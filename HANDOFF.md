# HANDOFF — harness-execmode-redteam

(Previous session's handoff backed up → `temp/goals/harness-execmode-redteam/HANDOFF-prev-2026-06-25.md`)

Goal: ship 4 artifacts (execution-mode router ref, red-team.js workflow, first-principles
ref wired into planner+maker, setup-system diagnosis), add SKILL.md routing section,
sync repo→global. Static-artifact goal → skip Prover, Checker only.

## Eval Plan

Up to 3 cycles. Each cycle:
1. Produce/harden the 4 artifacts + SKILL.md section (spec fixed — change only output).
2. **Mechanical gate** — every Done bullet's grep/parse passes:
   - `execution-mode-routing.md` names 4 modes (single-run, goal-loop, time-loop, dynamic-workflow)
   - `red-team.js` has `meta.name = 'red-team'`; `bun -e "import('./.claude/workflows/red-team.js')"` exits 0
   - first-principles directive present in BOTH `harness-planner.md` AND `harness-maker.md`
   - `"setup-harness.ts:156"` literal appears in `docs/setup-system-diagnosis.md`
   - all 4 artifact files exist
   - HANDOFF.md carries firstmate proof (below)
   - changed skill/agent/workflow files synced repo→global
   Fix + re-run until green BEFORE checker.
3. **Checker** (fresh subagent, CHECKER_BRIEF, paths only) scores 4 dims + reward → CYCLE_LOG.md.
4. Done = gate green AND checker mean ≥3.5/5.0 → commit, finish. Else fix lowest dim only, return to 1.
5. 3 identical rewards → plateau: commit best, note it. Reward = (Done bullets passing)/(total).

## Firstmate non-finding — "nothing to revert" proof

Ran once (phase 0). No `firstmate` code, feature, or commit exists anywhere.

```
$ grep -ri firstmate .
./temp/goals/harness-execmode-redteam/HARNESS.md   (goal-spec text: instruction to run this check)
./temp/_goal-candidate.txt                          (goal-spec text: instruction to run this check)
# EXIT=0 — only matches are the goal spec DESCRIBING this check; no code/artifact named firstmate

$ git log --all -i --grep=firstmate
# (empty)
# EXIT=0 — zero commits across all branches
```

Conclusion: nothing to revert. The only occurrences of the token are the goal/harness
spec files instructing this very check. History untouched.

## Needs My Decision

(none yet)

## Progress

- Phase 0 firstmate proof: DONE (above)
- Planner: spawning
