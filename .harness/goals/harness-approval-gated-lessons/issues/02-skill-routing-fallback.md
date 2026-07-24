# 02 - C02 Deterministic skill-routing fallback
Status: done
Blocked by: 01

## Parent
`C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-approval-gated-lessons\BRIEF.md` and approved decision C02 in `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-approval-gated-lessons\APPROVALS.md`.

## What to build

Give Planner a deterministic fallback chain when `<PROJECT_ROOT>/.harness/skill-routing.md` is absent: try the canonical project write-goal-prompt routing reference, then use task-specific HARNESS routing and a documented direct implementation quality bar. Never abort solely because the seeded table is missing and never invent an unavailable skill.

## Approved source boundary

- `.claude/agents/harness-planner.md`
- `scripts/harness-agent-contracts.test.ts`

Goal-local slice status and `PROGRESS.md` may accompany this commit.

## Acceptance criteria

- The primary lookup is `<PROJECT_ROOT>/.harness/skill-routing.md`, not the goal subdirectory.
- A missing primary table falls back to `skills/write-goal-prompt/references/skill-routing.md` when present.
- If both files are absent, Planner uses confirmed HARNESS routing or `direct` with an explicit quality bar and records the fallback in PLAN.md.
- No unavailable skill is routed by assumption.
- Contract tests cover all three lookup outcomes.
- `bun test scripts/harness-agent-contracts.test.ts` exits 0.
- The commit subject starts `C02` and staged paths are limited to this boundary plus goal-local bookkeeping.

## Mechanical gate

`bun test scripts/harness-agent-contracts.test.ts`

## Skill routing

`tdd` - `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.claude\agents\harness-planner.md`
