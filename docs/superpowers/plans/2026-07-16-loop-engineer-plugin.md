# loop-engineer Plugin Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the loop-engineer repo into a self-marketplace Claude Code plugin (manifest overlay — no directory restructure) so the harness loads in every session on every machine.

**Architecture:** Add `.claude-plugin/` manifests pointing at the repo's existing component dirs, a SessionStart self-update hook (gtme pattern), `${CLAUDE_PLUGIN_ROOT}` path portability, a gnhf/pwsh launcher preflight, and slim `setup-harness.ts` to per-repo seeding only. Spec: `docs/superpowers/specs/2026-07-16-loop-engineer-plugin-design.md`.

**Tech Stack:** Claude Code plugin system (plugin.json / marketplace.json / hooks.json), Bun (scripts + tests), bash.

## Global Constraints

- Work on branch `charles-fork` of LeadGrowGTM/loop-engineer; commit per task; push at the end. NEVER run `git clean`, `git reset --hard`, or `git checkout -- .`.
- Commit messages: conventional prefix, plain sentences, NO em dashes, NO Claude attribution / Co-Authored-By lines.
- Plugin name: `loop-engineer`. Version everywhere: `1.0.0`.
- The 4 build-loop agents are `harness-planner.md`, `harness-maker.md`, `harness-prover.md`, `harness-checker.md`; the 2 benchmarking agents are `harness-inbounds-checker.md`, `harness-novelty-checker.md`.
- Run all tests with `bun test` from the repo root; suite must stay green after every task.
- Do not edit anything under `archive/` or `docs/adr/`.

---

### Task 1: Plugin + marketplace manifests

**Files:**
- Create: `.claude-plugin/plugin.json`
- Create: `.claude-plugin/marketplace.json`

**Interfaces:**
- Produces: plugin identity `loop-engineer@loop-engineer` (plugin@marketplace) that Tasks 8-9 install; `"agents": "./.claude/agents"` and `"commands": "./.claude/commands"` custom paths; version string `1.0.0` that Task 6 reads from `plugin.json`.

- [ ] **Step 1: Create `.claude-plugin/plugin.json`**

```json
{
  "name": "loop-engineer",
  "version": "1.0.0",
  "description": "Goal-loop harness for Claude Code: planner, maker, prover, checker build loops with tool-enforced checker isolation, plus an experimental benchmarking loop (sweep and climb). Durable phase slices, proof protocol, morning reports.",
  "author": { "name": "LeadGrowGTM", "url": "https://github.com/LeadGrowGTM" },
  "repository": "https://github.com/LeadGrowGTM/loop-engineer",
  "keywords": ["harness", "goal-loop", "agents", "eval-loop", "benchmarking"],
  "agents": "./.claude/agents",
  "commands": "./.claude/commands"
}
```

Note: `skills/` at repo root is auto-discovered; no manifest key needed. Custom `agents`/`commands` paths REPLACE the defaults, which is fine because no root `agents/` or `commands/` dirs exist.

- [ ] **Step 2: Create `.claude-plugin/marketplace.json`** (shape copied from the working nexus-mcp marketplace)

```json
{
  "name": "loop-engineer",
  "owner": { "name": "LeadGrowGTM" },
  "metadata": {
    "description": "loop-engineer: goal-loop harness plugin for Claude Code.",
    "version": "1.0.0",
    "repository": "https://github.com/LeadGrowGTM/loop-engineer"
  },
  "plugins": [
    {
      "name": "loop-engineer",
      "source": "./",
      "description": "Planner/Maker/Prover/Checker goal loops plus an experimental benchmarking loop",
      "version": "1.0.0",
      "category": "productivity"
    }
  ]
}
```

- [ ] **Step 3: Validate both files parse**

Run: `bun -e "for (const f of ['.claude-plugin/plugin.json','.claude-plugin/marketplace.json']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('manifests: valid JSON')"`
Expected: `manifests: valid JSON`

- [ ] **Step 4: Commit**

```bash
git add .claude-plugin/
git commit -m "feat(plugin): add plugin.json and marketplace.json (self-marketplace overlay)"
```

---

### Task 2: SessionStart self-update hook

**Files:**
- Create: `hooks/hooks.json`
- Create: `hooks/update-marketplace.sh`

**Interfaces:**
- Consumes: marketplace name `loop-engineer` from Task 1.
- Produces: auto-refresh of the marketplace at session start on any machine with the plugin installed (this is what makes releases propagate without manual `/plugin update`).

- [ ] **Step 1: Create `hooks/update-marketplace.sh`**

```bash
#!/bin/bash
# Auto-update the loop-engineer marketplace on session start (same pattern as gtme-skills)
claude plugin marketplace update loop-engineer 2>/dev/null
exit 0
```

- [ ] **Step 2: Make it executable**

Run: `chmod +x hooks/update-marketplace.sh && ls -l hooks/update-marketplace.sh`
Expected: mode shows `-rwxr-xr-x`

- [ ] **Step 3: Create `hooks/hooks.json`** (default discovery location — no manifest key needed)

```json
{
  "description": "loop-engineer hooks: auto-update the marketplace on session start",
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/hooks/update-marketplace.sh",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 4: Validate**

Run: `bun -e "JSON.parse(require('fs').readFileSync('hooks/hooks.json','utf8')); console.log('hooks.json: valid')" && bash -n hooks/update-marketplace.sh && echo "script: syntax ok"`
Expected: both lines print.

- [ ] **Step 5: Commit**

```bash
git add hooks/
git commit -m "feat(plugin): SessionStart hook keeps the marketplace current (gtme pattern)"
```

---

### Task 3: Flag the benchmarking pieces experimental

**Files:**
- Modify: `.claude/agents/harness-inbounds-checker.md:3`
- Modify: `.claude/agents/harness-novelty-checker.md:3`
- Modify: `.claude/commands/benchmarking-loop.md:2`

**Interfaces:**
- Consumes: nothing.
- Produces: user-visible "EXPERIMENTAL" markers; the flag comes off only after the benchmarking loop survives one real run (out of scope here).

- [ ] **Step 1: Edit `harness-inbounds-checker.md` frontmatter description**

Old (line 3 starts): `description: Fresh-context invariant enforcer for the benchmarking climb loop.`
New (same line, prefix added): `description: EXPERIMENTAL (benchmarking loop, no real-run trail yet). Fresh-context invariant enforcer for the benchmarking climb loop.`
Rest of the description line stays byte-identical.

- [ ] **Step 2: Edit `harness-novelty-checker.md` frontmatter description**

Old (line 3 starts): `description: Fresh-context duplicate detector for the benchmarking climb loop.`
New: `description: EXPERIMENTAL (benchmarking loop, no real-run trail yet). Fresh-context duplicate detector for the benchmarking climb loop.`

- [ ] **Step 3: Edit `benchmarking-loop.md` frontmatter description**

Old (line 2): `description: Run a benchmark spec through the benchmarking loop (sweep or climb) and write a ranked variant ledger`
New: `description: "EXPERIMENTAL: run a benchmark spec through the benchmarking loop (sweep or climb) and write a ranked variant ledger"`

- [ ] **Step 4: Verify**

Run: `grep -c "EXPERIMENTAL" .claude/agents/harness-inbounds-checker.md .claude/agents/harness-novelty-checker.md .claude/commands/benchmarking-loop.md`
Expected: `1` for each file.

- [ ] **Step 5: Commit**

```bash
git add .claude/agents/harness-inbounds-checker.md .claude/agents/harness-novelty-checker.md .claude/commands/benchmarking-loop.md
git commit -m "docs(benchmarking): flag the benchmarking loop experimental until it survives a real run"
```

---

### Task 4: ${CLAUDE_PLUGIN_ROOT} path portability sweep

**Files:**
- Modify: `skills/setup-harness/SKILL.md:36,55,69-71`
- Modify: `skills/write-goal-prompt/SKILL.md:488`
- Modify: `skills/write-goal-prompt/references/subagent-harness.md:37`
- Modify: `.claude/commands/benchmarking-loop.md:65-66,71,84,108`

**Interfaces:**
- Consumes: nothing (pure text substitution; the variable is substituted at skill/command load time per official docs).
- Produces: every bundled-file reference resolves on any machine. Task 6 additionally rewrites the smoke command's arguments.

- [ ] **Step 1: setup-harness SKILL.md replacements**

Line 36 old: `bun <loop-engineer>/scripts/setup-harness.ts install <repo-root>`
Line 36 new: `bun "${CLAUDE_PLUGIN_ROOT}/scripts/setup-harness.ts" install <repo-root>`

Line 55 old: `bun <loop-engineer>/scripts/setup-harness.ts smoke <repo-root> ~/.claude/agents`
Line 55 new: `bun "${CLAUDE_PLUGIN_ROOT}/scripts/setup-harness.ts" smoke <repo-root>`

Lines 69-71 old:
```
- Script: `<loop-engineer>/scripts/setup-harness.ts`
- Routing seed: `<loop-engineer>/skills/setup-harness/routing-template.md`
- Harness agents: `<loop-engineer>/.claude/agents/harness-*.md` (source of truth)
```
New:
```
- Script: `${CLAUDE_PLUGIN_ROOT}/scripts/setup-harness.ts`
- Routing seed: `${CLAUDE_PLUGIN_ROOT}/skills/setup-harness/routing-template.md`
- Harness agents: `${CLAUDE_PLUGIN_ROOT}/.claude/agents/harness-*.md` (source of truth)
```

- [ ] **Step 2: write-goal-prompt SKILL.md line 488**

Old: `pwsh <loop-engineer>\scripts\launch-gnhf.ps1 \``
New: `pwsh "${CLAUDE_PLUGIN_ROOT}\scripts\launch-gnhf.ps1" \``

- [ ] **Step 3: subagent-harness.md line 37**

Old: `tools/agent/agent-harness/.claude/agents/harness-*.md   ← source of truth (loop-engineer repo)`
New: `${CLAUDE_PLUGIN_ROOT}/.claude/agents/harness-*.md   ← source of truth (loop-engineer plugin)`

- [ ] **Step 4: benchmarking-loop.md engine paths**

Line 66 old: `` `bun .claude/workflows/benchmark-sweep.js <spec.json>`. Runs all N pre-declared ``
Line 66 new: `` `bun "${CLAUDE_PLUGIN_ROOT}/.claude/workflows/benchmark-sweep.js" <spec.json>`. Runs all N pre-declared ``

Then update the remaining engine references the same way. Run `grep -n '\.claude/workflows' .claude/commands/benchmarking-loop.md` and for every hit that is a runnable path (lines 65, 71, 84, 108 today), prefix with `${CLAUDE_PLUGIN_ROOT}/` so e.g. `.claude/workflows/benchmark-climb.js` becomes `${CLAUDE_PLUGIN_ROOT}/.claude/workflows/benchmark-climb.js`. Purely descriptive mentions of the filename without a path stay as they are.

- [ ] **Step 5: Verify zero placeholders remain outside the spec doc**

Run: `grep -rn '<loop-engineer>' --include=*.md . | grep -v docs/superpowers`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add skills/ .claude/commands/benchmarking-loop.md
git commit -m "feat(plugin): reference bundled files via CLAUDE_PLUGIN_ROOT so paths resolve on any machine"
```

---

### Task 5: gnhf/pwsh launcher preflight in write-goal-prompt

**Files:**
- Modify: `skills/write-goal-prompt/SKILL.md` (Execution Router section, insert after the `PROJECT_ROOT=` bash block that ends at line 44, before the paragraph starting "Then determine execution mode.")

**Interfaces:**
- Consumes: nothing.
- Produces: the skill never emits a gnhf/pwsh command on a machine that lacks the stack (today: the WSL machine has neither).

- [ ] **Step 1: Insert the preflight block**

Insert this markdown between the PROJECT_ROOT code fence and the "Then determine execution mode." paragraph:

```markdown
**Step 0.1 — Launcher preflight.** The gnhf autonomous path requires `gnhf` and `pwsh` on PATH. Check once per session:

```bash
command -v gnhf >/dev/null && command -v pwsh >/dev/null && echo "gnhf stack: available" || echo "gnhf stack: NOT available - in-session harness only"
```

If NOT available: do not offer, emit, or reference the gnhf / `launch-gnhf.ps1` path anywhere in this run. Route every task shape to the **in-session harness** and tell the operator once, in one line: "gnhf stack not installed on this machine, using the in-session path." The mode table below only applies in full when the stack is available.
```

- [ ] **Step 2: Verify placement and syntax**

Run: `grep -n "Step 0.1" skills/write-goal-prompt/SKILL.md && awk '/Step 0.1/,/mode table below/' skills/write-goal-prompt/SKILL.md | grep -c 'command -v gnhf'`
Expected: the heading line number (~46), then `1`.

- [ ] **Step 3: Commit**

```bash
git add skills/write-goal-prompt/SKILL.md
git commit -m "feat(router): preflight gnhf and pwsh so the skill never offers a path the machine cannot run"
```

---

### Task 6: Slim setup-harness.ts to per-repo seeding (TDD)

**Files:**
- Modify: `scripts/setup-harness.ts`
- Modify: `scripts/setup-harness.test.ts`
- Modify: `skills/setup-harness/SKILL.md:39-46,50` (the "This does atomically" list and smoke wording)

**Interfaces:**
- Consumes: `HARNESS_AGENTS` constant (exists on charles-fork), plugin version from Task 1's `plugin.json`.
- Produces: exported `BENCHMARK_AGENTS: readonly string[]` and `PLUGIN_AGENTS` (= HARNESS_AGENTS + BENCHMARK_AGENTS, 6 entries); `smokeTest(targetDir, agentsDir)` where `agentsDir` now means the PLUGIN SOURCE agents dir (defaulted in the CLI to `join(import.meta.dir, '../.claude/agents')`); `install <target>` that copies NOTHING and seeds per-repo files only.

- [ ] **Step 1: Update tests to the new contract (write failing tests first)**

In `scripts/setup-harness.test.ts`:

(a) Change the import line to:
```ts
import { scanSkills, seedRoutingTable, patchClaudeMd, smokeTest, HARNESS_AGENTS, BENCHMARK_AGENTS, PLUGIN_AGENTS } from './setup-harness';
```

(b) Replace the `describe('HARNESS_AGENTS', ...)` block with:
```ts
describe('agent constants', () => {
  test('HARNESS_AGENTS is the 4-agent build loop including the prover', () => {
    expect(HARNESS_AGENTS).toContain('harness-planner.md');
    expect(HARNESS_AGENTS).toContain('harness-maker.md');
    expect(HARNESS_AGENTS).toContain('harness-prover.md');
    expect(HARNESS_AGENTS).toContain('harness-checker.md');
    expect(HARNESS_AGENTS).toHaveLength(4);
  });

  test('PLUGIN_AGENTS adds the 2 benchmarking checkers (6 total ship in the plugin)', () => {
    expect(BENCHMARK_AGENTS).toContain('harness-inbounds-checker.md');
    expect(BENCHMARK_AGENTS).toContain('harness-novelty-checker.md');
    expect(PLUGIN_AGENTS).toHaveLength(6);
  });
});
```

(c) In the `smokeTest` describe block, update the two fixtures that scaffold agent files so they scaffold ALL PLUGIN_AGENTS:
- "all pass when all files exist": replace the `scaffold(Object.fromEntries(HARNESS_AGENTS...))` call with `scaffold(Object.fromEntries(PLUGIN_AGENTS.map((f) => [f, '---'])))`.
- "fails when harness-prover.md missing from agents dir": replace `HARNESS_AGENTS.filter(...)` with `PLUGIN_AGENTS.filter((f) => f !== 'harness-prover.md')`.
- "fails when skill-routing.md is too short": replace the 3-file scaffold with `scaffold(Object.fromEntries(PLUGIN_AGENTS.map((f) => [f, '---'])))`.
- "fails when harness-planner.md missing": replace its agentsDir scaffold with `scaffold(Object.fromEntries(PLUGIN_AGENTS.filter((f) => f !== 'harness-planner.md').map((f) => [f, '---'])))`.

- [ ] **Step 2: Run tests, confirm red**

Run: `bun test scripts/setup-harness.test.ts 2>&1 | tail -5`
Expected: FAIL (BENCHMARK_AGENTS / PLUGIN_AGENTS not exported).

- [ ] **Step 3: Implement in `scripts/setup-harness.ts`**

(a) Below the `HARNESS_AGENTS` constant add:
```ts
// The 2 benchmarking-loop checkers also ship in the plugin (experimental until a real run).
export const BENCHMARK_AGENTS = [
  'harness-inbounds-checker.md',
  'harness-novelty-checker.md',
] as const;

// Everything the plugin ships; smoke verifies plugin integrity against this list.
export const PLUGIN_AGENTS = [...HARNESS_AGENTS, ...BENCHMARK_AGENTS] as const;
```

(b) In `smokeTest`, change the agent checks to iterate `PLUGIN_AGENTS` and relabel:
```ts
    ...PLUGIN_AGENTS.map((f) => ({
      check: `${f} in plugin agents dir`,
      passed: existsSync(join(agentsDir, f)),
    })),
```

(c) In the CLI `smoke` branch, default the second arg to the plugin source:
```ts
  } else if (cmd === 'smoke') {
    const results = smokeTest(rest[0], rest[1] ?? join(import.meta.dir, '../.claude/agents'));
```

(d) In the CLI `install` branch: DELETE the `agentsDir` HOME line, the `mkdirSync(agentsDir, ...)` line, and the whole `for (const f of HARNESS_AGENTS) { copyFileSync... }` loop. Keep `sourceAgentsDir`. Change the guard to check `PLUGIN_AGENTS` and reword:
```ts
    // Plugin integrity: all shipped agents must exist in the plugin source.
    const missingAgents = PLUGIN_AGENTS.filter((f) => !existsSync(join(sourceAgentsDir, f)));
    if (missingAgents.length) {
      console.error(`✗ plugin agents missing from ${sourceAgentsDir}: ${missingAgents.join(', ')}`);
      console.error('  Aborting: this plugin checkout is incomplete.');
      process.exit(1);
    }
```

(e) In the CLAUDE.md block writer, read the plugin version and stamp the new wording. Above the `const block =` line add:
```ts
      const pluginVersion = (() => { try { return JSON.parse(readFileSync(join(import.meta.dir, '../.claude-plugin/plugin.json'), 'utf8')).version ?? 'unknown'; } catch { return 'unknown'; } })();
```
Replace the block's first line so it reads:
```ts
      const block = `## Harness\nInstalled: ${new Date().toISOString().slice(0, 10)}. Source: loop-engineer plugin v${pluginVersion} (LeadGrowGTM/loop-engineer@${sha}).\nRouting: \`.harness/skill-routing.md\`. Goals: \`.harness/goals/<slug>/\`. Backlog: \`.tasks.toml\` → \`.claude/backlog.md\` (project-scoped). Worktrees: \`treehouse.toml\` (project-scoped; \`launch-gnhf.ps1\` auto-leases an isolated worktree when a parallel gnhf run is detected). Agents: loop-engineer plugin (auto-loaded).`;
```

(f) At the end of the install branch, pass the source dir to the final smoke: `const smoke = smokeTest(targetDir, sourceAgentsDir);`

(g) Remove `copyFileSync` from the fs import if nothing else uses it (verify with `grep -c copyFileSync scripts/setup-harness.ts`, expect 1 hit = the import, then remove it).

- [ ] **Step 4: Run full suite, confirm green**

Run: `bun test 2>&1 | tail -4`
Expected: `24 pass / 0 fail` (23 on charles-fork today, minus the replaced HARNESS_AGENTS-only describe, plus the two new constant tests; if the count differs, every test must still pass).

- [ ] **Step 5: Exercise install end-to-end in a sandbox**

Run:
```bash
SB=$(mktemp -d) && printf '# T\n\n## Other\nx\n' > "$SB/CLAUDE.md" && bun scripts/setup-harness.ts install "$SB" && grep -o 'loop-engineer plugin v[0-9.]*' "$SB/CLAUDE.md"
```
Expected: no "Copied" lines in the output, all smoke checks ✓, and `loop-engineer plugin v1.0.0` printed. Also confirm nothing was written to `~/.claude/agents`: `ls ~/.claude/agents/harness-*.md 2>/dev/null | wc -l` → `0`.

- [ ] **Step 6: Update `skills/setup-harness/SKILL.md` step list to match**

In the "This does atomically" list: delete item 1 ("Copies `harness-planner.md`, ...") and renumber; append a new final item `7. Verifies plugin integrity (6 agent files present in the plugin)`. Change item about smoke to `Runs smoke test with ✓/✗ per check (8 checks: 6 plugin agent files, skill-routing.md, ## Harness block)`. Change line 50 `If all 6 checks pass` to `If all 8 checks pass`. Change line 65 to: `- To update agents: the plugin updates itself via the marketplace; bump the version in .claude-plugin/plugin.json and merge to master to release.`

- [ ] **Step 7: Commit**

```bash
git add scripts/setup-harness.ts scripts/setup-harness.test.ts skills/setup-harness/SKILL.md
git commit -m "feat(setup): stop copying agents, the plugin ships them; setup-harness seeds per-repo files only"
```

---

### Task 7: README + repo CLAUDE.md describe the plugin

**Files:**
- Modify: `README.md:101-107` (Installation section)
- Modify: `CLAUDE.md` (Repo Map table)

**Interfaces:**
- Consumes: install commands from Task 1, dev-override behavior (project > plugin precedence).
- Produces: accurate install docs for both machines and future public users.

- [ ] **Step 1: Replace the README Installation section**

Old section (starts `## Installation`, ends `...workspace copies stay in sync.`) becomes:

```markdown
## Installation

loop-engineer is a Claude Code plugin, and this repo is also its marketplace:

```
/plugin marketplace add LeadGrowGTM/loop-engineer
/plugin install loop-engineer@loop-engineer
```

Agents, skills, and the `/loop-engineer:benchmarking-loop` command load automatically in every session on every machine; a SessionStart hook keeps the plugin current. Per-repo wiring (skill routing, `.harness/`, backlog, worktree pool) is seeded by running `/loop-engineer:setup-harness` inside a target repo.

Dev note: when working inside this repo, the project-level `.claude/agents/` definitions override the installed plugin's (project > user > plugin precedence), so you can edit agents locally and test before releasing. Release = bump `version` in `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`, then merge to master.
```

- [ ] **Step 2: Add two rows to the CLAUDE.md Repo Map table**

After the first table row, insert:
```markdown
| `.claude-plugin/` | Plugin + marketplace manifests: this repo installs as the `loop-engineer` Claude Code plugin |
| `hooks/` | Plugin SessionStart hook that auto-updates the marketplace |
```

- [ ] **Step 3: Verify**

Run: `grep -c "plugin marketplace add" README.md && grep -c ".claude-plugin" CLAUDE.md`
Expected: `1` and at least `1`.

- [ ] **Step 4: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: installation is now the plugin flow; note the dev override and release steps"
```

---

### Task 8: Live install verification (local marketplace), then clean up

**Files:**
- None modified. Verification only. Run from the repo root; `$PWD` must be the clone.

**Interfaces:**
- Consumes: everything from Tasks 1-7.
- Produces: proof the plugin installs and carries all components. IMPORTANT: this local-path marketplace is temporary (the scratchpad clone is wiped between sessions), so it MUST be removed at the end of the task; the durable install happens from GitHub after the PR merges (Task 9).

- [ ] **Step 1: Discover exact CLI verbs**

Run: `claude plugin --help 2>&1 | head -30`
Expected: subcommands including `marketplace`, `install`, `list`, `uninstall` (exact names may vary; use what help prints for the following steps).

- [ ] **Step 2: Add the clone as a marketplace and install**

```bash
claude plugin marketplace add "$PWD"
claude plugin install loop-engineer@loop-engineer
claude plugin list 2>&1 | grep -i loop-engineer
```
Expected: install succeeds; list shows `loop-engineer` v1.0.0 enabled.

- [ ] **Step 3: Assert the installed cache carries all components**

```bash
C=$(ls -d ~/.claude/plugins/cache/loop-engineer/loop-engineer/*/ | head -1)
ls "$C/.claude/agents" | wc -l          # expect 6
ls "$C/skills"                          # expect setup-harness  write-goal-prompt
ls "$C/.claude/commands"                # expect benchmarking-loop.md
ls "$C/hooks"                           # expect hooks.json  update-marketplace.sh
```
Expected: counts and names as annotated.

- [ ] **Step 4: Clean up the temporary local marketplace**

```bash
claude plugin uninstall loop-engineer@loop-engineer
claude plugin marketplace remove loop-engineer
claude plugin list 2>&1 | grep -ci loop-engineer
```
Expected: final grep prints `0`. (If the remove verb differs, use what `claude plugin marketplace --help` prints.)

- [ ] **Step 5: Record the result**

Append one line to the PR-notes scratch (no commit): verification passed with CLI version output of `claude --version`.

---

### Task 9: Push, PR to master, and the migration runbook

**Files:**
- None modified in this repo beyond what previous tasks committed.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: pushed `charles-fork`; a PR to master (USER GATE: open it only when the user says ship, since Mitchell owns master); the migration steps each machine runs after merge.

- [ ] **Step 1: Full-suite final check**

Run: `bun test 2>&1 | tail -3 && bun .claude/workflows/benchmark-climb.js --selftest 2>&1 | tail -1`
Expected: all tests pass; climb demo `15 passed, 0 failed`.

- [ ] **Step 2: Push**

```bash
git push origin charles-fork
```

- [ ] **Step 3: USER GATE, then PR**

Ask the user before opening. PR body: what changed (plugin overlay, self-update hook, portable paths, launcher preflight, setup slimming) and how to test (Task 8 commands). No em dashes, plain voice, no conversation context.

- [ ] **Step 4: Migration runbook (runs AFTER the PR merges to master; do not run now)**

Per machine:
```bash
/plugin marketplace add LeadGrowGTM/loop-engineer
/plugin install loop-engineer@loop-engineer
```
Then MANDATORY cleanup (stale copies override the plugin due to project > user > plugin precedence):
- WSL machine: first `diff -r ~/MACH4_2/Brainstorm/.claude/skills/write-goal-prompt <repo>/skills/write-goal-prompt` and diff each `~/MACH4_2/Brainstorm/.claude/agents/harness-*.md` against the repo copies; if identical, delete them; if diverged, port the divergence into the repo FIRST, then delete.
- Mitchell's machine: same for `Everything_CC\.claude\agents\harness-*.md` and `Everything_CC\.claude\skills\write-goal-prompt\`.

Then the bare-name checkpoint: in a fresh session in any repo, ask Claude to spawn agent `harness-planner`. If it does not resolve, update bare agent references to `loop-engineer:`-prefixed names in: `skills/write-goal-prompt/references/subagent-harness.md` (HARNESS templates), `.claude/workflows/benchmark-climb.js` (`agentType: 'harness-inbounds-checker'` and `'harness-novelty-checker'`), and any HARNESS.md authoring instructions that name agents; bump the plugin version and re-release.
```

---

## Self-Review Notes

- Spec coverage: manifests (T1), self-update (T2), experimental flags (T3), path portability (T4), launcher preflight (T5), setup slimming + smoke redefinition + CLAUDE.md stamp (T6), install docs + dev override (T7), live install proof + cleanup rationale (T8), ship + migration + bare-name fallback (T9). Out-of-scope items from the spec are not planned, as specified.
- Types/names consistent: `HARNESS_AGENTS` (4), `BENCHMARK_AGENTS` (2), `PLUGIN_AGENTS` (6), `smokeTest(targetDir, agentsDir)` semantics changed in T6 and reflected in its own SKILL.md edits.
- No placeholders: every step carries exact content or an exact discovery command with expected output.
