# Managed Run Contract

`goal-lifecycle start` is the sole supported way to prepare a goal run. Its successful JSON returns
the authoritative task identity, absolute run path, run directory, and manifest path. Authors and
agents use those values exactly and never select, create, return, or alter a run location themselves.

After the work and required handoff records are complete, the separately approved shipping flow
invokes `goal-lifecycle finish --run <RUN.json> [--pr <url>]`. A blocked or failed goal retains its
run for recovery. Use `goal-lifecycle audit --repo <absolute-repository-path>` for read-only
diagnostics; it does not change state.

The restart pointer always directs the next context to `goal-lifecycle validate --run <RUN.json>`
before routing, Planner, or Maker. A non-ready result blocks execution.
