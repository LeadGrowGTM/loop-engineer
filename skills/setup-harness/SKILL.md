---
name: setup-harness
description: Installs the loop-engineer harness wiring (tuned skill-routing.md + .harness/ + backlog/worktree seeds) into any repo. Run before first use of /write-goal-prompt in a new repo, or to update an existing install. Agents ship with the loop-engineer plugin (auto-loaded); this skill seeds per-repo files and verifies plugin integrity.
disable-model-invocation: false
---

# Setup Harness

Installs the planner/maker/checker harness into the current repo. One command; idempotent.

## Process

### 1. Explore

Understand the current state before touching anything:

- What repo is this? (`git remote -v`, `git rev-parse --show-toplevel`)
- Does `.harness/skill-routing.md` already exist? If yes — show the user what's there, ask before overwriting.
- Does `CLAUDE.md` exist? Where will the `## Harness` block go?
- Are the plugin's 6 harness agents present? (`ls "${CLAUDE_PLUGIN_ROOT}/.claude/agents/harness-"*.md`)
- Run: `bun scripts/setup-harness.ts scan <repo-root>` — show the user how many skills were found.

### 2. Present findings

Show a one-paragraph summary:

> "Found N skills in this repo. Plugin agents are [present/missing] (6 expected). CLAUDE.md [has/does not have] a ## Harness block."

Then ask one question: **"Install or update?"** Default: install. If everything is already current, say so and stop.

### 3. Install

Run the install script from your loop-engineer clone:

```bash
bun "${CLAUDE_PLUGIN_ROOT}/scripts/setup-harness.ts" install <repo-root>
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
bun "${CLAUDE_PLUGIN_ROOT}/scripts/setup-harness.ts" smoke <repo-root>
```

### 5. Done

Tell the user:

- Harness is ready. Planner reads `.harness/skill-routing.md` — edit it to tune routing for this repo.
- Run `/write-goal-prompt` to create a harness-wired goal prompt.
- Re-run `/setup-harness` if you add new skills and want them auto-added to the routing table.
- To update agents: the plugin updates itself via the marketplace; bump the version in .claude-plugin/plugin.json and merge to master to release.

## Reference

- Script: `${CLAUDE_PLUGIN_ROOT}/scripts/setup-harness.ts`
- Routing seed: `${CLAUDE_PLUGIN_ROOT}/skills/setup-harness/routing-template.md`
- Harness agents: `${CLAUDE_PLUGIN_ROOT}/.claude/agents/harness-*.md` (source of truth)
