# 05 - C05 Coherent operator documentation
Status: done
Blocked by: 04

## Parent
`C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-approval-gated-lessons\BRIEF.md` and approved decision C05 in `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-approval-gated-lessons\APPROVALS.md`.

## What to build

Align the repo map, operator guidance, and dependency contract with C04's supported model: in-session goal execution, optional treehouse isolation, explicit readiness checks, fail-fast unsafe-tree reporting, no gnhf dependency, and no detached runner claim.

## Approved source boundary

- `README.md`
- `CLAUDE.md`
- `docs/DEPENDENCIES.md`

Goal-local slice status and `PROGRESS.md` may accompany this commit.

## Acceptance criteria

- All three documents describe the same supported execution path and role boundaries.
- Bun, git, gh, no-mistakes, tasks-axi, treehouse, and bundled harness behavior retain accurate required/optional tiers.
- No document claims gnhf is installed, required, optional, launched, configured, or part of onboarding.
- Treehouse remains optional and its missing-tool behavior is explicit and fail-fast when isolation is required.
- The docs do not imply a merge, automatic shipping, or user-level agent installation during this goal.
- `git grep -n -E 'gnhf|\.gnhf-runs' -- README.md CLAUDE.md docs/DEPENDENCIES.md` prints nothing.
- The commit subject starts `C05` and staged paths are limited to this boundary plus goal-local bookkeeping.

## Mechanical gate

`git grep -n -E 'gnhf|\.gnhf-runs' -- README.md CLAUDE.md docs/DEPENDENCIES.md`

## Skill routing

`direct` - `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\README.md`, `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\CLAUDE.md`, `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\docs\DEPENDENCIES.md`
