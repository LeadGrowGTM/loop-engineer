# Adaptive Maker Fan-out and Claude Shipping Fallback

## Objective

Update the authoritative `write-goal-prompt` harness so newly authored goals choose Maker concurrency from the structure and size of the work, while keeping Codex as the preferred `no-mistakes` runner and Claude as an availability fallback.

## Adaptive Maker orchestration

The Planner must identify concrete work units before choosing a Maker count. A unit is parallel-safe only when it has a distinct output boundary, does not depend on another unit's unfinished output, and does not compete for the same mutable files or external state.

The Planner records:

- the work-unit inventory and estimated size;
- dependencies and shared-state risks;
- which units are parallel-safe;
- the selected Maker count, bounded by useful work and available agent capacity;
- artifact ownership and the later integration barrier.

Small, coupled, or shared-state work uses one Maker. Larger collections of independent units fan out across multiple Makers. The policy must avoid both serializing obviously independent work and spawning more Makers than there are meaningful isolated units.

Video production is the canonical example, not a special case: independent frames or frame ranges may be assigned to separate Makers because they have isolated outputs. The same rule applies to other independent batches such as image variants, document sections, migrations over disjoint targets, or isolated test groups. Assembly, cross-unit consistency, and final integration remain explicit sequential barriers.

Each Maker receives only its assigned units, relevant context, output paths, and quality criteria. Ownership is durable in PLAN.md and progress artifacts. When a reviewer finds a defect in an owned unit, the orchestrator returns that finding to the responsible Maker when possible. Cross-cutting findings go to an integration Maker or the parent orchestrator.

## Safety and failure handling

Fan-out is prohibited when units write the same artifact, mutate shared external state, require strict ordering, or cannot be merged deterministically. The Planner must state why concurrency is safe; absence of that evidence defaults to a single Maker.

Partial failures do not discard successful units. Failed units may be retried or reassigned, while completed artifacts remain available for integration. The Checker evaluates the integrated result with fresh context after all required Maker work and integration are complete.

## Task-aware model routing

Subagents must not blindly inherit the parent session's model. Default routing is Haiku 4.5 for simple tool calls, exploration, search, extraction, and cheap independent fan-out; Sonnet 5 for copywriting, synthesis, ordinary implementation, and bounded knowledge work; Opus 5 for visual work, frame execution, UI and multimodal judgment, difficult technical work, and visual review; and Fable 5 for creative direction, orchestration, decomposition, integration judgment, and original or high-ambiguity work.

Select the cheapest supported model expected to clear the task-specific quality bar. A Fable parent must not cause Fable inheritance: it should commonly orchestrate Haiku explorers, Sonnet copy agents, and Opus visual Makers. Record model, reason, fallback, and cost tier for every spawn. Respect verified provider aliases; do not emit Opus 5 or Fable 5 through a proxy until its aliases, docs, resolver policy, and tests support them.

## `no-mistakes` executor fallback

Codex remains the preferred executor for the approved Ship stage. Claude is a fallback only when Codex is unavailable or its invocation fails before a valid `no-mistakes` pipeline run begins.

The harness must:

1. attempt the Codex path first;
2. distinguish executor startup/availability failure from a legitimate pipeline failure;
3. fall back to Claude only for startup or availability failure;
4. never rerun a legitimately failed, cancelled, or completed pipeline under Claude merely to seek a different result;
5. record the chosen executor, fallback reason, and terminal pipeline outcome.

Shipping still requires Checker PASS plus separate explicit shipping approval. This change does not loosen that gate.

## Expected implementation surfaces

The implementation should update the canonical goal-authoring and harness references, especially:

- `skills/write-goal-prompt/SKILL.md`;
- `skills/write-goal-prompt/references/subagent-harness.md`;
- any orchestration reference that defines safe parallel execution;
- harness agent contracts or templates that carry Maker ownership and reviewer feedback;
- automated contract tests under `scripts/`.

Exact files may change after implementation planning if repository inspection identifies a more authoritative seam.

## Acceptance criteria

- Goal authoring derives Maker count from work-unit independence, task size, and available capacity.
- One-Maker behavior remains the default for small, coupled, or shared-state work.
- Independent video frames or frame ranges are documented as a canonical parallel example without making the policy video-specific.
- Every parallel Maker has exclusive artifact ownership and an explicit integration point.
- Review findings can be routed back to the responsible Maker; cross-cutting findings have an integration owner.
- Tests cover small versus large workloads, isolated versus competing units, bounded fan-out, partial failure, review routing, integration barriers, and mixed-model routing without parent-model inheritance.
- Codex is attempted first for `no-mistakes`; Claude is used only for Codex startup or availability failure.
- Tests prove that legitimate Codex pipeline outcomes do not trigger a Claude retry.
- Existing approval gates, provider-aware model resolution, Checker independence, and terminal outcome semantics remain intact.

## Out of scope

- Maximizing concurrency regardless of task shape.
- Video-specific orchestration logic.
- Allowing multiple Makers to edit the same mutable artifact concurrently.
- Choosing Claude by preference, task fit, or pipeline result when Codex is available.
- Changing the separate shipping-approval requirement.

## Verification strategy

Use contract tests to exercise representative planning inputs and assert the resulting concurrency plan, ownership map, integration barrier, and feedback routing. Add executor-selection tests for Codex success, Codex unavailable, Codex startup failure, and legitimate Codex pipeline failure. Run the focused tests and the full harness script suite before completion.
