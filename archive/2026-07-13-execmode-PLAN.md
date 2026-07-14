# PLAN.md

## Phases

0. **Firstmate check** — skill: direct — artifact: proof pasted into PROGRESS.md (no file written)
   Run `git log --all -i --grep=firstmate` and `grep -ri firstmate .` (repo root) exactly once each.
   Expect zero matches on both. Paste the literal empty output as proof. Do NOT alter git history
   regardless of result — this is a read-only confirmation, not a trigger for action.

1. **Router** — skill: direct — artifact: `skills/write-goal-prompt/references/execution-mode-routing.md`
   Harden the existing draft (already covers 4 modes, first-match-wins order, interval guidance,
   nesting — verify each is airtight, don't rewrite from scratch). Confirm against the two Anthropic
   source articles ("Getting started with loops"; "A harness for every task: dynamic workflows in
   Claude Code") that: the 4 modes are complete, the decision-order walk is unambiguous (no two rules
   can both fire on the same input), the interval rule ("match interval to how often the watched
   thing changes") is explicit, and the mode-nesting section correctly describes goal-loop-spawns-
   workflow / workflow-contains-loop / time-loop-runs-single-pass as real, cited examples (the file
   already names `.claude/workflows/red-team.js` as the nested example from Phase 2 — verify that
   reference stays accurate after Phase 2's edits).

2. **Red-team** — skill: direct — artifact: `.claude/workflows/red-team.js`
   Harden the existing draft. Confirm/fix: `meta.name === 'red-team'` (currently line 2, verify),
   exactly 4 parallel attack roles each with a distinct lens and no overlap (hostile user, careless
   user, performance, security — currently present), a real barrier before merge (the `parallel(...)`
   call must fully resolve before the merge `agent()` call — currently structured correctly, verify
   no early-return path skips the barrier), worst-first severity ordering in the merge instructions
   (critical → high → medium → low, explicit in the merge prompt), and schema validation on BOTH
   `FINDINGS_SCHEMA` (per-role) and `MERGE_SCHEMA` (post-merge) — confirm required fields match what
   the merge step actually reads (e.g. merge output requires `foundBy` as an array; per-role output
   uses a bare `foundBy` string appended post-hoc at line ~105 — verify no type mismatch survives
   through to the final schema). Finally: syntax-check the file cleanly imports under bun — run
   `bun build --no-bundle .claude/workflows/red-team.js` (or `node --check` equivalent) and paste the
   real output as proof; a script written against Workflow-DSL globals (`phase`, `parallel`, `agent`,
   `log`, `args`) will throw at runtime outside the Workflow executor — "imports clean" here means
   zero syntax errors, not a standalone execution. Document that distinction inline in the file's
   top comment if not already clear.

3. **First-principles** — skill: direct — artifact: `skills/write-goal-prompt/references/first-principles-generation.md` + edits to `.claude/agents/harness-planner.md` and `.claude/agents/harness-maker.md`
   Write the new reference: a short directive on decomposing from first principles (what does the
   user actually observe when this is done — not what artifact exists) for Planner, and
   reasoning-before-code (state the approach and why, in 1-3 sentences, before writing/editing) for
   Maker. Then wire it — not just write it:
   - In `harness-planner.md`, add a line under "## Process" (or a new short subsection) that
     references `references/first-principles-generation.md` and instructs the Planner to apply it
     when decomposing phases.
   - In `harness-maker.md`, add a line under "## Process" that references the same file and
     instructs the Maker to state its reasoning before invoking Edit/Write/Bash for non-trivial
     changes.
   Checker dimension "First-principles wiring" scores 1/5 if the reference file exists but neither
   agent file mentions it — the reference must be linked from both, verifiably (a grep for the
   filename must return a hit in each agent file).

4. **Setup diagnosis** — skill: direct — artifact: `docs/setup-system-diagnosis.md`
   Write the diagnosis using the confirmed (not guessed) defects below — every claim must cite
   `scripts/setup-harness.ts:<line>`:
   - **Prover-not-installed defect, line 156**: `install`'s copy loop —
     `for (const f of ['harness-planner.md', 'harness-maker.md', 'harness-checker.md'])` — omits
     `harness-prover.md`. Repo's `.claude/agents/` has all 4 files (confirmed via Glob); global
     `~/.claude/agents/` also now has `harness-prover.md` — meaning someone already manually
     worked around this exact defect, which is corroborating evidence it's real and has bitten
     someone.
   - **Smoke-test gap, lines 106-134**: `smokeTest()` hardcodes 3 checks (lines 113-123) for
     planner/maker/checker only — no check exists for harness-prover.md, so a broken install
     (line 156 defect) still reports all-green smoke output. This is why the defect went
     undetected: the mechanical gate doesn't cover the 4th agent.
   - **Duplicated agent enumeration**: the "which agents ship" list is written independently at
     line 156 (array literal) and lines 113-123 (three separate hardcoded `passed:` checks) instead
     of one shared constant (e.g. `const AGENT_FILES = [...]` referenced by both `install` and
     `smokeTest`) — root cause of the above two defects drifting out of sync.
   - **Unwired seed/patch CLI**: usage comment lines 6-9 documents `seed <dir> <template-path>` and
     `patch <claude-md-path> <block-string>` as standalone commands; the CLI dispatcher (lines
     138-183) has no `cmd === 'seed'` or `cmd === 'patch'` branch — `seedRoutingTable()` (line 71)
     and `patchClaudeMd()` (line 89) are only reachable indirectly via `install`.
   - **Missing uninstall**: no command reverses an install (remove copied agent files,
     `.harness/skill-routing.md`, or the CLAUDE.md `## Harness` block).
   - **Cross-repo generalization defect, lines 171-172**: the CLAUDE.md block hardcodes the literal
     `LeadGrowGTM/loop-engineer` as source repo name instead of deriving it from
     `git remote get-url origin`; line 171 also mixes `__dirname` (CommonJS) with `import.meta.dir`
     used elsewhere in the same file (lines 153, 161) — inconsistent and would misattribute if this
     script is vendored into another repo.
   Close with a prioritized fix list (line-156 fix first — it's the active, silently-broken defect;
   then the smoke-test gap since it masks #1; then the DRY fix; then seed/patch wiring; then
   uninstall; then the generalization fix) — this is a diagnosis, not a patch; do not edit
   `scripts/setup-harness.ts` itself in this phase.

5. **Wire + sync** — skill: direct — artifact: `skills/write-goal-prompt/SKILL.md` (new "Execution Mode Routing" section) + synced copies at `~/.claude/skills/write-goal-prompt/`, `~/.claude/agents/`, `~/.claude/workflows/`
   Add a new "## Execution Mode Routing" section to the canonical repo SKILL.md (placed near "##
   Reference Files" or right after "Phase 0") that: points at
   `references/execution-mode-routing.md` as the mode-decision authority, notes that
   `.claude/workflows/red-team.js` is the concrete dynamic-workflow example it references for
   adversarial verification, and does NOT collide with or duplicate global's existing "Execution
   Router" heading (infra-choice: in-session vs gnhf vs parallel-gnhf) — use the distinct heading
   "Execution Mode Routing" (shape-choice) and add one cross-reference line noting the two are
   different axes. Then sync repo→global for every file changed in phases 1-5:
   `skills/write-goal-prompt/references/execution-mode-routing.md`,
   `skills/write-goal-prompt/references/first-principles-generation.md`, the updated `SKILL.md`,
   `.claude/workflows/red-team.js` (global currently only has `ship-change.js` — this is a net-new
   file there), `.claude/agents/harness-planner.md`, `.claude/agents/harness-maker.md`. Do not
   touch global's gnhf/tasks-axi/Execution Router content — copy additively, never wholesale
   overwrite a file that has global-only content without merging it in first.

## Skill Routing
All phases → direct — reason (skill-routing.md heuristic #6): "No matching skill? Direct
implementation is fine." This is harness-internal authoring (docs, a workflow script, agent-file
edits, a diagnosis doc) — none of the confirmed skills in skill-routing.md's routing table match
(no code feature, no PRD, no bug investigation, no UI). Noted per heuristic so the Checker knows
there is no external skill quality bar to reference — the quality bar is this PLAN.md's rubric.

## Checker Rubric
Artifacts to evaluate:
- `skills/write-goal-prompt/references/execution-mode-routing.md`
- `.claude/workflows/red-team.js`
- `skills/write-goal-prompt/references/first-principles-generation.md`
- `docs/setup-system-diagnosis.md`
- The "Execution Mode Routing" section in `skills/write-goal-prompt/SKILL.md`

Dimensions (score 1-5 each, cite file:line for every score):
- **Router correctness**: 5 = decision order is unambiguous, first-match-wins, the 4 modes +
  signals match the two Anthropic articles, nesting section has real cited examples; 1 = modes
  blur together, no clear router, or nesting section is hand-wavy.
- **Red-team validity**: 5 = parses as valid JS (bun syntax-check output pasted as proof), exactly
  4 distinct attack angles, real barrier (parallel resolves fully before merge) + worst-first
  severity dedup, schema validation on both per-role and merged findings with no field mismatch;
  1 = fails syntax-check, roles overlap/redundant, or no real barrier/schema.
- **First-principles wiring**: 5 = `references/first-principles-generation.md` exists AND is
  referenced by filename in both `harness-planner.md` and `harness-maker.md` (grep confirms both
  hits); 1 = reference file written but not linked from either agent file.
- **Diagnosis teeth**: 5 = names the prover-install defect with `scripts/setup-harness.ts:156`
  evidence, the smoke-test gap, duplicated enumeration, unwired seed/patch CLI, missing uninstall,
  and the cross-repo generalization defect — each with a real line citation — plus a prioritized
  fix list; 1 = vague summary, no defects cited, or line numbers don't match the actual file.

PASS threshold: mean score ≥ 3.5/5.0.

## Turn Budget
Phase 0 (firstmate check): ~1 turn
Phase 1 (Router): ~6 turns
Phase 2 (Red-team): ~7 turns (includes bun syntax-check + proof)
Phase 3 (First-principles): ~6 turns
Phase 4 (Setup diagnosis): ~7 turns (requires re-reading setup-harness.ts closely)
Phase 5 (Wire + sync): ~6 turns
Total: ~33 (5 reserved for checker) — matches HARNESS.md's "~35 total" budget

## Dependencies
Sequential: All phases run in strict order (0 → 1 → 2 → 3 → 4 → 5). Phase 5 depends on the final
state of files touched in phases 1-3 (it syncs them) and phase 4's diagnosis references the same
setup-harness.ts read in the Planner read-first list — no phase can start before the prior phase's
artifact is committed. HARNESS.md explicitly states "no inter-phase parallelism needed — all touch
shared skill files."
Parallel-safe: None. All phases are sequential per HARNESS.md.
