# Write Goal Prompt — Worked Lifecycle Example

## Input

```text
Task: Migrate fetch calls in src/api/ to ApiClient.
Done: tests pass and no raw fetch calls remain in src/api/.
Repository: C:\work\myapp
```

## Authoring record

```text
git -C C:\work\myapp rev-parse --show-toplevel
# C:\work\myapp
goal-lifecycle start --repo C:\work\myapp --task-id api-client-migration --title "Migrate API calls to ApiClient"
```

The `git` result is the target project's actual root. If `C:\work\myapp` were nested, its own
reported root—not the containing workspace or monorepo—would still be passed to `start`. On
successful `start`, use only its returned `worktreePath`, `runDirectory`, and `manifestPath`.
Change into that run path, then unconditionally invoke `batch-grill-me`. Save its completed receipt
as `<runDirectory>/candidate-GRILL.json`, even when it contains zero questions.

```text
goal-lifecycle record-grill --run <RUN.json> --receipt <candidate-GRILL.json>
```

After successful recording, persist `RUN.json + GRILL.json + BRIEF.md + HARNESS.md` before any
context clear. The authoring sequence is `start -> unconditional batch-grill-me -> record-grill ->
durable artifacts -> emit restart pointer`.

HARNESS.md stores the exact emitted resolver command block for this run:

```text
[ROUTING_GUARD]
<exact emitted resolver guard block for C:\work\myapp>
```

## Output

```text
/goal [LIFECYCLE_RESTART]
Task ID: api-client-migration
Absolute run path: C:\work\myapp\.worktrees\api-client-migration
Manifest path: C:\work\myapp\.worktrees\api-client-migration\.harness\goals\api-client-migration\RUN.json
Artifacts: C:\work\myapp\.worktrees\api-client-migration\.harness\goals\api-client-migration\GRILL.json,
  C:\work\myapp\.worktrees\api-client-migration\.harness\goals\api-client-migration\BRIEF.md,
  C:\work\myapp\.worktrees\api-client-migration\.harness\goals\api-client-migration\HARNESS.md

First action: goal-lifecycle validate --run <RUN.json>.
Change execution to the absolute run path, read RUN.json and HARNESS.md, then run that first action.
Stop on any non-ready result. Validate before routing, Planner, or Maker. After successful validation,
execute the exact [ROUTING_GUARD] block persisted in HARNESS.md and invoke Planner with
LIFECYCLE_VALIDATION: OK.
```

The generated pointer does not include task registration, run acquisition, alternate-path selection,
or repository-preparation instructions. Shipping remains separately approved: Checker PASS alone
does not start shipping, and the shipping flow never merges.
