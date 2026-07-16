# write-goal-prompt Reference Index

All reference files for the write-goal-prompt skill.

## Core References (`references/`)

| File                                                                            | What it covers                                                          |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [subagent-harness.md](../references/subagent-harness.md)                       | 4-agent loop design, depth budget, checker independence rules           |
| [eval-loop-design.md](../references/eval-loop-design.md)                       | Reward signal design, pass thresholds, cycle budget                     |
| [clarity-gate.md](../references/clarity-gate.md)                               | Phase 0.5 grill vs `/wayfinder` routing, grill agent prompt             |
| [taste-gate.md](../references/taste-gate.md)                                   | Phase 0.75: router (goal → YES/NO), approval table, compilation, precedence |
| [spec-intake.md](../references/spec-intake.md)                                 | Branch S: superpowers spec → goal, checkability gate, no grill          |
| [issue-tracker.md](../references/issue-tracker.md)                             | Durable phase-slice schema (`issues/NN-<slug>.md`), Status vocab        |
| [skill-routing.md](../references/skill-routing.md)                             | Which skill to invoke per task type                                     |
| [execution-mode-routing.md](../references/execution-mode-routing.md)           | Task-shape routing: single-run, goal-loop, time-loop, dynamic-workflow  |
| [parallel-execution.md](../references/parallel-execution.md)                   | Treehouse worktree isolation, auto-lease on collision, lease lifecycle  |
| [first-principles-generation.md](../references/first-principles-generation.md) | Planner: decompose from observable outcomes; Maker: reason before code  |
| [context-management.md](../references/context-management.md)                  | Token budget, context compression, fork vs fresh                        |
| [qa-checklist.md](../references/qa-checklist.md)                               | Pre-ship QA gates for goal prompts                                      |
| [morning-report-specs.md](../references/morning-report-specs.md)               | Overnight run report format                                             |

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
