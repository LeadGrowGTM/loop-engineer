# agent-harness

Goal loop harness system for Claude Code. Separates planning, execution, and verification into isolated agents with structural enforcement — not prompt trust.

## What's here

```
agent-harness/
├── .claude/agents/          ← runtime agents (installed at workspace level)
│   ├── harness-planner.md   — decomposes goal → PLAN.md (sonnet, Read/Glob/Write only)
│   ├── harness-maker.md     — executes phases, commits (haiku, full tools)
│   ├── harness-prover.md    — runs live feature (sonnet, Read/Bash only) for running-app goals
│   ├── harness-checker.md   — scores artifacts fresh (sonnet, Read/Glob only)
│   └── harness-shipper.md   ← runs /no-mistakes once after PASS + separate shipping approval → PR (sonnet, Read/Bash only)
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
        ├── parallel-execution.md ← explicit treehouse worktree isolation
        ├── first-principles-generation.md
        ├── qa-checklist.md
        ├── morning-report-specs.md
        └── context-management.md
```

## Core principle

The model that wrote the code is too generous grading its own homework. Self-eval = agreement loop, not improvement loop.

Fix: **harness-checker** has `tools: Read, Glob, Write` only. It cannot run Bash, spawn agents, or access anything the Maker produced via tool calls. This isolation is enforced by the tool layer, not by prompt instruction. The attached goal agent invokes the planner, then maker, then prover (for running-app goals), then checker within the current session. Only explicitly approved scope may enter planning or execution. A Checker PASS does not authorize shipping; the shipper also requires separate explicit shipping approval. This ordering is defined in HARNESS.md and relies on the goal agent's instruction-following, not tool enforcement.

## The 5-agent loop

```
Goal agent (depth 0)
  └── harness-planner (depth 1)  → PLAN.md
  └── harness-maker   (depth 2)  → artifacts + PROGRESS.md (with proof)
  └── harness-prover  (depth 3)  → PROOF verdict (running-app goals only)
  └── harness-checker (depth 4)  → CYCLE_LOG.md (scores + verdict)
  └── harness-shipper (depth 1)  → /no-mistakes once, after PASS + separate shipping approval → PR URL
       ↑ repeat until PASS or plateau (max 3 cycles)
  PASS + shipping approval → /no-mistakes → review/test/lint/push/PR/CI → PR ready for human merge
```

Depth budget: goal=0, planner=1, maker=2, prover=3, checker=4, sub-skills max=5. Never need depth 6.

**Prover role:** For goals that produce a running application (browser UI, API, CLI), Prover drives the live feature and returns a binary works/broken verdict before Checker scores. For static artifact goals (docs, code, analysis), skip Prover and go directly to Checker.

**Shipping stage:** After Checker returns PASS, the goal agent waits for separate explicit shipping approval. Only then may it spawn a fresh `harness-shipper`, which invokes `/no-mistakes` exactly once and drives it to a terminal outcome. A `checks-passed` outcome means the PR is prepared with green CI for human review; the harness never merges it. ITERATE and PLATEAU do not ship.

## How goals use this

`write-goal-prompt` skill (Phase 1.5) spawns a Harness Architect agent that customizes `HARNESS.md` for the specific task. The goal template's `[HARNESS]` block points to that file. Runtime agents read it for task-specific context; their structural logic is in the agent files.

## Operator workflow

Run the supported harness in the current interactive Claude Code session. Approval stays under operator control: Planner and Maker are limited to explicitly approved scope, newly discovered scope waits for a new approval, and shipping requires separate approval after Checker PASS. No detached process is part of this path.

Before starting a goal, run the non-launching readiness check:

```powershell
powershell -NoProfile -File scripts/prepare-harness-run.ps1 `
  -RepoPath C:\path\to\repo -CheckOnly
```

The `-CheckOnly` mode does not start task execution and does not mutate Git state. It emits one JSON object and fails fast for an invalid repository or pipeline layout, a missing committed `HEAD`, a detached or default branch, hidden index state, or a dirty working tree. Continue in the current session only when `readyForRun` is `true`.

When isolation is desired or required, acquire a treehouse worktree explicitly:

```powershell
powershell -NoProfile -File scripts/prepare-harness-run.ps1 `
  -RepoPath C:\path\to\repo -PrepareIsolation `
  -LeaseHolder harness-my-task
```

Treehouse is optional for a standalone serial repository. Add `-Parallel` when preparing a parallel stream; parallel streams and canonical monorepo pipelines require isolation. If Treehouse is missing when isolation is required, readiness fails with remediation instead of falling back. The `-PrepareIsolation` mode acquires a Treehouse lease and creates a unique derived `runBranch` at the checked source `HEAD` before returning READY. It keeps `branch` as the source branch and returns `runPath` plus `returnCommand`. Work and commit only on `runBranch`; verify that branch contains the intended commits before deliberately returning the lease.

## Optional Pi OpenAI server compaction

This integration is optional and off by default. Neither `scripts/setup-harness.ts` nor
`scripts/prepare-harness-run.ps1` invokes the manager, changes Pi state, or installs the extension.
Ordinary harness setup, readiness, and goal runs are unaffected.

The project must already contain `.pi/settings.json`. Setup requires Node `>=22`, Pi
`>=0.80.9 <0.81.0`, and this immutable package spec:

```
git:github.com/algal/pi-openai-server-compaction@c6d593087709e9481223dc6c6c2269b371b5e055
```

Use the dedicated manager from this repo:

```bash
bun scripts/manage-pi-openai-server-compaction.ts check <project-root>
bun scripts/manage-pi-openai-server-compaction.ts setup <project-root> --enable --acknowledge-openai-retention
bun scripts/manage-pi-openai-server-compaction.ts disable <project-root>
```

`check` is read-only and reports `DISABLED`, `READY`, or `NOT_READY` as JSON. `setup` is the
only enabling path. It first backs up settings, records the exact package with `autoload: false`,
reconciles only that package, and verifies the clone HEAD, package metadata, settings entry, and
compatible versions. It then writes the project-local lock and config atomically and changes
`autoload` to `true` only in the final settings write. A failed setup retains its work in an inert
state rather than leaving an active partial setup.

All managed state stays under `<project-root>/.pi/`: the preserved `settings.json`, the extension
clone, `openai-server-compaction.lock.json`, `openai-server-compaction.json`, and exclusive settings
and enabled-config backups. `disable` writes `enabled: false` before `autoload: false`. It deletes
nothing and retains the package, clone, lock, config, and backups for rollback. For an emergency
bypass, run `disable` before manual operator recovery and inspect its JSON result.

### Data and model disclosure

- Setup writes `store: true`, and the extension sends compaction requests with `store: true`.
  OpenAI receives the context sent for compaction and may retain server-side data under the
  operator's OpenAI account and API policy.
- The pinned upstream supports the `openai/*` and `openai-codex/*` model families. Azure support is
  partial and opt-in upstream; it remains off unless separately configured.
- Local Pi sessions may contain opaque compaction artifacts in JSONL or other session files. The
  manager does not copy those artifacts into this repo. It stores no credentials, prompts,
  conversation context, model secrets, or opaque session artifacts in managed config or JSON output.
- Tests are offline. They fake Node, Pi, Git and package records, processes, the filesystem, and the
  network on Windows and POSIX. They do not authenticate, call OpenAI, or fetch the extension.

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
Use the Operator workflow above before every goal. `scripts/setup-harness.ts` seeds config and
installs agent files, but it neither checks repository readiness nor starts task execution.

Agent files live at `C:\Users\mitch\Everything_CC\.claude\agents\` (workspace-level discovery).
Skill lives at `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\skills\write-goal-prompt\` —
this repo is the canonical source.

`C:\Users\mitch\.claude\skills\write-goal-prompt` is a **junction** to the repo copy, so the two
cannot drift: edit the repo copy, never the `~/.claude` path. The junction replaced a real directory
that had silently drifted from this repo; the stale copy is archived at
`C:\Users\mitch\Everything_CC\archive\2026-07-16-write-goal-prompt-stale-copy\`.

Copies under `C:\Users\mitch\Everything_CC\.claude\` are **not** junctioned and do drift from this
repo — do not assume they are current.
