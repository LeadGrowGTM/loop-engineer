---
disable-model-invocation: true
name: write-goal-prompt
description: >
  Transforms a task description into a lean, restartable /goal pointer. Authoring and runtime
  state flow only through goal-lifecycle and its durable run records.
version: 4.0.0
maturity: validated
triggers:
  - write a goal prompt
  - turn this into a /goal
  - overnight task
  - run unsupervised
  - hand off this task
---

# Skill: Write Goal Prompt

Turn a task into a `/goal` restart pointer. The pointer carries no conversational state and never
describes repository preparation. The lifecycle owns task registration, dependency checks, isolated
run acquisition, validation, completion, and read-only diagnostics.

## Lifecycle interface

These are the only supported lifecycle operations:

```text
goal-lifecycle start --repo <absolute-repository-path> --task-id <slug> --title <one-line-title>
goal-lifecycle record-grill --run <RUN.json> --receipt <candidate-GRILL.json>
goal-lifecycle validate --run <RUN.json>
goal-lifecycle finish --run <RUN.json> [--outcome success|blocked|failed] [--pr <url>]
goal-lifecycle audit --repo <absolute-repository-path>
```

Use `audit` only for read-only diagnostics. Use `finish` only after the work and required handoff
records are complete. Outcome defaults to `success` when omitted. Do not call underlying task, lease,
or repository-management tools directly.

## Authoring sequence

Perform these steps in order. A failure is terminal for this attempt: preserve the lifecycle JSON,
follow its remediation, and retry the same lifecycle operation only after the reported condition is
resolved.

Before step 1, resolve the target project's actual repository root:

```text
git -C <candidate-target> rev-parse --show-toplevel
```

Use that exact absolute output as the `--repo` value. When the candidate is a nested repository,
its own root is the target; the nested repository must not use a workspace or monorepo root.

1. Run `goal-lifecycle start --repo <exact-target-repository-root> --task-id <slug> --title <one-line-title>`.
   Read its successful JSON and take `taskId`, `worktreePath`, `runDirectory`, and `manifestPath` as
   authoritative. The author must not select or derive a run path.
2. Change into the returned absolute `worktreePath`. Unconditionally invoke `batch-grill-me`, even
   when the opening request looks complete. Save its completed, redacted candidate receipt as
   `<runDirectory>/candidate-GRILL.json`; a zero-question completed frontier is valid.
3. Run `goal-lifecycle record-grill --run <RUN.json> --receipt <candidate-GRILL.json>`, using the
   absolute manifest path returned by `start`. Do not continue unless its JSON result is successful.
4. Resolve routing from the manifest's `repositoryRoot` only after grill recording succeeds. Persist
   the exact emitted `[ROUTING_GUARD]` block verbatim in `HARNESS.md`; it is the restart-time routing
   action and must not be regenerated from memory. Then persist `RUN.json + GRILL.json + BRIEF.md + HARNESS.md` in the returned run directory before any
   context clear. `BRIEF.md` records the bounded task, success criteria, constraints, and exclusions.
   `HARNESS.md` records task briefs, execution protocol, proof, blocking, context, and shipping rules.
5. Emit the measured restart pointer below. It must name the task ID, absolute run path, and absolute
   manifest path, and it must contain no repository-preparation instructions.

The required authoring order is `start -> unconditional batch-grill-me -> record-grill -> durable
artifacts -> emit restart pointer`.

## Intake and brief

Gather the task, stack, done criteria, quality bar, constraints, and turn budget. Use the completed
grill receipt to fold all settled decisions into `BRIEF.md`; do not replace the mandatory grill with
another interview path. A task that needs research may record that bounded research in the brief, but
the lifecycle sequence remains unchanged.

`BRIEF.md` must include:

```text
# Goal Brief — <task-id>

## Problem
<one sentence>

## Success criteria
- <observable result>

## Out of scope
- <explicit exclusion>
```

## Planner routing after validation

Skill routing is not run while authoring and never precedes restart validation. After validation
succeeds, resolve the planner routing with the existing executable resolver using the recorded
repository root from `RUN.json`. Pass its exact JSON to Planner as `[SKILL_ROUTING_RESOLUTION]`.
If it returns nonzero, stop before Planner. Persist the exact emitted `[ROUTING_GUARD]` block in
HARNESS.md before emitting the pointer. For `project-local` or `canonical`, Planner reads only
`normalizedPath`; for `direct`, Planner uses the confirmed HARNESS routing or a documented direct
quality bar. Do not hand-build or re-quote resolver paths.

HARNESS.md carries this exact post-validation guard, with its emitted command body rather than a
placeholder:

```text
[ROUTING_GUARD]
<exact emitted resolver guard block>
```

## HARNESS.md standing protocol

Write these contracts into `HARNESS.md` before emitting the pointer:

```text
EXECUTION_PROTOCOL
The restart pointer's first action is goal-lifecycle validate --run <RUN.json>. Stop on any
non-ready result. Validation succeeds before routing, Planner, or Maker is reachable. The parent
then executes the exact [ROUTING_GUARD] block persisted in HARNESS.md, passes exact routing evidence plus LIFECYCLE_VALIDATION: OK to Planner, and
runs Planner → Maker → Prover (when applicable) → Checker.

Planner writes PLAN.md and durable phase slices before task artifacts. Maker works only from the
recorded run path and the validated invocation context. Every phase needs a mechanical gate and
committed proof. A Checker PASS does not authorize shipping.

SHIPPING
Run the Shipper only after Checker PASS plus separate explicit shipping approval for this invocation.
Without that approval, record N/A - shipping not approved. The Shipper never merges. Once the
approved shipping flow has prepared its result, invoke goal-lifecycle finish --run <RUN.json>
[--outcome success|blocked|failed] [--pr <url>] to complete the lifecycle. A failed or blocked goal
retains its run for recovery.

CONTEXT_MANAGEMENT
Before context clear, confirm RUN.json, GRILL.json, BRIEF.md, and HARNESS.md are persisted at the
recorded absolute run path. After a compact, repeat the restart pointer's first action rather than
reconstructing state from memory.
```

## Restart pointer template

Measure the completed pointer before emitting it. It must stay lean and contain only task identity,
persisted locations, and restart instructions:

```text
/goal [LIFECYCLE_RESTART]
Task ID: <task-id>
Absolute run path: <worktreePath>
Manifest path: <absolute-path-to-RUN.json>
Artifacts: <absolute-path-to-GRILL.json>, <absolute-path-to-BRIEF.md>, <absolute-path-to-HARNESS.md>

First action: goal-lifecycle validate --run <RUN.json>.
Change execution to the absolute run path, read RUN.json and HARNESS.md, then run that first action.
Stop on any non-ready result. Validate before routing, Planner, or Maker. Only after successful
validation, execute the exact [ROUTING_GUARD] block persisted in HARNESS.md and invoke Planner with
LIFECYCLE_VALIDATION: OK.
```

## Runtime boundaries

- Planner and Maker are unreachable unless the parent supplies `LIFECYCLE_VALIDATION: OK` from the
  current `goal-lifecycle validate --run <RUN.json>` result.
- Runtime agents use only the recorded run path. They do not derive an alternate location.
- Keep separate shipping approval semantics: implementation approval and Checker PASS alone never
  authorize shipping.
- Do not emit a detached runner.

## Reference files

| File | Use |
| --- | --- |
| `references/clarity-gate.md` | Mandatory grill receipt contract |
| `references/parallel-execution.md` | Lifecycle-only isolated-run and completion contract |
| `references/context-management.md` | Durable restart checkpoint contract |
| `references/skill-routing.md` | Post-validation planner routing |
| `references/issue-tracker.md` | Durable Planner phase slices |
| `EXAMPLES.md` | Worked lifecycle pointer |
