# HARNESS — v1-3-0-metrics-grill

- **Spec (source of truth):** docs/superpowers/specs/2026-07-17-run-metrics-grill-gate.md
- **Working dir:** .harness/goals/v1-3-0-metrics-grill/
- **Repo / branch:** /home/del13s_ubuntu/MACH4_2/loop-engineer, charles-fork only
- **Agents (plugin-scoped names):** loop-engineer:harness-planner, loop-engineer:harness-maker, loop-engineer:harness-checker

## PLANNER_BRIEF

Read the spec, decompose into 3-4 slices. Suggested clustering: (1) run-metrics.ts + tests [R3, R4 — TDD, failing test first], (2) [RUN METRICS] template block + morning-report-specs section [R1, R2], (3) grill gate in spec-intake.md + SKILL.md Branch S mention [R5], (4) version bump + full verification sweep [R6 + all 8 checks]. Do not invent requirements beyond the spec.

## PROVER_BRIEF

N/A — static artifacts. Skip Prover.

## REDTEAM_BRIEF

N/A — internal tooling.

## CHECKER_BRIEF

You did not write this. Read ONLY: the spec, the changed/created artifacts, and proof lines in PROGRESS.md. Score 4 dimensions, each /5, each with file:line evidence (uncited scores are invalid):

1. **Metrics script + tests** — R3/R4 exactly: exported goals-dir-parameterized parser, exact R1 field names, (no metrics) tolerance with exit 0, >= 3 tests incl. fixture-parse and missing-section cases.
2. **Template + report-spec wiring** — R1/R2 exactly: [RUN METRICS] block placed after [MORNING REPORT] in the Phase 2 template with the exact 11 fields; morning-report-specs.md section lists the same fields verbatim.
3. **Grill gate fidelity** — R5 exactly: section >= 25 lines BEFORE "The mapping"; router table with GRILL/SKIP/AMBIGUOUS rows; "Never grill when the default is clear."; attacks-existing-decisions-only rule (no re-gathering); grill-me/grill-with-docs tooling note; SKILL.md Branch S mentions "Grill gate".
4. **Release hygiene** — 1.3.0 in all three version fields; validate passes; commits conventional, no em dashes, no attribution.

Reward = mean of the 4. Pass threshold: 4.0. Write scores + verdict (PASS / ITERATE / PLATEAU) + weakest dimension + fix target to CYCLE_LOG.md.

## LOOP_TRACKER

- [ ] Cycle 1: mechanical gate ___ | reward ___ | changed: ___
- [ ] Cycle 2: mechanical gate ___ | reward ___ | changed: ___
- [ ] Cycle 3: mechanical gate ___ | reward ___ | changed: ___
- Final: verdict ___ | commit ___ | pushed: ___
