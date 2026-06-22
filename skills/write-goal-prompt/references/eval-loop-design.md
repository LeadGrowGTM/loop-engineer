# Eval Loop Design Reference

## The Four Design Questions

Run through these before Phase 1. A goal without an eval is a task description.

---

### 1. What is the single reward signal?

One number or binary flag that represents task quality. Must be computable without
human judgment on every cycle. Examples:
- Coding: `npm test` pass rate, lint error count, bundle size bytes, grep match count
- Research: source count (≥N unique URLs cited), section count, word count vs. target
- Content: Layer-2 rubric mean score (1-5 across dimensions), binary checklist pass rate
- Migration: `grep -r OLD_PATTERN src/` returns 0 results

Bad signals: "looks good", "is complete", composite weighted scores with implicit weights.

**Human-judgment flag:** If the reward signal cannot be computed without a human
reading and deciding, surface this to the user before proceeding:
> "⚠️ The eval for this task requires human judgment ([what requires judgment]).
> Overnight agents cannot self-evaluate this reliably. Options:
> (a) replace with a proxy signal that's programmatic (e.g., rubric score instead of 'good')
> (b) reduce the loop to a checklist gate only — the agent verifies structure, you verify quality
> (c) proceed anyway — agent self-scores, but treat results as directional not authoritative"
Do not silently proceed with a human-judgment eval. The user must choose.

---

### 2. What is the mechanical gate (fast, cheap, binary)?

Runs in seconds. Purely programmatic — no LLM judgment. The agent must pass this
before even running the qualitative gate. Examples:
- `npm test && npm run lint` exits 0
- File exists AND word count > 500
- `grep -r "fetch(" src/api/` returns empty
- All required sections present (grep for headers)

---

### 3. What is the qualitative gate (scored, slower)?

Runs after the mechanical gate passes. Produces the reward signal. Examples:
- Coding: self-review rubric (correctness, error handling, test coverage, naming)
- Research: source diversity + claim coverage + section depth (each scored 1-5)
- Content: same 5-dimension rubric as cold-email-copywriter (specificity, proof,
  clarity, hook strength, CTA match)

LLM-as-judge is acceptable here IF the questions are narrow and binary:
"Does this output cite a specific dollar figure not from the prompt?" beats
"Is this good research?" Every judge question must have a right answer.

**Human-judgment flag trigger:** If any qualitative gate dimension requires reading
and deciding rather than checking, it needs human judgment. Common tells:
- "Does this feel right?"
- "Is the tone appropriate?"
- "Is this compelling enough?"
- Any rubric dimension where two reasonable people would score differently by >1 point

Surface the flag to the user (see reward signal flag above) — don't quietly include it.

---

### 4. What are the cycle limits?

- Default reflection cycles: **3** (research confirms diminishing returns after 3)
- Default outer loop (if task has multiple phases): 1 cycle per phase unless specified
- Circuit breaker: exit after 3 consecutive cycles with identical reward signal
- On max cycles reached: commit current best, mark phase as DRAFT, continue

---

## Task-Type Lookup Table

If the task type is ambiguous, default to the closest pattern:

| Task type | Mechanical gate | Qualitative gate | Signal |
|-----------|----------------|-----------------|--------|
| Coding | tests pass, lint clean | self-review rubric (1-5 per dimension) | mean rubric score |
| Research | source count ≥ N, all sections present | claim coverage + source diversity | mean score |
| Content | binary checklist (CTA, proof, no slop phrases) | 5-dimension rubric | mean_layer2_score |
| Migration | grep for old pattern returns 0 | coverage check (all instances migrated) | pass rate |
| Infra/config | dry-run exits 0, diff as expected | change review (scope, safety) | pass/fail |
