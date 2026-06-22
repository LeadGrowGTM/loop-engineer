# write-goal-prompt Knowledge Base

Emergent knowledge accumulated during harness runs. Plain markdown + frontmatter in git —
agent-writable, human-reviewable.

## Structure

```
kb/
├── README.md        ← this file
├── LOG.md           ← global activity feed (one line per ship/upgrade)
├── signals/
│   ├── README.md    ← schema for signal artifacts
│   └── *.md         ← individual signals (feedback, observations, anti-patterns)
└── docs/
    ├── README.md    ← schema for doc artifacts
    └── *.md         ← decisions, analyses, learned facts
```

## Two kinds

| Kind     | What                                                                | Folder     | When to use                                     |
| -------- | ------------------------------------------------------------------- | ---------- | ----------------------------------------------- |
| `signal` | Evidence: feedback, observation, idea (deduped + frequency-counted) | `signals/` | Something recurred or was noticed during a run  |
| `doc`    | Durable knowledge: decision, analysis, learned fact                 | `docs/`    | Something confirmed and worth keeping long-term |

Read each folder's `README.md` for frontmatter schema before writing.

## Log

`LOG.md` is the global feed — append one line before committing a batch of work.
Detail lives in each artifact's `## Timeline` section, not in LOG.md.

## Promotion path

Agents write `trust=emergent` entries. A human reviews and promotes good signals/docs
to validated status by updating the `status:` frontmatter field.
