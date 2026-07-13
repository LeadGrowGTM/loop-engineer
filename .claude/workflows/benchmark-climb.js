// Benchmark climb engine (P5). ADR-0003 climb branch + ADR-0001 stop condition.
//
// Open-ended search: each cycle INVENTS a new variant over the declared levers, clears two
// pre-measurement checks run by agents OTHER than the inventor (in-bounds, then novelty),
// MEASURES the survivor exogenously, and KEEPS it if it improves (Pareto). The loop halts on
// the FIRST-OF(target / plateau / budget) and always returns the best-so-far config.
//
// Three entry shapes, mirroring red-team.js + benchmark-sweep.js's import-clean discipline:
//   1. `import()` as a module -> defines meta + pure helpers, runs NOTHING (neither guard at
//      the bottom fires). This is the parse check the mechanical gate runs.
//   2. Under the Workflow executor (globals `phase`/`agent`/`parallel`/`log`/`args` injected)
//      -> run() drives the live climb: invent -> in-bounds -> novelty -> measure -> keep.
//   3. `bun .claude/workflows/benchmark-climb.js --selftest` -> runs the STOP-LOGIC demo: a
//      scripted trace that trips target, plateau, and budget in turn using ONLY the pure
//      functions - no agents, no paid APIs. This is the "stop logic demonstrable" acceptance
//      criterion (issue 05), runnable with zero cost.
//
// Anti-gaming (ADR-0003, non-negotiable): the inventor never certifies its own variant. The
// in-bounds and novelty verdicts come from harness-inbounds-checker / harness-novelty-checker,
// fresh-context agents with no view of the inventor's reasoning. A VIOLATION or DUPLICATE kills
// the variant BEFORE any measurement and does NOT count as a cycle. Measurement is exogenous:
// the reward comes from the benchmark command / external orchestrator, never from a model's
// judgement.

export const meta = {
  name: 'benchmark-climb',
  description:
    'Climb engine: invent a variant over declared levers, clear an independent in-bounds check then a novelty check (agents separate from the inventor), measure exogenously, keep improvements (Pareto), and halt on first-of(target/plateau/budget) returning best-so-far. The climb branch of the benchmarking loop (ADR-0001/0003).',
  whenToUse:
    'A benchmark spec whose search.mode is "climb" - an open-ended space (email reply-rate copy, prompt tuning) with declared levers + invariants. For a fixed candidate set use the sweep engine (benchmark-sweep.js).',
  phases: [{ title: 'Climb' }],
};

// ───────────────────────── structured-output schemas (the agents) ─────────────────────────

// The inventor proposes a config over the declared levers only. Its rationale is deliberately
// NOT part of what the checkers see (anti-gaming) - only the config crosses the seam.
const VARIANT_SCHEMA = {
  type: 'object',
  required: ['config'],
  properties: {
    config: { type: 'object', description: 'lever -> value; touches ONLY declared levers' },
    rationale: { type: 'string', description: 'inventor-private; never shown to the checkers' },
  },
};

const INBOUNDS_SCHEMA = {
  type: 'object',
  required: ['verdict'],
  properties: {
    verdict: { type: 'string', enum: ['in-bounds', 'violation'] },
    cited_invariant: { type: ['string', 'null'] },
    evidence: { type: 'string' },
  },
};

const NOVELTY_SCHEMA = {
  type: 'object',
  required: ['verdict'],
  properties: {
    verdict: { type: 'string', enum: ['novel', 'duplicate'] },
    closest_variant_id: { type: ['string', 'null'] },
    evidence: { type: 'string' },
  },
};

// ───────────────────────── pure helpers (unit-runnable, model-free) ─────────────────────────

export function variantId(cycle) {
  return `v${String(cycle).padStart(4, '0')}`;
}

// Is reward `a` strictly better than `b` under the spec direction? null is never better.
export function isBetter(a, b, direction) {
  if (!Number.isFinite(a)) return false;
  if (!Number.isFinite(b)) return true;
  return direction === 'minimize' ? a < b : a > b;
}

// Best-so-far entry among kept + settled variants (ADR-0001: always returnable).
export function bestSoFar(ledger, direction) {
  let best = null;
  for (const e of ledger) {
    if (!e.kept || !e.measurement?.settled) continue;
    if (!Number.isFinite(e.measurement.reward)) continue;
    if (best === null || isBetter(e.measurement.reward, best.measurement.reward, direction)) best = e;
  }
  return best;
}

// Deterministic explore/exploit schedule (ADR-0003). No Math.random (unavailable + non-repro):
// explore (invent from scratch) every `exploreEvery`-th cycle or while there is no best yet;
// otherwise exploit (mutate the best-so-far). Deterministic keeps the loop reproducible.
export function selectStrategy(cycle, hasBest, exploreEvery = 3) {
  if (!hasBest) return 'explore';
  return cycle % exploreEvery === 0 ? 'explore' : 'exploit';
}

// Pareto-keep on (reward, cost). Keep the candidate unless an already-kept variant DOMINATES
// it: at least as good on reward under `direction` AND no more expensive, with a strict edge on
// one axis. A candidate that is a new best on reward is always kept.
export function paretoKeep(candidate, keptEntries, direction) {
  const cReward = candidate.reward;
  const cCost = Number.isFinite(candidate.cost) ? candidate.cost : 0;
  if (!Number.isFinite(cReward)) return false;
  for (const e of keptEntries) {
    const eReward = e.measurement?.reward;
    const eCost = Number.isFinite(e.measurement?.cost_usd) ? e.measurement.cost_usd : 0;
    if (!Number.isFinite(eReward)) continue;
    const rewardAtLeast = direction === 'minimize' ? eReward <= cReward : eReward >= cReward;
    const costAtMost = eCost <= cCost;
    const strictReward = direction === 'minimize' ? eReward < cReward : eReward > cReward;
    const strictCost = eCost < cCost;
    if (rewardAtLeast && costAtMost && (strictReward || strictCost)) return false; // dominated
  }
  return true;
}

// First-of(target / plateau / budget) - ADR-0001. Evaluated every cycle; halts on the first to
// trip. `state`: { cyclesDone, bestReward, spendUsd, noImproveStreak }. Returns { halt, reason }.
export function evaluateStop(state, spec) {
  const direction = spec?.benchmark?.direction ?? 'maximize';
  const stop = spec?.stop ?? {};

  // 1. target - the metric crossed its declared bar (open-ended benchmarks omit target).
  const targetValue = stop.target?.value;
  if (Number.isFinite(targetValue) && Number.isFinite(state.bestReward)) {
    const hit = direction === 'minimize' ? state.bestReward <= targetValue : state.bestReward >= targetValue;
    if (hit) return { halt: true, reason: 'target' };
  }

  // 2. budget - a cycle-count or spend cap was reached.
  const maxCycles = stop.budget?.max_cycles;
  if (Number.isFinite(maxCycles) && state.cyclesDone >= maxCycles) return { halt: true, reason: 'budget' };
  const maxSpend = stop.budget?.max_spend_usd;
  if (Number.isFinite(maxSpend) && Number.isFinite(state.spendUsd) && state.spendUsd >= maxSpend)
    return { halt: true, reason: 'budget' };

  // 3. plateau - N cycles with best-so-far improvement below the threshold (default 3).
  const plateauCycles = stop.plateau?.cycles ?? 3;
  if (Number.isFinite(plateauCycles) && state.noImproveStreak >= plateauCycles)
    return { halt: true, reason: 'plateau' };

  return { halt: false, reason: null };
}

// Did this cycle's reward improve best-so-far by at least min_gain? Drives the plateau streak.
export function isImprovement(reward, prevBest, spec) {
  const direction = spec?.benchmark?.direction ?? 'maximize';
  const minGain = spec?.stop?.plateau?.min_gain ?? 0;
  if (!Number.isFinite(reward)) return false;
  if (!Number.isFinite(prevBest)) return true;
  const gain = direction === 'minimize' ? prevBest - reward : reward - prevBest;
  return gain >= minGain && (direction === 'minimize' ? reward < prevBest : reward > prevBest);
}

// One ledger line for a climb variant (schema: docs/benchmarking/variant-ledger.md).
export function climbLedgerEntry({ cycle, config, inbounds, novelty, reward, unit, cost, source, kept, killed }) {
  return {
    variant_id: variantId(cycle),
    cycle,
    search_mode: 'climb',
    config,
    candidate_label: null,
    checks: {
      in_bounds: {
        verdict: inbounds?.verdict ?? 'n/a',
        by: 'harness-inbounds-checker',
        cited_invariant: inbounds?.cited_invariant ?? null,
      },
      novelty: {
        verdict: novelty?.verdict ?? 'n/a',
        by: 'harness-novelty-checker',
        closest_variant_id: novelty?.closest_variant_id ?? null,
      },
    },
    measurement: {
      cadence: 'instant',
      reward: killed ? null : reward ?? null,
      unit: unit ?? 'reward',
      cost_usd: killed ? 0.0 : cost ?? 0.0,
      source: killed ? null : source ?? null,
      measured_at_cycle: killed ? null : cycle,
      settled: !killed,
    },
    kept: !!kept,
    is_best_so_far: false,
  };
}

// ───────────────────────── agent briefs (used only inside run()) ─────────────────────────

function inventBrief(spec, strategy, best) {
  const levers = JSON.stringify(spec?.search?.levers ?? [], null, 2);
  const invariants = JSON.stringify(spec?.search?.invariants ?? [], null, 2);
  const anchor =
    strategy === 'exploit' && best
      ? `EXPLOIT: mutate the current best config (below) along ONE lever to try to beat it.\nBest so far: ${JSON.stringify(best.config)}`
      : 'EXPLORE: propose a config that opens a genuinely different region of the space.';
  return `You are the variant inventor in a benchmarking climb loop. Propose ONE new variant.

Benchmark: ${spec?.benchmark?.metric} (${spec?.benchmark?.direction}).
Declared LEVERS (the only things you may change):
${levers}
Declared INVARIANTS (must stay fixed - changing any is a VIOLATION that will be killed):
${invariants}

Strategy this cycle - ${anchor}

Return ONLY a config object touching declared levers. A separate in-bounds checker will diff
your config against the invariants; it never sees this reasoning, so do not argue in-bounds-ness
here - just keep the invariants fixed.`;
}

function inboundsBrief(spec, config) {
  return `Diff this proposed variant config against the spec invariants and return your binary verdict.

spec.search.invariants: ${JSON.stringify(spec?.search?.invariants ?? [])}
spec.search.levers: ${JSON.stringify(spec?.search?.levers ?? [])}
Proposed config (the variant only - no inventor notes): ${JSON.stringify(config)}

Follow your agent brief. Default to VIOLATION when uncertain.`;
}

function noveltyBrief(spec, config, ledgerPath) {
  return `Diff this proposed variant config against every entry in the variant ledger and return your binary verdict.

Ledger: ${ledgerPath}
spec.search.levers: ${JSON.stringify(spec?.search?.levers ?? [])}
Proposed config: ${JSON.stringify(config)}

Follow your agent brief. Novelty is about the config, not its reward.`;
}

// Exogenous measurement brief: an agent runs the spec's benchmark command and returns ONLY the
// numeric reward from its stdout. The number comes from the command, never from judgement - so
// the score stays exogenous. (For a fixed instant command this is the same contract as
// benchmark-sweep.js's measureInstant; the formal adapter is P7.)
function measureBrief(spec, config) {
  return `Run the benchmark command for this variant and report ONLY the numeric reward it prints.

measurement.command (substitute the config where templated): ${spec?.measurement?.command}
Variant config: ${JSON.stringify(config)}

Run the command, read its stdout, and return the last numeric token as the reward. Do NOT invent,
estimate, or adjust the number - report exactly what the command emitted. If it prints no number,
return reward null.`;
}

const REWARD_SCHEMA = {
  type: 'object',
  required: ['reward'],
  properties: {
    reward: { type: ['number', 'null'] },
    cost_usd: { type: ['number', 'null'] },
    source: { type: 'string' },
  },
};

// ───────────────────────── orchestration (Workflow executor only) ─────────────────────────
// Every executor global (phase/agent/log/args) is referenced ONLY inside run(), so a bare
// import() defines this and returns without touching them.
export async function run() {
  const a = typeof args !== 'undefined' ? args || {} : {};
  const spec = a.spec;
  if (!spec || spec?.search?.mode !== 'climb') {
    throw new Error('benchmark-climb requires args.spec with search.mode "climb".');
  }
  const direction = spec?.benchmark?.direction ?? 'maximize';
  const unit = spec?.benchmark?.metric ?? 'reward';
  const ledgerPath = a.ledgerPath ?? `.harness/goals/${spec.slug ?? 'adhoc'}/runs/${spec.run_id ?? 'climb'}/ledger.jsonl`;
  const exploreEvery = spec?.search?.explore_every ?? 3;

  phase('Climb');
  const ledger = [];
  let cyclesDone = a.resumeCyclesDone ?? 0; // resumed runs carry forward (ADR-0005)
  let spendUsd = 0;
  let noImproveStreak = 0;

  // Guard against runaway invention when neither budget nor plateau can trip.
  const hardCap = spec?.stop?.budget?.max_cycles ?? 50;

  while (true) {
    const best = bestSoFar(ledger, direction);
    const stop = evaluateStop({ cyclesDone, bestReward: best?.measurement?.reward, spendUsd, noImproveStreak }, spec);
    if (stop.halt) {
      log(`climb: halt on ${stop.reason} after ${cyclesDone} cycle(s); best=${best?.variant_id ?? 'none'}`);
      break;
    }
    if (cyclesDone >= hardCap) {
      log(`climb: hard cap ${hardCap} reached (no stop tripped) - halting`);
      break;
    }

    // ── Invent (the inventor - NOT the checker) ──
    const strategy = selectStrategy(cyclesDone + 1, !!best, exploreEvery);
    const invented = await agent(inventBrief(spec, strategy, best), {
      label: `invent:c${cyclesDone + 1}`,
      phase: 'Climb',
      schema: VARIANT_SCHEMA,
    });
    const config = invented?.config ?? {};
    const nextId = ledger.length + 1; // ledger-line number (killed variants still get a line)

    // ── In-bounds check (agent SEPARATE from the inventor) - kill before measurement ──
    const inbounds = await agent(inboundsBrief(spec, config), {
      label: `inbounds:c${cyclesDone + 1}`,
      phase: 'Climb',
      schema: INBOUNDS_SCHEMA,
      agentType: 'harness-inbounds-checker',
    });
    if (inbounds?.verdict === 'violation') {
      ledger.push(climbLedgerEntry({ cycle: nextId, config, inbounds, novelty: null, killed: true, kept: false, unit }));
      log(`climb: variant killed (in-bounds VIOLATION: ${inbounds.cited_invariant}) - not counted as a cycle`);
      continue; // killed pre-measurement, does NOT count as a cycle (ADR-0003)
    }

    // ── Novelty check (agent SEPARATE from the inventor) - reject dup before measurement ──
    const novelty = await agent(noveltyBrief(spec, config, ledgerPath), {
      label: `novelty:c${cyclesDone + 1}`,
      phase: 'Climb',
      schema: NOVELTY_SCHEMA,
      agentType: 'harness-novelty-checker',
    });
    if (novelty?.verdict === 'duplicate') {
      ledger.push(climbLedgerEntry({ cycle: nextId, config, inbounds, novelty, killed: true, kept: false, unit }));
      log(`climb: variant rejected (DUPLICATE of ${novelty.closest_variant_id}) - not counted as a cycle`);
      continue; // rejected pre-measurement, does NOT count as a cycle (ADR-0003)
    }

    // ── Measure (exogenous) - only survivors of both checks reach here ──
    const measured = await agent(measureBrief(spec, config), {
      label: `measure:c${cyclesDone + 1}`,
      phase: 'Climb',
      schema: REWARD_SCHEMA,
    });
    const reward = Number.isFinite(measured?.reward) ? measured.reward : null;
    const cost = Number.isFinite(measured?.cost_usd) ? measured.cost_usd : 0;

    // ── Keep (Pareto) ──
    const keptEntries = ledger.filter((e) => e.kept);
    const kept = paretoKeep({ reward, cost }, keptEntries, direction);
    const entry = climbLedgerEntry({
      cycle: nextId,
      config,
      inbounds,
      novelty,
      reward,
      unit,
      cost,
      source: measured?.source ?? spec?.measurement?.command,
      kept,
      killed: false,
    });
    ledger.push(entry);

    // A measured variant counts as a cycle; update plateau streak + spend against best-BEFORE.
    const prevBest = best?.measurement?.reward;
    noImproveStreak = isImprovement(reward, prevBest, spec) ? 0 : noImproveStreak + 1;
    spendUsd += cost;
    cyclesDone += 1;
  }

  const best = bestSoFar(ledger, direction);
  if (best) best.is_best_so_far = true;
  return {
    best: best ? { variant_id: best.variant_id, reward: best.measurement.reward, unit, config: best.config } : null,
    cycles_done: cyclesDone,
    variants_tried: ledger.length,
    ledger,
  };
}

// ───────────────────────── stop-logic demo (CLI --selftest) ─────────────────────────
// Exercises the pure stop/keep/select functions on scripted state - NO agents, NO paid API - so
// the first-of(target/plateau/budget) logic is demonstrable at zero cost (issue 05 acceptance).
export function demoStopLogic() {
  const out = [];
  const ok = (name, cond) => out.push(`${cond ? 'PASS' : 'FAIL'}  ${name}`);

  // target trips: maximize, best 0.09 crosses bar 0.08.
  const targetSpec = { benchmark: { direction: 'maximize' }, stop: { target: { value: 0.08 }, plateau: { cycles: 3 }, budget: { max_cycles: 20 } } };
  ok('target trips when best crosses the bar', evaluateStop({ cyclesDone: 4, bestReward: 0.09, spendUsd: 0, noImproveStreak: 0 }, targetSpec).reason === 'target');
  ok('target does NOT trip below the bar', evaluateStop({ cyclesDone: 4, bestReward: 0.05, spendUsd: 0, noImproveStreak: 0 }, targetSpec).halt === false);

  // budget trips: cycle cap reached before target/plateau.
  const budgetSpec = { benchmark: { direction: 'maximize' }, stop: { plateau: { cycles: 5 }, budget: { max_cycles: 10 } } };
  ok('budget trips at the cycle cap', evaluateStop({ cyclesDone: 10, bestReward: 0.03, spendUsd: 0, noImproveStreak: 2 }, budgetSpec).reason === 'budget');
  ok('budget trips at the spend cap', evaluateStop({ cyclesDone: 2, bestReward: 0.03, spendUsd: 5.0, noImproveStreak: 0 }, { benchmark: { direction: 'maximize' }, stop: { budget: { max_spend_usd: 5.0 } } }).reason === 'budget');

  // plateau trips: N no-improve cycles, no target/budget hit.
  const plateauSpec = { benchmark: { direction: 'maximize' }, stop: { plateau: { cycles: 3, min_gain: 0.01 }, budget: { max_cycles: 100 } } };
  ok('plateau trips after N no-improve cycles', evaluateStop({ cyclesDone: 7, bestReward: 0.06, spendUsd: 0, noImproveStreak: 3 }, plateauSpec).reason === 'plateau');
  ok('no halt while still improving under budget', evaluateStop({ cyclesDone: 7, bestReward: 0.06, spendUsd: 0, noImproveStreak: 1 }, plateauSpec).halt === false);

  // first-of ordering: target beats budget when both would trip the same cycle.
  ok('first-of prefers target over a co-tripping budget', evaluateStop({ cyclesDone: 20, bestReward: 0.09, spendUsd: 0, noImproveStreak: 0 }, targetSpec).reason === 'target');

  // improvement + plateau-streak semantics (minimize).
  ok('minimize: lower reward is an improvement', isImprovement(0.04, 0.06, { benchmark: { direction: 'minimize' }, stop: { plateau: { min_gain: 0.005 } } }) === true);
  ok('sub-min_gain change is NOT an improvement', isImprovement(0.059, 0.06, { benchmark: { direction: 'maximize' }, stop: { plateau: { min_gain: 0.01 } } }) === false);

  // Pareto keep: a cheaper, equal-reward incumbent dominates a pricier newcomer.
  ok('Pareto: dominated (worse reward, higher cost) not kept', paretoKeep({ reward: 0.05, cost: 0.2 }, [{ measurement: { reward: 0.07, cost_usd: 0.1 } }], 'maximize') === false);
  ok('Pareto: new best reward always kept', paretoKeep({ reward: 0.09, cost: 0.3 }, [{ measurement: { reward: 0.07, cost_usd: 0.1 } }], 'maximize') === true);

  // explore/exploit schedule is deterministic.
  ok('explore when no best yet', selectStrategy(1, false, 3) === 'explore');
  ok('exploit on a non-explore cycle', selectStrategy(2, true, 3) === 'exploit');
  ok('explore every 3rd cycle', selectStrategy(3, true, 3) === 'explore');

  // best-so-far ignores killed + unsettled variants.
  const led = [
    climbLedgerEntry({ cycle: 1, config: {}, reward: 0.05, kept: true, killed: false, unit: 'r' }),
    climbLedgerEntry({ cycle: 2, config: {}, inbounds: { verdict: 'violation' }, killed: true, kept: false, unit: 'r' }),
    climbLedgerEntry({ cycle: 3, config: {}, reward: 0.08, kept: true, killed: false, unit: 'r' }),
  ];
  ok('best-so-far picks the top kept+settled variant', bestSoFar(led, 'maximize')?.variant_id === 'v0003');

  const passed = out.filter((l) => l.startsWith('PASS')).length;
  const failed = out.filter((l) => l.startsWith('FAIL')).length;
  out.forEach((l) => console.log(l));
  console.log(`\nclimb stop-logic demo: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

// ───────────────────────── guarded auto-invoke ─────────────────────────
// Under the Workflow executor the globals are injected -> drive the live climb. On a bare
// `bun benchmark-climb.js --selftest` run the pure stop-logic demo. On a bare import() neither
// fires, so the module loads clean - the mechanical-gate parse check.
if (typeof phase !== 'undefined' && typeof agent !== 'undefined' && typeof parallel !== 'undefined') {
  await run();
} else if (import.meta.main) {
  const okDemo = demoStopLogic();
  if (!okDemo) process.exit(1);
}
