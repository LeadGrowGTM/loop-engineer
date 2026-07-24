# Phase 2 - Integrate issues #21-#24

Status: complete
Blocked by: 0
Parent: `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.tmp\treehouse\.treehouse\agent-harness-d0f233\1\agent-harness\.harness\goals\harness-pi-openai-server-compaction\PLAN.md`

## What to build

Apply verified issue commits to `local/integrate-issues-21-25` in order: #21 `da7efde843f4def51aa0910da7df9f50d176a1ca`, new #22, #23 `d0d8f764e8c495382b43b3b18cd32e3e85ba8ca3`, #24 `89c899b5a82bdc6a0184d7ccb40e51f4cb49101a`.

## Acceptance criteria

- Source commits remain unchanged.
- Integration has no merge, rebase, amend, squash, or force operation.
- Each issue has source SHA, integration SHA, parent, subject, stable patch ID, changed paths, and passing issue gate recorded in `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.tmp\treehouse\.treehouse\agent-harness-d0f233\1\agent-harness\.harness\goals\harness-pi-openai-server-compaction\INTEGRATION_LEDGER.md`.
- Focused suites, full `bun test`, PowerShell parser, `git diff --check`, no-merge proof, and protected-work guard pass.
- Unexpected conflict stops work. Replacement lease may reapply only approved issue patch.

## Skill routing

Direct Git integration plus `verify`.

## Commit contract

Four issue imports stay separate. One named goal-bookkeeping closeout commit records Planner files, current phase proof, and integration ledger. This task-specific cross-worktree exception is approved by the 2026-07-22 goal plan.

## BLOCKED (historical)
Reason: Cherry-pick conflict applying issue #24 `89c899b5a82bdc6a0184d7ccb40e51f4cb49101a` onto `local/integrate-issues-21-25` after #21-#23.
Tried: `git cherry-pick 89c899b5a82bdc6a0184d7ccb40e51f4cb49101a` after importing #21 #22 #23.
Unblocked work: clean replacement lease from latest integration `HEAD` and reapply only the approved #24 patch set.

## PASS
- Applied replacement patch commit `b5891b59302feaf695ad6a596cfa4ae077539777` on top of `7be8dcb` and committed as integration `b44824d8324aa8fe59079bac27018921be8b9031`.
- Updated source/integration lineage in `INTEGRATION_LEDGER.md`, including replacement and stable patch IDs.
- Confirmed issue source/integration patch IDs match for #21-#24.
- Ready for Phase 2 closeout proof and target-goal bookkeeping commit.