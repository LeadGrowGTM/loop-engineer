# 0001 - Benchmarking loop stop condition: first-of(target / plateau / budget)

- Status: accepted
- Date: 2026-07-13
- Context path: root (loop-engineer)

## Context

The benchmarking loop optimizes a measurable benchmark rather than producing an
artifact. Unlike the build loop, it has no natural done-state: open-ended
benchmarks ("get this as fast as you can") and uncapped KPIs (reply rate) can be
chased indefinitely, so an explicit stop condition is part of the loop's
definition, not an afterthought. Without one the loop risks infinite spend, which
matters more here than in build loops precisely because there is no completeness
gate to terminate on.

## Decision

A benchmarking goal declares up to three stop conditions at authoring time and the
loop halts on the **first to trip**, always returning the best-so-far config:

1. **target** (optional) - metric crosses a declared bar (e.g. reply rate >= 8%).
2. **plateau** - N cycles with improvement below a threshold (default: 3 cycles,
   < X% gain). Same shape as the build loop's existing PLATEAU.
3. **budget** - a cycle-count / token / spend cap is hit.

Open-ended benchmarks omit `target` and ride plateau + budget. Every cycle
tracks best-so-far so a budget/plateau halt still yields the best configuration.

## Alternatives considered

- **Single plateau rule only** - simpler, but gives open-ended loops no hard spend
  ceiling and no early exit when a declared target is already met.
- **Single budget rule only** - guarantees termination but wastes budget when the
  metric has already converged or hit target.

First-of-three composes these so each covers the others' blind spot.

## Consequences

- The loop must track and return a best-so-far configuration every cycle.
- Authoring (the grill) must capture up to three stop parameters; sensible
  defaults (plateau 3 cycles, a budget cap) apply when the user gives only a
  direction.
- Ties into cost-weighting: budget is a first-class loop input, so per-cycle cost
  must be measured.
