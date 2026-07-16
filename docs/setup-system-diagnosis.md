# Setup System Diagnosis

The setup-harness script had six confirmed defects. This document names each defect with file:line evidence and outlines prioritized fixes. Defects #1-#3 are now **RESOLVED** (see status notes); #4-#6 are still open.

## Confirmed Defects

### 1. Prover-Not-Installed Defect (RESOLVED)
**Location:** `scripts/setup-harness.ts:156`

**Symptom (as originally found):** Running `/setup-harness install <dir>` copied only three agents to `~/.claude/agents/`:
```
for (const f of ['harness-planner.md', 'harness-maker.md', 'harness-checker.md']) {
  copyFileSync(join(sourceAgentsDir, f), join(agentsDir, f));
}
```

The array omitted `'harness-prover.md'`. Yet:
- The repo's own `.claude/agents/` has all five files (confirmed via glob).
- The README.md documents a "5-agent harness" loop (Planner → Maker → Prover → Checker → Shipper).
- Global `~/.claude/agents/` already contains `harness-prover.md` from a prior manual workaround.

**Impact (as originally found):** Anyone running `/setup-harness` got a 3-agent harness even though the architecture promised 4. The missing Prover agent broke any running-app goal loop that depended on PROOF verification.

**Status:** Fixed — the install loop now iterates the shared `AGENT_FILES` constant (`scripts/setup-harness.ts:29-35`), which includes `harness-prover.md` and `harness-shipper.md`.

### 2. Smoke-Test Gap (RESOLVED — was masking defect #1)
**Location:** `scripts/setup-harness.ts:106-134` (smokeTest function)

The smoke-test used to hardcode checks for only three agents (lines 113, 117, 121):
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

No check for `harness-prover.md`. Result: a broken install (defect #1) still reported all-green smoke output, so the defect went undetected.

**Impact (as originally found):** The mechanical gate (the smoke test) did not cover the 4th agent, so a broken install looked like a successful install.

**Status:** Fixed — `smokeTest()` now maps over `AGENT_FILES` (`scripts/setup-harness.ts:119-123`) to generate one check per agent file, currently five.

### 3. Duplicated Agent Enumeration (RESOLVED — was root cause of drift)
**Location:** `scripts/setup-harness.ts:156` (install copy loop) and lines 113, 117, 121 (smoke checks)

The "which agents ship" used to be written independently in two places:
- Line 156: Array literal in the install copy loop
- Lines 113, 117, 121: Three separate hardcoded `check:` strings in the smoke test

When `harness-prover.md` was added to the repo's `.claude/agents/` directory, neither list was updated. This is exactly why defects #1 and #2 silently drifted out of sync.

**Root cause (as originally found):** No shared constant.

**Status:** Fixed — `scripts/setup-harness.ts:29-35` now defines `export const AGENT_FILES = ['harness-planner.md', 'harness-maker.md', 'harness-prover.md', 'harness-checker.md', 'harness-shipper.md']`, and both the install loop and `smokeTest()` reference it. Adding `harness-shipper.md` required only one edit to this list.

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

1. ~~**Fix defect #1 (Prover install)**~~ — **DONE.** The copy loop now iterates `AGENT_FILES`, which includes `harness-prover.md`.

2. ~~**Fix defect #2 (Smoke-test gap)**~~ — **DONE.** `smokeTest()` generates one check per entry in `AGENT_FILES`.

3. ~~**Fix defect #3 (DRY)**~~ — **DONE.** `export const AGENT_FILES = [...]` lives at `scripts/setup-harness.ts:29-35`; both the install loop and `smokeTest()` reference it.

4. **Fix defect #4 (CLI wiring)** — Add `else if (cmd === 'seed')` and `else if (cmd === 'patch')` branches to the CLI dispatcher (around line 150), delegating to the existing functions. Update the usage comment (line 6-9) to match the actual dispatcher, or vice versa. Still open.

5. **Fix defect #5 (Uninstall)** — Add an `else if (cmd === 'uninstall')` branch that reverses the three write operations: deletes agent files, removes `.harness/skill-routing.md`, and strips the `## Harness` block from CLAUDE.md. Update the usage comment to include it. Still open.

6. **Fix defect #6 (Generalization)** — Replace the hardcoded `'LeadGrowGTM/loop-engineer'` string with a dynamic lookup: `git remote get-url origin` and extract the repo name. Consistently use `import.meta.dir` instead of `__dirname` to avoid path misattribution if the script is vendored. Still open.

## Notes

- Defects #1 and #2 were tightly coupled: #2 masked #1, which is why #1 went undetected. Both were fixed together, via the shared `AGENT_FILES` constant from defect #3's fix.
- Defect #3's fix (the `AGENT_FILES` constant) is also what made adding the 5th agent (`harness-shipper.md`) a one-line change instead of a repeat of #1/#2.
- Defects #4 and #5 are CLI completeness issues (unwired commands, missing uninstall) — lower priority than #1/#2/#3, but still open and important for usability.
- Defect #6 is a portability issue — affects scenarios where the script is copied to another repo. Still open.
