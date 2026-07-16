[GOAL] loop-engineer v1.2.0 ships the taste gate: seeding + decision-gate reference + wiring, all 8 spec verification checks green, checker reward >= 4.0/5.

[DATE] 2026-07-17

[TASK]
I'm handing you this task to run unsupervised.

Implement the taste gate per the approved spec: docs/superpowers/specs/2026-07-17-taste-gate-design.md. Read it FIRST — it is the source of truth; requirements R1-R5 are exact, the verification plan is the done-checklist. Do not re-decide anything the spec locked.

Stack: Bun + TypeScript (scripts/), markdown skill files, Claude Code plugin manifests.

Must include:
- R1: personal taste seeding (~/.claude/taste/: ux-taste, ui-taste, copy-taste, opinions), exported testable function, never-overwrite, idempotent
- R2: repo .harness/taste.md seeding
- R3: references/taste-gate.md (>=60 lines: router-with-default, layer selection, approve/edit/drop table, compilation into Done-means + [CONSTRAINTS] + "Taste applied:" audit line, precedence, documented-only nexus hook) + SKILL.md wiring + docs/index.md row
- R4: bun tests for seeding (TDD: failing test first)
- R5: version 1.2.0 in plugin.json + both marketplace.json fields

Quality bar: production-grade; new markdown matches the repo's existing reference-file style (see references/spec-intake.md as the model); templates contain rules-with-examples, no essays.

Done means: all 8 checks in the spec's "Verification plan (mechanical)" section pass, run exactly as written, output pasted as proof.

Use this context:
Repo: /home/del13s_ubuntu/MACH4_2/loop-engineer, branch charles-fork (verify with git branch --show-current before any commit).
Working dir for loop artifacts: .harness/goals/taste-gate-v1-2-0/

[TOOLS]
bun test; claude plugin validate .; sandbox installs use HOME=$(mktemp -d) so the real home is never touched.

[HARNESS]
Read .harness/goals/taste-gate-v1-2-0/HARNESS.md before starting. Four-phase execution:
1. Planner: spawn loop-engineer:harness-planner (pass HARNESS.md path + spec path) -> BRIEF.md, PLAN.md, issues/NN-<slug>.md slices. No task artifacts before PLAN.md exists.
2. Maker: spawn loop-engineer:harness-maker per phase; commit at each phase boundary.
3. Prover: PROVER_BRIEF: N/A (static artifacts). 3b. REDTEAM_BRIEF: N/A (internal).
4. Checker: spawn fresh loop-engineer:harness-checker with CHECKER_BRIEF from HARNESS.md; pass artifact paths + spec path only. Checker writes CYCLE_LOG.md.

Work to completion. On blockers: mock/stub, document, continue everything not requiring my decision.

[EVAL LOOP]
Turn 1, before any work: write "Eval Loop Design" in HANDOFF.md.
- Reward signal: checker's mean score over 4 dimensions (seeding+tests / gate reference fidelity to spec R3 / docs wiring / release hygiene)
- Mechanical gate: bun test && claude plugin validate . (both exit 0)
- Qualitative gate: checker rubric, file:line evidence per dimension
- Max cycles: 3
- Done condition: mechanical gate green AND reward >= 4.0/5
Loop: generate -> mechanical gate (fix until green) -> checker -> done? commit : fix ONLY lowest dimension, repeat. Plateau (3 equal rewards) -> commit best, note in HANDOFF.md. Log each cycle to HANDOFF.md; update LOOP_TRACKER in HARNESS.md.

[CONSTRAINTS]
Do NOT touch unsupervised: master branch; ~/.claude outside mktemp sandboxes; the installed plugin (never run claude plugin update/install); anything outside this repo.
NEVER run git clean, git reset --hard, or git checkout -- . anywhere.
Commits: conventional prefix, plain sentences, no em dashes, no attribution/Co-Authored-By lines.

[BLOCKERS]
Hard blocker -> stub it, document under "Needs My Decision" in HANDOFF.md, continue independent work. Tiered fallbacks; never silently downgrade: Tier 2 marks quality: draft, Tier 3 marks quality: placeholder.

[PROOF PROTOCOL]
Every phase appends to PROGRESS.md: Phase N — COMPLETE, Artifact: <path>, Proof: <pasted command output>, Commit: <SHA>. No proof, no COMPLETE.

[MORNING REPORT]
Leave in the working dir: HANDOFF.md (completed/workarounds/needs-decision/evidence) + HANDOFF.html (single-page visual). If lavish-axi is available, publish HANDOFF.html per references/morning-report-specs.md; otherwise skip publishing and note it. Push charles-fork when done.

[TURN LIMIT] Stop after 60 turns. If not done, write HANDOFF files anyway and push.
