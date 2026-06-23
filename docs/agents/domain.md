# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root (create lazily — not required upfront)
- **`docs/adr/`** — read ADRs that touch the area you're about to work in

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront.

## File structure

Single-context repo:

```
/
├── CONTEXT.md
├── docs/adr/
│   └── 0001-*.md
├── .claude/agents/
├── skills/write-goal-prompt/
└── scripts/
```

## Domain vocabulary (seed)

| Term | Meaning |
|---|---|
| goal | A task statement that drives a harness loop |
| harness | The planner/maker/checker 3-agent loop |
| cycle | One planner+maker+checker pass |
| reward signal | Mean score across checker rubric dimensions (0–5) |
| PLATEAU | 3 consecutive cycles within ±0.1 reward signal — stop, commit best |
| triage inbox | SQLite run log + `bun scripts/triage.ts` CLI |

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly:

> _Contradicts ADR-000X — but worth reopening because…_
