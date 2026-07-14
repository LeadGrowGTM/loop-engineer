# Parallel Execution & Worktree Isolation

Two detached gnhf/goal runs in the same working tree corrupt each other's commits and dirty-tree snapshots. Isolation is provided by **treehouse** - a pool of pre-warmed git worktrees, one per stream.

## Pool config (`treehouse.toml`)

`treehouse` resolves the nearest `treehouse.toml` from cwd. Without one, a run falls through to the monorepo-root pool and worktrees land in the wrong place. Every harness repo carries its own:

```toml
max_trees = 16
root = ".tmp/treehouse/"
```

- Seeded automatically by `/setup-harness` in target projects, and present in the agent-harness repo itself.
- `.tmp/treehouse/` and `.gnhf-runs/` must be gitignored (setup-harness adds both; verify in older installs).

## Auto-lease on collision (the launcher does this)

`scripts/launch-gnhf.ps1` isolates automatically - the operator does not lease by hand:

1. Before launch it scans `<repo>/.gnhf-runs/*.handle.json` and checks each recorded PID with `Get-Process`.
2. It leases an isolated worktree via `treehouse get --lease --lease-holder "gnhf-<slug>"` and launches gnhf there when any of three conditions hold: a **live** gnhf run is anchored to this repo, `-Parallel` is passed, or `-RepoPath` resolves to a canonical monorepo-tracked pipeline (`content`, `outbound` - declared by the workspace `.gitignore`'s `!pipelines/<name>/` exceptions). Those pipelines have no own `.git`, so isolation is forced rather than optional: it's the only way gnhf gets a scoped git toplevel. `RunPath` is set to the leased worktree's `pipelines/<name>/` subdir so gnhf's git operations never touch the live monorepo tree.
3. Handle + log + collision state stay anchored to the **original** repo's `.gnhf-runs/`, so the next launch still sees this run and isolates against it too - except for canonical monorepo pipelines, which have no `.gnhf-runs/` of their own to anchor to; their state lives under `%TEMP%\gnhf-runs\<slug>` instead.

Single stream, no live run, not a monorepo-tracked pipeline → no lease, gnhf runs in the repo root (fast path). Force isolation with `-Parallel` even when no collision is detected.

## Lease lifecycle - return is manual for detached runs

A detached launch returns immediately; the process outlives the launcher, so the launcher **cannot** auto-return the lease on exit. The lease is held until returned by hand:

- The launcher prints `return: treehouse return '<path>'` and records `lease` in the handle JSON.
- Return the worktree **after** morning review (returning early kills the still-running gnhf process inside it):

```bash
treehouse return '<worktree-path>'   # frees the worktree back to the pool
```

- `treehouse status` lists live leases and their holders. A lease is never handed out again or pruned until returned - a forgotten lease permanently shrinks the pool (`max_trees`). If `get --lease` reports the pool exhausted, run `treehouse status`, return a stale lease, relaunch.

## Manual parallel streams (without the launcher)

For a raw `gnhf` invocation, lease first, then run inside the worktree:

```bash
path=$(treehouse get --lease --lease-holder "gnhf-<slug>")   # stdout = path, stderr = banners
cd "$path"
gnhf "<objective>" --max-iterations 30 --stop-when "<done condition>"
# after morning review:
treehouse return "$path"
```

Register each stream in tasks-axi (`tasks-axi add <slug>` from `$PROJECT_ROOT`) so parallel work stays tracked.
