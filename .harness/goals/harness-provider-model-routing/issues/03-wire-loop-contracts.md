# 03 - Wire into the loop + agent contracts
Status: done
Blocked by: none

## Parent
Goal: harness-provider-model-routing (BRIEF.md, PLAN.md — no PRD.md; this is an autonomous
goal loop, not an interactive `/to-prd` intake).

## What to build
Consult the Phase 1 resolver wherever a harness role subagent is spawned, and update
`scripts/harness-agent-contracts.test.ts` to assert the resolved model per (role × provider)
instead of a single static frontmatter string. Each `.claude/agents/harness-*.md` frontmatter
`model:` line stays exactly as-is — it is the guaranteed native-provider fallback by construction
(PLAN.md's fallback chain), not something this phase edits. "Wherever a role subagent is spawned"
in this repo means the documented invocation patterns, not literal spawn code: update
`skills/write-goal-prompt/SKILL.md`'s `[HARNESS]` block (the five numbered stage descriptions)
and `skills/write-goal-prompt/references/subagent-harness.md`'s `Agent({subagent_type: ...})`
invocation pattern to instruct resolving the model via `scripts/resolve-role-model.ts` before
each spawn, and passing it as an explicit override where the invocation mechanism accepts one —
falling back to the agent file's own frontmatter (which already equals the native resolution)
when it does not. Do not claim runtime override enforcement that cannot be verified in this repo.

## Acceptance criteria
- `scripts/harness-agent-contracts.test.ts` imports `resolveRoleModel` and adds assertions covering all 5 roles × 3 providers, checking the resolved `{model, tier}` against PLAN.md's policy table — not just grepping the static frontmatter string as the sole check for model routing.
- Existing contract tests in the file (approval, commit atomicity, checker independence, etc.) remain green and unmodified in intent — no regression.
- `skills/write-goal-prompt/SKILL.md`'s `[HARNESS]` block references `scripts/resolve-role-model.ts` as the model-resolution step preceding each of the five stage spawns.
- `skills/write-goal-prompt/references/subagent-harness.md`'s invocation pattern section documents resolving via the script before calling `Agent({subagent_type: ...})`, and explicitly states the frontmatter fallback boundary (no overclaiming a runtime override that isn't confirmed to exist).
- `bun test scripts/harness-agent-contracts.test.ts` exits 0 — paste the pass count as proof in PROGRESS.md.
- `bun test scripts/` (full suite) exits 0 — no regression introduced elsewhere.

## Skill routing
`tdd` — artifact: `scripts/harness-agent-contracts.test.ts` (updated) + spawn-path doc edits in `skills/write-goal-prompt/SKILL.md` and `skills/write-goal-prompt/references/subagent-harness.md`
