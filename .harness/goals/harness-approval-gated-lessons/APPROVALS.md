# APPROVALS.md

## Approval authority

The user's 2026-07-17 handoff explicitly approves C01 through C06 for planning and later Maker execution. No ID is rejected or deferred. Silence is not being used as approval.

## Baseline to preserve

Source: `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.claude\agent-context\snapshot.md`.

- Branch: `feat/batch-grill-deps`
- Baseline HEAD: `6bf9a02`
- Existing unstaged files: `.claude/agent-context/snapshot.md`, `scripts/launch-gnhf.ps1`
- Existing untracked goal directory: `.harness/goals/harness-approval-gated-lessons/`
- Staged files: none

`.claude/agent-context/snapshot.md` is volatile hook output. It must never be staged or committed. `scripts/launch-gnhf.ps1` contains pre-existing user work. C04 may edit that path only with hunk-isolated staging that leaves the pre-existing user delta unstaged and preserved. If the approved C04 change overlaps the user hunk and cannot be isolated safely, C04 must be marked blocked rather than overwriting or committing the user change.

## Commit and scope contract

- One approved ID equals one PLAN phase, one issue slice, one mechanical gate, and one future Maker commit.
- There is no standalone planning commit. The Maker includes initial planning artifacts in the C01 commit, then includes the relevant slice status and `PROGRESS.md` update in each ID's single commit.
- Source edits are limited to the exact file boundary recorded below.
- Goal-local bookkeeping under `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-approval-gated-lessons\` may accompany the matching ID commit.
- Before every commit, the Maker must inspect `git diff --cached --name-only`, reject paths outside the current ID plus goal-local bookkeeping, and prove `.claude/agent-context/snapshot.md` is absent.
- No merge, push, PR, gnhf command, detached runner, destructive reset, stash, checkout, or broad staging command is approved.

## Approved decisions

### C01 - Approval-aware role contracts

Status: APPROVED

Recommendation: make the canonical harness agent definitions honor task-specific approval gates, phase-to-commit atomicity, conditional Prover use, evidence isolation, and separate shipping approval.

Exact source files:
- `.claude/agents/harness-planner.md`
- `.claude/agents/harness-maker.md`
- `.claude/agents/harness-prover.md`
- `.claude/agents/harness-checker.md`
- `.claude/agents/harness-shipper.md`
- `scripts/harness-agent-contracts.test.ts`

Verification command:
`bun test scripts/harness-agent-contracts.test.ts`

### C02 - Skill-routing fallback

Status: APPROVED

Recommendation: let Planner continue deterministically when project-local `.harness/skill-routing.md` is absent by trying the canonical write-goal-prompt reference and then a documented direct fallback instead of failing or inventing a skill.

Exact source files:
- `.claude/agents/harness-planner.md`
- `scripts/harness-agent-contracts.test.ts`

Verification command:
`bun test scripts/harness-agent-contracts.test.ts`

### C03 - Protected-file policy

Status: APPROVED

Recommendation: make baseline capture, path-specific staging, volatile snapshot exclusion, protected dirty-file handling, and stop-on-overlap behavior mechanical Maker requirements.

Exact source files:
- `.claude/agents/harness-maker.md`
- `scripts/harness-agent-contracts.test.ts`

Protected working-tree paths governed by the policy but not approved as C03 source edits:
- `.claude/agent-context/snapshot.md`
- `scripts/launch-gnhf.ps1`

Verification commands:
- `bun test scripts/harness-agent-contracts.test.ts`
- `git diff --cached --name-only -- .claude/agent-context/snapshot.md` must print nothing before every commit

### C04 - Retire gnhf execution and preserve readiness

Status: APPROVED

Recommendation: remove gnhf process/config dependency from the supported harness path, replace it with a non-launching readiness preflight, preserve explicit branch and dirty-tree reporting, preserve treehouse/worktree preparation, keep invalid pipeline-tree validation, and never auto-commit user work.

Approval amendment recorded during C04 execution:
- The protected `-CurrentBranch` forwarding hunk may be replaced by equivalent non-launching current-branch acceptance and reporting.
- The later protected multiline/quote escaping hunk for `Objective` and `StopWhen` may be retired because readiness never executes those legacy values. The compatibility entry continues accepting them without execution.
- Byte-exact pre-edit launcher content and its binary diff were saved outside the repository before C04 edits. Other protected work remains out of staging.
- After the initial C04 commit's red-team review, the user explicitly authorized fixing the blocking C04 findings and amending unpushed commit `f31160b` so C04 remains one commit. No reset, checkout, force, push, or other history rewrite was authorized.

Exact source files:
- `scripts/launch-gnhf.ps1`
- `scripts/prepare-harness-run.ps1`
- `scripts/prepare-harness-run.test.ts`
- `scripts/setup-harness.ts`
- `scripts/setup-harness.test.ts`
- `skills/setup-harness/SKILL.md`
- `skills/write-goal-prompt/SKILL.md`
- `skills/write-goal-prompt/references/parallel-execution.md`

Read-only dependency, not approved for editing:
- `scripts/validate-pipeline-layout.ps1`

Verification commands:
- `bun test scripts/prepare-harness-run.test.ts scripts/setup-harness.test.ts`
- PowerShell parser validation for `scripts/launch-gnhf.ps1`, `scripts/prepare-harness-run.ps1`, and `scripts/validate-pipeline-layout.ps1`
- `git grep -n -E 'gnhf|\.gnhf-runs' -- skills/write-goal-prompt/SKILL.md skills/write-goal-prompt/references/parallel-execution.md skills/setup-harness/SKILL.md scripts/setup-harness.ts` must print nothing
- `git grep -n -E 'Start-Process|\.gnhf\\config|git add -A|pre-run snapshot' -- scripts/launch-gnhf.ps1 scripts/prepare-harness-run.ps1` must print nothing

### C05 - Documentation coherence

Status: APPROVED

Recommendation: align the operator-facing repo map and dependency contract with the supported in-session harness plus optional treehouse readiness path.

Exact source files:
- `README.md`
- `CLAUDE.md`
- `docs/DEPENDENCIES.md`

Verification command:
`git grep -n -E 'gnhf|\.gnhf-runs' -- README.md CLAUDE.md docs/DEPENDENCIES.md` must print nothing

### C06 - Untouched-work proof

Status: APPROVED

Recommendation: produce a final, command-backed proof that only approved paths changed, six ID commits exist, the volatile snapshot delta is unchanged and unstaged, the pre-existing launcher delta remains preserved, and the index is clean.

Exact deliverable:
- `.harness/goals/harness-approval-gated-lessons/UNTOUCHED_WORK_PROOF.md`

Verification commands:
- `git diff --cached --quiet`
- `git diff --cached --name-only -- .claude/agent-context/snapshot.md` must print nothing
- compare the final snapshot diff hash with the hash captured before C01
- replay the C04 task-only staged patch over the pre-C01 launcher worktree copy and compare it byte-for-byte with the final launcher worktree file
- `git diff --name-only 6bf9a02..HEAD` must contain only approved source files and this goal directory
- `git log --format='%h %s' 6bf9a02..HEAD` must show one commit for each C01 through C06 and no merge commit
