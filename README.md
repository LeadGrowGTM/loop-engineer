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
        ├── clarity-gate.md       ← Phase 0.5 grill vs /wayfinder routing
        ├── issue-tracker.md      ← durable phase-slice schema (issues/NN-<slug>.md)
        ├── skill-routing.md      ← task type → skill mapping + chaining patterns
        ├── execution-mode-routing.md
        ├── parallel-execution.md ← treehouse worktree isolation, auto-lease on collision
        ├── first-principles-generation.md
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
  PASS → /no-mistakes → review/test/lint/push/PR/CI → PR ready for human merge
```

Depth budget: goal=0, planner=1, maker=2, prover=3, checker=4, sub-skills max=5. Never need depth 6.

**Prover role:** For goals that produce a running application (browser UI, API, CLI), Prover drives the live feature and returns a binary works/broken verdict before Checker scores. For static artifact goals (docs, code, analysis), skip Prover and go directly to Checker.

**Shipping stage:** After Checker returns PASS, the goal agent spawns a fresh `harness-shipper`, which invokes `/no-mistakes` exactly once and drives it to a terminal outcome. A `checks-passed` outcome means the PR is prepared with green CI for human review and merge. ITERATE and PLATEAU do not ship.

## How goals use this

`write-goal-prompt` skill (Phase 1.5) spawns a Harness Architect agent that customizes `HARNESS.md` for the specific task. The goal template's `[HARNESS]` block points to that file. Runtime agents read it for task-specific context; their structural logic is in the agent files.

## Second goal path: the benchmarking loop

The build loop above produces an *artifact*. The **benchmarking loop** is the second
goal path - it *optimizes a measurable dimension* (a metric read exogenously) instead of
producing a fixed artifact. It slots beside `/write-goal-prompt` as a second thin front
door, `/benchmarking-loop`, over the same shared grill (ADR-0004). Glossary: root
`CONTEXT.md`; decisions: `docs/adr/0001`-`0006`.

```
benchmarking loop/
├── .claude/commands/benchmarking-loop.md      ← thin router: fresh spec | template | --resume (P3)
├── .claude/workflows/
│   ├── benchmark-sweep.js                      ← sweep engine: run all candidates → rank → pick (P4)
│   └── benchmark-climb.js                      ← climb engine: invent → in-bounds → novelty → measure → keep (P5)
├── .claude/agents/
│   ├── harness-inbounds-checker.md             ← invariant check, fresh-context, separate from inventor (P6)
│   └── harness-novelty-checker.md              ← ledger dedup check, fresh-context, separate from inventor (P6)
├── skills/write-goal-prompt/references/
│   └── benchmark-intake.md                     ← lazy grill branch: benchmark · measurement · search · stop (P1)
├── docs/benchmarking/
│   ├── variant-ledger.md                       ← append-only ledger.jsonl + best.json schema (P2)
│   ├── snapshot-store.md                        ← run-id-keyed spec+ledger+best, --resume contract (P2)
│   └── measurement-adapter.md                  ← exogenous reward contract: instant + lagging (P7)
├── .harness/loops/README.md                    ← loop registry / template store (P2/P5)
└── scripts/benchmark-adapters/
    ├── instant.ts                              ← command→number reference impl (P7)
    └── lagging-emit.ts                         ← emit-job stub for external orchestrator (P7, never run live)
```

**Sweep vs climb (ADR-0003).** Sweep runs a fixed candidate set and skips the two
pre-measurement checks (candidates are pre-declared). Climb invents variants over
declared levers and, before spending any measurement, clears an **in-bounds** check then
a **novelty** check - both run by agents *separate from the inventor* (anti-gaming is
non-negotiable). Both stop on first-of(target / plateau / budget) and always return
best-so-far (ADR-0001). Measurement is exogenous throughout.

## Proof protocol

Every phase completion requires actual command output, not assertion:
- "47 passed, 0 failed" not "tests pass"
- "312 lines" not "file written"
- "34 grep matches" not "well-sourced"

Checker cites `file:line` evidence for every dimension score. Scores without citations are invalid.

## Installation

**Prerequisites:** see [`docs/DEPENDENCIES.md`](docs/DEPENDENCIES.md) for every external tool the
loop uses, its tier (Required / Optional / Bundled), a verify command, and what breaks without it.
Check them by hand — `scripts/setup-harness.ts` seeds config and installs agent files but verifies
**no** external binary, so a green setup run tells you nothing about whether `gnhf`, `treehouse`,
`tasks-axi`, or `no-mistakes` exist.

Agent files live at `C:\Users\mitch\Everything_CC\.claude\agents\` (workspace-level discovery).
Skill lives at `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\skills\write-goal-prompt\` —
this repo is the canonical source.

`C:\Users\mitch\.claude\skills\write-goal-prompt` is a **junction** to the repo copy, so the two
cannot drift: edit the repo copy, never the `~/.claude` path. The junction replaced a real directory
that had silently drifted from this repo; the stale copy is archived at
`C:\Users\mitch\Everything_CC\archive\2026-07-16-write-goal-prompt-stale-copy\`.

Copies under `C:\Users\mitch\Everything_CC\.claude\` are **not** junctioned and do drift from this
repo — do not assume they are current.
