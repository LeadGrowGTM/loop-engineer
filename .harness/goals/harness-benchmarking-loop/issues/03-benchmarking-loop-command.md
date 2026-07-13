# 03 - /benchmarking-loop command (thin router)
Status: done
Blocked by: 01, 02

## Done
`.claude/commands/benchmarking-loop.md` - thin front-door router (slash name
`/benchmarking-loop`) with three first-match-wins modes: `--resume <run-id>` (warm-start
from the snapshot store, skips known variants via the novelty check, no double-count) |
`<template-name>` (instantiate `.harness/loops/<name>.json` fresh, honoring `repoint`) |
fresh goal text (grill via the lazy `benchmark-intake.md`, offer-to-switch on
mis-routing, ADR-0004/0006). Dispatches by `spec.search.mode` to the sweep engine
(`bun .claude/workflows/benchmark-sweep.js <spec.json>`) or the climb engine
(`.claude/workflows/benchmark-climb.js`, P5). Cadence note documents lagging =
emit-stub + snapshot only. Traces ADR-0002/0003/0004/0005/0006.

## Parent
PRD.md "In scope" 3; ADR-0004, ADR-0005.

## What to build
`.claude/commands/benchmarking-loop.md` - a thin front-door router with three modes:
fresh spec (grill via benchmark-intake) | template name (from `.harness/loops/`) |
`--resume <run-id>` (warm-start from snapshot). Runs a spec; does NOT re-author it.

## Acceptance criteria
- File exists and parses; slash command name is `/benchmarking-loop`.
- Three invocation modes documented with argument grammar.
- Fresh mode routes into the shared grill + `benchmark-intake.md` (lazy).
- Template mode reads a named template from the loop registry.
- `--resume <run-id>` warm-starts from the snapshot store (skips known variants).
- Dispatches to sweep engine (P4) or climb engine (P5) by the spec's `search` field.

## Skill routing
direct - `.claude/commands/benchmarking-loop.md`
