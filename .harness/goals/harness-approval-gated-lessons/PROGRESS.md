# Maker Progress

## Phase 1: C01 Approval-aware role contracts - COMPLETE
Slice: C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-approval-gated-lessons\issues\01-approval-aware-role-contracts.md - Status: done
Skill invoked: codebase-design then tdd
Artifact: C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.claude\agents\harness-*.md
Mechanical gate: `bun test scripts/harness-agent-contracts.test.ts` - exit 0
PROOF:
  bun test v1.3.9 (cf6cdbbb)

   6 pass
   0 fail
   25 expect() calls
  Ran 6 tests across 1 file. [38.00ms]
Commit: SELF - C01 approval-aware role contracts (resolved SHA recorded in C06 proof)

## Phase 2: C02 Deterministic skill-routing fallback - COMPLETE
Slice: C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-approval-gated-lessons\issues\02-skill-routing-fallback.md - Status: done
Skill invoked: tdd
Artifact: C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.claude\agents\harness-planner.md
Mechanical gate: `bun test scripts/harness-agent-contracts.test.ts` - exit 0
PROOF:
  bun test v1.3.9 (cf6cdbbb)

   7 pass
   0 fail
   31 expect() calls
  Ran 7 tests across 1 file. [42.00ms]
Commit: SELF - C02 deterministic skill-routing fallback (resolved SHA recorded in C06 proof)

## Phase 3: C03 Protected dirty-work policy - COMPLETE
Slice: C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-approval-gated-lessons\issues\03-protected-dirty-work-policy.md - Status: done
Skill invoked: tdd
Artifact: C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.claude\agents\harness-maker.md
Mechanical gate: `bun test scripts/harness-agent-contracts.test.ts` + `git diff --cached --name-only -- .claude/agent-context/snapshot.md` -> exit 0
PROOF:
  RED RUN (before maker doc update):
  bun test scripts/harness-agent-contracts.test.ts
  Exit code 1
  12 pass
  5 fail
  37 expect() calls
  Ran 12 tests across 1 file. [78.00ms]

  GREEN RUN:
  bun test scripts/harness-agent-contracts.test.ts
  Exit code 0
  12 pass
  0 fail
  53 expect() calls
  Ran 12 tests across 1 file. [44.00ms]

  Staged-path verification:
  git diff --cached --name-only -- .claude/agent-context/snapshot.md
  (empty output)
Commit: <short SHA> — C03 protected dirty-work policy

## Phase 4: C04 Non-launching harness readiness - COMPLETE
Slice: C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-approval-gated-lessons\issues\04-non-launching-harness-readiness.md - Status: done
Skill invoked: tdd, then direct Maker fallback after harness-maker launch was denied before execution
Artifact: C:\Users\mitch\Everything_CC\tools\agent\agent-harness\scripts\prepare-harness-run.ps1
Mechanical gates: `bun test scripts/prepare-harness-run.test.ts scripts/setup-harness.test.ts`; PowerShell parser for three scripts; two forbidden-pattern git grep gates
PROOF:
  RED tracer runs:
  - Clean feature branch contract: exit 1; expected one JSON line, received 4 because readiness script did not exist.
  - Dirty-path contract: exit 1; expected `dirty file.txt`, received quoted path.
  - Parallel CheckOnly contract: exit 1; expected `isolationRequired: true`, received false.
  - Explicit preparation contract: exit 1; expected prepared lease path, received original repo path.
  - Compatibility entry contract: exit 1; legacy launcher returned nonzero instead of readiness JSON.
  - CheckOnly mutation guard: exit 1; combined check/preparation flags incorrectly returned zero.

  FINAL GREEN RUN:
  bun test scripts/prepare-harness-run.test.ts scripts/setup-harness.test.ts
  Exit code 0
  25 pass
  0 fail
  70 expect() calls
  Ran 25 tests across 2 files. [17.73s]

  PowerShell parser gate:
  PowerShell parse: 3 passed, 0 failed
  Validator hash before and after: 535e25503e8066974681a0c70a1743e3ec5c2e30

  Forbidden runner reference gate: 0 matches
  Forbidden launcher behavior gate: 0 matches
  Focused pre-commit review: no findings

  Protected launcher evidence captured before edit:
  Copy: C:\Users\mitch\AppData\Local\Temp\loop-engineer-c04-f8b586d2b3174745bd1c00c7f1d740fe-launch-gnhf.pre.ps1
  Copy SHA256: 58E5CC55A1124E48D47976E33E79636F178E97EB5A8F918BC3527304F9687318
  Diff: C:\Users\mitch\AppData\Local\Temp\loop-engineer-c04-f8b586d2b3174745bd1c00c7f1d740fe-launch-gnhf.pre.diff
  Diff SHA256: 09F8DBB3116DE1AB9111F12C43F43D59A430A6FF268D6DF5FE113A87A1787996
  Final copy: C:\Users\mitch\AppData\Local\Temp\loop-engineer-c04-f8b586d2b3174745bd1c00c7f1d740fe-launch-gnhf.post.ps1
  Final copy SHA256: FB89322847971510066F1AB7046D7CB67883AFA8BF25976859F7DF27D2DFE6DC
  Task patch: C:\Users\mitch\AppData\Local\Temp\loop-engineer-c04-f8b586d2b3174745bd1c00c7f1d740fe-launch-gnhf.task.diff
  Task patch SHA256: 3C66D8B6D90BCE26D1FB2FD936758CB817384C085CB7A6501B750F934B4C6BF7

  Runtime note: `pwsh` was not on PATH. Tests selected available Windows PowerShell, and syntax validation used the PowerShell language parser directly.
Commit: `1797f19` - C04 non-launching harness readiness

## Restart checkpoint - C04 red-team hardening in progress

Branch: `feat/batch-grill-deps`
Current HEAD: `f31160b` - C04 non-launching harness readiness

Completed ID commits:
- C01: `02c4bd7`
- C02: `07ca251`
- C03: `db34fc1`
- C04 initial commit: `f31160b`

Verified before hardening:
- C04 mechanical gate: 25 pass, 0 fail, 70 expect() calls.
- C04 Prover: Feature works. Clean fixture returned one READY JSON; dirty fixture returned one NOT_READY JSON with `dirty file.txt`; commit/stash/reflog unchanged; fake executable marker absent.
- Built-in red-team workflow failed before launch with `SyntaxError: Unexpected keyword 'export'`. Tier 1 fallback used four independent attack agents plus fresh merge verifier.

Merged blocking C04 findings:
1. Git inspection must scrub `GIT_*`, disable fsmonitor/optional locks, inspect submodules, and remain non-mutating.
2. Treehouse must run from inspected repo, prove lease Git identity/HEAD/cleanliness, return lease metadata, and clean up failed acquisitions.
3. Workspace root must be physically related to target; caller override cannot bypass root/layout checks.
4. Reparse/junction targets must not bypass canonical pipeline classification.
5. Unknown/default/unborn branch states must fail closed.
6. Exactly one mode is required; check-only with required isolation must return NOT_READY until a validated lease exists.
7. Check-only must verify treehouse pool status, not command presence only.
8. Child process stdout/stderr need concurrent draining, timeout, and bounded output behavior.
9. Caller must precheck pipeline layout using literal paths and fail closed because validator source remains read-only.

Nonblocking deferred findings needing separate approval:
- Existing setup installer symlink/junction write hardening and shell-string SHA lookup.
- Existing setup scan of worktrees and install smoke exit behavior.

Explicit user decision:
- User authorized fixing blocking C04 findings and amending unpushed commit `f31160b` so C04 remains one commit.
- No reset, checkout, force, push, merge, PR, or shipping is authorized.

Current uncommitted state:
- `.claude/agent-context/snapshot.md` modified by hook; never stage or commit.
- `scripts/prepare-harness-run.test.ts` contains partial RED hardening work only: fake treehouse now creates a real detached Git worktree and isolation tests expect fail-closed check-only plus lease identity fields. Implementation has not been updated yet, so tests are expected to fail.
- This `PROGRESS.md` is modified only by this restart checkpoint and remains unstaged.
- No other working-tree files are modified.

Resume sequence:
1. Read this checkpoint, `PLAN.md`, `APPROVALS.md`, C04 issue, current test diff, and committed readiness scripts.
2. Continue TDD for merged blocking set only.
3. Run C04 tests, parser, forbidden-pattern gates, Prover, and fresh red-team verification.
4. If all pass, stage only C04 paths plus goal bookkeeping and amend `f31160b` as explicitly authorized.
5. Then execute C05, amended C06 proof contract, fresh Checker, and no shipping.

## C04 red-team hardening - COMPLETE

This section supersedes the stale implementation-state notes in the restart checkpoint above.

Slice: `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-approval-gated-lessons\issues\04-non-launching-harness-readiness.md` - Status: done
Skill invoked: `tdd`, followed by independent runtime proof and four read-only attack lenses
Artifacts:
- `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\scripts\prepare-harness-run.ps1`
- `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\scripts\prepare-harness-run.test.ts`
- `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\scripts\launch-gnhf.ps1`

Hardening outcomes:
- Git inspection scrubs inherited `GIT_*`, disables optional locks and fsmonitor, inspects submodules, and remains non-mutating.
- Workspace containment rejects the root itself and all child reparse points.
- Unknown default branches, unborn HEAD, detached HEAD, unsafe modes, dirty trees, invalid layouts, and hidden index state fail closed.
- Child stdout/stderr use concurrent fixed-size bounded drains with timeout and output-limit termination.
- Check-only verifies treehouse status and refuses READY when required isolation is unprepared.
- Prepared leases must match Git common directory and HEAD, be clean, and return on validation failure. Malformed successful output returns the one safely identifiable same-repository lease before failing.
- Compatibility launcher forwards `DefaultBranch`, accepts legacy values without execution, and never resolves or runs gnhf.

PROOF:
  Hardening RED run before implementation stabilization:
  `bun test scripts/prepare-harness-run.test.ts`
  Exit code 1
  7 pass
  10 fail
  42 expect() calls

  Lease-cleanup RED tracer:
  `bun test scripts/prepare-harness-run.test.ts -t "malformed successful lease"`
  Exit code 1
  0 pass
  1 fail
  3 expect() calls
  Failure: expected `Lease was returned`; received malformed-output failure without cleanup.

  Lease-cleanup GREEN tracer:
  `bun test scripts/prepare-harness-run.test.ts -t "malformed successful lease"`
  Exit code 0
  1 pass
  0 fail
  4 expect() calls

  Final C04 mechanical gate:
  `bun test scripts/prepare-harness-run.test.ts scripts/setup-harness.test.ts`
  Exit code 0
  36 pass
  0 fail
  109 expect() calls
  Ran 36 tests across 2 files. [51.37s]

  Final repository suite:
  `bun test`
  Exit code 0
  62 pass
  0 fail
  179 expect() calls
  Ran 62 tests across 5 files. [50.89s]

  PowerShell parser gate:
  PowerShell parse: 3 passed, 0 failed

  Forbidden runner reference gate: 0 matches
  Forbidden launcher behavior gate: 0 matches
  `git diff --check`: clean
  Validator blob: `535e25503e8066974681a0c70a1743e3ec5c2e30` - unchanged

  Runtime Prover: `PROOF: WORKS`
  - Clean fixture: exit 0, one READY JSON line, exact branch/repo/runPath/isolation fields.
  - Dirty fixture: exit 1, one NOT_READY JSON line with `dirty file.txt`.
  - Commit count, stash list, and reflog unchanged; fake gnhf marker/config/process absent.

  Final red-team status:
  - Path and containment lens: NONE.
  - Process bounds and timeout lens: NONE.
  - Git/treehouse lease lens: initial malformed-output lease leak fixed; re-review NONE.
  - Wrapper lens: sole `DefaultBranch` passthrough blocker fixed and covered; no unresolved critical/high finding.

  Protected launcher final evidence:
  - Final copy: `C:\Users\mitch\AppData\Local\Temp\loop-engineer-c04-final-a8194d3e60fb465b8a705d990cdad6d1-launch-gnhf.post.ps1`
  - Final copy SHA256: `C008AFEE3C8E90812594B002E2915998D847DBBBBE5A2ED41F7EEF88E4F60856`
  - Final task patch: `C:\Users\mitch\AppData\Local\Temp\loop-engineer-c04-final-a8194d3e60fb465b8a705d990cdad6d1-launch-gnhf.task.diff`
  - Final task patch SHA256: `4D0D711FFAB364B5721EBE1D285A87BB3603007823028C2C490E0DE782380B4E`

Commit: `1797f19` - C04 non-launching harness readiness

## Phase 5: C05 Coherent operator documentation - COMPLETE

Slice: `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-approval-gated-lessons\issues\05-coherent-operator-documentation.md` - Status: done
Skill invoked: direct implementation through three one-file editors, followed by fresh read-only review
Artifacts:
- `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\README.md`
- `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\CLAUDE.md`
- `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\docs\DEPENDENCIES.md`
Mechanical gate: `git grep -n -E 'gnhf|\.gnhf-runs' -- README.md CLAUDE.md docs/DEPENDENCIES.md` - expected no matches
PROOF:
  C05 forbidden reference gate: 0 matches
  `git diff --check -- README.md CLAUDE.md docs/DEPENDENCIES.md`: clean
  Diff scope: 3 files changed, 67 insertions, 29 deletions
  Fresh coherence review: NONE
  - All three documents describe non-launching readiness before attached in-session execution.
  - Treehouse is optional generally and fail-fast required when isolation is needed.
  - Shipping requires separate explicit post-PASS approval.
  - Dependency tiers remain consistent.
Commit: `05cff83` - C05 coherent operator documentation

## Phase 7: C07 Canonical pipeline target routing - COMPLETE

Slice: `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-approval-gated-lessons\issues\07-canonical-pipeline-target-routing.md` - Status: done
Skill invoked: `tdd`
Artifacts:
- `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\skills\write-goal-prompt\SKILL.md`
- `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\scripts\harness-agent-contracts.test.ts`
Mechanical gate: `bun test scripts/harness-agent-contracts.test.ts`
PROOF:
  RED: exit 1; new contract failed at missing `INVOCATION_ROOT=$(pwd -P)` while the skill still assigned `PROJECT_ROOT=$(git rev-parse --show-toplevel ...)`.
  GREEN: exit 0
  13 pass
  0 fail
  60 expect() calls
  Ran 13 tests across 1 file. [50.00ms]
  Contract now separates `PROJECT_ROOT` target from `WORKSPACE_ROOT` trust boundary and passes both to CheckOnly and PrepareIsolation.
Commit: SELF - C07 canonical pipeline target routing (resolved SHA recorded in final proof)