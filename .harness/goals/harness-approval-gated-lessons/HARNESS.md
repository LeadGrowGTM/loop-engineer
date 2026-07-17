# HARNESS.md - Approval-gated loop-engineer improvements

## PRE_PLANNER_APPROVAL

Run this stage before Planner or Maker. It is read-only for repository source.

1. Capture baseline branch, HEAD, `git status --short`, and current diff for `scripts/launch-gnhf.ps1`. Never stage or commit pre-existing changes. Treat `.claude/agent-context/snapshot.md` as volatile hook output: never stage or commit it.
2. Audit current repository against lessons in `https://gist.github.com/charlesdr13/f1d96d870c47b36b26de8d08c62ab883`. Check portability, packaging, namespacing, update behavior, versioning, gate design, metric provenance, test coverage, and generated-run hygiene. Existing behavior may be better than fork behavior.
3. Write only task-local bookkeeping before approval: `CHANGE_PROPOSALS.md`, `APPROVALS.md`, `HANDOFF.md`, and updates inside this goal directory.
4. Give every independently executable source change a stable ID: `C01`, `C02`, and so on. Each proposal must include recommendation, exact files, evidence, expected value, bounded scope, dependencies, risk, and verification command. Do not combine unrelated edits.
5. Ask for one explicit decision per ID using `AskUserQuestion`. Use at most four changes per round. Choices: Approve, Reject, Defer. Put recommended choice first and explain why. Silence is not approval. Omitted or deferred IDs stay pending.
6. Do not spawn Planner or Maker until every current proposal is approved, rejected, or deferred. Rejected/deferred IDs never become phases or slices.
7. Any scope discovered later gets a new ID and another approval before edits. Approval for one ID never authorizes adjacent cleanup, renamed files, new dependencies, update hooks, publishing, or broader refactors.

## PLANNER_BRIEF

Read first:
- `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\CLAUDE.md`
- `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\README.md`
- `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\docs\DEPENDENCIES.md`
- `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\skills\write-goal-prompt\references\issue-tracker.md`
- `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\skills\write-goal-prompt\references\first-principles-generation.md`
- `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\skills\write-goal-prompt\references\skill-routing.md`
- `CHANGE_PROPOSALS.md` and `APPROVALS.md`

Plan only approved IDs. Map each approved ID to exactly one observable phase and one `issues/NN-<slug>.md` slice. Record rejected and deferred IDs under Out of scope. Preserve pre-existing working-tree changes. Budget 5 turns for planning, remaining turns across approved IDs, 5 for Checker, and 5 for reporting.

## MAKER_ROUTING

One approved ID equals one phase, one slice, one mechanical gate, and one commit. Choose routing by change type:
- Architecture or plugin boundary: `codebase-design`, then `tdd` where runtime behavior changes.
- Script, CLI, installer, or deterministic behavior: `tdd`.
- Documentation-only contract: direct.
- Verification and final review: `engineering-discipline` if available, otherwise direct tests plus `code-review`.

Maker may touch only files named in that ID's approved scope. Before each phase, compare intended files with approval record. If scope differs, stop that phase and create a new proposal ID. Never stage `scripts/launch-gnhf.ps1` or `.claude/agent-context/snapshot.md` unless an explicit approved ID names that file. Never use blocked status for rejected work.

## PROVER_BRIEF

Default: N/A for documentation or static packaging artifacts.

If an approved ID changes CLI, installer, hook, plugin discovery, or runtime behavior:
- Feature intent: approved behavior works from user entry point without machine-specific assumptions.
- Exercise: use exact smoke command from that ID, plus relevant Bun tests and PowerShell syntax validation where applicable.
- Auth: no auth required.
- Accept: command exits 0 and observed output matches approved contract. Return binary PROOF verdict.

## REDTEAM_BRIEF

Default: N/A for static internal documentation.

Run only when an approved ID changes install/update hooks, command execution, path resolution, plugin loading, credentials, or other trust boundaries.
- Target: only approved security-sensitive behavior.
- Paths: files named in approved ID.
- Entry point: exact install, startup, or CLI command affected.
- Out of scope: rejected, deferred, and unrelated existing behavior.

Maker fixes critical/high findings only when fix remains inside approved scope. Otherwise create new proposal ID and request approval.

## CHECKER_BRIEF

Evaluate `PLAN.md`, approved issue slices, `PROGRESS.md`, `APPROVALS.md`, `CHANGE_PROPOSALS.md`, changed files, tests, and proof output.

Dimensions, scored 1-5:
1. Approval integrity: 5 means every edit traces to one explicit approved ID; 1 means any unapproved edit.
2. Scope discipline: 5 means exact approved files and behavior only; 1 means bundled cleanup or broadened scope.
3. Technical quality: 5 means simple, robust, repository-native implementation with passing tests; 1 means fragile or speculative work.
4. Evidence: 5 means each ID has exact command output, diff, and commit; 1 means assertions without proof.
5. Decision fidelity: 5 means rejected/deferred work stayed untouched and protected dirty work was preserved; 1 means any leakage.

PASS requires mechanical gate success, mean at least 4.0/5.0, no dimension below 3, and no approval-integrity violation.

## SHIP_BRIEF

Intent: apply only explicitly approved loop-engineer improvements derived from current-state audit, preserving rejected, deferred, and pre-existing work.

After Checker PASS, present final decision matrix and request separate explicit shipping approval. Only then spawn fresh `harness-shipper`, which runs `/no-mistakes` once. Never ship inline, never merge, and never ship on ITERATE, PLATEAU, rejection, or silence. Record terminal outcome and PR URL. If shipping is rejected or deferred, record `N/A - shipping not approved` and finish without external action.

## LOOP_TRACKER

### Pre-Planner approval
- [ ] Baseline HEAD, status, protected diff recorded
- [ ] Read-only audit complete
- [ ] `CHANGE_PROPOSALS.md` written
- [ ] Every proposal has stable ID and exact scope
- [ ] Every ID decided: approved / rejected / deferred
- [ ] `APPROVALS.md` written

### Planner
- [ ] HARNESS.md read
- [ ] skill-routing.md read
- [ ] PLAN.md contains approved IDs only
- [ ] One slice per approved ID
- [ ] Rejected/deferred IDs recorded out of scope

### Cycle 1
- [ ] Maker: one phase and commit per approved ID
- [ ] Mechanical gates passed
- [ ] Conditional Prover verdict received
- [ ] Conditional red-team critical/high findings resolved or re-proposed
- [ ] Checker wrote CYCLE_LOG.md
- [ ] Reward signal recorded, threshold 4.0/5.0
- [ ] Verdict: PASS / ITERATE / PLATEAU

### Cycle 2 if ITERATE
- [ ] Fix limited to weakest dimension and approved scope
- [ ] Mechanical gates passed
- [ ] Checker updated CYCLE_LOG.md
- [ ] Verdict: PASS / ITERATE / PLATEAU

### Cycle 3 if ITERATE again
- [ ] Fix limited to weakest dimension and approved scope
- [ ] Mechanical gates passed
- [ ] Checker updated CYCLE_LOG.md
- [ ] Verdict: PASS / PLATEAU

### Final
- [ ] Decision matrix lists every ID, files, test, and commit
- [ ] Rejected/deferred work proven untouched
- [ ] Pre-existing dirty work preserved and unstaged
- [ ] Shipping decision explicitly requested
- [ ] No-mistakes outcome recorded or N/A
- [ ] HANDOFF.md, HANDOFF.html, and HANDOFF.excalidraw written
