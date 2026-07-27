# 04 - Orchestration + discovery
Status: done
Blocked by: none

## Parent
Goal: harness-provider-model-routing (BRIEF.md, PLAN.md — no PRD.md; this is an autonomous
goal loop, not an interactive `/to-prd` intake).

## What to build
Document which harness roles may dispatch concurrently (faster goal execution) and confirm the
resolver's `{model, provider, tier}` output is exactly the spawn-descriptor shape a concurrent
fan-out needs — no extra glue required. Write `docs/adr/0007-provider-aware-model-orchestration.md`
covering: the role dependency chain (Planner → Maker → Prover → Checker → Shipper is sequential
by output/input dependency — Checker consumes Prover's PROOF verdict when applicable, Shipper
requires a Checker PASS plus separate shipping approval); the one existing precedent for
concurrent dispatch already in this repo (`.claude/workflows/red-team.js`'s four parallel attack
roles) as the model for how a future fan-out would consume per-role spawn descriptors; and why
pure-resolver-plus-injected-detection matters specifically for concurrency (no shared mutable
detection state to race on when multiple spawns resolve models at once). Then update
`skills/write-goal-prompt/SKILL.md`'s Phase 1.5 "Agent 4 — Harness Architect" prompt so a newly
authored goal's `HARNESS.md` carries this routing policy forward (pointer to the resolver + the
concurrency map), not just this repo's own five static agent files.

## Acceptance criteria
- `docs/adr/0007-provider-aware-model-orchestration.md` exists and names, for every one of the 5 harness roles, whether it may run concurrently with any other named role and why (citing the actual input/output dependency, not just asserting it).
- The ADR explicitly references the Phase 1 resolver's `{model, provider, tier}` return shape as the spawn descriptor a concurrent fan-out consumes, and cites `.claude/workflows/red-team.js` as the existing 4-way-parallel precedent.
- The ADR states plainly that this goal's own four phases stay sequential (single Maker, per-phase commits) — the concurrency map is a capability documented for other goal runs, not a change to this run's control flow.
- `skills/write-goal-prompt/SKILL.md`'s Phase 1.5 Agent 4 prompt is edited so the `HARNESS.md` it produces carries the routing policy forward — e.g. a pointer to `scripts/resolve-role-model.ts` and a one-line concurrency note per role.
- Direct implementation (no `/tdd` — this is a documentation deliverable); the mechanical gate is file-existence plus a grep confirming both required references (resolver script path, red-team.js path) appear in the new ADR.

## Skill routing
`direct` — artifact: `docs/adr/0007-provider-aware-model-orchestration.md` + `skills/write-goal-prompt/SKILL.md` (Agent 4 / Phase 1.5 discovery prompt)
