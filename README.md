# agent-harness

Goal loop harness system for Claude Code. Separates planning, execution, and verification into isolated agents with structural enforcement — not prompt trust.

## What's here

```
agent-harness/
├── .claude/agents/          ← runtime agents (installed at workspace level)
│   ├── harness-planner.md   — decomposes goal → PLAN.md (sonnet, Read/Glob/Write only)
│   ├── harness-maker.md     — executes phases, commits (haiku, full tools)
│   ├── harness-prover.md    — runs live feature (sonnet, Read/Bash only) for running-app goals
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

Fix: **harness-checker** has `tools: Read, Glob, Write` only. It cannot run Bash, spawn agents, or access anything the Maker produced via tool calls. This isolation is enforced by the tool layer, not by prompt instruction. The goal agent follows written instructions to invoke the planner, then maker, then prover (for running-app goals), then checker — this ordering is defined in HARNESS.md and relies on the goal agent's instruction-following, not tool enforcement.

## The 4-agent loop

```
Goal agent (depth 0)
  └── harness-planner (depth 1)  → PLAN.md
  └── harness-maker   (depth 2)  → artifacts + PROGRESS.md (with proof)
  └── harness-prover  (depth 3)  → PROOF verdict (running-app goals only)
  └── harness-checker (depth 4)  → CYCLE_LOG.md (scores + verdict)
       ↑ repeat until PASS or plateau (max 3 cycles)
```

Depth budget: goal=0, planner=1, maker=2, prover=3, checker=4, sub-skills max=5. Never need depth 6.

**Prover role:** For goals that produce a running application (browser UI, API, CLI), Prover drives the live feature and returns a binary works/broken verdict before Checker scores. For static artifact goals (docs, code, analysis), skip Prover and go directly to Checker.

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
