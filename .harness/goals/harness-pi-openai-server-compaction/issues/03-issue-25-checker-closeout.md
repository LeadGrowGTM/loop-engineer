# Phase 3 - Issue #25 Checker closeout

Status: complete
Blocked by: 0
Parent: `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.tmp\treehouse\.treehouse\agent-harness-d0f233\1\agent-harness\.harness\goals\harness-pi-openai-server-compaction\PLAN.md`

## What to build

Correct prior approval-gated goal bookkeeping, preserve original Cycle 1 byte-for-byte, append fresh Checker output, and persist it through one separately approved closeout commit.

## Acceptance criteria

- Prior goal text names C07-C10 and all ten slices.
- Protected original Checker file remains unchanged at expected SHA-256.
- Integration copy begins with byte-identical Cycle 1.
- Fresh original-goal Checker appends, never replaces, next cycle and passes.
- Policy states post-proof Checker output enters history only through separately approved closeout commit.
- C01-C10 and disclosed external lineage remains exact; zero merges/history rewrites.
- Full `bun test`, commit-count proof, snapshot exclusion, and protected-work guard pass.
- Final status explains each remaining modified or untracked path.

## Skill routing

`tdd` for deterministic text assertions, direct proof, fresh `harness-checker`.

## Commit contract

One #25 closeout commit containing approved prior-goal bookkeeping, copied/appended Checker artifact, and matching task proof. Never amend prior commits.

## PRE-CHECKER

- Approved scope: four prior-goal files and matching current-task proof files.
- Protected original `CYCLE_LOG.md` SHA256: `246AE22109DD74BA798556D7B06BC03396B0DF2D905CF221D37176D6168A14D9`.
- RED output: valid; missing `followups`, `phases`, `slices`, `policy`, `approval`, and `cycleLog`.
- Next steps: byte-copy protected original, reach GREEN, run gates, then append fresh Checker output only.
- State: PRE-CHECKER; no PASS or commit claimed.

## READY FOR CHECKER

- Cycle 1 source and target SHA256 match: `246AE22109DD74BA798556D7B06BC03396B0DF2D905CF221D37176D6168A14D9`.
- Artifact contract GREEN: six checks pass.
- Full suite: 124 pass, 0 fail, 484 expect() calls.
- Parser, diff check, exact lineage, zero-merge, snapshot exclusion, and timeout-fix review pass.
- Fresh Checker must append the next cycle and preserve the Cycle 1 prefix.

## PASS

- Cycle 3 verdict: PASS, 5.0/5.0 across all dimensions.
- Cycle 1+2 exact prefix: 19,740 bytes, SHA256 `39F9BB4D38498B58636707F773817D257A58DCAD7CA23C9D301DF4873CF3F64C`.
- Protected original Cycle 1 SHA256: `246AE22109DD74BA798556D7B06BC03396B0DF2D905CF221D37176D6168A14D9`.
- Cycle 3 citation audit: 33 paths, 26 ranges, no failures.
- Protected-work replacement guard: PASS with exact six-file staging, no blockers, no unexpected paths, and snapshot unstaged.
- Closeout commit may now persist the four prior-goal files and matching task proof.
