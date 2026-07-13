# HARNESS.md - harness-benchmarking-loop

Build target: the benchmarking loop (second goal path). Spec is frozen in
`PRD.md` + root `CONTEXT.md` + `docs/adr/0001`-`0006`. Do NOT re-decide settled
questions - trace every phase to those docs.

## PLANNER_BRIEF

Read first, in order:
1. `.harness/goals/harness-benchmarking-loop/PRD.md` (the brief).
2. Root `CONTEXT.md` (glossary - the ubiquitous language; use these exact terms).
3. `docs/adr/0001`-`0006` (the six frozen decisions).
4. `skills/write-goal-prompt/SKILL.md` + `references/execution-mode-routing.md`
   (the existing build path this must slot beside, not replace).
5. `references/first-principles-generation.md`, `references/issue-tracker.md`.

Phases (mirror each to `issues/NN-<slug>.md`, PLAN.md `## Phases` canonical).
Suggested ordering (dependency-first; Planner may refine but keep the deps):
- P1 `benchmark-intake.md` reference (the lazy grill branch + spec schema). No deps.
- P2 Variant ledger + snapshot store + loop registry schemas. No deps.
- P3 `/benchmarking-loop` command (thin router: fresh spec | template | --resume).
  Blocked by P1, P2.
- P4 Sweep engine (run-all candidates → rank → pick; ledger write). Blocked by P2.
- P5 Climb engine (invent → in-bounds check → novelty check → measure → keep;
  explore/exploit + Pareto + ADR-0001 stop). Blocked by P2, P6.
- P6 Independent checker roles: in-bounds checker + novelty checker (fresh-context
  agent defs, reuse harness-checker discipline). No deps.
- P7 Measurement adapter contract: instant (command→number) + lagging (emit job to
  external orchestrator + snapshot resume). Blocked by P2.
- P8 Routing: benchmark auto-detect wired into `execution-mode-routing.md` + both
  front-door commands + offer-to-switch. Blocked by P1, P3.
- P9 Docs sync: CONTEXT.md links, README, write-goal-prompt SKILL.md routing section.
  Blocked by all.

Turn split: Planner 1-5. Maker 6-70 (9 phases, ~7 turns each; front-load P1-P2-P6
which unblock the rest). Reserve final turns for P9 + morning report.

## MAKER_ROUTING

- Phase 1: direct - `skills/write-goal-prompt/references/benchmark-intake.md`
- Phase 2: direct - schema docs under `docs/` + `.harness/loops/README.md` (registry),
  ledger/snapshot schema (reuse `.claude/state/` SQLite if it fits P7's needs).
- Phase 3: direct - `.claude/commands/benchmarking-loop.md` (or skill wrapper).
- Phase 4: direct - sweep engine (`.claude/workflows/` or `scripts/`, TS/bun; mirror
  red-team.js's Workflow-DSL sweep shape where it fits).
- Phase 5: direct - climb engine (same location as P4).
- Phase 6: direct - `.claude/agents/harness-inbounds-checker.md`,
  `.claude/agents/harness-novelty-checker.md`.
- Phase 7: direct - adapter contract doc + reference impl (instant), lagging emit stub.
- Phase 8: direct - edits to `references/execution-mode-routing.md` + command routers.
- Phase 9: direct - doc edits (CONTEXT.md, README.md, SKILL.md).

Prefer `direct` - this is harness plumbing; no existing skill matches. Commit at each
phase boundary. State a 1-3 sentence approach before non-trivial code
(`first-principles-generation.md`).

## PROVER_BRIEF

Feature intent: `/benchmarking-loop` runs a benchmark spec and produces a ranked
result + a written variant ledger.
How to exercise: run the smallest instant **sweep** end-to-end - two fixed candidates
on a trivial benchmark command (e.g. two echo/latency commands, no paid API), through
the sweep engine (P4). Command form: `bun <sweep-runner> <spec.json>` or the
`/benchmarking-loop` router against a checked-in fixture spec.
Auth: none (use a local/no-cost benchmark command for the smoke test; do NOT call paid
APIs unsupervised).
Accept criteria: the run writes a variant ledger file containing both candidates each
with a numeric reward, and emits a ranked winner. Paste the ledger contents + the
picked winner line as proof.

## REDTEAM_BRIEF

N/A - internal developer tooling, not a user-facing or security-sensitive shipped
surface. (Note: the feature's *own* invariant-enforcement is exercised by the
in-bounds checker built in P6 - that is a functional test inside the build, not a
red-team target.)

## CHECKER_BRIEF

Artifacts to evaluate: `references/benchmark-intake.md`, the `/benchmarking-loop`
command, sweep + climb engines, the two checker agent defs, ledger/snapshot/registry
schemas, routing edits, doc sync.
Rubric dimensions (1-5):
1. **Spec fidelity** - do the artifacts implement ADR-0001..0006 exactly (stop
   condition, cadence, sweep/climb, invariants+2 checks, template+snapshot,
   rule-derived guardrail)? 5 = every ADR decision traceable in code/docs; 1 =
   contradicts or omits ADRs.
2. **Anti-gaming integrity** - are in-bounds + novelty checks run by agents separate
   from the inventor, fresh-context, and is the measurement exogenous? 5 = separation
   airtight; 1 = inventor self-certifies.
3. **Runs end-to-end** - does the smoke sweep actually produce a ranked winner +
   ledger (Prover PROOF = works)? 5 = works + climb stop logic demonstrable; 1 = broken.
4. **Fits the existing harness** - slots beside the build path without breaking it;
   uses CONTEXT.md vocabulary; progressive-disclosure (intake is a lazy reference,
   SKILL.md stays lean). 5 = clean fit; 1 = duplicates/regresses the build path.
PASS threshold: mean >= 3.5/5.0 AND Prover = works AND mechanical gate green.

## LOOP_TRACKER

## Loop Tracker
> Update as you complete each step. Check off in order.

### Planner
- [ ] HARNESS.md read
- [ ] PRD.md + CONTEXT.md + ADRs 0001-0006 read
- [ ] PLAN.md written + issues/NN slices mirrored

### Cycle 1
- [ ] Maker P1 benchmark-intake.md - commit `<SHA>`
- [ ] Maker P2 ledger/snapshot/registry schemas - commit `<SHA>`
- [ ] Maker P6 in-bounds + novelty checker agents - commit `<SHA>`
- [ ] Maker P3 /benchmarking-loop command - commit `<SHA>`
- [ ] Maker P4 sweep engine - commit `<SHA>`
- [ ] Maker P5 climb engine - commit `<SHA>`
- [ ] Maker P7 measurement adapter - commit `<SHA>`
- [ ] Maker P8 routing/auto-detect - commit `<SHA>`
- [ ] Maker P9 docs sync - commit `<SHA>`
- [ ] Mechanical gate: passed
- [ ] Prover: PROOF VERDICT - Feature: works | broken (smoke sweep)
- [ ] Checker: CYCLE_LOG.md written
- [ ] Reward: __/5.0 (threshold 3.5)
- [ ] Verdict: PASS / ITERATE / PLATEAU

### Cycle 2 (if ITERATE)
- [ ] Fix target: <weakest dimension from Cycle 1>
- [ ] Maker: changes applied - commit `<SHA>`
- [ ] Mechanical gate: passed
- [ ] Prover: PROOF VERDICT - works | broken
- [ ] Checker: CYCLE_LOG.md updated
- [ ] Reward: __/5.0
- [ ] Verdict: PASS / ITERATE / PLATEAU

### Cycle 3 (if ITERATE again)
- [ ] Fix target: <weakest dimension from Cycle 2>
- [ ] Maker: changes applied - commit `<SHA>`
- [ ] Mechanical gate: passed
- [ ] Prover: PROOF VERDICT - works | broken
- [ ] Checker: CYCLE_LOG.md updated
- [ ] Reward: __/5.0
- [ ] Verdict: PASS / PLATEAU (max cycles)

### Final
- [ ] HANDOFF.md + .html + .excalidraw written
- [ ] HANDOFF.html published (lavish-axi) - URL atop HANDOFF.md
