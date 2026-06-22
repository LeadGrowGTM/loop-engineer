# agent-harness

Goal loop harness system for Claude Code. Separates planning, execution, and verification into isolated agents with mechanical enforcement — not prompt trust.

## What's here

```
agent-harness/
├── .claude/agents/          ← runtime agents (installed at workspace level)
│   ├── harness-planner.md   — decomposes goal → PLAN.md (sonnet, Read/Glob/Write only)
│   ├── harness-maker.md     — executes phases, commits (haiku, full tools)
│   └── harness-checker.md   — scores artifacts fresh (sonnet, Read/Glob only)
└── skills/write-goal-prompt/ ← authoring skill (lives at .claude/skills/ for discovery)
    ├── SKILL.md
    ├── EXAMPLES.md
    └── references/
        ├── eval-loop-design.md
        ├── subagent-harness.md   ← patterns, depth budget, fork mode, independence rules
        ├── skill-routing.md      ← task type → skill mapping + chaining patterns
        ├── qa-checklist.md
        ├── morning-report-specs.md
        └── context-management.md
```

## Core principle

The model that wrote the code is too generous grading its own homework. Self-eval = agreement loop, not improvement loop.

Fix: **harness-checker** has `tools: Read, Glob, Write` only. It cannot run Bash, spawn agents, or access anything the Maker produced via tool calls. Isolation is mechanical, not a prompt instruction.

## The 3-agent loop

```
Goal agent (depth 0)
  └── harness-planner (depth 1)  → PLAN.md
  └── harness-maker   (depth 2)  → artifacts + PROGRESS.md (with proof)
  └── harness-checker (depth 3)  → CYCLE_LOG.md (scores + verdict)
       ↑ repeat until PASS or plateau (max 3 cycles)
```

Depth budget: goal=0, planner=1, maker=2, checker=3, sub-skills max=4. Never need depth 5.

## How goals use this

`write-goal-prompt` skill (Phase 1.5) spawns a Harness Architect agent that customizes `HARNESS.md` for the specific task. The goal template's `[HARNESS]` block points to that file. Runtime agents read it for task-specific context; their structural logic is in the agent files.

## Proof protocol

Every phase completion requires actual command output, not assertion:
- "47 passed, 0 failed" not "tests pass"
- "312 lines" not "file written"  
- "34 grep matches" not "well-sourced"

Checker cites `file:line` evidence for every dimension score. Scores without citations are invalid.

## Installation

Agent files live at `C:\Users\mitch\Everything_CC\.claude\agents\` (workspace-level discovery).
Skill lives at `C:\Users\mitch\Everything_CC\.claude\skills\write-goal-prompt\`.
This repo is the canonical source — workspace copies stay in sync.
