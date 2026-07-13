---
description: Run a benchmark spec through the benchmarking loop (sweep or climb) and write a ranked variant ledger
argument-hint: "[goal text | <template-name> | --resume <run-id>]"
---

# /benchmarking-loop

Thin front-door **router** for the benchmarking loop - the harness's second goal path,
slotted beside `/write-goal-prompt` (ADR-0004). It **runs** a frozen benchmark spec; it
does NOT re-author one. Authoring lives in the shared grill + the lazy
`skills/write-goal-prompt/references/benchmark-intake.md`.

Use the exact vocabulary of root `CONTEXT.md`. Trace every branch below to an ADR.

## Three invocation modes

Dispatch on `$ARGUMENTS`, first-match-wins:

| Mode | Argument grammar | What happens |
|---|---|---|
| **`--resume`** | `/benchmarking-loop --resume <run-id>` | Warm-start from the snapshot store. |
| **template** | `/benchmarking-loop <template-name>` (a kebab slug that resolves to `.harness/loops/<template-name>.json`) | Instantiate a saved template - fresh run. |
| **fresh** | `/benchmarking-loop [goal text]` (anything else, incl. empty) | Grill a new spec via `benchmark-intake.md`. |

### 1. Fresh spec (no arg matches a template / `--resume`)

Route into the **shared grill** and load
`skills/write-goal-prompt/references/benchmark-intake.md` lazily (ADR-0004 - a plain
build goal never loads it). Grill until all four spec sections are captured
(`benchmark` · `measurement` · `search` · `stop`); do not emit a partial spec.

- Auto-detect mis-routing (ADR-0004): if the goal names **no** measurable metric+direction
  (just "build X"), **offer to switch** to `/write-goal-prompt`. If a rule-derived rubric
  cannot be frozen (ADR-0006), it is a build goal with a quality gate, not a benchmark.
- Freeze the grilled answers into the spec JSON (schema: `benchmark-intake.md` "Emit").
- Assign a fresh `run_id` at run start (keys the snapshot store, ADR-0005).
- Offer to save the spec as a **template** (`.harness/loops/<name>.json`, ADR-0005).
- Then dispatch by `search.mode` (see **Dispatch** below).

### 2. Template name (`$ARGUMENTS` resolves to `.harness/loops/<name>.json`)

Read the named template from the loop registry (`.harness/loops/README.md`). A template
persists **spec only** - re-invoking starts a **fresh** optimization (ADR-0005).

- Load `.harness/loops/<template-name>.json`, take its `spec`.
- If the template declares `repoint`, gather those inputs from the user first, substitute.
- Assign a fresh `run_id` (templates omit it by construction).
- Dispatch by `search.mode`.

### 3. `--resume <run-id>` (warm-start from snapshot)

Reload the snapshot in place from `.harness/goals/<slug>/runs/<run-id>/` (schema:
`docs/benchmarking/snapshot-store.md`). Warm-start = continue, do not restart:

- Load `snapshot.json` + `spec.json` + `ledger.jsonl` + `best.json`.
- Terminal `status` (`plateau` / `target-hit` / `budget-exhausted` / `done`) returns
  best-so-far without new cycles. `settling` (a lagging run) waits on its external job.
- Otherwise the novelty check (ADR-0003) reads the resumed ledger so **known variants
  are skipped** - no measurement is re-spent - and the climb resumes from the best config
  at `cycles_done` (the plateau/budget counters read it so a resumed loop does not
  double-count).

## Dispatch (by `spec.search.mode`, ADR-0003)

- **`sweep`** -> the **sweep engine** `.claude/workflows/benchmark-sweep.js`:
  `bun .claude/workflows/benchmark-sweep.js <spec.json>`. Runs all N pre-declared
  candidates -> measures each via the instant adapter -> ranks by `benchmark.direction`
  -> picks the winner -> writes the variant ledger. No explore/exploit, no plateau; stop
  = candidate list exhausted (a `budget` cap still applies). Sweep skips both
  pre-measurement checks (candidates are fixed + pre-declared).
- **`climb`** -> the **climb engine** `.claude/workflows/benchmark-climb.js`: each cycle
  invents a variant, clears the two independent pre-measurement checks run by agents
  **other than the inventor** (`harness-inbounds-checker` in-bounds, then
  `harness-novelty-checker` novelty - anti-gaming is non-negotiable), measures, keeps
  improvements (Pareto), and halts on the **first of** target / plateau / budget
  (ADR-0001), always returning best-so-far.

Both engines write the append-only variant ledger (`docs/benchmarking/variant-ledger.md`)
plus `best.json` + `snapshot.json` under the run directory. Measurement is **exogenous**
(the reward comes from the benchmark command / external orchestrator, never the model).

## Cadence note (ADR-0002)

The `measurement.cadence` field selects where the loop runs, not a different loop:

- **instant** - runs in-session (the sweep smoke test is instant).
- **lagging** - does NOT run in-session. The loop **emits** a scheduled job to an
  external orchestrator (n8n / trigger.dev / Hermes) carrying the `settle_window` +
  persisted state and resumes across time via `--resume` (ADR-0005). Under unsupervised
  builds a lagging loop is **authored + emit-stub + snapshot only** - never run live.

## Related

- Spec intake: `skills/write-goal-prompt/references/benchmark-intake.md`
- Engines: `.claude/workflows/benchmark-sweep.js`, `.claude/workflows/benchmark-climb.js`
- Independent checkers: `.claude/agents/harness-inbounds-checker.md`,
  `.claude/agents/harness-novelty-checker.md`
- Registry / snapshot / ledger: `.harness/loops/README.md`,
  `docs/benchmarking/snapshot-store.md`, `docs/benchmarking/variant-ledger.md`
- Adapter contract: `docs/benchmarking/measurement-adapter.md`
- ADRs: `docs/adr/0001`-`0006`. Glossary: root `CONTEXT.md`.
