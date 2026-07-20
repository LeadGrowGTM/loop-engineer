# Parallel Execution and Worktree Isolation

Parallel task streams must not share one working tree. Isolation uses **treehouse**, a pool of pre-warmed git worktrees with one leased path per stream.

## Preflight before preparation

Run readiness without mutation first:

```powershell
powershell -NoProfile -File scripts/prepare-harness-run.ps1 `
  -RepoPath C:\path\to\repo -CheckOnly -Parallel
```

The command emits one JSON object. Inspect these fields:

- `status`: `READY` or `NOT_READY`
- `repoPath`, source `branch`, derived `runBranch`, and `defaultBranch`
- `dirtyPaths` and `layoutValid`
- `isolationRequired`, `isolationPrepared`, and `treehouseAvailable`
- `runPath` and `errors`

Readiness fails before any treehouse action when the target is not a repository, is on its default branch, has a detached HEAD, is dirty, points at the workspace root or `pipelines/` parent, or has an invalid pipeline layout. `-CheckOnly` never leases a worktree.

## Explicit isolation preparation

After a `READY` check, request a lease explicitly:

```powershell
powershell -NoProfile -File scripts/prepare-harness-run.ps1 `
  -RepoPath C:\path\to\repo -PrepareIsolation -Parallel `
  -LeaseHolder harness-my-task
```

Preparation runs the same safety checks again before calling treehouse. Treehouse may supply a detached worktree; readiness creates a unique derived branch at the checked source HEAD before returning READY. A successful result sets `isolationPrepared: true`, keeps `branch` as the source branch, and returns the isolated `runPath` plus attached `runBranch`. Use that path and branch for task work and commits.

Canonical monorepo-tracked pipelines, declared by `!pipelines/<name>/` entries in the workspace `.gitignore`, always require isolation because they do not have their own git root. Their prepared path is `<leased-worktree>\pipelines\<name>`.

## Pool config (`treehouse.toml`)

Treehouse resolves the nearest `treehouse.toml` from the current directory. Every harness repo should carry its own pool config:

```toml
max_trees = 16
root = ".tmp/treehouse/"
```

`/setup-harness` seeds this file and adds `.tmp/treehouse/` to `.gitignore`.

## Lease lifecycle

A prepared lease remains held until the operator returns it after review:

```bash
treehouse status
treehouse return '<worktree-path>'
```

Return only the lease used by the completed stream. Before return, verify the reported `runBranch` contains every intended commit; returning the worktree resets its checkout, while the derived branch preserves referenced commits. If the pool is full, inspect `treehouse status`, identify a stale lease, and return it deliberately. Never prune or return an active stream automatically.

## Manual parallel streams

The readiness script is preferred because it checks repository, branch, dirt, layout, and isolation ordering. For manual operation, preserve the same order:

1. Run `-CheckOnly -Parallel`.
2. Resolve every reported error.
3. Run `-PrepareIsolation -Parallel`.
4. Work and commit only inside returned `runPath` on reported `runBranch`.
5. Verify `runBranch` contains the intended commits, then return that lease.

Register each stream in tasks-axi from its project root so ownership and completion remain visible.
