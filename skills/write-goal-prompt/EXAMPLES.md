# Write Goal Prompt — Worked Example

## User Input

```
Task: Migrate all fetch() calls in src/api/ to use the new ApiClient class
Done: all tests pass, no raw fetch() calls remain in src/api/
Context: repo at ~/projects/myapp, branch feature/api-client, TypeScript + Node
Quality bar: production-grade — every migrated call uses proper error handling,
             no raw try/catch without logging
Constraints: don't touch src/auth/ — Auth team owns it. Stay out.
```

---

## Phase 0 (eval loop design — run before formatting)

- Reward signal: `npm test` pass rate (0–100%) AND `grep -r "fetch(" src/api/` line count (target: 0)
- Mechanical gate: `npm test && grep -r "fetch(" src/api/ | wc -l` exits 0 / returns 0
- Qualitative gate: checker rubric — error handling preserved (1-5), no scope creep (1-5), naming consistent (1-5)
- Max cycles: 3 per file batch, circuit breaker on 3 identical scores
- Done: mechanical gate passes AND mean rubric score ≥ 4.0

---

## Output

```
/goal [GOAL] All tests pass and no raw fetch() calls remain in src/api/.

[DATE] 2026-06-21

[TASK]
I'm handing you this task to run unsupervised overnight.

Migrate every fetch() call in src/api/ to use the new ApiClient class.
No other files should change.

Stack: TypeScript, Node.js

Must include:
- All fetch() calls in src/api/ replaced with ApiClient equivalents
- Error handling preserved or improved on every migrated call — no silent swallows
- No changes outside src/api/

Quality bar: Production-grade. Every migrated call must use proper error handling
with logging. A senior dev should not need to rewrite any of it.

Done means:
- `npm test` exits 0 with no skipped tests
- `grep -r "fetch(" src/api/` returns empty
- `git diff --name-only` shows only files under src/api/
- HANDOFF.md, HANDOFF.html, and HANDOFF.excalidraw exist at project root

Use this context:
Repo: ~/projects/myapp, branch: feature/api-client.
ApiClient is at src/lib/api-client.ts — read it before migrating.

[TOOLS]
- TypeScript compiler (tsc) for type checking
- Node.js test runner (npm test) for validation
- grep for verification of API calls

[HARNESS]
Read HARNESS.md before starting. Three-phase execution:
1. Planner (turns 1-5): decompose task → write PLAN.md (phases, skill routing, checker rubric).
   Do not produce task artifacts until PLAN.md is written.
2. Maker (turns 6-<N>): execute per PLAN.md, invoke skills per phase, commit at each phase boundary.
3. Checker: spawn fresh subagent per checker brief in HARNESS.md. Pass artifact paths only —
   not your reasoning context. Checker opens "I did not write this." Writes scores to CYCLE_LOG.md.

Work through the task to completion. If you hit a blocker, do not stop. Use mocks, stubs, or documented assumptions. Record each workaround and continue with everything that does not require my decision.

[EVAL LOOP]
At turn 1, before any migration work, write your eval plan in HANDOFF.md under
"Eval Loop Design". Do not start the task until this is written. Then migrate in batches using this loop (max 3 cycles/batch):
  - Reward signal: npm test pass rate + grep fetch count (target: 100% / 0)
  - Mechanical gate: `npm test && grep -r "fetch(" src/api/ | wc -l` → 0
  - Qualitative gate: checker rubric dimensions: error handling (1-5), scope (1-5), naming (1-5)
  - Done: mechanical gate passes AND mean rubric score ≥ 4.0
  1. Generate output (migrate a batch of fetch() calls)
  2. Run mechanical gate — if it fails, fix and re-run before proceeding to step 3
  3. Spawn checker subagent (checker brief in HARNESS.md) — pass artifact paths only,
     not your context. Checker opens "I did not write this." Writes dimension scores
     + reward signal to CYCLE_LOG.md.
  4. If done condition met → commit batch, proceed to next files
  5. If not → read CYCLE_LOG.md, fix only the lowest-scoring dimension, return to step 1
  6. If 3 consecutive cycles produce the same reward signal → exit loop (plateau),
     commit current best, note "plateau after N cycles" in HANDOFF.md
Log each cycle to HANDOFF.md: cycle number, mechanical gate result, reward signal score, what changed.

[CONSTRAINTS]
Do NOT touch unsupervised:
- src/auth/ — Auth team owns it. If a fetch() call is in there, document in
  HANDOFF.md under "Constraint Block" and skip it.

[CONTEXT MANAGEMENT]
Run /compact when context approaches 170k tokens. After compacting, state
your current checkpoint before continuing. Do NOT compact on turn 1.

[BLOCKERS]
If a fetch() call needs an auth pattern not yet on ApiClient: add a TODO
comment, document in HANDOFF.md under "Needs My Decision", continue.

[PROOF PROTOCOL]
Every completed phase needs proof, not assertion. After each phase append to PROGRESS.md:
  Phase N: <name> — COMPLETE
  Artifact: <absolute-path>
  Proof: <actual command output — paste it, don't describe it>
  e.g. "npm test: 47 passed, 0 failed" not "tests pass"
  e.g. "wc -l src/api/client.ts: 312 lines" not "file written"
  e.g. "grep -c 'fetch(' src/api/: 0" not "all migrated"
  Commit: <SHA>
Never write "Phase N complete" without proof on the line below it.

[MORNING REPORT]
By morning, leave me the morning report at project root:
1. HANDOFF.md — what completed, workarounds, needs my decision, evidence
2. HANDOFF.html — single-page visual summary (status badges per phase, files
   created with sizes, decisions made, blockers highlighted)
3. HANDOFF.excalidraw — diagram of migration scope (blue=done, red=blocked)
4. Publish it: `lavish-axi share HANDOFF.html --password <fresh-pw>` — record ONLY the
   URL in a "## 📋 Published Report" block atop HANDOFF.md. Write the password and
   update_key to HANDOFF.secret.local (+ .gitignore it — update_key is update/delete-
   capable and must never be committed). Export fallback if ht-ml.app unreachable.

[TURN LIMIT] Stop after 80 turns.
```
