# Goal Brief — v1-3-0-metrics-grill

## Problem
Every goal run currently disappears without a number attached to it, so the "2 days of work in 2 hours" claim has no accumulating evidence, and specs freeze into unattended goals without anyone adversarially attacking the decisions inside them first.

## Success criteria (product-level)
- After any goal run, running `bun scripts/run-metrics.ts` from repo root prints one aligned table row per run under `.harness/goals/*/HANDOFF.md` (slug, started, wall_clock_minutes, turns_used, cycles_used, reward_final); a run that predates instrumentation (`taste-gate-v1-2-0`) shows as `taste-gate-v1-2-0  (no metrics)` instead of crashing the script.
- A goal author following `/write-goal-prompt`'s spec-mode branch (Branch S) hits a named "Grill gate" decision point in `spec-intake.md`, before the mapping table, that either adversarially attacks the spec's existing decisions one at a time or explicitly skips per a stated default — and never re-interviews the user for requirements the spec already answered.
- `loop-engineer` ships as v1.3.0: `claude plugin validate .` passes, and all 8 checks in the spec's verification plan pass when run exactly as written, pasted as proof.
- This run's own HANDOFF.md carries the new `## Run Metrics` section it just built — the harness eats its own dogfood as the first real datapoint.

## Out of scope
- Learning write-back (still v1.4, blocked on override data).
- Retrofitting metrics into past runs' HANDOFF.md files — the aggregator tolerates their absence instead of backfilling them.
- Live Nexus integration, the benchmarking-loop's first real run, or any changes to superpowers.
- Running `claude plugin update` during this build (release to the live install happens after human review of the morning report).
