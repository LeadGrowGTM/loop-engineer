# HARNESS — harness-adaptive-maker-fanout

Goal: make `write-goal-prompt` author safe, bounded, mixed-model Maker fan-outs and preserve Codex-first shipping with a narrow Claude startup fallback.

## PLANNER_BRIEF

Explore is the first mandatory dependency barrier. Read the approved spec and plan, `skills/write-goal-prompt/SKILL.md`, `references/{subagent-harness,parallel-execution,skill-routing}.md`, relevant `.claude/agents/harness-*.md`, provider/model code and tests, `docs/research/claude-task-aware-model-routing-2026-08-10.md`, and installed Claude/Codex/no-mistakes help. Do not guess model aliases, spawn syntax, nesting depth, or the boundary at which a no-mistakes pipeline has validly started.

PLAN.md must inventory work units, read/write sets, dependencies, shared state, stable artifact IDs, owners, estimated size, selected model/reason/fallback/cost tier, safe concurrency, isolated in-repo worktree/branch, and integration barrier. One Maker is the default for small/coupled/shared-state work. Fan out only dependency-ready units with disjoint mutable outputs; bound count by useful units, available capacity, depth, and integration cost. Video frames/ranges are the canonical example, not a special case.

Preserve routing evidence verbatim: `status=resolved`; `selectedSource=canonical`; `normalizedPath=C:/Users/mitch/Everything_CC/tools/agent/agent-harness/skills/write-goal-prompt/references/skill-routing.md`; `fallback=project-local-absent`; `sha256=e8a6eb4dab4fd02ef6157ae78a08fe38961f62ce121cf10e7712a50e5ef77440`; `errors=[]`.

Required phases: Explore/freeze seams; TDD scheduler; ownership/isolation/feedback routing; task-aware model routing; Ship executor selector; shared docs/contracts integration; full verification and fresh Checker.

## MAKER_ROUTING

- Explore: direct, read-only — `EXPLORE.md` with exact runtime seams and verified aliases.
- Scheduling interface: `codebase-design`, then `tdd` — pure work-unit-to-fanout plan with tests.
- Ownership/isolation/rework: `tdd` — exclusive artifact ownership, in-repo worktrees, coordinator join, routed findings, partial failure retention.
- Model selection: `tdd` — Haiku for simple tools/explore/search; Sonnet for copy/synthesis/general work; Opus for visual/difficult workhorse tasks; Fable for creativity/orchestration. Cheapest capable supported model wins; parent model never auto-inherits.
- Shipping selection: `tdd` — separate pure Codex-first/Claude-fallback selector; no fallback after a valid pipeline starts.
- Integration/docs: direct with contract-test quality bar — synchronize skill, references, agents, examples, architecture, dependency docs, and depth rules.

Concurrent Makers must use separate `<repo>/.worktrees/<task-id>` paths and `wt/<task-id>` branches, own disjoint artifacts, and never share an index, HEAD, working tree, or mutable PROGRESS.md. The coordinator alone owns the canonical ledger and shared-file integration. If isolation or deterministic integration cannot be proven, serialize.

## PROVER_BRIEF

N/A — static internal tooling. Behavioral proof comes from contract tests and fresh review.

## REDTEAM_BRIEF

N/A — static internal tooling. Edge cases belong in automated tests and Checker review.

## CHECKER_BRIEF

Read only the approved spec, frozen PLAN rubric, final artifacts, diff, named test output, and coordinator ownership ledger; never Maker reasoning. Findings must cite requirement, severity, file/evidence, work-unit ID, artifact ID, and responsible owner. Route shared/integration findings to coordinator. Score 1–5: requirement fidelity; orchestration safety; task/model selection and cost discipline; TDD coverage; Ship fallback correctness; docs/runtime consistency; maintainability. PASS requires full tests green, no high/blocking findings, mean >=4.0, and no dimension <3.

## SHIP_BRIEF

Intent: update the authoritative goal harness with safe adaptive Maker fan-out, model choice by job, owner-routed review, and Codex-preferred no-mistakes execution with Claude only as a pre-start availability fallback. Checker PASS is necessary but insufficient; require separate explicit shipping approval. Discover installed contracts. A Codex unavailable/startup failure before a valid pipeline run may fall back to Claude. Any valid active, gated, completed, failed, or cancelled pipeline is the one logical run and must never trigger executor fallback. Record executor, availability proof, fallback reason, validRunStarted, terminal result, commits, PR, and CI. Never merge.

## ORCHESTRATION NOTE

Parallelism is earned by independence. A Fable orchestrator should normally dispatch Haiku explorers, Sonnet copy/synthesis workers, and Opus visual/frame workers instead of cloning Fable. Use provider-aware spawn descriptors and verified aliases; tune effort before escalation. Independent video frames/ranges may fan out, but assembly and cross-frame consistency form a join barrier. Apply the same rule to other isolated batches.

## LOOP_TRACKER

The coordinator maintains one canonical table: work-unit ID; state (`planned|ready|assigned|red|green|integrated|checked|rework|pass`); owner; model/reason; worktree/branch; artifact/read/write sets; dependencies; test proof; integration SHA; Checker findings; retries. Makers submit results but never edit the ledger concurrently. Reopen affected dependents when an upstream/shared contract changes.

## EXECUTION_PROTOCOL

1. Execute the routing guard immediately before Planner. Planner writes BRIEF.md, PLAN.md, and 1:1 issue slices before task artifacts.
2. Coordinator schedules dependency-ready work from PLAN.md. Each Maker follows its assigned slice and skill, captures protected-work evidence, runs its mechanical gate, and returns artifacts/proof/commit without touching coordinator-owned state.
3. Coordinator integrates isolated branches in dependency order and reruns impacted tests. Do not start verification before the join barrier closes.
4. Skip Prover and red-team for this static goal. Spawn a fresh Checker with artifact-only context. On ITERATE, route findings to recorded owners and repeat integration/checking.
5. After PASS, ship only with separate explicit approval. Otherwise record `N/A - shipping not approved` and terminate successfully.

## EVAL_LOOP

At turn 1 write the eval plan to HANDOFF.md: reward signal, fast mechanical gate, scored qualitative gate, max cycles, and exact done threshold from `[PARAMS]`. Inputs remain fixed. Per cycle: generate; pass mechanical tests; fresh Checker scores; PASS exits; otherwise fix only routed findings/weakest dimension. Stop on PASS, max cycles, or three identical scores (PLATEAU). Log every cycle and preserve the best committed state.

## BLOCKERS

Never silently lower substance. Tier 1: reproduce the same process manually. Tier 2: reduced scope marked `quality: draft`. Tier 3: skeleton marked `quality: placeholder` and flagged in HANDOFF. If isolation, alias support, or pipeline-start semantics are unverified, do not guess: serialize or keep the current supported alias and document the blocked upgrade. Continue all independent work.

## PROOF_PROTOCOL

Every completed slice appends to PROGRESS.md: phase/work-unit ID; artifact path; exact mechanical command and output; model/reason; worktree/branch; integration SHA; commit SHA. Assertions without command/file evidence do not count. Stage only approved task paths; preserve unrelated dirty work.

## CONTEXT_MANAGEMENT

Run `/compact` near the `[PARAMS]` compact threshold, never on turn 1. Before compacting, persist the coordinator ledger, current dependency frontier, isolated worktree paths, integration state, and next action. After compaction, reread HARNESS.md, PLAN.md, and the ledger.

## MORNING_REPORT

Write HANDOFF.md, HANDOFF.html, and HANDOFF.excalidraw in this goal directory. HANDOFF.md must lead with outcome, tests, Checker verdict, worktree/branch state, model/cost decisions, shipping result, workarounds, and decisions needed. Publish HANDOFF.html publicly with `lavish-axi share`; store the update key only in gitignored HANDOFF.secret.local. If sharing fails, export locally and record why. Never include credentials or client PII.

## TURN_LIMIT

Stop at `[PARAMS].turn_limit`. Persist all artifacts and the morning report even if incomplete; never claim PASS without the required threshold and proof.
