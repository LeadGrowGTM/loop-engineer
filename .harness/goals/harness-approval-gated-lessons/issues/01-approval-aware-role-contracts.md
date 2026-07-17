# 01 - C01 Approval-aware role contracts
Status: done
Blocked by: none

## Parent
`C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-approval-gated-lessons\BRIEF.md` and approved decision C01 in `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-approval-gated-lessons\APPROVALS.md`.

## What to build

Make the five canonical repository agent definitions share an approval-aware runtime contract. Planner plans approved IDs only. Maker performs one phase and one commit per ID with status and proof included atomically. Prover runs only for applicable runtime changes. Checker uses fresh artifact evidence while allowing task-specific command and commit proof without anchoring on Maker opinion. Shipper requires both Checker PASS and separate explicit shipping approval and never merges.

## Approved source boundary

- `.claude/agents/harness-planner.md`
- `.claude/agents/harness-maker.md`
- `.claude/agents/harness-prover.md`
- `.claude/agents/harness-checker.md`
- `.claude/agents/harness-shipper.md`
- `scripts/harness-agent-contracts.test.ts`

Goal-local planning, slice status, and `PROGRESS.md` may accompany this commit. No installed user agent copy is edited.

## Acceptance criteria

- Every role reads and honors its task-specific HARNESS brief within its tool permissions.
- Planner refuses to create phases for rejected, deferred, missing, or newly discovered unapproved scope when PRE_PLANNER_APPROVAL applies.
- Maker updates the slice and proof before the single phase commit so source, status, gate output, and commit boundary cannot drift.
- Checker can inspect exact process proof named by CHECKER_BRIEF but cannot use Maker self-assessment as qualitative evidence.
- Shipper refuses to run without explicit shipping approval in addition to PASS and never merges.
- `bun test scripts/harness-agent-contracts.test.ts` exits 0.
- The commit subject starts `C01` and staged paths are limited to this boundary plus goal-local bookkeeping.

## Mechanical gate

`bun test scripts/harness-agent-contracts.test.ts`

## Skill routing

`codebase-design` then `tdd` - `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.claude\agents\harness-*.md`
