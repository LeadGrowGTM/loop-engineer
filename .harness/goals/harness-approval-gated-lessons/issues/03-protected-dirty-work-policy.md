# 03 - C03 Protected dirty-work policy
Status: ready-for-agent
Blocked by: 02

## Parent
`C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-approval-gated-lessons\BRIEF.md` and approved decision C03 in `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-approval-gated-lessons\APPROVALS.md`.

## What to build

Make protected working-tree handling a mechanical Maker contract. Before source edits, capture branch, HEAD, status, and protected diff hashes; prohibit broad staging and destructive worktree commands; inspect staged paths before every commit; never stage volatile snapshot output; and isolate task-only patches on already dirty approved files. Stop on overlapping user and task hunks instead of replacing or committing user work.

## Approved source boundary

- `.claude/agents/harness-maker.md`
- `scripts/harness-agent-contracts.test.ts`

Protected paths governed but not edited by C03:
- `.claude/agent-context/snapshot.md`
- `scripts/launch-gnhf.ps1`

Goal-local slice status and `PROGRESS.md` may accompany this commit.

## Acceptance criteria

- Maker captures a pre-C01 hash for the snapshot diff and a pre-C01 launcher worktree copy and diff outside the repository.
- `git add -A`, `git add .`, stash, reset, checkout, overwrite, and equivalent broad or destructive operations are forbidden.
- Before each commit, Maker verifies the staged path set is a subset of the current ID plus goal-local bookkeeping.
- `.claude/agent-context/snapshot.md` is always excluded from staging and commits.
- A dirty approved path uses task-only patch staging. A non-approved dirty path is not edited.
- Unisolatable overlap becomes BLOCKED and triggers a new proposal request.
- `bun test scripts/harness-agent-contracts.test.ts` exits 0.
- `git diff --cached --name-only -- .claude/agent-context/snapshot.md` prints nothing.
- The commit subject starts `C03` and staged paths are limited to this boundary plus goal-local bookkeeping.

## Mechanical gate

`bun test scripts/harness-agent-contracts.test.ts`

`git diff --cached --name-only -- .claude/agent-context/snapshot.md`

## Skill routing

`tdd` - `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.claude\agents\harness-maker.md`
