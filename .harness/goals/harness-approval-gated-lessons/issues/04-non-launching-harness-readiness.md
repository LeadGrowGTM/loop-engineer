# 04 - C04 Non-launching harness readiness
Status: ready-for-agent
Blocked by: 03

## Parent
`C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-approval-gated-lessons\BRIEF.md` and approved decision C04 in `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-approval-gated-lessons\APPROVALS.md`.

## What to build

Replace the supported gnhf runner path with a non-launching readiness interface. It must report repo, feature-branch, dirty-tree, isolation, and invalid-layout state; fail before mutation when unsafe; support explicit treehouse/worktree preparation; preserve `scripts/validate-pipeline-layout.ps1` as a read-only safeguard; and never resolve or execute gnhf, create detached processes, snapshot dirty work, or create gnhf run logs and handles.

## Approved source boundary

- `scripts/launch-gnhf.ps1`
- `scripts/prepare-harness-run.ps1`
- `scripts/prepare-harness-run.test.ts`
- `scripts/setup-harness.ts`
- `scripts/setup-harness.test.ts`
- `skills/setup-harness/SKILL.md`
- `skills/write-goal-prompt/SKILL.md`
- `skills/write-goal-prompt/references/parallel-execution.md`

Read-only, never edit:
- `scripts/validate-pipeline-layout.ps1`

Goal-local slice status and `PROGRESS.md` may accompany this commit.

## Acceptance criteria

- A clean non-default branch fixture exits 0 with machine-readable READY, repo path, branch, run path, and isolation state.
- A dirty fixture exits nonzero, prints dirty paths, creates no commit, and does not stash or reset.
- Workspace root, pipelines parent, non-repo path, and invalid pipeline layout fail before worktree or process action.
- Parallel or monorepo-tracked pipeline mode checks treehouse readiness and reports an isolated path or exact remediation.
- A fake `gnhf` executable on PATH is never invoked.
- Setup no longer seeds or advertises `.gnhf-runs` or gnhf execution.
- `scripts/launch-gnhf.ps1` contains no runner execution and safely directs callers to the readiness path without erasing the pre-existing user delta.
- The pre-existing launcher delta remains unstaged. Only the C04 task-only patch is committed. Overlap that cannot be isolated blocks C04.
- `bun test scripts/prepare-harness-run.test.ts scripts/setup-harness.test.ts` exits 0.
- All three PowerShell scripts parse without errors.
- Approved setup and skill guidance contains no `gnhf` or `.gnhf-runs` references.
- Launcher/readiness scripts contain no `Start-Process`, gnhf config lookup, `git add -A`, or pre-run snapshot behavior.
- The commit subject starts `C04` and staged paths are limited to this boundary plus goal-local bookkeeping.

## Mechanical gate

`bun test scripts/prepare-harness-run.test.ts scripts/setup-harness.test.ts`

`pwsh -NoProfile -Command '$files=@("scripts/launch-gnhf.ps1","scripts/prepare-harness-run.ps1","scripts/validate-pipeline-layout.ps1"); foreach($f in $files){$tokens=$null;$errors=$null;[System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path $f),[ref]$tokens,[ref]$errors)|Out-Null;if($errors.Count){$errors|ForEach-Object{Write-Error $_};exit 1}}'`

`git grep -n -E 'gnhf|\.gnhf-runs' -- skills/write-goal-prompt/SKILL.md skills/write-goal-prompt/references/parallel-execution.md skills/setup-harness/SKILL.md scripts/setup-harness.ts`

`git grep -n -E 'Start-Process|\.gnhf\\config|git add -A|pre-run snapshot' -- scripts/launch-gnhf.ps1 scripts/prepare-harness-run.ps1`

## Skill routing

`tdd` - `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\scripts\prepare-harness-run.ps1`
