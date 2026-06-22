# write-goal-prompt Reference Index

All reference files for the write-goal-prompt skill.

## Core References (`references/`)

| File                                                             | What it covers                                                |
| ---------------------------------------------------------------- | ------------------------------------------------------------- |
| [subagent-harness.md](../references/subagent-harness.md)         | 3-agent loop design, depth budget, checker independence rules |
| [eval-loop-design.md](../references/eval-loop-design.md)         | Reward signal design, pass thresholds, cycle budget           |
| [skill-routing.md](../references/skill-routing.md)               | Which skill to invoke per task type                           |
| [context-management.md](../references/context-management.md)     | Token budget, context compression, fork vs fresh              |
| [qa-checklist.md](../references/qa-checklist.md)                 | Pre-ship QA gates for goal prompts                            |
| [morning-report-specs.md](../references/morning-report-specs.md) | Overnight run report format                                   |

## Architecture (`docs/`)

| File                               | What it covers                                           |
| ---------------------------------- | -------------------------------------------------------- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Agent roles, file paths, depth budget, plateau detection |

## Knowledge Base (`kb/`)

| File                                         | What it covers                                                 |
| -------------------------------------------- | -------------------------------------------------------------- |
| [LOG.md](../kb/LOG.md)                       | Global activity feed — one line per significant run or upgrade |
| [signals/README.md](../kb/signals/README.md) | Schema for signal artifacts (feedback, observations, ideas)    |
| [docs/README.md](../kb/docs/README.md)       | Schema for doc artifacts (decisions, analyses, learned facts)  |
