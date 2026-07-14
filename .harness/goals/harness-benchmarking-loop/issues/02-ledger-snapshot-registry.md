# 02 - variant ledger + snapshot store + loop registry schemas
Status: done
Blocked by: none

## Parent
PRD.md "In scope" 6; ADR-0003 (ledger), ADR-0005 (template/snapshot).

## What to build
Three durable schemas:
- `.harness/loops/README.md` - the loop **registry** (named templates, spec-only).
- `docs/benchmarking/variant-ledger.md` - the **variant ledger** schema (run.md-style:
  every variant tested, its config, its reward; feeds novelty + best-so-far).
- `docs/benchmarking/snapshot-store.md` - the **snapshot** store (spec + ledger +
  best-so-far, keyed by run-id; warm-start via `--resume`).

## Acceptance criteria
- All three files exist and parse as markdown.
- Ledger schema defines per-variant fields: variant id, config, reward (numeric),
  cadence, timestamp/cycle, in-bounds + novelty verdicts, best-so-far marker.
- Snapshot = spec + ledger + best-so-far, keyed by run-id; template = spec only.
- Registry says templates live in `.harness/loops/`, named, instantiated by name.
- Files reference the concrete on-disk layout the engines (P4/P5) and command (P3) use.

## Skill routing
direct - `.harness/loops/README.md`, `docs/benchmarking/variant-ledger.md`,
`docs/benchmarking/snapshot-store.md`
