# 10 - C10 Cross-platform target routing
Status: done
Blocked by: 09

## Parent
`C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-approval-gated-lessons\BRIEF.md` and the user's approved C10 final-review follow-up.

## What to build

Make C07 routing executable on the supported Windows Git Bash runtime and correct for standalone repositories. Normalize invocation and Git-root paths into one representation, use the Git root as the workspace boundary for canonical pipelines, and use the repository parent as the standalone trust boundary.

## Approved source boundary

- `skills/write-goal-prompt/SKILL.md`
- `scripts/harness-agent-contracts.test.ts`

Goal-local slice status and `PROGRESS.md` may accompany this commit.

## Acceptance criteria

- Windows Git Bash `/c/...` and Git `C:/...` paths normalize before comparison.
- Direct canonical `pipelines/<name>` invocation resolves `PROJECT_ROOT` to the pipeline and `WORKSPACE_ROOT` to the workspace Git root.
- Standalone invocation resolves `PROJECT_ROOT` to the repository Git root and `WORKSPACE_ROOT` to its parent, so readiness receives strict containment rather than identical roots.
- Non-Git fallback uses the physical invocation directory as target and its parent as trust boundary.
- Tests execute the actual Step 0 shell snippet in canonical and standalone temporary fixtures; source-string assertions alone are insufficient.
- No C08/C09 behavior or adjacent cleanup is included.
- Commit subject starts `C10`.

## Mechanical gate

`bun test scripts/harness-agent-contracts.test.ts`

## Skill routing

`tdd` - `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\skills\write-goal-prompt\SKILL.md`
