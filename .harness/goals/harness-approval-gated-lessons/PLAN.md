# PLAN.md

## PRE_PLANNER_APPROVAL

- Approval source: the user's 2026-07-17 handoff explicitly approves C01, C02, C03, C04, C05, and C06.
- Decision state: six approved, zero rejected, zero deferred.
- Baseline branch: `feat/batch-grill-deps`; baseline HEAD: `6bf9a02`; staged files: none.
- Protected pre-existing work: `.claude/agent-context/snapshot.md` and `scripts/launch-gnhf.ps1` are unstaged. The snapshot is never staged or committed. The launcher may receive only isolated C04 task hunks; its pre-existing user delta stays unstaged.
- Execution prohibition: no gnhf command, detached runner, merge, push, PR, destructive reset, stash, checkout, or broad staging command.
- Scope authority and exact file boundaries: `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-approval-gated-lessons\APPROVALS.md`.

## PLANNER_BRIEF

The initial plan covered C01-C06; the approved review follow-up section adds C07-C09. Each phase is an observable checkpoint, not a file inventory. One ID maps to one phase, one durable slice, one mechanical gate, and one Maker commit. The Maker must use path-specific staging, include goal-local bookkeeping in the matching commit, and stop for a new approval if any source path or behavior falls outside `APPROVALS.md`.

The six phases are sequential because C02 and C03 refine role files introduced by C01, C04 may touch the protected launcher only after C03 is active, C05 documents C04's final behavior, and C06 proves the complete commit and working-tree state.

## Phases

1. C01 Approval-aware role contracts - skill: codebase-design -> tdd - artifact: `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.claude\agents\harness-*.md`
2. C02 Deterministic skill-routing fallback - skill: tdd - artifact: `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.claude\agents\harness-planner.md`
3. C03 Protected dirty-work policy - skill: tdd - artifact: `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.claude\agents\harness-maker.md`
4. C04 Non-launching harness readiness - skill: tdd - artifact: `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\scripts\prepare-harness-run.ps1`
5. C05 Coherent operator documentation - skill: direct - artifact: `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\README.md`, `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\CLAUDE.md`, `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\docs\DEPENDENCIES.md`
6. C06 Untouched-work and commit proof - skill: direct tests + code-review - artifact: `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-approval-gated-lessons\UNTOUCHED_WORK_PROOF.md`

Each phase is mirrored 1:1 as a durable slice in `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-approval-gated-lessons\issues\NN-<slug>.md`.

## MAKER_ROUTING

### C01 - Approval-aware role contracts

Routing: `codebase-design` then `tdd`.

Observable outcome: all five canonical agent roles agree on task-specific approval authority, phase and commit atomicity, conditional Prover use, evidence boundaries, and explicit post-PASS shipping approval. Maker ordering must place slice status, proof, and source changes in the same single C01 commit rather than appending uncommitted proof afterward.

Exact source boundary:
- `.claude/agents/harness-planner.md`
- `.claude/agents/harness-maker.md`
- `.claude/agents/harness-prover.md`
- `.claude/agents/harness-checker.md`
- `.claude/agents/harness-shipper.md`
- `scripts/harness-agent-contracts.test.ts`

Mechanical gate:
`bun test scripts/harness-agent-contracts.test.ts`

Commit contract: one commit whose subject starts `C01` and contains only the approved C01 source paths plus initial goal-local planning/bookkeeping.

### C02 - Deterministic skill-routing fallback

Routing: `tdd`.

Observable outcome: Planner first reads `<PROJECT_ROOT>/.harness/skill-routing.md`; if absent, it reads the canonical write-goal-prompt routing reference available in the project; if neither exists, it uses the task-specific HARNESS routing and documents direct implementation rather than aborting or inventing a skill.

Exact source boundary:
- `.claude/agents/harness-planner.md`
- `scripts/harness-agent-contracts.test.ts`

Mechanical gate:
`bun test scripts/harness-agent-contracts.test.ts`

Commit contract: one commit whose subject starts `C02` and contains only the approved C02 source paths plus C02 goal-local bookkeeping.

### C03 - Protected dirty-work policy

Routing: `tdd`.

Observable outcome: Maker captures branch, HEAD, status, and hashes of protected diffs before source work; forbids broad staging and destructive worktree commands; checks the staged path set before every commit; never stages the volatile snapshot; and isolates any approved task delta on an already dirty file. An overlap that cannot be isolated becomes BLOCKED, not overwritten.

Exact source boundary:
- `.claude/agents/harness-maker.md`
- `scripts/harness-agent-contracts.test.ts`

Mechanical gates:
- `bun test scripts/harness-agent-contracts.test.ts`
- `git diff --cached --name-only -- .claude/agent-context/snapshot.md` prints nothing

Commit contract: one commit whose subject starts `C03` and contains only the approved C03 source paths plus C03 goal-local bookkeeping.

### C04 - Non-launching harness readiness

Routing: `tdd`.

Observable outcome: the supported command reports whether a target repo and branch are ready, fails loudly on a dirty or invalid tree without committing or stashing, preserves `scripts/validate-pipeline-layout.ps1` enforcement, and reports or prepares treehouse isolation when required. It does not resolve gnhf config, execute gnhf, start a detached process, create gnhf logs/handles, or require gnhf on PATH.

Exact source boundary:
- `scripts/launch-gnhf.ps1`
- `scripts/prepare-harness-run.ps1`
- `scripts/prepare-harness-run.test.ts`
- `scripts/setup-harness.ts`
- `scripts/setup-harness.test.ts`
- `skills/setup-harness/SKILL.md`
- `skills/write-goal-prompt/SKILL.md`
- `skills/write-goal-prompt/references/parallel-execution.md`

Read-only safeguard:
- `scripts/validate-pipeline-layout.ps1`

Required TDD seams:
- clean feature-branch repo returns a machine-readable READY result and run path
- dirty repo exits nonzero, reports dirty paths, and creates no commit
- workspace root, pipelines parent, non-repo path, and invalid pipeline layout fail before any worktree action
- parallel or monorepo-tracked pipeline mode requires treehouse readiness and reports the isolated path or exact remediation
- a fake `gnhf` executable on PATH is never called
- setup no longer seeds or advertises `.gnhf-runs` or a gnhf launcher

Mechanical gates:
1. `bun test scripts/prepare-harness-run.test.ts scripts/setup-harness.test.ts`
2. `pwsh -NoProfile -Command '$files=@("scripts/launch-gnhf.ps1","scripts/prepare-harness-run.ps1","scripts/validate-pipeline-layout.ps1"); foreach($f in $files){$tokens=$null;$errors=$null;[System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path $f),[ref]$tokens,[ref]$errors)|Out-Null;if($errors.Count){$errors|ForEach-Object{Write-Error $_};exit 1}}'`
3. `git grep -n -E 'gnhf|\.gnhf-runs' -- skills/write-goal-prompt/SKILL.md skills/write-goal-prompt/references/parallel-execution.md skills/setup-harness/SKILL.md scripts/setup-harness.ts` prints nothing
4. `git grep -n -E 'Start-Process|\.gnhf\\config|git add -A|pre-run snapshot' -- scripts/launch-gnhf.ps1 scripts/prepare-harness-run.ps1` prints nothing

Protected launcher rule: preserve byte-exact pre-edit launcher content and diff outside the repo. The user approved retiring the overlapping current-branch forwarding and objective/stop-condition escaping code because execution is removed; preserve their intent through compatibility parameters, current-branch reporting, and safe path handling. Save C04 lineage evidence outside the repo for C06. Any other overlap remains blocked.

Commit contract: one commit whose subject starts `C04` and contains only the approved C04 source paths plus C04 goal-local bookkeeping.

### C05 - Coherent operator documentation

Routing: direct because this is a documentation-only contract.

Observable outcome: the repo map, operating guidance, and dependency table all describe an in-session harness, optional treehouse worktree isolation, fail-fast readiness, and no gnhf dependency or runner path.

Exact source boundary:
- `README.md`
- `CLAUDE.md`
- `docs/DEPENDENCIES.md`

Mechanical gate:
`git grep -n -E 'gnhf|\.gnhf-runs' -- README.md CLAUDE.md docs/DEPENDENCIES.md` prints nothing

Commit contract: one commit whose subject starts `C05` and contains only the approved C05 source paths plus C05 goal-local bookkeeping.

### C06 - Untouched-work and commit proof

Routing: direct deterministic checks followed by `code-review`, because `engineering-discipline` was not confirmed available.

Observable outcome: a reviewer can verify from command output that exactly one commit for every approved ID C01-C10 is present, no merge occurred, preserved non-ID external commits are disclosed, the index is clean, snapshot.md remains unstaged and absent from every ID commit despite the unavailable pre-C01 hash, and the pre-existing launcher work has recoverable lineage through the saved C04 evidence.

Exact deliverable:
- `.harness/goals/harness-approval-gated-lessons/UNTOUCHED_WORK_PROOF.md`

Required proof commands and records:
1. `git status --short`
2. `git diff --cached --quiet`
3. `git diff --cached --name-only -- .claude/agent-context/snapshot.md`
4. Record `git diff --binary -- .claude/agent-context/snapshot.md | git hash-object --stdin`, disclose the unavailable pre-C01 hash, and verify snapshot absence from all C01-C10 commit path lists
5. Normalize and replay the saved C04 task patch over the saved pre-edit launcher copy in a temporary directory, then byte-compare the recovered file with the saved final copy and repository `scripts/launch-gnhf.ps1`
6. `git diff --name-only 6bf9a02..HEAD`, classifying approved ID paths separately from preserved non-ID external commit paths
7. `git log --format='%H%x09%P%x09%s' 6bf9a02..HEAD`, showing exactly one C01, C02, C03, C04, C05, and planned C06 commit, preserving disclosed non-ID commits, and showing no merge commit
8. `bun test`
9. Run `code-review` with fixed point `6bf9a02` and this PLAN/APPROVALS pair as the spec source; critical or high findings must stay inside an approved ID or become a new proposal.

Commit contract: one commit whose subject starts `C06` and contains the proof artifact plus C06 goal-local bookkeeping only.

## PROVER_BRIEF

Conditional: run only for C04 because it changes CLI and path-resolution behavior. C01-C03, C05, and C06 are static contract or evidence phases and do not need Prover.

Feature intent: a user can run the readiness CLI against a clean feature-branch fixture and receive a READY result without any gnhf process, config, snapshot commit, or detached launch.

Exercise:
1. Create a unique temporary git repository without deleting any existing path.
2. Add one file, commit it, and create a non-default feature branch.
3. Run `pwsh -NoProfile -File C:\Users\mitch\Everything_CC\tools\agent\agent-harness\scripts\prepare-harness-run.ps1 -RepoPath <fixture> -CheckOnly`.
4. Run it again after adding an unstaged fixture change and confirm a nonzero dirty-tree result with no new commit.

Auth: no auth required.

Accept: clean fixture exits 0 with machine-readable READY, branch, repo path, run path, and isolation state; dirty fixture exits nonzero with the dirty path; commit count is unchanged; no gnhf process or marker is created. Return binary PROOF verdict.

## REDTEAM_BRIEF

Conditional: run only for C04 because it changes command execution, git state handling, path resolution, and worktree isolation trust boundaries.

Target: attack the readiness path for accidental execution, path confusion, broad staging, mutation of dirty work, default-branch misuse, invalid pipeline acceptance, missing treehouse behavior, and command injection through repo paths or labels.

Paths:
- `scripts/launch-gnhf.ps1`
- `scripts/prepare-harness-run.ps1`
- `scripts/prepare-harness-run.test.ts`
- `scripts/setup-harness.ts`
- `scripts/setup-harness.test.ts`
- `skills/setup-harness/SKILL.md`
- `skills/write-goal-prompt/SKILL.md`
- `skills/write-goal-prompt/references/parallel-execution.md`
- read-only: `scripts/validate-pipeline-layout.ps1`

Entry point: `pwsh -NoProfile -File scripts/prepare-harness-run.ps1 -RepoPath <path> -CheckOnly` and the explicit treehouse preparation mode defined by C04.

Out of scope: rejected/deferred work, external treehouse implementation, user-level agent installation, gnhf behavior, and files outside C04.

Critical/high findings may be fixed only inside the C04 exact source boundary. Otherwise stop and create a new proposal ID.

## Skill Routing

C01 -> `codebase-design` then `tdd` - reason: role interactions are an architecture/plugin seam, and runtime contract changes require tests first.

C02 -> `tdd` - reason: code is involved and the deterministic fallback behavior must be encoded as a failing contract test before the agent definition changes.

C03 -> `tdd` - reason: protected-file and staging behavior is deterministic safety behavior that requires executable contract assertions.

C04 -> `tdd` - reason: script, CLI, installer, path resolution, and runtime behavior changes route to tests first.

C05 -> direct - reason: documentation-only contract with no matching implementation skill.

C06 -> direct tests plus `code-review` - reason: `engineering-discipline` was not confirmed available, so use deterministic verification and the confirmed review skill fallback.

## CHECKER_BRIEF

Artifacts to evaluate:
- `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-approval-gated-lessons\BRIEF.md`
- `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-approval-gated-lessons\PLAN.md`
- `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-approval-gated-lessons\APPROVALS.md`
- all six issue slices
- final files in the approved C01-C10 source boundaries
- `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-approval-gated-lessons\UNTOUCHED_WORK_PROOF.md`
- `PROGRESS.md` only for exact command output, staged-path evidence, and commit SHAs; do not use Maker opinions or self-assessment as qualitative evidence
- conditional C04 PROOF verdict and red-team result

Dimensions, scored 1-5:
- Approval integrity: 5 means every source edit, phase, slice, gate, and commit traces to one explicit approved ID and exact boundary; 1 means any unapproved edit or adjacent cleanup.
- Scope discipline: 5 means one ID per commit, only approved paths and behavior, and no gnhf launch/merge/push; 1 means bundled scope, runner execution, or unauthorized external action.
- Technical quality: 5 means simple repository-native role contracts and a tested non-launching readiness CLI that preserves branch, dirty-tree, treehouse, and invalid-layout safeguards; 1 means fragile prompts, hidden mutation, dead safety paths, or a remaining gnhf dependency.
- Evidence: 5 means each ID has exact gate output, staged-path proof, one commit, C04 live CLI proof, full tests, and reproducible untouched-work evidence; 1 means unsupported assertions.
- Decision fidelity: 5 means snapshot.md remains unchanged and unstaged, the pre-existing launcher delta is preserved, user-level agent copies and read-only safeguards remain untouched, and shipping is not attempted; 1 means any protected-work loss or approval leakage.

PASS threshold: mean score at least 4.0/5.0, no dimension below 3, every mechanical gate passes, C04 Prover returns works, no unresolved critical/high red-team finding, and no approval-integrity violation.

## Checker Rubric

Artifacts to evaluate: the paths listed in CHECKER_BRIEF.

Dimensions (score 1-5 each):
- Approval integrity: 5 = complete C01-C10 traceability with no unapproved edit | 1 = any unapproved edit.
- Scope discipline: 5 = exact file and behavior boundaries with one ID per commit | 1 = bundled cleanup or unauthorized action.
- Technical quality: 5 = robust role contracts and safe non-launching readiness behavior | 1 = fragile or still gnhf-dependent behavior.
- Evidence: 5 = reproducible commands, tests, proof, and commits for every ID | 1 = assertions without command-backed evidence.
- Decision fidelity: 5 = protected dirty work preserved and shipping withheld | 1 = protected work staged/lost or shipping attempted.

PASS threshold: mean score at least 4.0/5.0, no dimension below 3, all gates pass, and no approval-integrity violation.

## SHIP_BRIEF

Intent: apply only approved IDs C01-C10 to make loop-engineer approval-aware and independent of gnhf execution while preserving branch readiness, branch-safe treehouse/worktree isolation, fail-fast reporting, invalid-tree safeguards, and pre-existing dirty user work.

This goal does not ship. After Checker PASS, present the final decision matrix and request separate explicit shipping approval. On this invocation the required outcome is `N/A - shipping not approved`. Do not spawn Shipper, run `/no-mistakes`, push, open a PR, or merge.

## LOOP_TRACKER

### Pre-Planner approval
- [x] HARNESS.md and snapshot.md read
- [x] Baseline branch, HEAD, status, and protected paths recorded from snapshot
- [x] C01-C06 treated as explicitly approved by user handoff
- [x] APPROVALS.md written with exact source boundaries and gates
- [x] Zero rejected or deferred IDs recorded

### Planner
- [x] Canonical issue-tracker, first-principles, and skill-routing references read
- [x] Project and installed user harness definitions compared
- [x] PLAN.md contains approved IDs only
- [x] One phase and one slice defined per approved ID
- [ ] Maker captures live pre-C01 protected diff hashes and temporary launcher copies before any source edit

### Cycle 1
- [ ] C01 commit and gate complete
- [ ] C02 commit and gate complete
- [ ] C03 commit and gate complete
- [ ] C04 commit and gate complete
- [ ] C05 commit and gate complete
- [ ] C06 commit and gate complete
- [ ] Conditional C04 Prover verdict received
- [ ] Conditional C04 red-team critical/high findings resolved or re-proposed
- [ ] Checker wrote CYCLE_LOG.md
- [ ] Reward signal recorded, threshold 4.0/5.0
- [ ] Verdict: PASS / ITERATE / PLATEAU

### Cycle 2 if ITERATE
- [ ] Fix limited to weakest dimension and an already approved ID boundary
- [ ] Mechanical gates passed
- [ ] Conditional C04 proof repeated if runtime behavior changed
- [ ] Checker updated CYCLE_LOG.md
- [ ] Verdict: PASS / ITERATE / PLATEAU

### Cycle 3 if ITERATE again
- [ ] Fix limited to weakest dimension and an already approved ID boundary
- [ ] Mechanical gates passed
- [ ] Checker updated CYCLE_LOG.md
- [ ] Verdict: PASS / PLATEAU

### Final
- [ ] Decision matrix lists C01-C10, exact files, tests, and commits
- [ ] UNTOUCHED_WORK_PROOF.md proves protected and unrelated work state
- [ ] `.claude/agent-context/snapshot.md` remains unstaged and uncommitted
- [ ] Pre-existing `scripts/launch-gnhf.ps1` user delta remains preserved
- [ ] No merge, push, PR, gnhf execution, or Ship stage occurred
- [ ] Shipping outcome recorded as `N/A - shipping not approved`

## Turn Budget

Planner: ~5 turns
Phase 1 C01: ~5 turns
Phase 2 C02: ~3 turns
Phase 3 C03: ~4 turns
Phase 4 C04: ~12 turns
Phase 5 C05: ~3 turns
Phase 6 C06: ~4 turns
Conditional C04 Prover and red-team: ~4 turns
Checker: ~5 turns
Reporting: ~5 turns
Total: ~50 turns

## Dependencies

Sequential: C01 -> C02 -> C03 -> C04 -> C05 -> C06. C03 must be active before the protected launcher is touched. C05 depends on final C04 behavior. C06 depends on all prior commits and saved baseline evidence.

Parallel-safe: none during Maker execution. Shared role files, shared tests, protected working-tree state, and one-ID commit boundaries make parallel edits unsafe. Prover and red-team may run after the C04 gate and before Checker, but not concurrently with source edits.

## Approved review follow-up phases - 2026-07-20

Final code review blocked C06 with three independently confirmed HIGH findings. The user approved C07, C08, and C09 as separate phases and commits. No prior commit is rewritten. C06 resumes only after all three gates pass.

### Phase 7: C07 Canonical pipeline target routing

Observable outcome: write-goal-prompt keeps the workspace Git root separate from a canonical pipeline invocation target, and readiness receives the pipeline directory as `RepoPath` plus workspace root as `WorkspaceRoot`.

Exact source boundary:
- `skills/write-goal-prompt/SKILL.md`
- `scripts/harness-agent-contracts.test.ts`

Mechanical gate: `bun test scripts/harness-agent-contracts.test.ts`

Commit contract: one commit whose subject starts `C07`, containing only this source boundary plus goal-local planning/bookkeeping.

### Phase 8: C08 Shipping consent propagation

Observable outcome: generated parent goals and SHIP_BRIEF require separate explicit shipping approval after Checker PASS; without it, Shipper is not spawned and the terminal outcome is `N/A - shipping not approved`.

Exact source boundary:
- `skills/write-goal-prompt/SKILL.md`
- `scripts/harness-agent-contracts.test.ts`

Mechanical gate: `bun test scripts/harness-agent-contracts.test.ts`

Commit contract: one commit whose subject starts `C08`, containing only this source boundary plus goal-local bookkeeping.

### Phase 9: C09 Isolated run branch

Observable outcome: explicit Treehouse preparation converts a validated detached lease into a unique derived branch at source HEAD, validates and reports that branch as the execution branch, keeps the source branch unchanged, and returns the lease on failure.

Exact source boundary:
- `scripts/prepare-harness-run.ps1`
- `scripts/prepare-harness-run.test.ts`
- `README.md`
- `CLAUDE.md`
- `skills/write-goal-prompt/references/parallel-execution.md`

Mechanical gate: `bun test scripts/prepare-harness-run.test.ts`

Commit contract: one commit whose subject starts `C09`, containing only this source boundary plus goal-local bookkeeping.

## Revised dependencies

Sequential: C01 -> C02 -> C03 -> C04 -> C05 -> C07 -> C08 -> C09 -> C10 -> C06. C06 proof and Checker must include the new commits and rerun review after C10.

### Phase 10: C10 Cross-platform target routing

Observable outcome: the actual Step 0 shell snippet normalizes Windows Git Bash and Git path forms, resolves canonical pipeline target/workspace values correctly, and gives standalone repositories a parent trust boundary rather than identical roots.

Exact source boundary:
- `skills/write-goal-prompt/SKILL.md`
- `scripts/harness-agent-contracts.test.ts`

Mechanical gate: `bun test scripts/harness-agent-contracts.test.ts`

Commit contract: one commit whose subject starts `C10`, containing only this source boundary plus goal-local bookkeeping.
