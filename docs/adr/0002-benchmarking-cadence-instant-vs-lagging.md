# 0002 - One benchmarking loop, two cadences: instant (in-session) vs lagging (external scheduler)

- Status: accepted
- Date: 2026-07-13
- Context path: root (loop-engineer)

## Context

Benchmark KPIs do not share a clock. Speed/cost/eval-score/test-pass and
auto-research provider bake-offs (e.g. Parallel API vs Serper.dev) are measurable
immediately. Reply rate, click-through, and ad spend are real-world metrics that
accrue over days: a variant must be shipped live, then the loop waits before a
cycle even has a reward. A single synchronous loop cannot serve both.

## Decision

**One benchmarking-loop skill, with a `measurement: instant | lagging` field on the
benchmark** that selects the execution cadence:

- **instant** - runs as a tight in-session goal-loop; cadence bounded only by how
  fast the model mutates and re-runs the benchmark command.
- **lagging** - the loop does NOT run to completion in-session. It emits a
  scheduled job to an external orchestrator (**n8n / trigger.dev / Hermes agent**),
  carrying a `settle_window` (how long to let data accrue) and persisted loop
  state so cycle N+1 resumes days later.

The reward, stop-condition, and search machinery are identical across both; only
the clock and the cross-time resume differ. This is a scheduling knob, not a
second skill.

## Alternatives considered

- **Two separate skills** (instant-benchmark vs lagging-benchmark) - rejected:
  duplicates all the shared reward/stop/search logic; the only real difference is
  where the cycle is scheduled.
- **Harness-native cron for lagging loops** - rejected in favor of existing
  external orchestrators (n8n/trigger.dev/Hermes) already run for long-running
  work; the harness emits the job rather than owning the scheduler.

## Consequences

- The benchmark spec needs `measurement` and, for lagging, `settle_window`.
- Lagging loops require a persisted-state contract and an emit-to-orchestrator
  adapter; the harness hands off rather than blocking.
- Maps onto the existing `execution-mode-routing.md` axis (goal-loop vs
  time-loop) - instant = goal-loop, lagging = time-loop delegated externally.
