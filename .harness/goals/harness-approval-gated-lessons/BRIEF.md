# Goal Brief - harness-approval-gated-lessons

## Problem

Loop-engineer currently exposes contract drift and a gnhf-oriented runner path that can obscure approval boundaries, mutate dirty work, and make safe execution depend on machine-specific tooling.

## Success criteria (product-level)

- An operator can prepare an in-session harness run and, when isolation is needed, a treehouse worktree with clear branch, dirty-tree, path, and invalid-layout reporting without installing or executing gnhf.
- Every implementation edit is traceable to one explicitly approved C01-C06 decision, one observable phase, one issue slice, and one commit.
- Existing user changes in `.claude/agent-context/snapshot.md` and `scripts/launch-gnhf.ps1` remain preserved and unstaged except for task-only C04 hunks isolated from the pre-existing launcher delta.
- Planner, Maker, Prover, Checker, and Shipper contracts agree on approval gates, evidence boundaries, conditional verification, and separate shipping consent.
- README, repository guidance, dependency documentation, setup behavior, and write-goal-prompt guidance describe the same supported execution model.

## Out of scope

- Merging, pushing, opening a pull request, or running the Ship stage.
- Launching gnhf, retaining gnhf as a supported dependency, or replacing it with another unattended runner.
- Editing user-level installed agent copies under `C:\Users\mitch\.claude\agents\`; the repository definitions remain the source of truth and installation is not run in this goal.
- Editing `scripts/validate-pipeline-layout.ps1`; C04 must preserve and exercise it as a read-only safeguard.
- Adjacent cleanup, publishing, new external dependencies, treehouse redesign, or changes outside C01-C06.
- Rejected or deferred IDs; none exist in the supplied approval handoff.
