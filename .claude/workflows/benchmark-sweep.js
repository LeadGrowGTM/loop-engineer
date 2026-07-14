// Benchmark sweep engine (P4). ADR-0003 sweep branch: a finite, pre-declared candidate
// set -> measure each via the instant adapter -> rank by reward -> pick the winner ->
// write the variant ledger (docs/benchmarking/variant-ledger.md). No explore/exploit, no
// plateau; the stop condition is "candidate list exhausted" (a budget cap still applies).
//
// Two entry shapes, mirroring red-team.js's import-clean discipline:
//   1. `import()` as a module -> defines meta + pure helpers, runs NOTHING (guarded at
//      the bottom by `import.meta.main`). This is the parse check the mechanical gate runs.
//   2. `bun .claude/workflows/benchmark-sweep.js <spec.json>` -> runs the sweep end-to-end
//      and writes the ledger. This is what the Prover smoke test drives.
//
// Measurement here is the INSTANT adapter inline (command -> stdout -> number). The formal
// adapter contract + reference impl is P7 (docs/benchmarking/measurement-adapter.md); this
// engine will import it once it lands. Until then the inline `measureInstant` is the same
// command->number contract, kept minimal and exogenous (the reward comes from the command's
// stdout, never from the model).

import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const meta = {
  name: 'benchmark-sweep',
  description:
    'Sweep engine: run a finite candidate set through an instant benchmark command, rank by reward, pick the winner, and write the variant ledger. The sweep branch of the benchmarking loop (ADR-0003).',
  whenToUse:
    'A benchmark spec whose search.mode is "sweep" - a fixed, pre-declared candidate set (provider bake-off, config comparison). For open-ended search use the climb engine (P5).',
};

// ───────────────────────── pure helpers ─────────────────────────

// A candidate is either a bare string (used as both label and {candidate} substitution)
// or an object { label, command? }. An explicit command overrides the spec's templated one.
export function normalizeCandidate(c, i) {
  if (typeof c === 'string') return { label: c, command: null };
  if (c && typeof c === 'object') return { label: c.label ?? `candidate-${i}`, command: c.command ?? null };
  throw new Error(`sweep: candidate ${i} must be a string or {label, command} object`);
}

// Resolve the shell command for one candidate. Explicit candidate.command wins; else the
// spec's measurement.command with `{candidate}` substituted by the candidate label.
export function resolveCommand(spec, cand) {
  if (cand.command) return cand.command;
  const base = spec?.measurement?.command;
  if (!base) throw new Error(`sweep: no command for candidate "${cand.label}" (set measurement.command with {candidate}, or candidate.command)`);
  return base.includes('{candidate}') ? base.split('{candidate}').join(cand.label) : base;
}

// Exogenous instant measurement: run the command, parse the LAST numeric token of stdout
// as the reward. Deterministic and model-free - the number comes from outside the model.
export function parseReward(stdout) {
  const matches = String(stdout).match(/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g);
  if (!matches || matches.length === 0) return null;
  return Number(matches[matches.length - 1]);
}

// Rank kept entries by the spec direction. Returns entries sorted best-first.
export function rankByDirection(entries, direction) {
  const dir = direction === 'minimize' ? 1 : -1; // maximize => bigger first
  return [...entries]
    .filter((e) => Number.isFinite(e.measurement.reward))
    .sort((a, b) => dir * (a.measurement.reward - b.measurement.reward));
}

// One ledger line for a sweep candidate (schema: docs/benchmarking/variant-ledger.md).
function ledgerEntry({ i, cand, command, reward, unit, direction }) {
  return {
    variant_id: `v${String(i + 1).padStart(4, '0')}`,
    cycle: i + 1,
    search_mode: 'sweep',
    config: { candidate: cand.label },
    candidate_label: cand.label,
    checks: {
      // Sweep skips both pre-measurement checks: candidates are fixed + pre-declared.
      in_bounds: { verdict: 'n/a', by: 'harness-inbounds-checker', cited_invariant: null },
      novelty: { verdict: 'n/a', by: 'harness-novelty-checker', closest_variant_id: null },
    },
    measurement: {
      cadence: 'instant',
      reward,
      unit: unit ?? 'reward',
      cost_usd: 0.0,
      source: command,
      measured_at_cycle: i + 1,
      settled: true,
    },
    kept: Number.isFinite(reward),
    is_best_so_far: false,
  };
}

// ───────────────────────── measurement (instant adapter, inline) ─────────────────────────

export function measureInstant(command, { cwd } = {}) {
  const stdout = execSync(command, { cwd, encoding: 'utf8', shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const reward = parseReward(stdout);
  if (reward === null) throw new Error(`instant measurement produced no number for: ${command}\nstdout: ${stdout}`);
  return { reward, stdout };
}

// ───────────────────────── sweep run ─────────────────────────

// runSweep(spec, opts) -> { winner, ledger, runDir }. Pure of the CLI; callable + testable.
// opts.repoRoot roots the .harness/goals/<slug>/runs/<run_id>/ output dir (default cwd).
export function runSweep(spec, opts = {}) {
  if (!spec || typeof spec !== 'object') throw new Error('sweep: spec must be an object');
  if (spec?.search?.mode !== 'sweep') throw new Error(`sweep: expected search.mode "sweep", got "${spec?.search?.mode}"`);
  const candidates = spec?.search?.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) throw new Error('sweep: search.candidates must be a non-empty array');

  const repoRoot = opts.repoRoot ?? process.cwd();
  const slug = opts.slug ?? spec.slug ?? 'adhoc';
  const runId = spec.run_id ?? opts.runId ?? `sweep-${slug}`;
  const direction = spec?.benchmark?.direction ?? 'maximize';
  const unit = spec?.benchmark?.metric ?? 'reward';
  const budgetMax = spec?.stop?.budget?.max_cycles ?? Infinity;

  const runDir = join(repoRoot, '.harness', 'goals', slug, 'runs', runId);
  mkdirSync(runDir, { recursive: true });
  const ledgerPath = join(runDir, 'ledger.jsonl');
  writeFileSync(ledgerPath, ''); // fresh run: empty append-only ledger
  writeFileSync(join(runDir, 'spec.json'), JSON.stringify({ ...spec, run_id: runId }, null, 2));

  const ledger = [];
  const toRun = candidates.slice(0, Number.isFinite(budgetMax) ? budgetMax : candidates.length);
  for (let i = 0; i < toRun.length; i++) {
    const cand = normalizeCandidate(toRun[i], i);
    const command = resolveCommand(spec, cand);
    let reward = null;
    try {
      ({ reward } = measureInstant(command, { cwd: repoRoot }));
    } catch (err) {
      // A candidate that fails to measure is recorded with a null reward (not kept), so the
      // ledger stays a complete record of what was tried. The sweep continues.
      reward = null;
      log?.(`sweep: candidate "${cand.label}" measurement failed: ${err.message}`);
    }
    const entry = ledgerEntry({ i, cand, command, reward: reward ?? null, unit, direction });
    ledger.push(entry);
    appendFileSync(ledgerPath, JSON.stringify(entry) + '\n');
  }

  const ranked = rankByDirection(ledger, direction);
  const winner = ranked[0] ?? null;
  if (winner) {
    winner.is_best_so_far = true;
    // Rewrite ledger.jsonl so the winner's is_best_so_far flag persists (still append-only
    // in spirit: one canonical line per variant, winner flag set).
    writeFileSync(ledgerPath, ledger.map((e) => JSON.stringify(e)).join('\n') + '\n');
  }

  writeFileSync(
    join(runDir, 'best.json'),
    JSON.stringify(winner ? { variant_id: winner.variant_id, reward: winner.measurement.reward, unit, cycle: winner.cycle } : {}, null, 2),
  );
  writeFileSync(
    join(runDir, 'snapshot.json'),
    JSON.stringify(
      {
        run_id: runId,
        template: opts.template ?? null,
        status: 'done',
        search_mode: 'sweep',
        cadence: 'instant',
        cycles_done: ledger.length,
        best_variant_id: winner?.variant_id ?? null,
        best_reward: winner?.measurement.reward ?? null,
        created_at_cycle: 0,
      },
      null,
      2,
    ),
  );
  writeFileSync(join(runDir, 'ledger.md'), renderLedgerMd(spec, ledger, ranked, winner, unit, direction));

  return { winner, ledger, ranked, runDir };
}

function renderLedgerMd(spec, ledger, ranked, winner, unit, direction) {
  const lines = [];
  lines.push(`# Sweep ledger - ${spec?.benchmark?.metric ?? 'benchmark'} (${direction})`, '');
  lines.push('| rank | variant | candidate | reward | kept |', '|---|---|---|---|---|');
  ranked.forEach((e, i) => {
    lines.push(`| ${i + 1} | ${e.variant_id} | ${e.candidate_label} | ${e.measurement.reward} ${unit} | ${e.kept} |`);
  });
  const unmeasured = ledger.filter((e) => !Number.isFinite(e.measurement.reward));
  for (const e of unmeasured) lines.push(`| - | ${e.variant_id} | ${e.candidate_label} | (no number) | ${e.kept} |`);
  lines.push('', winner ? `**Winner: ${winner.candidate_label}** (${winner.variant_id}, ${winner.measurement.reward} ${unit})` : '**No winner: no candidate produced a number.**');
  return lines.join('\n') + '\n';
}

// ───────────────────────── CLI entry (guarded) ─────────────────────────
// import.meta.main is true ONLY when this file is the program's entry (bun/node ESM). On a
// bare `import()` it is false, so the module loads clean - the mechanical-gate parse check.
if (import.meta.main) {
  const specPath = process.argv[2];
  if (!specPath) {
    console.error('usage: bun .claude/workflows/benchmark-sweep.js <spec.json>');
    process.exit(2);
  }
  const spec = JSON.parse(readFileSync(specPath, 'utf8'));
  const { winner, ranked, runDir } = runSweep(spec, { repoRoot: process.cwd() });
  console.log(`\nSweep complete. Ledger: ${join(runDir, 'ledger.jsonl')}`);
  console.log('Ranked:');
  ranked.forEach((e, i) => console.log(`  ${i + 1}. ${e.candidate_label} (${e.variant_id}) = ${e.measurement.reward} ${e.measurement.unit}`));
  if (winner) console.log(`\nWINNER: ${winner.candidate_label} (${winner.variant_id}) = ${winner.measurement.reward} ${winner.measurement.unit}`);
  else { console.error('\nNo winner - no candidate produced a number.'); process.exit(1); }
}
