# 08 - C08 Shipping consent propagation
Status: done
Blocked by: 07

## Parent
`C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-approval-gated-lessons\BRIEF.md` and the user's approved C08 review follow-up.

## What to build

Propagate the separate shipping-approval gate into generated SHIP_BRIEF and parent goal orchestration. Checker PASS alone must not spawn Shipper. Without separate explicit approval, record `N/A - shipping not approved` as the terminal shipping outcome.

## Approved source boundary

- `skills/write-goal-prompt/SKILL.md`
- `scripts/harness-agent-contracts.test.ts`

Goal-local slice status and `PROGRESS.md` may accompany this commit.

## Acceptance criteria

- Generated SHIP_BRIEF requires separate explicit shipping approval after Checker PASS.
- Parent goal orchestration does not spawn Shipper unless that approval exists for the current invocation.
- PASS without shipping approval terminates with `N/A - shipping not approved` rather than retrying or deadlocking.
- Existing Shipper refusal remains defense in depth, not the primary approval gate.
- Deterministic contract coverage pins generated and parent behavior.
- No C07/C09 behavior or adjacent cleanup is included.
- Commit subject starts `C08`.

## Mechanical gate

`bun test scripts/harness-agent-contracts.test.ts`

## Skill routing

`tdd` - `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\skills\write-goal-prompt\SKILL.md`
