# 08 - routing / benchmark auto-detect + offer-to-switch
Status: done
Blocked by: 01, 03

## Completion note
Wired benchmark auto-detect into the shared grill (ADR-0004):
- `execution-mode-routing.md` gains a "Prior axis: benchmark detection" section naming
  the metric+direction detection key, the two-doors-one-grill routing, and offer-to-switch
  in both directions - added above the existing four task-shape modes without altering
  build-path routing text.
- `SKILL.md` Execution Mode Routing section now runs benchmark detection first and offers
  to switch to `/benchmarking-loop` (loading the lazy `benchmark-intake.md`) before the
  build phases - one lean paragraph, no SKILL.md bloat.
- `/benchmarking-loop` command already carried the reciprocal offer-to-switch (build goal
  -> `/write-goal-prompt`) from P3; both doors now auto-detect from either side.

## Parent
PRD.md "In scope" 2; ADR-0004 (auto-detect fallback).

## What to build
Wire benchmark detection into the shared grill:
- Edit `skills/write-goal-prompt/references/execution-mode-routing.md` to add the
  benchmark-detection axis ("does the goal name a measurable benchmark - metric +
  direction?").
- Both front-door commands (`/write-goal-prompt` and `/benchmarking-loop`) auto-detect
  from either door and offer-to-switch on mis-route.

## Acceptance criteria
- execution-mode-routing.md names the benchmark-detection key and the two-doors-one-grill
  routing without regressing existing build-path routing text.
- Mis-invoking `/write-goal-prompt` on a benchmark goal triggers the switch offer
  (documented behaviour).
- `/benchmarking-loop` on a plain build goal offers to switch back.
- No change to the build path's behaviour beyond adding the fork.

## Skill routing
direct - `skills/write-goal-prompt/references/execution-mode-routing.md` + command routers
