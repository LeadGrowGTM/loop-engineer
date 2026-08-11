# Goal Lifecycle Invariants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every authored harness goal pass through one durable, fail-closed lifecycle that owns task identity, Treehouse isolation, grill proof, restart validation, completion, and read-only legacy audit.

**Architecture:** Add a Bun/TypeScript `goal-lifecycle` CLI as the only caller-facing seam. Keep bounded Git and Treehouse acquisition in `prepare-harness-run.ps1`, but give it exact task branch and repository-local pool constraints; keep filesystem/process/state logic in focused modules under `scripts/goal-lifecycle/`. Migrate setup, authoring, runtime agents, layout diagnostics, and documentation to the new CLI only after the lifecycle command is covered end-to-end.

**Tech Stack:** Bun 1.3.9, TypeScript, Bun test, PowerShell readiness adapter, Git, `tasks-axi` 0.1.1, Treehouse v1.8-compatible CLI.

## Global Constraints

- The public interface has exactly five operations: `start`, `record-grill`, `validate`, `finish`, and `audit`.
- Every command emits one JSON object. Failures use stable uppercase typed error codes and exact remediation that never recommends a primary-checkout, direct-Git-worktree, no-isolation, or skip-grill bypass.
- `tasks-axi`, Treehouse, and the pinned `batch-grill-me` skill are required. Supported setup/onboarding owns installation and repair; lifecycle execution fails closed while any dependency remains unusable.
- The `tasks-axi` slug is the task ID, Treehouse lease holder, `wt/<task-id>` branch suffix, run-manifest identity, grill-receipt identity, and completion identity.
- Repository ownership comes from `git rev-parse --show-toplevel`; every managed Treehouse path must be physically contained beneath that repository's `.worktrees/` pool and share its Git common directory.
- Treehouse is the exclusive worktree manager. Generated prompts, skills, and agents must not create Git worktrees or fall back to the primary checkout.
- `batch-grill-me` is invoked for every goal. A completed zero-question receipt with `finalFrontierCount: 0` is valid.
- Goal execution must use only the restart pointer and persisted `RUN.json`, `GRILL.json`, `BRIEF.md`, and `HARNESS.md`; `validate` must succeed before Planner or Maker is reachable.
- Blocked and failed runs retain their exact lease. Successful finish verifies preserved commits, clean state, and handoff evidence before returning only that lease and completing the task.
- Audit and pipeline classification are read-only. Existing misplaced worktrees are never moved, returned, pruned, deleted, reset, or cleaned by this feature.
- Tests use the lifecycle CLI as the primary seam and fake `tasks-axi`/Treehouse only as process adapters. Assertions cover JSON, exit status, durable files, and observable process effects.
- Work in vertical TDD slices: focused test red, minimal green, focused test pass, then commit. Run the full repository suite once at the end with a long timeout.

---

### Task 1: Lifecycle command contract and durable state model

**Files:**
- Create: `scripts/goal-lifecycle.ts`
- Create: `scripts/goal-lifecycle/contracts.ts`
- Create: `scripts/goal-lifecycle/process.ts`
- Create: `scripts/goal-lifecycle/manifest.ts`
- Create: `scripts/goal-lifecycle.test.ts`

**Interfaces:**
- Produces: `runGoalLifecycle(argv: string[], context?: LifecycleContext): Promise<LifecycleResult>`.
- Produces: `LifecycleResult = { schemaVersion: 1; operation; ok; code; message; remediation: string[]; data: Record<string, unknown> }`.
- Produces: versioned `RunManifestV1` and `GrillReceiptV1` types, plus atomic JSON read/write helpers.
- Produces: bounded `runProcess(command, args, options)` returning exit code, stdout, stderr, timeout, and output-limit state without shell interpolation.

- [ ] **Step 1: Write the failing CLI contract tests**

```ts
test('unknown operation emits exactly one typed JSON result', () => {
  const result = invokeLifecycle(['unknown']);
  expect(result.exitCode).toBe(2);
  expect(result.lines).toHaveLength(1);
  expect(result.json).toMatchObject({ schemaVersion: 1, ok: false, code: 'INVALID_ARGUMENT' });
});

test('manifest writes are atomic and reject unsupported schema versions', () => {
  expect(() => readRunManifest(pathToSchema2)).toThrow('RUN_MANIFEST_UNSUPPORTED');
});
```

- [ ] **Step 2: Run `bun test scripts/goal-lifecycle.test.ts` and confirm RED because the command and contracts do not exist.**
- [ ] **Step 3: Implement argument dispatch, one-result JSON output, stable error wrapping, bounded argv-only processes, and atomic JSON helpers.**

```ts
export type RunState = 'STARTED' | 'GRILL_COMPLETE' | 'VALIDATED' | 'FINISHED';
export interface RunManifestV1 {
  schemaVersion: 1;
  taskId: string;
  title: string;
  state: RunState;
  repositoryRoot: string;
  gitCommonDirectory: string;
  worktreePath: string;
  poolRoot: string;
  leaseHolder: string;
  branch: string;
  sourceHead: string;
  runDirectory: string;
  grillReceiptPath: string;
}
```

- [ ] **Step 4: Run `bun test scripts/goal-lifecycle.test.ts`; expect the contract tests to pass.**
- [ ] **Step 5: Commit `feat(goal-lifecycle): add command and state contracts`.**

### Task 2: Start lifecycle with canonical task identity and contained Treehouse lease

**Files:**
- Create: `scripts/goal-lifecycle/repository.ts`
- Create: `scripts/goal-lifecycle/start.ts`
- Modify: `scripts/goal-lifecycle.ts`
- Modify: `scripts/prepare-harness-run.ps1`
- Modify: `scripts/prepare-harness-run.test.ts`
- Modify: `scripts/goal-lifecycle.test.ts`

**Interfaces:**
- Consumes: Task 1 result/process/manifest contracts.
- Produces: `startLifecycle({ repo, taskId, title }, context): Promise<LifecycleResult>`.
- Produces readiness flags `-RunBranch wt/<task-id>` and `-RequiredPoolRoot <repo>/.worktrees` while retaining the existing bounded-process and exact-lease-return safety seam.
- Produces `RUN.json` at `<leased-worktree>/.harness/goals/<task-id>/RUN.json` in state `STARTED`.

- [ ] **Step 1: Add RED high-level tests for dependency doctor, idempotent task registration, conflicting task state, exact lease holder/branch, nested-repository ownership, sibling/traversal/reparse escapes, wrong Git common directory, malformed Treehouse output, and the original `../gtm-orchestrator-funnel-batch` regression.**

```ts
expect(start.json.code).toBe('LEASE_OUTSIDE_REPOSITORY');
expect(fakeTreehouse.calls).not.toContain('git worktree');
expect(valid.json.data).toMatchObject({ taskId, leaseHolder: taskId, branch: `wt/${taskId}` });
```

- [ ] **Step 2: Run the new lifecycle-start tests and the named readiness regression tests; confirm RED at the missing exact-branch/pool behavior.**
- [ ] **Step 3: Extend readiness to validate the canonical pool path before accepting a lease, reject reparse-point escapes, attach `wt/<task-id>` at the checked source commit, and return only a newly acquired, identity-proven invalid lease. Remove remediation that mentions `-NoIsolation`.**
- [ ] **Step 4: Implement start ordering: Git-resolve repo; doctor `tasks-axi`, Treehouse, and installed pinned grill; inspect/reuse or create/start the compatible task; validate `.worktrees/` ignore and `treehouse.toml`; invoke readiness; independently verify returned manifest facts; atomically write `RUN.json`.**
- [ ] **Step 5: Run `bun test scripts/goal-lifecycle.test.ts scripts/prepare-harness-run.test.ts`; expect all focused tests to pass.**
- [ ] **Step 6: Commit `feat(goal-lifecycle): start canonical managed runs`.**

### Task 3: Record and validate mandatory grill receipts

**Files:**
- Create: `scripts/goal-lifecycle/grill.ts`
- Modify: `scripts/goal-lifecycle.ts`
- Modify: `scripts/goal-lifecycle/contracts.ts`
- Modify: `scripts/goal-lifecycle.test.ts`

**Interfaces:**
- Consumes: `RunManifestV1` in state `STARTED` or `GRILL_COMPLETE`.
- Produces: `recordGrill(runPath, candidateReceiptPath)` and canonical `GRILL.json`.
- Produces: `GrillReceiptV1` with `schemaVersion`, `taskId`, pinned skill identity/version/source hash, ordered rounds, recommendations, settled decisions, `finalFrontierCount`, `status: 'complete'`, and redaction metadata.

- [ ] **Step 1: Add RED tests for unconditional zero-question completion, ordered multi-round completion, task mismatch, malformed/incomplete/frontier-nonzero input, receipt retry idempotence, and secret-like values in keys or content.**
- [ ] **Step 2: Run the grill test filter; confirm RED because `record-grill` is absent.**
- [ ] **Step 3: Implement strict structural validation, recursive secret redaction, pinned skill hash verification, canonical receipt write, and idempotent `RUN.json` transition to `GRILL_COMPLETE`.**

```ts
const SECRET_KEY = /(?:password|secret|token|api[_-]?key|update[_-]?key|authorization)/i;
if (receipt.status !== 'complete' || receipt.finalFrontierCount !== 0) {
  return failure('GRILL_RECEIPT_INVALID', 'The grill frontier is not complete.', ['Resume batch-grill-me and record the completed zero frontier.']);
}
```

- [ ] **Step 4: Run `bun test scripts/goal-lifecycle.test.ts --test-name-pattern grill`; expect pass.**
- [ ] **Step 5: Commit `feat(goal-lifecycle): persist mandatory grill proof`.**

### Task 4: Validate context-reset execution and gate runtime agents

**Files:**
- Create: `scripts/goal-lifecycle/validate.ts`
- Modify: `scripts/goal-lifecycle.ts`
- Modify: `scripts/goal-lifecycle.test.ts`
- Modify: `scripts/harness-agent-contracts.test.ts`

**Interfaces:**
- Consumes: only the absolute `RUN.json` path and persisted files/process state.
- Produces: `validateLifecycle(runPath, context)` with ready data only when task, manifest, grill, current directory, repository, common directory, containment, registration, Treehouse lease holder, and `wt/<task-id>` branch all agree.

- [ ] **Step 1: Add a RED end-to-end test that starts and records a fixture, launches a new process with no authoring memory, and validates using only the restart pointer. Add one failure case per invariant and markers proving Planner/Maker are never invoked.**
- [ ] **Step 2: Run the context-reset and contract tests; confirm RED because validate and runtime gates are absent.**
- [ ] **Step 3: Implement idempotent validation and stable `CONTEXT_RESTART_INVALID`, `LEASE_IDENTITY_MISMATCH`, `BRANCH_IDENTITY_MISMATCH`, `GRILL_RECEIPT_MISSING`, and `GRILL_RECEIPT_INVALID` results. Persist `VALIDATED` only after all checks pass.**
- [ ] **Step 4: Run `bun test scripts/goal-lifecycle.test.ts scripts/harness-agent-contracts.test.ts`; expect pass.**
- [ ] **Step 5: Commit `feat(goal-lifecycle): validate restart state before execution`.**

### Task 5: Finish safely and audit legacy worktrees without mutation

**Files:**
- Create: `scripts/goal-lifecycle/finish.ts`
- Create: `scripts/goal-lifecycle/audit.ts`
- Modify: `scripts/goal-lifecycle.ts`
- Modify: `scripts/goal-lifecycle.test.ts`

**Interfaces:**
- Consumes: validated run plus optional `--pr` and optional `--outcome success|blocked|failed` (default `success`).
- Produces: success completion commit containing the final manifest/completion record, exact Treehouse return, then idempotent `tasks-axi done <task-id> [--pr <url>]`.
- Produces: blocked/failed recovery record while retaining the lease.
- Produces: audit rows `{ path, branch, head, dirty, reachable, manager, classification, suggestedCommand }`.

- [ ] **Step 1: Add RED finish tests for clean success, dirty work, no commits beyond source, missing `HANDOFF.md`, wrong lease, idempotent completion, blocked/failed retention, and PR propagation. Add audit snapshot-before/after tests covering primary, managed, misplaced, dirty, unreachable, and sibling-pipeline worktrees.**
- [ ] **Step 2: Run finish/audit filters; confirm RED.**
- [ ] **Step 3: Implement fail-closed success checks, exact-path return, completion recording on `wt/<task-id>`, task completion after lease return, recovery instructions for non-success outcomes, and read-only audit collection via Git/Treehouse argv calls.**
- [ ] **Step 4: Re-run finish/audit tests and compare Git worktree registration, refs, files, and Treehouse calls before/after audit; expect no audit mutation.**
- [ ] **Step 5: Commit `feat(goal-lifecycle): finish runs and audit worktrees safely`.**

### Task 6: Make supported setup own all lifecycle dependencies and pool repair

**Files:**
- Create: `skills/setup-harness/vendor/batch-grill-me/SKILL.md`
- Modify: `scripts/setup-harness.ts`
- Modify: `scripts/setup-harness.test.ts`
- Modify: `skills/setup-harness/SKILL.md`
- Modify: `treehouse.toml`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: bundled pinned grill source and existing trusted-path install guards.
- Produces: `doctorLifecycleDependencies(targetDir): LifecycleDependencyReport` and setup output that distinguishes installable bundled skill drift from workspace-onboarding-required CLI failures.
- Produces repo config `root = ".worktrees/"` and ignored `.worktrees/`.

- [ ] **Step 1: Add RED setup tests for clean install, pinned grill install, idempotent reinstall, broken/missing `tasks-axi`, missing Treehouse, safe `.tmp/treehouse/` repair, and refusal to repair while active leases would be stranded.**
- [ ] **Step 2: Run `bun test scripts/setup-harness.test.ts`; confirm RED on the new required behavior.**
- [ ] **Step 3: Vendor the approved grill skill verbatim, install it through trusted destination validation, verify all three dependencies after setup, change new repo pool config/ignore to `.worktrees/`, and repair old config only after a no-active-lease Treehouse status check.**
- [ ] **Step 4: Run setup tests twice to prove byte-idempotent reinstall and no duplicate ignore/config entries.**
- [ ] **Step 5: Commit `feat(setup-harness): require lifecycle dependencies`.**

### Task 7: Route authoring and runtime contracts exclusively through lifecycle

**Files:**
- Modify: `skills/write-goal-prompt/SKILL.md`
- Modify: `skills/write-goal-prompt/EXAMPLES.md`
- Modify: `skills/write-goal-prompt/references/clarity-gate.md`
- Modify: `skills/write-goal-prompt/references/parallel-execution.md`
- Modify: `skills/write-goal-prompt/references/context-management.md`
- Modify: `.claude/agents/harness-planner.md`
- Modify: `.claude/agents/harness-maker.md`
- Modify: `.claude/agents/harness-shipper.md`
- Modify: `scripts/harness-agent-contracts.test.ts`

**Interfaces:**
- Consumes: all five lifecycle operations from Tasks 1-5.
- Produces: a lean restart pointer containing task ID, absolute run path, manifest path, and mandatory `goal-lifecycle validate --run <RUN.json>` first action.
- Produces: authoring order `start -> unconditional batch-grill-me -> record-grill -> durable artifacts -> emit pointer`.

- [ ] **Step 1: Add RED policy tests scanning generated examples, skill text, and agent definitions for mandatory lifecycle ordering and forbidding `git worktree add`, `-NoIsolation`, manual Treehouse acquisition/return, conditional grill language, model-chosen worktree paths, and Planner/Maker before validation.**
- [ ] **Step 2: Run `bun test scripts/harness-agent-contracts.test.ts`; confirm RED on current direct task/Treehouse and conditional clarity contracts.**
- [ ] **Step 3: Rewrite authoring and runtime contracts to use only lifecycle commands, persist `RUN.json`, `GRILL.json`, `BRIEF.md`, and `HARNESS.md` before context clear, emit the measured restart pointer, and require validation before routing/Planner. Remove supported non-isolated and single-stream bypasses.**
- [ ] **Step 4: Run harness contract tests and `bun test skills/write-goal-prompt/scripts/*.test.ts`; expect pass.**
- [ ] **Step 5: Commit `refactor(harness): route goals through lifecycle`.**

### Task 8: Classify misplaced pipeline worktrees and synchronize operator documentation

**Files:**
- Modify: `scripts/validate-pipeline-layout.ps1`
- Create: `scripts/validate-pipeline-layout.test.ts`
- Modify: `README.md`
- Modify: `CLAUDE.md`
- Modify: `docs/DEPENDENCIES.md`
- Modify: `skills/write-goal-prompt/docs/ARCHITECTURE.md`
- Modify: `skills/write-goal-prompt/docs/index.md`

**Interfaces:**
- Consumes: lifecycle and audit result vocabulary.
- Produces: layout result that recognizes a pipeline child whose `.git` file registers it to another repository as `misplaced_worktree`, while remaining read-only and failing with exact audit/cleanup guidance.

- [ ] **Step 1: Add RED layout fixtures for a real pipeline, allowlisted project, registered sibling worktree, malformed `.git` file, and ordinary unknown directory; snapshot files/refs before and after.**
- [ ] **Step 2: Run `bun test scripts/validate-pipeline-layout.test.ts`; confirm RED because sibling worktrees are currently allowlist entries rather than classified evidence.**
- [ ] **Step 3: Implement read-only Git-file classification, remove misplaced task checkouts from the real-pipeline allowlist, and update all operator docs to required dependencies, `.worktrees/`, lifecycle authoring/restart/finish/audit, and no automatic legacy cleanup.**
- [ ] **Step 4: Run lifecycle, setup, readiness, contract, layout, and goal-skill targeted tests; expect pass.**
- [ ] **Step 5: Run `bun test` once with a ten-minute-or-longer timeout and record exact totals/output.**
- [ ] **Step 6: Re-read issue #31 and the approved design line by line; map all 50 user stories to the implemented task/test evidence and fix any uncovered requirement.**
- [ ] **Step 7: Commit `docs(goal-lifecycle): document deterministic operations`.**

