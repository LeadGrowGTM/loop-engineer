# C06 Untouched-Work and Commit Proof

## Verdict scope

This document records deterministic evidence for approved IDs C01-C10 on branch `feat/batch-grill-deps`, fixed point `6bf9a02181489e31c458eb1470480053dca4d225`, and current pre-C06 HEAD `f72d8512e52afebeb462834ceaf1f0e5dcb340da`.

Approved proof amendment applied:

- Preserve and disclose non-ID external commits.
- Prove exactly one commit for each approved ID C01-C10 and no merge commit.
- Prove `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.claude\agent-context\snapshot.md` remains unstaged and absent from every ID commit.
- Disclose that no durable pre-C01 snapshot diff hash exists. Do not claim unavailable byte equality.
- Prove recoverable launcher lineage from saved pre-edit content, task patch, final copy, and repository file.

Shipping outcome: `N/A - shipping not approved`.

No merge, push, PR, Shipper, `/no-mistakes`, detached runner, or gnhf execution occurred.

## Baseline and protected work

Baseline recorded before C01:

- Branch: `feat/batch-grill-deps`
- HEAD: `6bf9a02181489e31c458eb1470480053dca4d225`
- Staged paths: none
- Existing unstaged protected paths:
  - `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.claude\agent-context\snapshot.md`
  - `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\scripts\launch-gnhf.ps1`

The launcher overlap decisions and later C04 amendment authorization are recorded in `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-approval-gated-lessons\APPROVALS.md`.

## Working tree and index capture

Command:

```powershell
git status --short
git diff --cached --quiet
git diff --cached --name-only -- .claude/agent-context/snapshot.md
```

Final read-only capture before staging C06:

```text
 M .claude/agent-context/snapshot.md
 M .harness/goals/harness-approval-gated-lessons/APPROVALS.md
 M .harness/goals/harness-approval-gated-lessons/BRIEF.md
 M .harness/goals/harness-approval-gated-lessons/PLAN.md
 M .harness/goals/harness-approval-gated-lessons/PROGRESS.md
 M .harness/goals/harness-approval-gated-lessons/issues/06-untouched-work-proof.md
?? .harness/goals/harness-approval-gated-lessons/UNTOUCHED_WORK_PROOF.md
```

Results:

- `git diff --cached --quiet`: exit 0
- Staged paths: none
- Staged snapshot path count: 0
- The goal-local modifications above are C06 bookkeeping. The snapshot is protected user/hook work and remains unstaged.

After this document is created, its untracked path and later `PROGRESS.md` bookkeeping are expected C06 working-tree entries. Path-specific staging must exclude the snapshot.

## Snapshot proof and limitation

Current snapshot binary-diff hashes:

```text
git hash-object --stdin: f8218e4dcd3d64ad6f5cae98c4c7b841b4c10212
SHA256:                  a8b74d111f08ee52def404ff3d2432129d462d21d182c99f1b152f1dde280840
Evidence file:             C:\Users\mitch\AppData\Local\Temp\snapshot-final-574b85e38a9e4fbda65e661720111803.diff
```

Commands:

```powershell
git diff --binary -- .claude/agent-context/snapshot.md | git hash-object --stdin
git rev-list --count 6bf9a02..HEAD -- .claude/agent-context/snapshot.md
git log 6bf9a02..HEAD -- .claude/agent-context/snapshot.md
git diff --cached --name-only -- .claude/agent-context/snapshot.md
```

Results:

- Post-baseline snapshot commit count: 0
- Snapshot log output after baseline: empty
- Snapshot staged path output: empty
- C01 `02c4bd797ab21ad98cc1520445b238573b1142c5`: snapshot absent
- C02 `07ca251f81c0a93b7484f81059ec8f573a78187d`: snapshot absent
- C03 `db34fc17652af56c55b5503130780456b51bda14`: snapshot absent
- C04 `1797f19114bd982e2fbe8738d40dadda4749f0c3`: snapshot absent
- C05 `05cff83e99b2cc69f169f5095e8942522d925300`: snapshot absent
- C07 `22e11d6d31d1387f4c443d554159ebe84ac7fd63`: snapshot absent
- C08 `04ae21abded5a00cf7e8a350a6df6e917047323f`: snapshot absent
- C09 `43eabfad11d1f43d8edbc2c6412a4d694c4dc018`: snapshot absent
- C10 `f72d8512e52afebeb462834ceaf1f0e5dcb340da`: snapshot absent

Limitation: no durable pre-C01 snapshot diff hash was captured. Searches of tracked goal artifacts, history, and git notes found no baseline 40- or 64-character hash. Therefore this proof does not claim that the current snapshot bytes equal pre-C01 bytes. It proves the approved replacement invariant: snapshot remains unstaged and uncommitted throughout C01-C10.

## Commit lineage

Command:

```powershell
git log --reverse --format='%H%x09%P%x09%s' 6bf9a02..HEAD
git rev-list --min-parents=2 6bf9a02..HEAD
```

Exact ordered history before C06 commit:

| Class | SHA | Parent | Subject |
|---|---|---|---|
| C01 | `02c4bd797ab21ad98cc1520445b238573b1142c5` | `6bf9a02181489e31c458eb1470480053dca4d225` | C01 approval-aware role contracts |
| C02 | `07ca251f81c0a93b7484f81059ec8f573a78187d` | `02c4bd797ab21ad98cc1520445b238573b1142c5` | C02 deterministic skill-routing fallback |
| External non-ID | `b6f8d6560cbd231eaf14f02376236b2f4b52c31b` | `07ca251f81c0a93b7484f81059ec8f573a78187d` | fix(agents): claudex-compat model IDs + document proxy mapping |
| External non-ID | `7a54afccc582a7040b98de6e45b798ab34cc2b2c` | `b6f8d6560cbd231eaf14f02376236b2f4b52c31b` | docs: update claudex model map (sonnet->terra, max effort) |
| C03 | `db34fc17652af56c55b5503130780456b51bda14` | `7a54afccc582a7040b98de6e45b798ab34cc2b2c` | C03 protected dirty-work policy |
| C04 | `1797f19114bd982e2fbe8738d40dadda4749f0c3` | `db34fc17652af56c55b5503130780456b51bda14` | C04 non-launching harness readiness |
| C05 | `05cff83e99b2cc69f169f5095e8942522d925300` | `1797f19114bd982e2fbe8738d40dadda4749f0c3` | C05 coherent operator documentation |
| C07 | `22e11d6d31d1387f4c443d554159ebe84ac7fd63` | `05cff83e99b2cc69f169f5095e8942522d925300` | C07 canonical pipeline target routing |
| C08 | `04ae21abded5a00cf7e8a350a6df6e917047323f` | `22e11d6d31d1387f4c443d554159ebe84ac7fd63` | C08 shipping consent propagation |
| C09 | `43eabfad11d1f43d8edbc2c6412a4d694c4dc018` | `04ae21abded5a00cf7e8a350a6df6e917047323f` | C09 isolated run branch |
| C10 | `f72d8512e52afebeb462834ceaf1f0e5dcb340da` | `43eabfad11d1f43d8edbc2c6412a4d694c4dc018` | C10 cross-platform target routing |

Count before C06:

```text
C01 1
C02 1
C03 1
C04 1
C05 1
C07 1
C08 1
C09 1
C10 1
MERGES 0
TOTAL 11
```

Every listed commit has one parent. History is linear. The two non-ID commits are preserved and disclosed, not rewritten and not misclassified as approval violations.

C06 self-reference note: a commit cannot embed its own SHA without changing that SHA. This document therefore records C06 as the planned final approved-ID commit with subject `C06 untouched-work and commit proof`. The post-commit Checker must verify exactly one commit for each approved ID C01-C10 and zero merge commits from live Git history.

## Per-ID boundary proof

Per-commit audit against current `APPROVALS.md` and `PLAN.md`:

```text
C01 unexpected=0 missing=0
C02 unexpected=0 missing=0
C03 unexpected=0 missing=0
C04 unexpected=0 missing=0
C05 unexpected=0 missing=0
C07 unexpected=0 missing=0
C08 unexpected=0 missing=0
C09 unexpected=0 missing=0
C10 unexpected=0 missing=0
```

Files by ID:

- C01: five canonical harness role definitions, `scripts/harness-agent-contracts.test.ts`, and initial goal-local planning/bookkeeping.
- C02: `.claude/agents/harness-planner.md`, `scripts/harness-agent-contracts.test.ts`, and matching goal-local bookkeeping.
- C03: `.claude/agents/harness-maker.md`, `scripts/harness-agent-contracts.test.ts`, and matching goal-local bookkeeping.
- C04: `scripts/launch-gnhf.ps1`, `scripts/prepare-harness-run.ps1`, `scripts/prepare-harness-run.test.ts`, setup script/test, three approved skill documents, and matching goal-local amendment/bookkeeping.
- C05: `README.md`, `CLAUDE.md`, `docs/DEPENDENCIES.md`, and matching goal-local bookkeeping.
- C07: `skills/write-goal-prompt/SKILL.md`, `scripts/harness-agent-contracts.test.ts`, and approved follow-up planning/bookkeeping.
- C08: `skills/write-goal-prompt/SKILL.md`, `scripts/harness-agent-contracts.test.ts`, and matching goal-local bookkeeping.
- C09: `scripts/prepare-harness-run.ps1`, `scripts/prepare-harness-run.test.ts`, `README.md`, `CLAUDE.md`, `skills/write-goal-prompt/references/parallel-execution.md`, and matching goal-local bookkeeping.
- C10: `skills/write-goal-prompt/SKILL.md`, `scripts/harness-agent-contracts.test.ts`, and matching goal-local bookkeeping.
- C06 planned boundary: this proof file plus C06 goal-local bookkeeping only. No source file may change.

Non-ID external commit paths:

- `b6f8d6560cbd231eaf14f02376236b2f4b52c31b`: `.claude/agents/harness-maker.md`, `docs/DEPENDENCIES.md`
- `7a54afccc582a7040b98de6e45b798ab34cc2b2c`: `docs/DEPENDENCIES.md`

Both external paths already occur in approved ID work, so they add no external-only path to the aggregate. Per-commit attribution preserves the distinction.

Aggregate committed path set for `6bf9a02..HEAD` before C06 contains 32 paths:

```text
.claude/agents/harness-checker.md
.claude/agents/harness-maker.md
.claude/agents/harness-planner.md
.claude/agents/harness-prover.md
.claude/agents/harness-shipper.md
.harness/goals/harness-approval-gated-lessons/APPROVALS.md
.harness/goals/harness-approval-gated-lessons/BRIEF.md
.harness/goals/harness-approval-gated-lessons/HARNESS.md
.harness/goals/harness-approval-gated-lessons/PLAN.md
.harness/goals/harness-approval-gated-lessons/PROGRESS.md
.harness/goals/harness-approval-gated-lessons/issues/01-approval-aware-role-contracts.md
.harness/goals/harness-approval-gated-lessons/issues/02-skill-routing-fallback.md
.harness/goals/harness-approval-gated-lessons/issues/03-protected-dirty-work-policy.md
.harness/goals/harness-approval-gated-lessons/issues/04-non-launching-harness-readiness.md
.harness/goals/harness-approval-gated-lessons/issues/05-coherent-operator-documentation.md
.harness/goals/harness-approval-gated-lessons/issues/06-untouched-work-proof.md
.harness/goals/harness-approval-gated-lessons/issues/07-canonical-pipeline-target-routing.md
.harness/goals/harness-approval-gated-lessons/issues/08-shipping-consent-propagation.md
.harness/goals/harness-approval-gated-lessons/issues/09-isolated-run-branch.md
.harness/goals/harness-approval-gated-lessons/issues/10-cross-platform-target-routing.md
CLAUDE.md
README.md
docs/DEPENDENCIES.md
scripts/harness-agent-contracts.test.ts
scripts/launch-gnhf.ps1
scripts/prepare-harness-run.ps1
scripts/prepare-harness-run.test.ts
scripts/setup-harness.test.ts
scripts/setup-harness.ts
skills/setup-harness/SKILL.md
skills/write-goal-prompt/SKILL.md
skills/write-goal-prompt/references/parallel-execution.md
```

No unapproved ID path was found.

## Protected launcher lineage

Saved evidence:

| Artifact | SHA256 |
|---|---|
| `C:\Users\mitch\AppData\Local\Temp\loop-engineer-c04-f8b586d2b3174745bd1c00c7f1d740fe-launch-gnhf.pre.ps1` | `58E5CC55A1124E48D47976E33E79636F178E97EB5A8F918BC3527304F9687318` |
| `C:\Users\mitch\AppData\Local\Temp\loop-engineer-c04-f8b586d2b3174745bd1c00c7f1d740fe-launch-gnhf.pre.diff` | `09F8DBB3116DE1AB9111F12C43F43D59A430A6FF268D6DF5FE113A87A1787996` |
| `C:\Users\mitch\AppData\Local\Temp\loop-engineer-c04-final-a8194d3e60fb465b8a705d990cdad6d1-launch-gnhf.post.ps1` | `C008AFEE3C8E90812594B002E2915998D847DBBBBE5A2ED41F7EEF88E4F60856` |
| `C:\Users\mitch\AppData\Local\Temp\loop-engineer-c04-final-a8194d3e60fb465b8a705d990cdad6d1-launch-gnhf.task.diff` | `4D0D711FFAB364B5721EBE1D285A87BB3603007823028C2C490E0DE782380B4E` |
| `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\scripts\launch-gnhf.ps1` | `C008AFEE3C8E90812594B002E2915998D847DBBBBE5A2ED41F7EEF88E4F60856` |

Current repository launcher byte-equals the saved final copy.

Recoverability procedure:

1. Create unique temp fixture `C:\Users\mitch\AppData\Local\Temp\loop-engineer-c06-replay-lf-00483a7f811e45d38a7a9ffa63cd419d`.
2. Copy saved pre-edit launcher into the fixture.
3. Normalize CRLF transport bytes to LF because the saved patch and final repository file use LF.
4. Normalize only the patch's absolute `diff --git`, `---`, and `+++` headers to `a/launch-gnhf.ps1` and `b/launch-gnhf.ps1`.
5. Run `git -c core.autocrlf=false apply --check` and `git -c core.autocrlf=false apply`.
6. Compare recovered, saved-final, and repository launcher SHA256 values.

Exact result:

```text
apply_check=PASS
pre_transport_eol=LF
recovered_sha256=C008AFEE3C8E90812594B002E2915998D847DBBBBE5A2ED41F7EEF88E4F60856
saved_final_sha256=C008AFEE3C8E90812594B002E2915998D847DBBBBE5A2ED41F7EEF88E4F60856
repo_launcher_sha256=C008AFEE3C8E90812594B002E2915998D847DBBBBE5A2ED41F7EEF88E4F60856
all_equal=True
```

A raw replay without LF normalization produced text-equivalent CRLF output and failed the byte comparison. That attempt is retained at `C:\Users\mitch\AppData\Local\Temp\loop-engineer-c06-replay-e53de48e2e1c4a0da5f37a37123d530d` as transparent diagnostic evidence. The approved normalized replay proves recovery without depending on absolute patch headers or host line-ending conversion.

## Tests

Required command:

```powershell
bun test
```

A background attempt while multiple audit agents were active hit Bun's 5-second process-integration timeout in three cases:

```text
59 pass
3 fail
176 expect() calls
```

The failures were process startup/time-budget expirations with killed dangling fixture processes, not failed behavior assertions. No result was hidden or treated as completion.

Final foreground run after C07-C09 completed:

```text
66 pass
0 fail
212 expect() calls
Ran 66 tests across 5 files. [34.53s]
```

Final test gate: PASS.

## Code review

Fixed-point review command: `git diff 6bf9a02...HEAD`.

Spec sources:

- `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-approval-gated-lessons\PLAN.md`
- `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-approval-gated-lessons\APPROVALS.md`

Standards sources:

- `C:\Users\mitch\Everything_CC\CLAUDE.md`
- `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\CLAUDE.md`

Initial Spec review found three HIGH defects. The user approved C07-C09; final review then found the Windows/standalone routing gap and the user approved C10. Each fix received its own slice, mechanical gate, and commit without history rewrite.

### Standards

Final verdict: PASS WITH MEDIUM.

- Critical/high: none. C10 closes the prior routing HIGH. Actual Step 0 execution returned canonical `PROJECT_ROOT` as the pipeline path and `WORKSPACE_ROOT` as the workspace Git root; executable contract gate: 15 pass, 0 fail, 71 expectations.
- Medium: public help says readiness never mutates Git state, while explicit `PrepareIsolation` creates the approved derived branch. Explicit mode wording limits impact, but help text remains inaccurate and was outside approved C10 scope.
- No runtime severity: two em dashes in `docs/DEPENDENCIES.md` belong to preserved external commit `b6f8d65`; the goal-local PROGRESS em dash is fixed in this C06 working tree.
- Judgment smell only: readiness duplicates the pipeline allowlist before calling the read-only validator; no concrete runtime defect was established.

### Spec

Final verdict: NONE. No critical/high finding remains.

- C10 executes the actual Step 0 shell fence in canonical and standalone fixtures and closes the C07 path-form/identical-root defect.
- C08 requires separate explicit shipping approval and terminates with `N/A - shipping not approved` otherwise.
- C09 creates and validates an attached derived `runBranch` at source HEAD and returns the lease on failure. Prover verdict: WORKS.
- C07-C10 source paths and subjects match approved slices; preserved external commits remain disclosed.

Review summary: Standards has one remaining medium finding; Spec has zero findings. Worst Standards issue is inaccurate no-mutation help text for explicit preparation. No critical/high issue remains on either axis.

## Post-commit checks

After the single C06 commit, run:

```powershell
git log --reverse --format='%H%x09%P%x09%s' 6bf9a02..HEAD
git rev-list --min-parents=2 6bf9a02..HEAD
git status --short
git diff --cached --quiet
git diff --cached --name-only -- .claude/agent-context/snapshot.md
```

Required post-commit result:

- Exactly one commit for each approved ID C01-C10.
- Two preserved and disclosed non-ID commits.
- Zero merge commits.
- Index clean.
- Working tree contains only the unstaged snapshot modification before Checker output.
- Snapshot absent from C06 and every earlier ID commit.
