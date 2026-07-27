# 01 - Policy + resolver
Status: done
Blocked by: none

## Parent
Goal: harness-provider-model-routing (BRIEF.md, PLAN.md — no PRD.md; this is an autonomous
goal loop, not an interactive `/to-prd` intake).

## What to build
A pure `resolveRoleModel(role, detected)` in `scripts/resolve-role-model.ts` implementing the
full policy table and deterministic fallback chain from PLAN.md, plus a thin CLI wrapper on the
same file: `bun scripts/resolve-role-model.ts <role> --provider <native|claudex|codex>` prints
the resolved `{model, provider, tier}` as JSON. The resolver function itself performs zero I/O
(no `Bun.which`, no `process.env`, no `Bun.spawnSync`) — `detected` is always injected by the
caller (the CLI wrapper is the only place allowed to construct a literal `detected` object from
argv, and even there it is a static map from `--provider` string to `{provider}`, not live
detection).

## Acceptance criteria
- `scripts/resolve-role-model.ts` exports `resolveRoleModel(role, detected): {model, provider, tier}` matching PLAN.md's policy table exactly for all 5 roles × 3 providers (15 combinations).
- The resolver file contains no `Bun.which`, no `process.env`, and no `Bun.spawnSync` calls — grep for all three returns empty against this file specifically.
- CLI mode works: `bun scripts/resolve-role-model.ts checker --provider codex` prints `{model: "gpt-5.6-sol", provider: "codex", tier: "flagship"}` (or equivalent JSON); same pattern verified for at least one native and one claudex case.
- `scripts/resolve-role-model.test.ts` exhaustively tests all 15 role×provider combinations against the literal table in PLAN.md, plus one test asserting an unrecognized/missing `detected.provider` value degrades to the native row rather than throwing.
- `bun test scripts/resolve-role-model.test.ts` exits 0 — paste the pass count as proof in PROGRESS.md.

## Skill routing
`tdd` — artifact: `scripts/resolve-role-model.ts` + `scripts/resolve-role-model.test.ts`
