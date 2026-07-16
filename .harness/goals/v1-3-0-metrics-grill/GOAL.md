[GOAL] loop-engineer v1.3.0 ships run metrics + the grill gate: all 8 spec verification checks green, checker reward >= 4.0/5.

[DATE] 2026-07-17

[TASK]
I'm handing you this task to run unsupervised.

Implement run instrumentation and the spec grill gate per the approved spec: docs/superpowers/specs/2026-07-17-run-metrics-grill-gate.md. Read it FIRST — it is the source of truth; R1-R6 are exact, its "Verification plan (mechanical)" is the done-checklist. Do not re-decide anything the spec locked.

Stack: Bun + TypeScript (scripts/), markdown skill files, plugin manifests.

Must include (details in spec):
- R1 [RUN METRICS] block in the Phase 2 goal template (exact 11 fields)
- R2 matching "## Run Metrics section" in morning-report-specs.md
- R3 scripts/run-metrics.ts aggregator (exported goals-dir-param parser, "(no metrics)" tolerance, exit 0)
- R4 bun tests for the parser (TDD: failing test first)
- R5 "## Grill gate (decision point)" in spec-intake.md (>=25 lines, before "The mapping") + SKILL.md Branch S mention
- R6 version 1.3.0 in plugin.json + both marketplace.json fields

Quality bar: production-grade; new markdown matches the repo's reference-file style (models: references/spec-intake.md, references/taste-gate.md); the metrics table output is aligned and scannable.

Done means: all 8 spec verification checks pass, run exactly as written, output pasted as proof. ALSO: this run itself writes the new ## Run Metrics section into its own HANDOFF.md (eat the dogfood you just cooked).

Use this context:
Repo /home/del13s_ubuntu/MACH4_2/loop-engineer, branch charles-fork (verify with git branch --show-current before any commit). Loop artifacts live in .harness/goals/v1-3-0-metrics-grill/

[TOOLS]
bun test; claude plugin validate .; date -Is for timestamps.

[HARNESS]
Read .harness/goals/v1-3-0-metrics-grill/HARNESS.md before starting. Four-phase execution:
1. Planner: spawn loop-engineer:harness-planner (pass HARNESS.md + spec paths) -> BRIEF.md, PLAN.md, issues/ slices. No artifacts before PLAN.md.
2. Maker: spawn loop-engineer:harness-maker per phase; commit at each phase boundary.
3. Prover: N/A. 3b. Red-team: N/A.
4. Checker: spawn fresh loop-engineer:harness-checker with CHECKER_BRIEF from HARNESS.md; pass artifact + spec paths only. Writes CYCLE_LOG.md.
Work to completion; on blockers mock/stub, document, continue independent work.

[EVAL LOOP]
Turn 1, before any work: record `started` via date -Is, then write "Eval Loop Design" in HANDOFF.md.
- Reward: checker mean over 4 dimensions (metrics script+tests / template+report-spec wiring / grill gate fidelity / release hygiene)
- Mechanical gate: bun test && claude plugin validate . (both exit 0)
- Qualitative gate: checker rubric, file:line evidence required
- Max cycles: 3
- Done: mechanical green AND reward >= 4.0/5
Loop: generate -> mechanical gate (fix until green) -> checker -> done? commit : fix ONLY lowest dimension, repeat. 3 equal rewards = plateau: commit best, note it. Log cycles to HANDOFF.md; tick LOOP_TRACKER in HARNESS.md.

[CONSTRAINTS]
Do NOT touch unsupervised: master; ~/.claude (no sandbox needed this run); the installed plugin (never run claude plugin update/install); anything outside this repo.
NEVER run git clean, git reset --hard, or git checkout -- . anywhere.
Commits: conventional prefix, no em dashes, no attribution lines.

[BLOCKERS]
Hard blocker -> stub, log under "Needs My Decision" in HANDOFF.md, continue. Never silently downgrade: reduced scope marks quality: draft; skeleton marks quality: placeholder.

[PROOF PROTOCOL]
Each phase appends to PROGRESS.md: Phase N — COMPLETE, Artifact: <path>, Proof: <pasted command output>, Commit: <SHA>. No proof, no COMPLETE.

[RUN METRICS]
At run end append ## Run Metrics to HANDOFF.md per the block you built in R1 — this run is its own first datapoint.

[MORNING REPORT]
Leave HANDOFF.md + HANDOFF.html in the working dir. Publish via lavish-axi if available, else note the skip. Push charles-fork when done.

[TURN LIMIT] Stop after 60 turns. If not done, write HANDOFF files anyway and push.
