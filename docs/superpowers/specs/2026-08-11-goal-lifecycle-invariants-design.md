# Goal lifecycle invariants

Date: 2026-08-11
Status: approved for implementation planning

## Problem

Goal authoring and goal execution currently rely on distributed prose contracts. Historical goals and agents issued direct commands such as `git worktree add ../gtm-orchestrator-funnel-batch`, creating task worktrees beside real pipeline repositories. A read-only audit found 28 registered worktrees outside repository-local `.worktrees/` roots across `gtm-orchestrator` and `leadgrow-video` alone. Four of those worktrees appear as unexpected top-level pipeline directories, and one contains dirty work.

The goal authoring path can also skip its interview when the opening request appears complete, and runtime isolation has supported `-NoIsolation` or single-stream bypasses. Clearing conversation context before `/goal` makes any state held only in chat unavailable to the autonomous run.

## Goals

1. Every harness goal has one durable task identity registered in `tasks-axi`.
2. Every goal runs in a Treehouse-managed worktree contained by the target repository's `.worktrees/` directory.
3. Every goal invokes `batch-grill-me`, including apparently complete goals; an empty frontier is a valid recorded result.
4. Missing required dependencies route through supported setup and are verified again. Goal authoring fails closed if setup cannot make them available.
5. Goal execution survives the deliberate context clear because all required state is persisted before `/goal` starts.
6. Existing misplaced worktrees are inventoried without moving, returning, or deleting them.

## Non-goals

- Removing or moving any existing worktree.
- Cleaning multi-gigabyte media and render artifacts under `.harness/goals/`. That is a separate storage-retention problem.
- Replacing Treehouse with direct `git worktree` commands.
- Automatically merging or deleting task branches.

## Domain language

- **Repository**: the target's actual `git rev-parse --show-toplevel`. It owns worktree placement and Git safety state.
- **Pipeline**: a domain-specific project that may itself be a nested repository. Its parent `pipelines/` directory is not a worktree root.
- **Task**: the durable `tasks-axi` record. Its slug is the canonical task ID.
- **Goal authoring**: the interactive, pre-clear phase that registers the task, prepares isolation, runs the grill, and persists the restart contract.
- **Goal execution**: the autonomous, post-clear phase started by `/goal` from durable state.
- **Goal lifecycle**: goal authoring and goal execution joined by a persisted run manifest.
- **Managed worktree**: a Treehouse lease beneath `<repository>/.worktrees/`, identified by the task ID.
- **Misplaced worktree**: any non-primary registered worktree outside `<repository>/.worktrees/`.
- **Grill receipt**: machine-checkable proof that `batch-grill-me` reached an empty frontier.

## Selected approach

Create a deep `goal-lifecycle` module with a small command interface. Keep the existing readiness script as its repository and Treehouse adapter instead of adding task registration, grill state, and restart orchestration to the already-large PowerShell implementation.

Alternatives rejected:

1. **Add more prose and contract tests only.** This cannot prevent a caller from bypassing Treehouse or skipping the grill.
2. **Expand `prepare-harness-run.ps1`.** This would combine authoring state, setup, task registration, process handling, and finish behavior in one large platform-specific script.
3. **Use direct Git worktrees at `.worktrees/<task-id>`.** This discards Treehouse pooling, leasing, and return semantics.

Treehouse v1.8 places pool entries under `<configured-root>/.treehouse/<repo-key>/<slot>/<repo-name>`. The accepted policy is containment beneath a shared repository-local `.worktrees/` pool, with identity supplied by lease holder `<task-id>` and branch `wt/<task-id>`. Treehouse-internal nesting is not part of the harness interface.

## Module interface

The new executable interface is:

```text
goal-lifecycle start --repo <path> --task-id <slug> --title <text>
goal-lifecycle record-grill --run <RUN.json> --receipt <GRILL.json>
goal-lifecycle validate --run <RUN.json>
goal-lifecycle finish --run <RUN.json> [--pr <url>]
goal-lifecycle audit --repo <path>
```

All commands emit one JSON result and stable typed error codes. Callers do not invoke `tasks-axi`, Treehouse, or Git worktree creation directly.

### `start`

`start` performs these operations in order:

1. Resolve the actual repository root and reject a detached, default, dirty, or invalid target using the existing readiness adapter.
2. Run dependency doctor checks for `tasks-axi`, Treehouse, and the pinned `batch-grill-me` skill.
3. If a dependency is absent, return `DEPENDENCY_SETUP_REQUIRED` with the supported setup route. The authoring skill invokes setup/onboarding, then retries `start`. There is no fallback execution mode.
4. Register and start `<task-id>` in `tasks-axi`. An existing compatible active task is reused idempotently; conflicting task state is rejected.
5. Verify `treehouse.toml` resolves its pool beneath `<repository>/.worktrees/` and `.worktrees/` is ignored.
6. Acquire Treehouse with `--lease --lease-holder <task-id>`.
7. Validate the returned absolute path, Git common directory, worktree registration, and containment beneath `<repository>/.worktrees/`.
8. Attach or verify branch `wt/<task-id>` at the checked source commit.
9. Create `<runPath>/.harness/goals/<task-id>/RUN.json` and return the run context.

If validation after lease acquisition fails, the module returns only the lease it just acquired when it can prove the exact path and Git identity. It never touches pre-existing leases.

### `record-grill`

The authoring skill invokes `batch-grill-me` unconditionally inside the prepared run. It writes `GRILL.json`, redacting secrets, with:

- schema version and task ID;
- skill identity and pinned source/version;
- ordered rounds, questions, recommendations, and settled decisions;
- final frontier count;
- completion status.

`record-grill` validates that the task matches `RUN.json`, the rounds are structurally valid, and completion means a zero-size frontier. A fully specified opening request still records invocation and may finish with zero questions. The module then marks the run `GRILL_COMPLETE`.

### `validate`

`validate` is the first command executed after context clear. It checks:

- the `tasks-axi` task is active;
- `RUN.json` and `GRILL.json` agree on task identity;
- the current directory is the recorded worktree;
- the worktree is still registered to the recorded Git common directory;
- its path remains under `<repository>/.worktrees/`;
- Treehouse reports the lease for the same task ID;
- branch is `wt/<task-id>`;
- the grill status is complete.

Planner and Maker remain unreachable on any failure.

### `finish`

`finish` verifies the intended commits are reachable from `wt/<task-id>`, the worktree has no uncommitted task work, and required handoff records exist. It then returns that exact Treehouse lease and marks the `tasks-axi` task done, including the PR URL when supplied. A failed or blocked goal retains its lease and writes recovery instructions; it is never returned automatically.

### `audit`

`audit` lists every registered worktree with repository, path, branch, HEAD, dirty state, merge/reachability state, manager classification, and a suggested cleanup command. Paths outside the allowed root receive `MISPLACED_WORKTREE`. Audit is read-only and never prunes, moves, returns, or deletes.

## Context-reset handoff

Goal authoring completes before the user clears context:

```text
tasks-axi registration
  -> dependency verification/setup
  -> Treehouse lease
  -> batch-grill-me
  -> RUN.json + GRILL.json + BRIEF.md + HARNESS.md
  -> measured /goal restart pointer
```

The generated goal condition no longer carries conversational state or worktree-creation instructions. It contains only the task identity, absolute run path, manifest path, and mandatory first actions:

1. change execution to the recorded run path;
2. read `RUN.json` and `HARNESS.md`;
3. execute `goal-lifecycle validate`;
4. stop on any non-ready result;
5. invoke Planner only after validation succeeds.

The generated prompt must not contain `git worktree add`, `-NoIsolation`, a worktree path chosen by the model, or a conditional grill instruction.

## Setup and migration

`setup-harness` becomes the supported setup owner:

- `tasks-axi`, Treehouse, and `batch-grill-me` are required dependencies.
- The pinned `batch-grill-me` source is bundled and installed idempotently into the supported user skill location.
- Missing internal CLIs route through workspace onboarding and are rechecked before setup can report ready.
- New repositories receive `treehouse.toml` with `root = ".worktrees/"` and an ignored `.worktrees/` entry.
- Existing safe configuration drift is repaired only when doing so cannot strand an active Treehouse lease. Otherwise setup reports the leases and blocks new lifecycle start until the operator resolves them.
- Existing non-Treehouse or misplaced worktrees do not get mutated. They appear in `audit`; a path collision or unsafe source repository still blocks the new run.

The pipeline-layout validator recognizes a sibling directory with a `.git` file pointing at another pipeline repository as `misplaced_worktree`, not as a new pipeline project.

## Failure behavior

The lifecycle is fail-closed. Representative error codes include:

- `DEPENDENCY_SETUP_REQUIRED`
- `DEPENDENCY_SETUP_FAILED`
- `TASK_REGISTRATION_FAILED`
- `TREEHOUSE_CONFIG_UNSAFE`
- `TREEHOUSE_LEASE_FAILED`
- `LEASE_OUTSIDE_REPOSITORY`
- `LEASE_IDENTITY_MISMATCH`
- `BRANCH_IDENTITY_MISMATCH`
- `GRILL_RECEIPT_MISSING`
- `GRILL_RECEIPT_INVALID`
- `CONTEXT_RESTART_INVALID`
- `MISPLACED_WORKTREE`
- `FINISH_NOT_SAFE`

Errors include exact remediation but never suggest bypassing Treehouse, skipping the grill, or using the primary checkout.

## Verification strategy

Implementation follows test-first development at these seams:

1. **Lifecycle state tests:** legal transitions and idempotent retries for `start`, `record-grill`, `validate`, and `finish`.
2. **Containment tests:** reject relative escapes, sibling paths, symlink/reparse escapes, wrong Git common directories, and Treehouse output outside `.worktrees/`.
3. **Task identity tests:** the same slug appears in `tasks-axi`, lease holder, branch, `RUN.json`, and `GRILL.json`.
4. **Grill tests:** unconditional invocation contract, valid zero-question completion, malformed or mismatched receipts, and secret-redaction rules.
5. **Context-reset integration test:** author a fixture run, discard all in-memory state, then validate and start execution using only the generated goal condition and persisted files.
6. **Setup tests:** clean install, idempotent reinstall, missing dependency routing, safe config repair, and active-legacy-lease refusal.
7. **Contract tests:** generated goals and agent definitions contain no direct `git worktree add`, no `-NoIsolation`, no conditional grill path, and no manual worktree fallback.
8. **Audit tests:** classify legacy worktrees without mutation and emit accurate dirty/branch/merge data.
9. **Regression fixture:** a proposed `../gtm-orchestrator-funnel-batch` worktree path must fail before any creation command executes.

The original environment audit remains evidence of legacy state, not a gate that requires destructive cleanup before implementation can pass.

## Rollout

1. Land the lifecycle module and tests without deleting existing interfaces.
2. Route `write-goal-prompt` and harness agents exclusively through the module.
3. Make setup install/verify the three required dependencies and repo-local Treehouse config.
4. Remove `-NoIsolation` and manual/single-stream worktree bypasses from supported contracts.
5. Add the read-only legacy audit and pipeline-layout classification.
6. Run the full contract and integration suite.
7. Inventory current legacy worktrees for a separate, explicitly approved cleanup task.
