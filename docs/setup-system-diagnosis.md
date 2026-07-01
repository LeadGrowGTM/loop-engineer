# Setup System Diagnosis

The setup-harness script has six confirmed defects. This document names each defect with file:line evidence and outlines prioritized fixes.

## Confirmed Defects

### 1. Prover-Not-Installed Defect (ACTIVE, SILENT)
**Location:** `scripts/setup-harness.ts:156`

**Symptom:** Running `/setup-harness install <dir>` copies only three agents to `~/.claude/agents/`:
```
for (const f of ['harness-planner.md', 'harness-maker.md', 'harness-checker.md']) {
  copyFileSync(join(sourceAgentsDir, f), join(agentsDir, f));
}
```

The array omits `'harness-prover.md'`. Yet:
- The repo's own `.claude/agents/` has all four files (confirmed via glob).
- The README.md documents a "4-agent harness" loop (Planner → Maker → Prover → Checker).
- Global `~/.claude/agents/` already contains `harness-prover.md` from a prior manual workaround.

**Impact:** Anyone running `/setup-harness` gets a 3-agent harness even though the architecture promises 4. The missing Prover agent breaks any running-app goal loop that depends on PROOF verification.

### 2. Smoke-Test Gap (MASKS DEFECT #1)
**Location:** `scripts/setup-harness.ts:106-134` (smokeTest function)

The smoke-test hardcodes checks for only three agents (lines 113, 117, 121):
```
{
  check: 'harness-planner.md in agents dir',
  passed: existsSync(join(agentsDir, 'harness-planner.md')),
},
{
  check: 'harness-maker.md in agents dir',
  passed: existsSync(join(agentsDir, 'harness-maker.md')),
},
{
  check: 'harness-checker.md in agents dir',
  passed: existsSync(join(agentsDir, 'harness-checker.md')),
},
```

No check for `harness-prover.md`. Result: a broken install (defect #1) still reports all-green smoke output, so the defect went undetected.

**Impact:** The mechanical gate (the smoke test) does not cover the 4th agent, so a broken install looks like a successful install.

### 3. Duplicated Agent Enumeration (ROOT CAUSE OF DRIFT)
**Location:** `scripts/setup-harness.ts:156` (install copy loop) and lines 113, 117, 121 (smoke checks)

The "which agents ship" is written independently in two places:
- Line 156: Array literal in the install copy loop
- Lines 113, 117, 121: Three separate hardcoded `check:` strings in the smoke test

When `harness-prover.md` was added to the repo's `.claude/agents/` directory, neither list was updated. This is exactly why defects #1 and #2 silently drifted out of sync.

**Root cause:** No shared constant. If there were a single `const AGENT_FILES = ['harness-planner.md', 'harness-maker.md', 'harness-checker.md', 'harness-prover.md']` at the top level, both the install loop and smoke checks would reference it, and adding a new agent would only require one edit.

### 4. Unwired Seed and Patch CLI Commands
**Location:** `scripts/setup-harness.ts:6-9` (usage) vs lines 141-182 (CLI dispatcher)

The top-of-file usage comment documents two commands as standalone invocable:
```
Usage (called by the skill prompt):
  bun scripts/setup-harness.ts seed <dir> <template-path>
  bun scripts/setup-harness.ts patch <claude-md-path> <block-string>
```

But the CLI dispatcher (lines 141-182) only handles:
- `cmd === 'scan'` (line 141)
- `cmd === 'smoke'` (line 144)
- `cmd === 'install'` (line 150)

The functions `seedRoutingTable()` (defined at line 71) and `patchClaudeMd()` (defined at line 89) exist and are called *only* indirectly from inside the `install` branch — they are not exposed as standalone commands.

**Impact:** The usage comment promises a CLI interface that doesn't exist. Any attempt to run `bun scripts/setup-harness.ts seed ...` directly will fail with "Commands: scan ... install ..." (line 181).

### 5. Missing Uninstall Command
**Location:** `scripts/setup-harness.ts` (no uninstall branch)

There is no command to reverse an install. An install does four things:
1. Copies agent files to `~/.claude/agents/` (lines 156-159)
2. Writes `.harness/skill-routing.md` (lines 161-167)
3. Patches CLAUDE.md with a `## Harness` block (lines 169-175)
4. Runs smoke test (line 177)

There is no corresponding `uninstall` command to:
- Remove the copied agent files from `~/.claude/agents/`
- Delete `.harness/skill-routing.md`
- Strip the `## Harness` block from CLAUDE.md

This makes the harness difficult to cleanly remove or re-setup if something goes wrong.

### 6. Cross-Repo Generalization Defect
**Location:** `scripts/setup-harness.ts:171-172`

Line 171 uses the CommonJS global `__dirname`:
```javascript
const sha = (() => { try { return require('child_process').execSync('git -C ' + __dirname + ' rev-parse --short HEAD', { encoding: 'utf8' }).trim(); } catch { return 'unknown'; } })();
```

Yet the rest of the file uses `import.meta.dir` (lines 153, 161):
```javascript
const sourceAgentsDir = join(import.meta.dir, '../.claude/agents');
const templatePath = join(import.meta.dir, '../skills/setup-harness/routing-template.md');
```

**Additional issue:** Line 172 hardcodes the literal string `'LeadGrowGTM/loop-engineer'` as the source repo name:
```javascript
const block = `## Harness\nInstalled: ${new Date().toISOString().slice(0, 10)}. Source: LeadGrowGTM/loop-engineer@${sha}.\nRouting: \`.harness/skill-routing.md\`. Agents: global (\`~/.claude/agents/\`).`;
```

If this script is vendored into another repository (e.g., `LeadGrowGTM/some-other-project`), it will:
- Use `__dirname` inconsistently with the rest of the file (potential path misattribution)
- Always claim the source is `LeadGrowGTM/loop-engineer` regardless of the actual origin

**Impact:** The script is not portable to other repos. Generalization would require deriving the repo name from `git remote get-url origin` and consistently using `import.meta.dir` throughout.

## Prioritized Fixes

1. **Fix defect #1 (Prover install)** — Add `'harness-prover.md'` to the copy loop at line 156. This is the active, silently-broken defect affecting all new setups.

2. **Fix defect #2 (Smoke-test gap)** — Add a check for `harness-prover.md` to the smokeTest() return array (around line 124). This ensures the mechanical gate catches future drift.

3. **Fix defect #3 (DRY)** — Extract a shared `const AGENT_FILES = [...]` constant at the top level (around line 16-17, after types). Update both the install loop (line 156) and smokeTest() (lines 113, 117, 121) to reference it. This prevents the two lists from drifting again.

4. **Fix defect #4 (CLI wiring)** — Add `else if (cmd === 'seed')` and `else if (cmd === 'patch')` branches to the CLI dispatcher (around line 150), delegating to the existing functions. Update the usage comment (line 6-9) to match the actual dispatcher, or vice versa.

5. **Fix defect #5 (Uninstall)** — Add an `else if (cmd === 'uninstall')` branch that reverses the three write operations: deletes agent files, removes `.harness/skill-routing.md`, and strips the `## Harness` block from CLAUDE.md. Update the usage comment to include it.

6. **Fix defect #6 (Generalization)** — Replace the hardcoded `'LeadGrowGTM/loop-engineer'` string with a dynamic lookup: `git remote get-url origin` and extract the repo name. Consistently use `import.meta.dir` instead of `__dirname` to avoid path misattribution if the script is vendored.

## Notes

- Defects #1 and #2 are tightly coupled: #2 masks #1, which is why #1 went undetected. Both must be fixed together to restore correctness and visibility.
- Defect #3 is the root cause of #1/#2 drifting — fixing it prevents future agent-list synchronization bugs.
- Defects #4 and #5 are CLI completeness issues (unwired commands, missing uninstall) — lower priority than #1/#2/#3, but important for usability.
- Defect #6 is a portability issue — affects scenarios where the script is copied to another repo.
