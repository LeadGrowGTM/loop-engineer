# 09 - docs sync (CONTEXT, README, SKILL routing section)
Status: done
Blocked by: 01, 02, 03, 04, 05, 06, 07, 08

## Completion note
- `CONTEXT.md` gains an "Artifact map" table cross-linking every glossary term to its
  built artifact + ADR; glossary body stays implementation-free. All 14 paths verified
  to resolve.
- `README.md` gains a "Second goal path: the benchmarking loop" section - names the path
  beside the build loop with a full file map (P1-P7 artifacts) and the sweep/climb +
  anti-gaming summary tracing ADR-0001/0003.
- `SKILL.md` Execution Mode Routing section runs benchmark detection first and names
  `/benchmarking-loop` as the second front door (one lean paragraph, lazy-reference
  discipline preserved - benchmark-intake.md only loads on the benchmark fork).

## Parent
PRD.md "In scope" 8.

## What to build
- `CONTEXT.md` - cross-link the glossary terms to the built artifacts + ADRs.
- `README.md` - name the second goal path (benchmarking loop) + its file map.
- `skills/write-goal-prompt/SKILL.md` - a routing section naming `/benchmarking-loop`
  as the second front door (thin, progressive-disclosure; SKILL.md stays lean).

## Acceptance criteria
- CONTEXT.md links resolve to real artifact + ADR paths.
- README.md documents the benchmarking loop beside the build loop.
- SKILL.md gains a short routing pointer to the second path WITHOUT bloating the
  build-goal invocation (lazy reference discipline preserved).
- No dead cross-links; ADR + CONTEXT cross-links resolve (mechanical gate).

## Skill routing
direct - `CONTEXT.md`, `README.md`, `skills/write-goal-prompt/SKILL.md`
