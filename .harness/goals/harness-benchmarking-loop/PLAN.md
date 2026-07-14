# PLAN - harness-benchmarking-loop

Build the **benchmarking loop** (the harness's second goal path) beside the existing
build path (`/write-goal-prompt`), per the frozen spec. Trace every phase to:
`PRD.md` (this dir), root `CONTEXT.md` (glossary), `docs/adr/0001`-`0006`.

Parent brief: `.harness/goals/harness-benchmarking-loop/PRD.md`.
Canonical HARNESS spec: `.harness/goals/harness-benchmarking-loop/HARNESS.md`.

## Execution shape

**goal-loop** (Planner -> Maker -> Prover -> Checker), single-context repo. Reasoning
(`references/execution-mode-routing.md`): the deliverable is a set of durable artifacts
with a runnable smoke test (instant sweep), not a 50+ item fan-out and not a time-loop.
The *built feature itself* contains a nested dynamic-workflow shape (sweep/climb engines
mirror `.claude/workflows/red-team.js`), but authoring it is a normal goal-loop.

Constraints carried through every phase:
- Do NOT call paid external APIs (Parallel, Serper, ad platforms) unsupervised - all
  smoke tests use local/no-cost commands.
- Do NOT modify the build path's behaviour beyond adding the routing fork (P8).
- Do NOT run any lagging loop live - author + emit-stub + snapshot only (P7).
- Anti-gaming is non-negotiable: in-bounds + novelty checks run as agents SEPARATE from
  the inventor; measurement is exogenous.

## Phases

Canonical phase list (mirrored 1:1 to `issues/NN-<slug>.md`). Dependency-first order;
front-load P1-P2-P6 which unblock the rest.

- **P1 - benchmark-intake reference.** `skills/write-goal-prompt/references/benchmark-intake.md`.
  The lazy grill branch capturing the spec: `benchmark` (metric+direction±target,
  incl. rule-derived frozen-rubric path) · `measurement` (instant|lagging +settle_window)
  · `search` (sweep candidates | climb {levers, invariants}) · `stop`
  (target?/plateau/budget). Blocked by: none. Traces ADR-0001/0002/0003/0004/0006.
- **P2 - ledger + snapshot + registry schemas.** `.harness/loops/README.md` (loop
  registry), `docs/benchmarking/variant-ledger.md`, `docs/benchmarking/snapshot-store.md`.
  Blocked by: none. Traces ADR-0003 (ledger), ADR-0005 (template/snapshot).
- **P3 - `/benchmarking-loop` command.** `.claude/commands/benchmarking-loop.md`. Thin
  router: fresh spec | template name | `--resume <run-id>`. Blocked by: P1, P2.
  Traces ADR-0004, ADR-0005.
- **P4 - sweep engine.** `.claude/workflows/benchmark-sweep.js` (Workflow-DSL, mirrors
  red-team.js). Run all N candidates -> measure each -> rank -> pick -> write ledger.
  Blocked by: P2. Traces ADR-0003 (sweep).
- **P5 - climb engine.** `.claude/workflows/benchmark-climb.js`. invent -> in-bounds
  check -> novelty check -> measure -> keep; explore/exploit + Pareto + ADR-0001 stop
  (first-of target/plateau/budget), returns best-so-far. Blocked by: P2, P6.
  Traces ADR-0001, ADR-0003.
- **P6 - independent checker roles.** `.claude/agents/harness-inbounds-checker.md`,
  `.claude/agents/harness-novelty-checker.md`. Fresh-context agent defs, reuse
  harness-checker discipline. Blocked by: none. Traces ADR-0003, ADR-0006.
- **P7 - measurement adapter contract.** `docs/benchmarking/measurement-adapter.md`
  (contract) + instant reference impl (`scripts/benchmark-adapters/instant.ts`) +
  lagging emit stub (`scripts/benchmark-adapters/lagging-emit.ts`). Instant =
  command->number; lagging = emit job to external orchestrator + snapshot resume
  (stubbed, NOT run live). Blocked by: P2. Traces ADR-0002.
- **P8 - routing / benchmark auto-detect.** Edits to
  `skills/write-goal-prompt/references/execution-mode-routing.md` + both front-door
  commands with offer-to-switch. Blocked by: P1, P3. Traces ADR-0004.
- **P9 - docs sync.** `CONTEXT.md` links, `README.md`, write-goal-prompt `SKILL.md`
  routing section. Blocked by: all. Traces PRD "In scope" 8.

## Maker routing

Per HARNESS.md MAKER_ROUTING: all phases are **direct** (harness plumbing; no existing
skill matches). Commit at each phase boundary. State a 1-3 sentence approach before
non-trivial code (`references/first-principles-generation.md`). Sweep/climb engines
mirror the `.claude/workflows/red-team.js` Workflow-DSL shape where it fits.

## Prover brief (running-app smoke test)

Feature intent: `/benchmarking-loop` runs a benchmark spec -> ranked result + written
variant ledger. Exercise the smallest instant **sweep** end-to-end: two fixed
candidates on a trivial local benchmark command (no paid API), through the P4 sweep
engine, against a checked-in fixture spec. Accept: ledger file contains both candidates
each with a numeric reward + a ranked winner line. No auth.

## Checker rubric (mean >= 3.5/5.0 to PASS)

Four dimensions (1-5), from HARNESS.md CHECKER_BRIEF:
1. **Spec fidelity** - artifacts implement ADR-0001..0006 exactly (stop condition,
   cadence, sweep/climb, invariants + 2 checks, template+snapshot, rule-derived
   guardrail). 5 = every ADR decision traceable; 1 = contradicts/omits.
2. **Anti-gaming integrity** - in-bounds + novelty run by agents separate from the
   inventor, fresh-context; measurement exogenous. 5 = separation airtight; 1 =
   inventor self-certifies.
3. **Runs end-to-end** - smoke sweep produces ranked winner + ledger (Prover = works);
   climb stop logic demonstrable. 5 = works; 1 = broken.
4. **Fits the existing harness** - slots beside the build path without breaking it;
   uses CONTEXT.md vocabulary; progressive-disclosure (intake lazy, SKILL.md lean).
   5 = clean fit; 1 = duplicates/regresses.

PASS threshold: mean >= 3.5/5.0 AND Prover = works AND mechanical gate green.

## Turn budget

Planner 1-5. Maker 6-70 (front-load P1-P2-P6). Reserve final turns for P9 + morning
report. Run under gnhf incrementally - each iteration is the next smallest verifiable
unit, not the whole build.

## Durable slices

Each phase mirrored in `issues/NN-<slug>.md` (schema: `references/issue-tracker.md`).
PLAN.md `## Phases` stays canonical; slices are the durable drive-list that survives
`/compact`. Maker updates each slice `Status:` in place.
