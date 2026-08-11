# Task 6 report — supported setup lifecycle dependencies

## Delivered

- Added the approved `batch-grill-me` source under `skills/setup-harness/vendor/` (SHA-256 verified against the installed approved source).
- Setup now installs that exact skill idempotently to the trusted global skill destination and exposes `doctorLifecycleDependencies(targetDir)`.
- A non-zero or missing `tasks-axi`/Treehouse executable is reported as workspace-onboarding-required; bundled grill drift is separately reported as installable drift.
- New installs use `root = ".worktrees/"` and ignore `.worktrees/`.
- Legacy `.tmp/treehouse/` configuration is repaired only when a read-only `treehouse status` returns an explicit no-active-leases result; all other status results preserve the legacy configuration and make setup fail.

## TDD evidence

- RED: `bun test scripts/setup-harness.test.ts` recorded 6 required lifecycle setup failures before implementation.
- GREEN: the focused suite passed twice: 38 pass, 0 fail on each run.

## Scope and concern

- Changes are confined to the Task 6 files and this report.
- The no-active-lease parser is intentionally strict (`NO_ACTIVE_LEASES`, `no active leases`, or `no leases`) so unfamiliar Treehouse output fails closed instead of risking a stranded lease.

## Review fix round 1 evidence

RED command and output:

```text
> bun test scripts/setup-harness.test.ts
41 tests: 39 pass, 2 fail
(fail) lifecycle dependency setup > reports tasks-axi absent from the hermetic PATH as workspace onboarding required
(fail) lifecycle dependency setup > reports Treehouse absent from the hermetic PATH as workspace onboarding required
```

GREEN command and output:

```text
> bun test scripts/setup-harness.test.ts
41 pass
0 fail
77 expect() calls
```

The review change creates each global grill parent (`.claude`, `.claude/skills`, and `batch-grill-me`) through a trusted pre- and post-create check. The coverage includes a hostile `.claude/skills` junction, genuinely absent `tasks-axi` and Treehouse commands under a hermetic `PATH`, and a legacy Treehouse pool sentinel that remains untouched during safe configuration repair.
