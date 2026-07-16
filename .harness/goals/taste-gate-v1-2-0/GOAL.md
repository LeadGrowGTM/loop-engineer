[GOAL] loop-engineer v1.2.0 ships the taste gate: all 8 spec verification checks green, checker reward >= 4.0/5.

[DATE] 2026-07-17

[TASK]
I'm handing you this task to run unsupervised.

Implement the taste gate per the approved spec: docs/superpowers/specs/2026-07-17-taste-gate-design.md. Read it FIRST — it is the source of truth; R1-R5 are exact, its "Verification plan (mechanical)" is the done-checklist. Do not re-decide anything the spec locked.

Stack: Bun + TypeScript (scripts/), markdown skill files, plugin manifests.

Must include (details in spec):
- R1 personal taste seeding (4 templates, exported home-dir-param function, never-overwrite, idempotent)
- R2 repo .harness/taste.md seeding
- R3 references/taste-gate.md (>=60 lines) + SKILL.md wiring + docs/index.md row
- R4 bun tests for seeding (TDD: failing test first)
- R5 version 1.2.0 in plugin.json + both marketplace.json fields

Quality bar: production-grade; new markdown matches the repo's reference-file style (model: references/spec-intake.md); templates are rules-with-examples, no essays.

Done means: all 8 spec verification checks pass, run exactly as written, output pasted as proof.

Use this context:
Repo /home/del13s_ubuntu/MACH4_2/loop-engineer, branch charles-fork (verify with git branch --show-current before any commit). Loop artifacts live in .harness/goals/taste-gate-v1-2-0/

[TOOLS]
bun test; claude plugin validate .; sandbox installs use HOME=$(mktemp -d) so the real home is never touched.

[HARNESS]
Read .harness/goals/taste-gate-v1-2-0/HARNESS.md before starting. Four-phase execution:
1. Planner: spawn loop-engineer:harness-planner (pass HARNESS.md + spec paths) -> BRIEF.md, PLAN.md, issues/ slices. No artifacts before PLAN.md.
2. Maker: spawn loop-engineer:harness-maker per phase; commit at each phase boundary.
3. Prover: N/A. 3b. Red-team: N/A.
4. Checker: spawn fresh loop-engineer:harness-checker with CHECKER_BRIEF from HARNESS.md; pass artifact + spec paths only. Writes CYCLE_LOG.md.
Work to completion; on blockers mock/stub, document, continue independent work.

[EVAL LOOP]
Turn 1, before any work: write "Eval Loop Design" in HANDOFF.md.
- Reward: checker mean over 4 dimensions (seeding+tests / gate fidelity to R3 / docs wiring / release hygiene)
- Mechanical gate: bun test && claude plugin validate . (both exit 0)
- Qualitative gate: checker rubric, file:line evidence required
- Max cycles: 3
- Done: mechanical green AND reward >= 4.0/5
Loop: generate -> mechanical gate (fix until green) -> checker -> done? commit : fix ONLY lowest dimension, repeat. 3 equal rewards = plateau: commit best, note it. Log cycles to HANDOFF.md; tick LOOP_TRACKER in HARNESS.md.

[CONSTRAINTS]
Do NOT touch unsupervised: master; ~/.claude outside mktemp sandboxes; the installed plugin (never run claude plugin update/install); anything outside this repo.
NEVER run git clean, git reset --hard, or git checkout -- . anywhere.
Commits: conventional prefix, no em dashes, no attribution lines.

[BLOCKERS]
Hard blocker -> stub, log under "Needs My Decision" in HANDOFF.md, continue. Never silently downgrade: reduced scope marks quality: draft; skeleton marks quality: placeholder.

[PROOF PROTOCOL]
Each phase appends to PROGRESS.md: Phase N — COMPLETE, Artifact: <path>, Proof: <pasted command output>, Commit: <SHA>. No proof, no COMPLETE.

[MORNING REPORT]
Leave HANDOFF.md + HANDOFF.html in the working dir. Publish via lavish-axi if available, else note the skip. Push charles-fork when done.

[TURN LIMIT] Stop after 60 turns. If not done, write HANDOFF files anyway and push.
