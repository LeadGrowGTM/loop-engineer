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

The goal condition is lean: task content, a compact `[PARAMS]` block, and a one-paragraph `[HARNESS]` pointer. The standing protocol (execution stages, eval loop, blockers, proof, morning report, context management, turn limit) is written verbatim into HARNESS.md in Phase 2.5 and read first — it is NOT inlined here, so it never competes for the 4000-char budget.

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

[PARAMS]
Reward signal: npm test pass rate + grep fetch count (target: 100% / 0)
Done: `npm test && grep -r "fetch(" src/api/ | wc -l` → 0 AND mean rubric ≥ 4.0/5.0
Max cycles: 3
Turn limit: 80
Do NOT touch: src/auth/ — Auth team owns it; skip any fetch() there and note it in HANDOFF.md

[HARNESS]
Read /home/user/projects/myapp/.harness/goals/api-client-migration/HARNESS.md before starting and
follow it end to end. Its standing sections carry the protocol: EXECUTION_PROTOCOL (the 5-stage
Planner→Maker→Prover→Checker→Ship flow), EVAL_LOOP, BLOCKERS, PROOF_PROTOCOL, MORNING_REPORT,
CONTEXT_MANAGEMENT, TURN_LIMIT. Use the [PARAMS] values above wherever a section references them.
The per-task briefs and LOOP_TRACKER live there too.
Before stage 1, the goal parent runs the exact safe snippet generated in Execution Router Step 0.1:
[ROUTING_GUARD]
ROUTING_EXIT=0
ROUTING_EVIDENCE=$(bun '/home/user/.claude/skills/write-goal-prompt/scripts/resolve-skill-routing.ts' --project-root '/home/user/projects/myapp' --canonical-path '/home/user/.claude/skills/write-goal-prompt/references/skill-routing.md') || ROUTING_EXIT=$?
printf '%s\n' "$ROUTING_EVIDENCE"
if [ "$ROUTING_EXIT" -ne 0 ]; then
  exit "$ROUTING_EXIT"
fi
A nonzero result stops before Planner.
```

The `HARNESS.md` this goal points at carries the six task briefs + LOOP_TRACKER **and** the seven standing protocol sections (written verbatim, per Phase 2.5 Step 0). None of that text lives in the measured goal condition above.
