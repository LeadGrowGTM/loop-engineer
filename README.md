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
        ├── clarity-gate.md       ← historical background; managed runs always use the pinned grill
        ├── issue-tracker.md      ← durable phase-slice schema (issues/NN-<slug>.md)
        ├── skill-routing.md      ← task type → skill mapping + chaining patterns
        ├── execution-mode-routing.md
        ├── parallel-execution.md ← historical worktree background; lifecycle start owns isolation
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

`write-goal-prompt` skill (Phase 1.5) spawns a Harness Architect agent that customizes `HARNESS.md` for the specific task; Phase 2.5 also writes the standing protocol (execution stages, eval loop, blockers, proof, morning report) into it verbatim, keeping that boilerplate out of the goal condition. The goal template's `[HARNESS]` block points to that file. Runtime agents read it for both task-specific context and the standing protocol; their structural logic is in the agent files.

## Operator workflow

Run the supported harness in the current interactive Claude Code session. Approval stays under operator control: Planner and Maker are limited to explicitly approved scope, newly discovered scope waits for a new approval, and shipping requires separate approval after Checker PASS. No detached process is part of this path.

Managed goal work uses the five `goal-lifecycle` operations: `start`, `record-grill`, `validate`, `finish`, and `audit`. They are the only supported lifecycle path. Do not substitute direct Git or Treehouse commands, a manual run, or a `-NoIsolation` fallback.

`start` requires the project-local `tasks-axi` backlog, Treehouse, and the hash-pinned `batch-grill-me` skill. It registers the durable task, leases a verified worktree from the repository-owned `.worktrees/` pool, creates the canonical `wt/<task-id>` branch, and persists the run identity under `.harness/goals/<task-id>/RUN.json`. Treehouse owns the pool's internal nested layout; treat the returned worktree path as opaque rather than creating or selecting directories below `.worktrees/`.

After every start, run the required grill even when the request appears fully specified. `record-grill` persists its receipt as `GRILL.json` beside the run manifest. Before emitting the lean goal/harness pointer or clearing context, persist `RUN.json`, `GRILL.json`, `BRIEF.md`, and `HARNESS.md` in the recorded run directory; do not inline a second copy of that durable state into the goal condition. After `/goal clear`, run `validate` against that persisted identity before invoking either Planner or Maker. A failed validation blocks those agents.

`finish` is safe completion: it confirms the task, branch, lease, and persisted run identity before marking the durable task complete and returning the lease. A blocked or failed run retains its lease and durable evidence for recovery; it is never silently returned. `audit` is read-only. It reports lifecycle state and layout evidence, including `misplaced_worktree` checkouts, but never repairs, removes, returns, or otherwise changes an existing misplaced worktree. Audit any reported owner first and perform any later cleanup deliberately outside the lifecycle command.

Before a managed `start`, setup/onboarding must have established its dependencies and repository configuration. `/setup-harness` seeds the project-local `.tasks.toml`, `treehouse.toml`, `.worktrees/` ignore rule, and harness files; workspace `/onboard` provisions the internal CLIs. Setup also installs and verifies the pinned grill. It does not take a task lease or start a goal.

`scripts/prepare-harness-run.ps1` is an internal bounded readiness implementation and diagnostic seam for lifecycle `start`, not an operator pre-goal command or lifecycle bypass. Lifecycle `start` invokes it to fail safely for an invalid repository or pipeline layout, missing committed `HEAD`, detached or default branch, hidden index state, dirty working tree, or unsafe pool; only the lifecycle result authorizes continuation.


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
only enabling path. It first writes a non-sensitive rollback marker recording that it is about to
add one pinned package entry, records the exact package with `autoload: false`, reconciles only
that package, and verifies the clone HEAD, package metadata, settings entry, and compatible
versions. It then writes the project-local lock and config atomically and changes `autoload` to
`true` only in the final settings write. A failed setup retains its work in an inert state rather
than leaving an active partial setup. On an already-`READY` project, `setup` re-verifies the live
clone against the pinned commit (`git rev-parse HEAD` and a clean `git status --porcelain`) before
affirming `READY`, rather than trusting the lockfile's declared commit; a moved `HEAD` or dirty
worktree fails with `GIT_HEAD_MISMATCH` or `CLONE_WORKTREE_DIRTY`.

All managed state stays under `<project-root>/.pi/`: `settings.json`, the extension clone,
`openai-server-compaction.lock.json`, `openai-server-compaction.json`, and exclusive settings and
enabled-config backups. The settings backup is metadata only (package name, source spec, and the
fact that one entry was added) — never a copy of `settings.json` itself, so it cannot carry operator
secrets. `disable` writes `enabled: false` before `autoload: false`. It deletes nothing and retains
the package, clone, lock, config, and backups for rollback. For an emergency bypass, run `disable`
before manual operator recovery and inspect its JSON result.

### Data and model disclosure

- Setup writes `store: true`, and the extension sends compaction requests with `store: true`.
  OpenAI receives the context sent for compaction and may retain server-side data under the
  operator's OpenAI account and API policy.
- The pinned upstream supports the `openai/*` and `openai-codex/*` model families. Azure support is
  partial and opt-in upstream; it remains off unless separately configured.
- Local Pi sessions may contain opaque compaction artifacts in JSONL or other session files. The
  manager does not copy those artifacts into this repo. It stores no credentials, prompts,
  conversation context, model secrets, or opaque session artifacts in managed config or JSON output.
- The settings backup written by `setup` never contains a verbatim copy of `settings.json`, so it
  cannot leak operator secrets that may live alongside the managed entry.
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
Use the managed lifecycle above before every goal. `scripts/setup-harness.ts` seeds repository
configuration and installs harness assets, but it neither acquires a lease nor starts task execution.

Agent files live at `C:\Users\mitch\Everything_CC\.claude\agents\` (workspace-level discovery).
Skill lives at `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\skills\write-goal-prompt\` —
this repo is the canonical source.

`C:\Users\mitch\.claude\skills\write-goal-prompt` is a **junction** to the repo copy, so the two
cannot drift: edit the repo copy, never the `~/.claude` path. The junction replaced a real directory
that had silently drifted from this repo; the stale copy is archived at
`C:\Users\mitch\Everything_CC\archive\2026-07-16-write-goal-prompt-stale-copy\`.

Copies under `C:\Users\mitch\Everything_CC\.claude\` are **not** junctioned and do drift from this
repo — do not assume they are current.
