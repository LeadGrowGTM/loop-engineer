# 02 - RUN METRICS template block and morning-report-specs section
Status: done
Blocked by: none

## Parent
Spec: docs/superpowers/specs/2026-07-17-run-metrics-grill-gate.md (R1, R2)

## What to build
In `skills/write-goal-prompt/SKILL.md`'s Phase 2 goal-condition template (the fenced
code block under "## Phase 2: Format the Goal Condition"), add a new `[RUN METRICS]`
block immediately AFTER the existing `[MORNING REPORT]` block. It instructs the goal
agent: at run end, append a `## Run Metrics` section to HANDOFF.md with EXACTLY these
fields, one per line, `key: value` format (this exact list, this exact order):
- `started` (ISO-8601 from `date -Is`, captured at turn 1)
- `finished` (same, at run end)
- `wall_clock_minutes`
- `turns_used`
- `turn_budget`
- `cycles_used`
- `max_cycles`
- `reward_final`
- `reward_per_cycle` (comma-separated)
- `commits` (count this run)
- `tests_delta` (e.g. "25->31")

Then add a `## Run Metrics section` heading to
`skills/write-goal-prompt/references/morning-report-specs.md` that lists the identical
11 fields verbatim — this is the single source a fresh-context checker diffs the
template block against, so the two lists must not diverge in name, order, or format
description.

## Acceptance criteria
- `grep -c '\[RUN METRICS\]' skills/write-goal-prompt/SKILL.md` → 1 — verification
  check 3.
- `grep -c '## Run Metrics section' skills/write-goal-prompt/references/morning-report-specs.md` → 1
  — verification check 4.
- The `[RUN METRICS]` block sits immediately after `[MORNING REPORT]` in the Phase 2
  template (not elsewhere in the file).
- Both the SKILL.md block and the morning-report-specs.md section list the same 11
  fields, same names, same order — a diff between the two lists finds no discrepancy.
- New markdown matches the repo's reference-file style (model:
  `skills/write-goal-prompt/references/taste-gate.md`) — rules with concrete examples,
  not prose essays.

## Skill routing
direct - skills/write-goal-prompt/SKILL.md ([RUN METRICS] block) + skills/write-goal-prompt/references/morning-report-specs.md (## Run Metrics section)
