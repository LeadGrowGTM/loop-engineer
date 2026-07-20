# 07 - C07 Canonical pipeline target routing
Status: done
Blocked by: 05

## Parent
`C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-approval-gated-lessons\BRIEF.md` and the user's approved C07 review follow-up.

## What to build

Make canonical monorepo pipeline readiness reachable through the supported write-goal-prompt skill. Keep the workspace Git root separate from the invocation target, pass the pipeline directory as `RepoPath`, and pass the workspace root as `WorkspaceRoot`. Preserve standalone-repository behavior.

## Approved source boundary

- `skills/write-goal-prompt/SKILL.md`
- `scripts/harness-agent-contracts.test.ts`

Goal-local planning, slice status, and `PROGRESS.md` may accompany this commit.

## Acceptance criteria

- Invocation from a canonical tracked `pipelines/<name>` directory keeps that directory as the readiness target.
- The containing workspace Git root is passed separately as `WorkspaceRoot`.
- Standalone repositories still use their Git toplevel as both project target and workspace root where appropriate.
- Check-only and explicit isolation commands use the resolved target rather than blindly passing the Git root.
- Deterministic contract coverage fails if the skill regresses to `RepoPath = git rev-parse --show-toplevel` for canonical pipelines.
- No C08/C09 behavior or adjacent cleanup is included.
- Commit subject starts `C07`.

## Mechanical gate

`bun test scripts/harness-agent-contracts.test.ts`

## Skill routing

`tdd` - `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\skills\write-goal-prompt\SKILL.md`
