# 09 - docs sync (CONTEXT, README, SKILL routing section)
Status: ready-for-agent
Blocked by: 01, 02, 03, 04, 05, 06, 07, 08

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
