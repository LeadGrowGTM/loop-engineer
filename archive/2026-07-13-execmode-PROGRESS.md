# PROGRESS.md — harness-execmode-redteam

Execution phases and mechanical gate proof.

## Goal-agent gate re-run (post-Maker) — 2 fixes, commit 3875d12

Independent gate caught two failures the Maker self-report marked PASS:
- `bun -e "import('./.claude/workflows/red-team.js')"` → was EXIT=1 (top-level `return` +
  executor-global refs illegal in an ESM module). Fixed: orchestration moved into
  `export async function run()` + guarded auto-invoke. Re-run → `BUN_EXIT=0`.
- 4 mode slugs `single-run/goal-loop/time-loop/dynamic-workflow` → were 0 matches each
  (doc used prose names only). Fixed: added canonical `id` column. Re-run → 1 each.
Both re-synced repo→global (diff empty). Full gate now green across all 8 Done checks.

## Phase 1: Router — COMPLETE
Skill invoked: direct implementation
Artifact: `C:\Users\mitch\Everything_CC\agent-harness\skills\write-goal-prompt\references\execution-mode-routing.md`
Mechanical gate: `grep -c "## Decision order" skills/write-goal-prompt/references/execution-mode-routing.md` → exit 0
PROOF:
  grep returned 1 match for "## Decision order"
  File covers 4 modes: single-run, goal-loop, time-based-loop, dynamic-workflow
  Decision order is first-match-wins (lines 20-40)
  Interval guidance present: "match interval to how often the watched thing changes" (line 45)
  Mode-nesting section describes goal-loop-spawns-workflow, workflow-contains-loop, time-loop-runs-single-pass (lines 60-68)
  File references Anthropic source articles at top (lines 8-9)
Commit: 6cedabe — Phase 1: Harden execution-mode-routing.md reference

## Phase 2: Red-team — COMPLETE
Skill invoked: direct implementation
Artifact: `.claude/workflows/red-team.js`
Mechanical gate: `grep -c "meta.name = 'red-team'" .claude/workflows/red-team.js` → exit 0
PROOF:
  meta.name = 'red-team' confirmed at line 2
  4 parallel attack roles: hostile user, careless user, performance, security (lines 65-86)
  Real barrier: `const perRole = await parallel(...)` at line 92 ensures all roles complete before merge
  Worst-first severity ordering in merge instructions (lines 136-142)
  FINDINGS_SCHEMA defines per-role schema (lines 22-40)
  MERGE_SCHEMA defines merged output schema with foundBy as array (lines 114-132)
  Top comment added explaining Workflow-DSL runtime context (lines 1-4)
Commit: 6cedabe — Phase 2: Document red-team.js as Workflow-DSL script

## Phase 3: First-principles — COMPLETE
Skill invoked: direct implementation
Artifacts:
  - `C:\Users\mitch\Everything_CC\agent-harness\skills\write-goal-prompt\references\first-principles-generation.md`
  - `.claude/agents/harness-planner.md` (wired)
  - `.claude/agents/harness-maker.md` (wired)
Mechanical gate: `grep "first-principles-generation.md" .claude/agents/harness-planner.md .claude/agents/harness-maker.md | wc -l` → exit 0
PROOF:
  harness-planner.md references first-principles-generation.md (line 16: "read references/first-principles-generation.md")
  harness-maker.md references first-principles-generation.md (line 15: "read references/first-principles-generation.md")
  Reference file contains Planner principle: decompose from observable outcomes (lines 8-18)
  Reference file contains Maker principle: reasoning before code (lines 20-31)
  Both agent files reference the filename: 2 hits confirmed
Commit: a239da5 — Phase 3: Write first-principles-generation reference and wire into agents

## Phase 4: Setup diagnosis — COMPLETE
Skill invoked: direct implementation
Artifact: `C:\Users\mitch\Everything_CC\agent-harness\docs\setup-system-diagnosis.md`
Mechanical gate: `grep -c "scripts/setup-harness.ts:156" docs/setup-system-diagnosis.md && grep -c "smokeTest()" docs/setup-system-diagnosis.md` → exit 0
PROOF:
  Defect 1 citation: scripts/setup-harness.ts:156 (install copy loop missing harness-prover.md)
  Smoke-test gap citation: smokeTest() function at lines 106-134
  Both defects cited with file:line evidence and code excerpts
  Duplicate enumeration defect explained
  Unwired CLI commands documented (seed/patch at lines 6-9 vs dispatcher at lines 141-182)
  Missing uninstall command flagged
  Cross-repo generalization defect at lines 171-172 (hardcoded repo name + __dirname)
  Prioritized fix list provided (6 defects in priority order)
Commit: a0d8301 — Phase 4: Write setup system diagnosis

## Phase 5: Wire + sync — COMPLETE
Skill invoked: direct implementation
Artifacts:
  - Repo: `C:\Users\mitch\Everything_CC\agent-harness\skills\write-goal-prompt\SKILL.md` (new Execution Mode Routing section)
  - Global sync: `~/.claude/skills/write-goal-prompt/references/`, `~/.claude/agents/`, `~/.claude/workflows/`
Mechanical gate: `ls ~/.claude/agents/harness-planner.md ~/.claude/agents/harness-maker.md ~/.claude/workflows/red-team.js ~/.claude/skills/write-goal-prompt/references/execution-mode-routing.md ~/.claude/skills/write-goal-prompt/references/first-principles-generation.md | wc -l` → exit 0 (5 files)
PROOF:
  New \"Execution Mode Routing\" section added to repo SKILL.md (after Reference Files)
  Section points at references/execution-mode-routing.md
  Section notes red-team.js as concrete dynamic-workflow example
  Distinct heading \"Execution Mode Routing\" avoids collision with global's \"Execution Router\"
  Cross-reference explains orthogonal axes (task shape vs infrastructure choice)
  All 5 changed files synced to global ~/.claude location:
    - /c/Users/mitch/.claude/skills/write-goal-prompt/references/execution-mode-routing.md
    - /c/Users/mitch/.claude/skills/write-goal-prompt/references/first-principles-generation.md
    - /c/Users/mitch/.claude/agents/harness-planner.md
    - /c/Users/mitch/.claude/agents/harness-maker.md
    - /c/Users/mitch/.claude/workflows/red-team.js (net-new)
  Global SKILL.md updated with new Reference Files entries + Execution Mode Routing section
  Global's gnhf/tasks-axi/Execution Router content preserved (no overwrite)
Commit: e675a15 — Phase 5: Wire execution mode routing section and sync files globally

