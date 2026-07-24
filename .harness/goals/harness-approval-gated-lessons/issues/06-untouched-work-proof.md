# 06 - C06 Untouched-work and commit proof
Status: done
Blocked by: 05

## Parent
`C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-approval-gated-lessons\BRIEF.md` and approved decision C06 in `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-approval-gated-lessons\APPROVALS.md`.

## What to build

Write a command-backed proof that the implementation stayed inside approved IDs C01-C10, produced one commit per ID, did not merge or ship, left the index clean, kept the volatile snapshot unstaged and uncommitted, and preserved recoverable pre-existing launcher lineage.

## Approved deliverable boundary

- `.harness/goals/harness-approval-gated-lessons/UNTOUCHED_WORK_PROOF.md`

Goal-local slice status and `PROGRESS.md` may accompany this commit. No source file may change in C06.

## Acceptance criteria

- `UNTOUCHED_WORK_PROOF.md` records the baseline branch, HEAD `6bf9a02`, initial dirty paths, and explicitly discloses that the pre-C01 snapshot diff hash was not durably captured.
- `git status --short` output is pasted and explained without hiding dirty user work.
- `git diff --cached --quiet` exits 0 and snapshot.md is absent from staged paths.
- The current snapshot diff hash is recorded, and snapshot.md is absent from every C01-C10 commit.
- The saved C04 task patch is normalized and replayed over the saved pre-edit launcher copy; the recovered file byte-matches the saved final launcher copy and repository launcher.
- `git diff --name-only 6bf9a02..HEAD` classifies approved C01-C10 paths separately from preserved non-ID external commit paths.
- `git log --format='%H%x09%P%x09%s' 6bf9a02..HEAD` shows exactly one commit starting with each approved ID C01-C10, preserves disclosed non-ID commits, and contains no merge commit.
- `bun test` exits 0 with actual counts recorded.
- `code-review` uses fixed point `6bf9a02` and PLAN.md plus APPROVALS.md as the spec; findings are recorded, and any out-of-scope fix becomes a new proposal rather than an edit.
- The commit subject starts `C06` and contains only this proof plus C06 goal-local bookkeeping.

## Mechanical gate

`git diff --cached --quiet`

`git diff --cached --name-only -- .claude/agent-context/snapshot.md`

`git diff --binary -- .claude/agent-context/snapshot.md | git hash-object --stdin`

`git diff --name-only 6bf9a02..HEAD`

`git log --format='%h %s' 6bf9a02..HEAD`

`bun test`

## Skill routing

`direct tests + code-review` - `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-approval-gated-lessons\UNTOUCHED_WORK_PROOF.md`
