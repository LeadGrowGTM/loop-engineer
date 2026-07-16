# 01 - Metrics aggregator script and tests
Status: done
Blocked by: none

## Parent
Spec: docs/superpowers/specs/2026-07-17-run-metrics-grill-gate.md (R3, R4)

## What to build
TDD, failing-test-first: write `scripts/run-metrics.test.ts` before
`scripts/run-metrics.ts` exists (or before its parser function is implemented). The
script scans `<goals-dir>/*/HANDOFF.md` for a `## Run Metrics` section and prints one
aligned table row per run: slug, started, wall_clock_minutes, turns_used, cycles_used,
reward_final. A run whose HANDOFF.md has no `## Run Metrics` section is listed as
`<slug>  (no metrics)` and must NEVER crash the script — the script exits 0 either way.
The parsing logic must live in an exported function that takes the goals directory as a
parameter (unit-testable, no hardcoded repo path baked into the function body) — mirror
the exported-function convention already used in `scripts/triage.ts`
(`cmdList`/`cmdLog`/etc. exported, `import.meta.main` guard for the CLI entry point) and
the `describe`/`test` structure in `scripts/triage.test.ts`.

## Acceptance criteria
- `bun test` → exit 0, all pass, including >= 3 new run-metrics tests — verification
  check 1. The >= 3 tests cover exactly (R4): (a) a fixture HANDOFF.md with a full `##
  Run Metrics` section parses to the expected values, (b) a fixture HANDOFF.md without
  the section is reported as metrics-missing, not thrown as an error, (c) the parser's
  recognized field list matches R1's 11 field names exactly (`started`, `finished`,
  `wall_clock_minutes`, `turns_used`, `turn_budget`, `cycles_used`, `max_cycles`,
  `reward_final`, `reward_per_cycle`, `commits`, `tests_delta`).
- The parser function is exported from `scripts/run-metrics.ts` and accepts the goals
  directory as a parameter — no hardcoded `.harness/goals` path inside the function body
  itself (the CLI entry point may default it, but the exported function must not).
- `bun scripts/run-metrics.ts` run from repo root → exit 0 AND output contains
  `taste-gate-v1-2-0` marked `(no metrics)` — verification check 5. (Confirmed during
  planning: `.harness/goals/taste-gate-v1-2-0/HANDOFF.md` has no `## Run Metrics` section
  — it predates this instrumentation, exactly the fixture the spec expects.)
- `grep -cE 'TODO|TBD' scripts/run-metrics.ts` → 0 — verification check 8, this file's
  half.
- Output table is aligned/scannable (column-padded), matching the "metrics table aligned
  and scannable" quality bar in GOAL.md.
- Proof captured in PROGRESS.md: `bun test` output (pass count) and
  `bun scripts/run-metrics.ts` output pasted verbatim.

## Skill routing
tdd - scripts/run-metrics.ts (exported parser + CLI) + scripts/run-metrics.test.ts
