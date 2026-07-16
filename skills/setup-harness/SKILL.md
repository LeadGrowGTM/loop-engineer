---
name: setup-harness
description: Installs the loop-engineer harness (planner/maker/checker agents + tuned skill-routing.md) into any repo. Run before first use of /write-goal-prompt in a new repo, or to update an existing install. Copies harness agents to ~/.claude/agents/ (global) and seeds .harness/skill-routing.md from a scan of the target repo's available skills.
disable-model-invocation: true
---

# Setup Harness

Installs the planner/maker/checker harness into the current repo. One command; idempotent.

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

Run the install script from your loop-engineer clone:

```bash
bun <loop-engineer>/scripts/setup-harness.ts install <repo-root>
```

This does atomically:
1. Scans `<repo-root>` for SKILL.md files
2. Seeds `.harness/skill-routing.md` from `routing-template.md` + repo-specific skills, and `.harness/goals/` (working dir for goal runs)
3. Seeds a per-project `.tasks.toml` (tasks-axi backlog → `.claude/backlog.md`) and `treehouse.toml` (worktree pool), if not already present
4. Adds `.tmp/treehouse/` and `.gnhf-runs/` to `.gitignore`
5. Patches `CLAUDE.md` with `## Harness` block (install date + source SHA)
6. Runs smoke test with ✓/✗ per check (8 checks: 6 plugin agent files, skill-routing.md, ## Harness block)
7. Verifies plugin integrity (6 agent files present in the plugin)

### 4. Present smoke test results

If all 8 checks pass — done. Tell the user which engineering workflows are now available.

If any check fails — show the failing line, diagnose, fix manually, re-run smoke:

```bash
bun <loop-engineer>/scripts/setup-harness.ts smoke <repo-root> ~/.claude/agents
```

### 5. Done

Tell the user:

- Harness is ready. Planner reads `.harness/skill-routing.md` — edit it to tune routing for this repo.
- Run `/write-goal-prompt` to create a harness-wired goal prompt.
- Re-run `/setup-harness` if you add new skills and want them auto-added to the routing table.
- To update agents: the plugin updates itself via the marketplace; bump the version in .claude-plugin/plugin.json and merge to master to release.

## Reference

- Script: `<loop-engineer>/scripts/setup-harness.ts`
- Routing seed: `<loop-engineer>/skills/setup-harness/routing-template.md`
- Harness agents: `<loop-engineer>/.claude/agents/harness-*.md` (source of truth)
