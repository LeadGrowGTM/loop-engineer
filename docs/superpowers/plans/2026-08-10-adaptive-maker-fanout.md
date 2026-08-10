# Adaptive Maker Fan-out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make goal-authored harnesses choose safe Maker concurrency and task-appropriate Claude models, while preserving Codex-first shipping with a narrow Claude startup fallback.

**Architecture:** Add pure planning seams for work-unit scheduling, task-aware model selection, and Ship executor selection. The goal coordinator owns the dependency/ownership ledger and integrates isolated Maker branches; workers never share a Git index, HEAD, or mutable progress file. Existing provider detection remains separate from task/model policy and Ship executor availability.

**Tech Stack:** Bun, TypeScript, Markdown harness contracts, Claude Code agents, Git worktrees, `no-mistakes axi`.

## Global Constraints

- Video frames/frame ranges are the canonical parallel example, not a video-specific rule.
- Concurrent Makers require disjoint artifacts and in-repo `.worktrees/<task-id>` branches `wt/<task-id>`.
- Haiku = simple tools/explore/search; Sonnet = copy/synthesis/general work; Opus = visual/difficult workhorse; Fable = creativity/orchestration.
- Select the cheapest supported model expected to clear the task-specific eval; never inherit the parent model automatically.
- Codex remains the preferred `no-mistakes` executor; Claude fallback is allowed only before a valid pipeline run starts.
- Checker PASS and separate explicit shipping approval remain mandatory.

---

### Task 1: Explore and freeze runtime seams

**Files:**
- Create: `.harness/goals/harness-adaptive-maker-fanout/EXPLORE.md`
- Inspect: `skills/write-goal-prompt/SKILL.md`
- Inspect: `skills/write-goal-prompt/references/subagent-harness.md`
- Inspect: `.claude/agents/harness-*.md`
- Inspect: `scripts/resolve-role-model.ts`
- Inspect: installed Codex, Claude, and `no-mistakes` help/contracts

**Interfaces:**
- Consumes: approved design and current runtime.
- Produces: exact spawn interface, depth limit, provider alias set, no-mistakes valid-run boundary, and file/symbol map.

- [ ] Run the documented help and contract probes without starting a pipeline.
- [ ] Record exact supported model aliases and distinguish provider detection, task-aware model selection, and Ship executor selection.
- [ ] Reconcile the conflicting depth documentation conservatively.
- [ ] Commit the exploration artifact.

### Task 2: Define the work-unit scheduling seam

**Files:**
- Create or modify: exact scheduler module identified by Task 1
- Test: focused scheduler test identified by Task 1

**Interfaces:**
- Consumes: `WorkUnit { id, size, dependencies, readSet, writeSet, externalState }` and available capacity.
- Produces: `FanoutPlan { waves, assignments, integrationBarriers, reason }`.

- [ ] Write a failing test where small/coupled work selects one Maker.
- [ ] Run the focused test and observe the expected failure.
- [ ] Implement the minimum one-Maker decision.
- [ ] Write and pass tracer tests for bounded independent-frame fan-out, competing writes, dependency waves, and capacity limits.
- [ ] Commit the green scheduling slice.

### Task 3: Add ownership, isolation, and feedback routing

**Files:**
- Modify: `.claude/agents/harness-planner.md`
- Modify: `.claude/agents/harness-maker.md`
- Modify: `.claude/agents/harness-checker.md`
- Test: `scripts/harness-agent-contracts.test.ts`

**Interfaces:**
- Consumes: `FanoutPlan` assignments and Checker findings containing work-unit/artifact IDs.
- Produces: coordinator-owned ledger, isolated worker handoffs, deterministic join, and owner-routed rework.

- [ ] Write failing contract tests for exclusive artifact ownership, in-repo worktrees, coordinator-only progress/integration, and findings routed to their original owner.
- [ ] Run the focused tests and confirm red.
- [ ] Update Planner, Maker, and Checker contracts minimally.
- [ ] Add partial-failure tests proving successful units survive and only failed/affected units reopen.
- [ ] Run focused tests and commit.

### Task 4: Add task-aware model selection

**Files:**
- Create or modify: model-policy module identified by Task 1
- Modify: `scripts/resolve-role-model.ts` only if exploration proves its interface is the correct seam
- Test: focused model-policy tests plus `scripts/harness-agent-contracts.test.ts`
- Modify: `docs/DEPENDENCIES.md`

**Interfaces:**
- Consumes: task signals, detected provider, verified aliases, and available models.
- Produces: `{ model, provider, tier, reason, fallback, costTier }`.

- [ ] Write failing tests for Haiku tool/explore/search, Sonnet copy/synthesis, Opus visual/workhorse, and Fable creativity/orchestration defaults.
- [ ] Add a failing mixed-team test proving a Fable orchestrator does not force Fable workers.
- [ ] Add provider-compatibility tests that reject or downgrade unrecognized aliases.
- [ ] Implement the cheapest-capable selection and effort-first escalation rules.
- [ ] Run tests and commit.

### Task 5: Add the Ship executor selector

**Files:**
- Create: pure Ship executor-selection module at the seam found in Task 1
- Modify: `.claude/agents/harness-shipper.md`
- Test: focused selector tests and `scripts/harness-agent-contracts.test.ts`

**Interfaces:**
- Consumes: Codex availability/start result and valid-pipeline-start state.
- Produces: `{ executor: codex | claude, fallbackReason, validRunStarted }`.

- [ ] Write failing tests for Codex success, unavailable, and pre-start invocation failure.
- [ ] Write failing tests proving `checks-passed`, `passed`, `failed`, `cancelled`, and active/gated runs never trigger fallback.
- [ ] Implement the pure selector and update Shipper to record executor/reason/outcome.
- [ ] Run focused tests and commit.

### Task 6: Synchronize goal-authoring contracts

**Files:**
- Modify: `skills/write-goal-prompt/SKILL.md`
- Modify: `skills/write-goal-prompt/references/subagent-harness.md`
- Modify: `skills/write-goal-prompt/references/parallel-execution.md`
- Modify: `skills/write-goal-prompt/EXAMPLES.md`
- Modify: `skills/write-goal-prompt/docs/ARCHITECTURE.md`
- Test: `scripts/harness-agent-contracts.test.ts`

**Interfaces:**
- Consumes: scheduler, ownership, model, and Ship selection contracts.
- Produces: every newly authored goal carries the policies consistently.

- [ ] Write failing textual contract tests for all required generated sections and examples.
- [ ] Update docs/templates without duplicating standing protocol into goal conditions.
- [ ] Run focused and full harness tests.
- [ ] Scan for stale singular-Maker, static-model, depth, and Ship-exactly-once wording; resolve contradictions.
- [ ] Commit the synchronization slice.

### Task 7: Final verification

**Files:**
- Verify all changed artifacts.

**Interfaces:**
- Consumes: integrated feature branch.
- Produces: mechanical proof and fresh Checker verdict.

- [ ] Run `bun test scripts/harness-agent-contracts.test.ts`.
- [ ] Run `bun test scripts/*.test.ts skills/write-goal-prompt/scripts/*.test.ts`.
- [ ] Run the textual audit for work units, ownership, integration, model reasons, and Ship fallback.
- [ ] Verify every changed path belongs to the approved goal and no unrelated dirty work was staged.
- [ ] Spawn a fresh artifact-only Checker; route any findings by work-unit/artifact ID and repeat until PASS or plateau.
- [ ] Ship only after separate explicit approval.
