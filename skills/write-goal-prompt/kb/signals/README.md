# signals/ — Schema

Each file in this folder is a **signal**: a piece of evidence — feedback, observation, or
idea — that has been deduped and frequency-counted.

## Frontmatter fields

```yaml
---
kind: signal
category: feedback | observation | idea | anti-pattern
frequency: 1 # increment each time this signal recurs
sources: # where it was observed
  - 'session YYYY-MM-DD'
domain: # which loop(s) this belongs to (list)
  - write-goal-prompt
status: open | actioned | dismissed
---
```

## Body convention

Two layers:

1. **Main body** — what's true now: the signal statement, context, implications.
2. **`## Timeline`** (append-only) — dated entries recording each occurrence:
   ```
   YYYY-MM-DD | source — what happened / new instance
   ```

`frequency` in frontmatter = count of Timeline entries. Keep them in sync.

## Naming

`<slug>.md` — kebab-case, describes the signal. Examples:

- `maker-self-grades-too-high.md`
- `checker-reads-progress-md.md`
- `plateau-not-detected-early-enough.md`

## Rules

- One concept = one file. Increment `frequency`; don't create duplicates.
- `category: anti-pattern` = a failure mode worth encoding as a rule.
- `status: actioned` = a rule or fix was applied. Keep the file; mark it.
- Agents write signals; humans promote patterns to validated rules.
