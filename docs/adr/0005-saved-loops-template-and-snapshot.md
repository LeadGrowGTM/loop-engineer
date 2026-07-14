# 0005 - Saved loops: template (stateless) and snapshot (stateful)

- Status: accepted
- Date: 2026-07-13
- Context path: root (loop-engineer)

## Context

Benchmarking loops that prove useful should be re-invocable instead of re-authored.
But "the saved loop" can mean two different things that behave differently on
re-invoke: the reusable recipe, or the recipe plus everything the loop has learned.
Lagging loops (ADR 0002) also need to resume across days, which requires persisted
in-progress state regardless.

## Decision

Support **both** save kinds:

- **Template** - persists only the spec (benchmark + measurement + search mode + stop
  conditions + levers/invariants). Re-invoking starts a fresh optimization. Portable
  and parameterized: re-pointed at new inputs (e.g. an "email reply-rate optimizer"
  aimed at a different campaign). Templates live in a **loop registry**
  (`.harness/loops/`), named, and are instantiated with
  `/benchmarking-loop <template-name>`.
- **Snapshot** - persists the spec **plus** the variant ledger and best-so-far. Re-
  invoking **warm-starts**: it skips known variants (novelty check, ADR 0003) and
  resumes climbing from the best config. Enables lagging-loop resume across time and
  forking a proven optimizer with its learnings. Keyed by run-id; resumed with
  `--resume <run-id>`.

## Alternatives considered

- **Template only** - rejected; loses cross-invocation compounding and cannot resume a
  lagging loop mid-flight.
- **Snapshot only** - rejected; ledger-bound snapshots are not cleanly portable to a
  new context, so there is no reusable library asset.

## Consequences

- Need a loop registry (`.harness/loops/`) for named templates and a snapshot store
  keyed by run-id (the variant ledger is the bulk of a snapshot).
- `/benchmarking-loop` accepts a template name (fresh) or `--resume <run-id>` (warm).
- Lagging loops persist a snapshot by construction so the external scheduler can
  resume them.
