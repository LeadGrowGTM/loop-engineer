---
name: setup-harness
description: Installs the loop-engineer harness and its required lifecycle dependencies into any repo. Run before first use of /write-goal-prompt in a new repo, or to update an existing install. Copies harness agents and the pinned batch-grill-me skill into the supported global locations, installs the guard in the target repo, and seeds .harness/skill-routing.md from the target repo's available skills.
disable-model-invocation: true
---

# Setup Harness

Installs the planner/maker/prover/checker/shipper harness into the current repo. One command; idempotent.

## Process

### 1. Explore

Understand the current state before touching anything:

- What repo is this? (`git remote -v`, `git rev-parse --show-toplevel`)
- Does `.harness/skill-routing.md` already exist? If yes — show the user what's there, ask before overwriting.
- Does `CLAUDE.md` exist? Where will the `## Harness` block go?
- Are harness agents already in `~/.claude/agents/`? Which version (check the comment block)?
- Run: `bun scripts/setup-harness.ts scan <repo-root>` — show the user how many skills were found.

### 2. Present findings

Show a one-paragraph summary:

> "Found N skills in this repo. Harness agents are [present/missing] in ~/.claude/agents/. CLAUDE.md [has/does not have] a ## Harness block."

Then ask one question: **"Install or update?"** Default: install. If everything is already current, say so and stop.

### 3. Install

Run the install script from the agent-harness repo:

```bash
bun C:\Users\mitch\Everything_CC\tools\agent\agent-harness\scripts\setup-harness.ts install <repo-root>
```

This does atomically:
1. Copies `harness-planner.md`, `harness-maker.md`, `harness-prover.md`, `harness-checker.md`, `harness-shipper.md` → `~/.claude/agents/`
2. Copies `guard-protected-work.ts` → `<repo-root>/scripts/guard-protected-work.ts`
3. Scans `<repo-root>` for SKILL.md files
4. Seeds `.harness/skill-routing.md` from `routing-template.md` + repo-specific skills, and `.harness/goals/` (working dir for goal runs)
5. Seeds a per-project `.tasks.toml` (tasks-axi backlog → `.claude/backlog.md`) and `treehouse.toml` (worktree pool at `.worktrees/`), if not already present
6. Installs the bundled pinned `batch-grill-me` skill to `~/.claude/skills/batch-grill-me/SKILL.md`, repairing drift byte-for-byte
7. Adds `.worktrees/` to `.gitignore`; an old `.tmp/treehouse/` pool is repaired only after a read-only Treehouse status proves no active lease
8. Patches `CLAUDE.md` with `## Harness` block (install date, source SHA, readiness command, and explicit worktree preparation guidance)
9. Runs smoke test, then verifies `tasks-axi`, Treehouse, and the installed pinned grill. Missing or broken CLIs require workspace onboarding; bundled grill drift is repaired by setup.

### 4. Present smoke test results

If all 8 checks pass - done. Tell the user which engineering workflows are now available.

If any check fails — show the failing line, diagnose, fix manually, re-run smoke:

```bash
bun C:\Users\mitch\Everything_CC\tools\agent\agent-harness\scripts\setup-harness.ts smoke <repo-root> ~/.claude/agents
```

### 5. Done

Tell the user:

- Harness is ready. Planner reads `.harness/skill-routing.md` — edit it to tune routing for this repo.
- Run `/write-goal-prompt` to create a harness-wired goal prompt.
- Re-run `/setup-harness` if you add new skills and want them auto-added to the routing table.
- To update agents: re-run `/setup-harness` — it overwrites `~/.claude/agents/harness-*.md` with the latest from agent-harness.

## Reference

- Script: `tools/agent/agent-harness/scripts/setup-harness.ts`
- Protected-work guard: `tools/agent/agent-harness/scripts/guard-protected-work.ts`
- Routing seed: `tools/agent/agent-harness/skills/setup-harness/routing-template.md`
- Harness agents: `tools/agent/agent-harness/.claude/agents/harness-*.md` (source of truth)
