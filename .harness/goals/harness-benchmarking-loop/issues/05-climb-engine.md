# 05 - climb engine (invent -> checks -> measure -> keep)
Status: done
Blocked by: 02, 06

## Completion note
`.claude/workflows/benchmark-climb.js` built (Workflow-DSL shape, red-team.js discipline).
Bare `import()` loads clean (mechanical-gate parse check). run() drives the live climb:
invent (inventor agent) -> in-bounds (harness-inbounds-checker, SEPARATE agent) -> novelty
(harness-novelty-checker, SEPARATE agent) -> exogenous measure -> Pareto keep. VIOLATION and
DUPLICATE both kill the variant pre-measurement and do NOT count as a cycle. Stop =
first-of(target/plateau/budget) via pure `evaluateStop`, always returns best-so-far. Stop logic
demonstrable at zero cost: `bun .claude/workflows/benchmark-climb.js --selftest` -> 15/15 pure
assertions pass (target/budget/plateau trips, Pareto dominance, explore/exploit, best-so-far).
Traces ADR-0001 (stop) + ADR-0003 (climb + bounded independently-checked invention).

## Parent
PRD.md "In scope" 4; ADR-0001 (stop), ADR-0003 (climb + bounded invention).

## What to build
`.claude/workflows/benchmark-climb.js` - a Workflow-DSL engine. Each cycle: invent a
new variant over the declared levers -> **in-bounds check** (P6 agent, separate from
inventor) -> **novelty check** (P6 agent, diff vs ledger) -> measure (adapter) ->
keep if it improves. explore/exploit + Pareto-keep. Stop = first-of(target / plateau /
budget), always returns best-so-far.

## Acceptance criteria
- File parses clean on a bare `import()` (guarded executor globals).
- Invention, in-bounds check, novelty check, measurement, keep are distinct steps.
- In-bounds + novelty checks invoked as agents SEPARATE from the inventor
  (harness-inbounds-checker, harness-novelty-checker) - no self-certification.
- Invariant violations killed before measurement, not counted as a cycle.
- Near-duplicate variants rejected against the ledger before measurement.
- Stop logic implements first-of(target/plateau/budget); returns best-so-far.
- Stop logic is demonstrable (unit-runnable or documented trace), no live paid API.

## Skill routing
direct - `.claude/workflows/benchmark-climb.js`
