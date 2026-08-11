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
