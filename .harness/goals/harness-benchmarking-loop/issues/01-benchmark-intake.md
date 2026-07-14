# 01 - benchmark-intake reference (lazy grill branch)
Status: done
Blocked by: none

## Parent
PRD.md "In scope" 1; ADR-0004 (lazy reference), ADR-0001/0002/0003/0006 (spec fields).

## What to build
`skills/write-goal-prompt/references/benchmark-intake.md` - the lazily-loaded grill
branch that captures a full benchmark spec: `benchmark` (metric + direction ± target,
including the rule-derived frozen-rubric path), `measurement` (instant|lagging +
settle_window), `search` (sweep candidates | climb {levers, invariants}), `stop`
(target?/plateau/budget). Loads only when the benchmark path fires so a plain build
goal never pays for it.

## Acceptance criteria
- File exists at the path above and parses as markdown.
- Captures all four spec sections with exact CONTEXT.md vocabulary.
- Includes the rule-derived -> frozen-rubric-or-fallback-to-build branch (ADR-0006).
- Emits a concrete spec JSON shape the runner (P4/P5) and command (P3) consume.
- States it is lazily loaded (progressive disclosure); SKILL.md stays lean.

## Skill routing
direct - `skills/write-goal-prompt/references/benchmark-intake.md`
