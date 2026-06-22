# docs/ — Schema

Each file in this folder is a **doc**: durable knowledge — a decision, analysis, or
learned fact — that has been confirmed and is worth keeping long-term.

## Frontmatter fields

```yaml
---
kind: doc
domain: # which loop(s) this belongs to (list)
  - write-goal-prompt
status: draft | adopted | superseded
links: # related signals or docs by slug
  - signals/maker-self-grades-too-high
---
```

## Body convention

Two layers:

1. **Main body** — what's true now: the decision, analysis, or learned fact.
   For decisions, include: what was chosen, why, and options rejected.
2. **`## Timeline`** (append-only) — dated entries for status changes or updates:
   ```
   YYYY-MM-DD | source — what changed / why status updated
   ```

## Naming

`<slug>.md` — kebab-case, describes the knowledge. Examples:

- `checker-isolation-rationale.md`
- `depth-budget-constraints.md`
- `plateau-detection-design.md`

## Rules

- `status: adopted` = decision is in effect; harness behavior reflects it.
- `status: superseded` = replaced by a newer doc (link it). Keep for history.
- Cross-cutting knowledge → add multiple `domain:` tags, not duplicate files.
- Agents write docs; humans review and promote to `adopted`.
