# 09 - C09 Isolated run branch
Status: done
Blocked by: 08

## Parent
`C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-approval-gated-lessons\BRIEF.md` and the user's approved C09 review follow-up using the automatic derived-branch approach.

## What to build

Make explicit Treehouse preparation branch-safe. After validating a clean same-repository lease, create a unique derived branch at the checked source HEAD inside the leased worktree, validate and report that run branch, and return the lease on any failure. Never report a detached or unrelated branch as READY.

## Approved source boundary

- `scripts/prepare-harness-run.ps1`
- `scripts/prepare-harness-run.test.ts`
- `README.md`
- `CLAUDE.md`
- `skills/write-goal-prompt/references/parallel-execution.md`

Goal-local slice status and `PROGRESS.md` may accompany this commit.

## Acceptance criteria

- Treehouse may return a detached worktree, but READY is emitted only after a unique derived branch is created at the validated source HEAD.
- Result JSON distinguishes the source branch from the derived run branch and reports the exact branch used at `runPath`.
- The source branch remains checked out and unchanged in the source repository.
- Branch creation failure, collision, wrong HEAD, wrong repository, dirty state, or source race returns the lease and fails closed.
- Canonical pipeline run paths inherit the validated derived branch from the leased worktree.
- Tests prove a detached fake Treehouse lease becomes attached to the reported unique branch before READY.
- Guidance tells operators to commit on the returned run branch and preserve that branch before returning the lease.
- No C07/C08 behavior or adjacent cleanup is included.
- Commit subject starts `C09`.

## Mechanical gate

`bun test scripts/prepare-harness-run.test.ts`

## Skill routing

`tdd` - `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\scripts\prepare-harness-run.ps1`
