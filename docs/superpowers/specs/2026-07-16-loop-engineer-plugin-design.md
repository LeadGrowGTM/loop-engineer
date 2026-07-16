# loop-engineer as a Claude Code plugin — design spec

- **Date:** 2026-07-16
- **Status:** approved (brainstormed, verified against official docs + live local precedents)
- **Branch:** charles-fork
- **Approach:** manifest overlay — the repo becomes a plugin and its own marketplace without moving any directory

## Goal

Make the harness available in every Claude Code session on every machine, replacing hand-copied installs, without changing the loop's runtime behavior. Today the harness only exists where someone copied it (on the WSL machine it lives at project level inside one project, so only that project's sessions see it). Copy-drift already caused one shipped bug (#13). Public publishing stays possible later.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Audience | Charles + Mitchell now, public-ready later | Their answer; drives cross-platform care but not community docs |
| v1 scope | Everything ships; benchmarking loop flagged experimental | Benchmarking has passing self-tests but zero real runs |
| Structure | Manifest overlay (no restructure) | Identical runtime to full restructure; ~4 new files; 5-minute review for the repo owner |
| Distribution | Repo is its own marketplace | Proven in-house by nexus-mcp; verified schema locally |
| Updates | Plugin ships a SessionStart self-update hook | Marketplace updates are NOT automatic natively; gtme plugins already use this exact pattern |
| Launcher | Runtime detection, no port | gnhf + pwsh are absent on WSL; skill must never offer a path the machine can't run |
| Skill overlap | Route to existing skills (superpowers, TDD) via skill-routing; no in-house duplicates | Loop-engineer is the unattended-mode shell, not a toolbox |

## Verified facts the design rests on

1. **Custom component paths** — `plugin.json` accepts `"agents"` / `"commands"` as relative paths (string or array). They REPLACE defaults, which is moot here (no root `agents/` or `commands/` dirs exist). `skills/` at repo root auto-discovers with no manifest key. *(code.claude.com/docs/en/plugins-reference.md)*
2. **`${CLAUDE_PLUGIN_ROOT}`** — substituted at load time inside skill/agent/command markdown (the model sees the resolved path), and exported to hook processes. Live precedent: nexus-mcp SKILL.md shells out with it on this machine today. *(plugins-reference.md + local)*
3. **Agent precedence** — managed > CLI > project > user > plugin. Plugin agents are lowest priority and scoped (`loop-engineer:harness-planner`). Consequences: (a) stale project/user copies silently override the plugin, so migration cleanup is **mandatory correctness**, not hygiene; (b) inside the dev repo, `.claude/agents` overrides the plugin — free dev-mode testing of agent edits before release. *(sub-agents.md)*
4. **Self-marketplace** — `.claude-plugin/marketplace.json` with `{name, owner, plugins:[{name, source:"./"}]}`; install via `/plugin marketplace add LeadGrowGTM/loop-engineer` then `/plugin install loop-engineer@loop-engineer`; source tracks the repo default branch, so shipping = merging to master. *(plugin-marketplaces.md + nexus-mcp manifests on disk)*

## Design

### New files (the whole overlay)

```
.claude-plugin/plugin.json        name, version 1.0.0, description, author, repository,
                                  "agents": "./.claude/agents", "commands": "./.claude/commands"
.claude-plugin/marketplace.json   nexus-mcp shape; plugins: [{name: "loop-engineer", source: "./"}]
hooks/hooks.json                  SessionStart -> update-marketplace.sh (gtme pattern)
hooks/update-marketplace.sh       claude plugin marketplace update loop-engineer; exit 0
```

### Component map

| Today | As plugin |
|---|---|
| `.claude/agents/` — 4 build-loop agents + 2 benchmarking checkers | Auto-loaded everywhere; benchmarking checkers get "(experimental)" in descriptions |
| `skills/write-goal-prompt`, `skills/setup-harness` | `loop-engineer:write-goal-prompt`, `loop-engineer:setup-harness`; descriptions unchanged |
| `.claude/commands/benchmarking-loop.md` | `/loop-engineer:benchmarking-loop`, description flagged experimental |
| `.claude/workflows/*.js` | Ship inside plugin; invoked via `scriptPath: ${CLAUDE_PLUGIN_ROOT}/.claude/workflows/...` |
| `scripts/` | Ship inside plugin; referenced via `${CLAUDE_PLUGIN_ROOT}` |

### Path portability

Replace the `<loop-engineer>` placeholders (introduced by PR #16) with `${CLAUDE_PLUGIN_ROOT}` in: `skills/setup-harness/SKILL.md`, `skills/write-goal-prompt/SKILL.md` (launcher block), `.claude/commands/benchmarking-loop.md` (workflow scriptPaths), and any reference docs pointing at repo paths. This finishes de-hardcoding with a variable that actually resolves.

### Launcher routing

`write-goal-prompt`'s Execution Router gains a preflight: check `gnhf` and `pwsh` on PATH. Both present → offer the overnight gnhf path with `${CLAUDE_PLUGIN_ROOT}/scripts/launch-gnhf.ps1`. Either missing → route to the in-session `/goal` path and say why in one line. No `.ps1` port.

### setup-harness slimming

- **Delete** the agent-copy block from `scripts/setup-harness.ts` (and its copy-related tests). The plugin makes copies obsolete, and precedence makes leftover copies actively harmful.
- **Keep** per-repo seeding: `.harness/skill-routing.md`, `.harness/goals/`, `.tasks.toml`, `treehouse.toml`, gitignore lines, CLAUDE.md `## Harness` block (now stamped `Source: loop-engineer plugin v<version>`).
- **Smoke test** becomes: per-repo seeds present + plugin integrity (6 `harness-*.md` files under `${CLAUDE_PLUGIN_ROOT}/.claude/agents`).
- Routing template points at existing installed skills (superpowers TDD etc.), adding no in-house duplicates.

### Open implementation checks (verify during build, both have fallbacks)

1. **Bare agent-name resolution** — HARNESS.md templates and the workflow engines reference agents by bare name (`harness-planner`, `agentType: 'harness-inbounds-checker'`). Verify these resolve to plugin-provided agents once local copies are deleted. Fallback: switch references to `loop-engineer:`-prefixed names.
2. **Local-path marketplace install** — test installs use `/plugin marketplace add <local clone path>` (branch installs aren't a thing; source tracks default branch). Fallback: push to a scratch fork's master to test the GitHub flow.

### Migration (per machine, after the PR lands on master)

1. `/plugin marketplace add LeadGrowGTM/loop-engineer`
2. `/plugin install loop-engineer@loop-engineer`
3. **Mandatory cleanup** — delete the hand-copies or they silently override the plugin:
   - WSL machine: `~/MACH4_2/Brainstorm/.claude/agents/harness-*.md` and `~/MACH4_2/Brainstorm/.claude/skills/write-goal-prompt/`
   - Mitchell's machine: the `Everything_CC\.claude\agents\harness-*.md` and `Everything_CC\.claude\skills\write-goal-prompt\` copies
4. Releases: bump `version` in `plugin.json` + `marketplace.json`, merge to master; the SessionStart hook refreshes each machine.

### Verification plan

- `bun test` green after slimming (copy tests replaced by seed-only tests).
- Engine self-tests still green (`benchmark-climb --selftest`, import-clean checks).
- Live install proof on the WSL machine: add marketplace from the local clone, install, confirm skills/agents/command appear namespaced, then run one small in-session goal loop end-to-end through plugin-loaded agents.
- Router guard proof: with `gnhf` absent, the skill offers only the in-session path.

## Out of scope

- Full plugin-layout restructure (revisit when going public).
- Porting `launch-gnhf.ps1` to Linux (blocked on gnhf itself being Windows-only).
- First real benchmarking-loop run (separate follow-up; the flag comes off only after it survives one).
- The depth-limit doc inconsistency (5 vs 6) flagged in PR #17.
