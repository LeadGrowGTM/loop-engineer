# PLAN.md

## Phases
1. Taste seeding function + templates + tests — skill: tdd — artifact: `scripts/setup-harness.ts` (exported seeding functions) + `scripts/setup-harness.test.ts` (or new taste-seed test file)
2. Taste gate reference + SKILL.md/docs wiring — skill: direct — artifact: `skills/write-goal-prompt/references/taste-gate.md` + `skills/write-goal-prompt/SKILL.md` + `skills/write-goal-prompt/docs/index.md`
3. Version bump + validate + full verification sweep — skill: direct — artifact: `.claude-plugin/plugin.json` + `.claude-plugin/marketplace.json` + `PROGRESS.md` (verification sweep output)

(Each phase is mirrored 1:1 as a durable slice in `issues/NN-<slug>.md`.)

## Skill Routing

Note: this repo has no top-level `.harness/skill-routing.md` (it is the plugin's own
source repo, not an installed target) — routing below falls back to
`skills/write-goal-prompt/references/skill-routing.md`, per that file's own fallback rule.

- Phase 1 → `tdd` — reason: skill-routing.md heuristic #1 ("Code involved? Check for
  `/tdd` first — tests encode intent, they're not optional") and PLANNER_BRIEF's explicit
  "Route phase 1 through test-first discipline." `/tdd`'s quality bar (tests failing
  before implementation, all pass after, no skip/xfail) matches R4's TDD requirement
  exactly. Per user CLAUDE.md skill-arsenal rule, `tdd` is the pick over superpowers
  `test-driven-development` when both are available.
- Phase 2 → `direct` — reason: heuristic #6 ("No matching skill? Direct implementation is
  fine. Note it in PLAN.md so the Checker knows there's no skill quality bar to
  reference.") No skill in skill-routing.md covers reference-file authoring + doc
  wiring; the quality bar is the spec's R3 requirements and the spec-intake.md style
  model, not a skill's rubric.
- Phase 3 → `direct` — reason: same heuristic #6. Version bump, `claude plugin validate`,
  and running a fixed mechanical checklist is release hygiene, not a skill-shaped task.

## Checker Rubric
Artifacts to evaluate: `scripts/setup-harness.ts`, `scripts/setup-harness.test.ts` (or
new taste-seed test file), `skills/write-goal-prompt/references/taste-gate.md`,
`skills/write-goal-prompt/SKILL.md`, `skills/write-goal-prompt/docs/index.md`,
`.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, and PROGRESS.md proof
lines for the 8-check verification sweep.

Dimensions (score 1-5 each):
- **Seeding + tests (R1/R2/R4, Phase 1):** 5 = exactly 4 personal templates + repo
  taste.md seeded; exported, home-dir-parameterized function with no hardcoded `$HOME`;
  never-overwrite proven by a dedicated test; idempotency proven by a dedicated test —
  each claim cited by file:line. 1 = seeding hardcodes `$HOME`, or overwrites an existing
  file, or no test proves never-overwrite / idempotency.
- **Gate reference fidelity (R3, Phase 2):** 5 = `references/taste-gate.md` implements
  R3 exactly — router-with-default (never asks when the default is clear), layer
  selection table, approve/edit/drop presentation, compilation targets (Done-means +
  `[CONSTRAINTS]` + `Taste applied:` audit line), precedence rule, and the Nexus hook as
  documented-text-only — each traceable to a specific line. 1 = one or more of the six
  R3 elements missing, or contradicts the spec.
- **Docs wiring (R3, Phase 2):** 5 = SKILL.md gate step positioned after Phase 0.5 /
  before Phase 2, states it applies to both grilled and spec-mode goals, plus a
  references-table row, plus a docs/index.md row, all present and grep-verifiable
  (checks 4-5). 1 = wiring absent, misplaced relative to Phase 0.5/Phase 2, or grep
  counts don't match checks 4-5.
- **Release hygiene (R5, Phase 3):** 5 = `1.2.0` in all 3 version fields
  (plugin.json + marketplace.json metadata.version + marketplace.json
  plugins[0].version); `claude plugin validate .` passes; every commit message in the
  goal is conventional-prefix, no em dashes, no attribution lines. 1 = any version field
  mismatched, validate fails, or any commit violates the message rules.

PASS threshold: mean score ≥ 4.0/5.0 (matches HARNESS.md CHECKER_BRIEF).

## Turn Budget
Phase 1: ~20 turns (write failing tests, implement seeding, sandbox-verify)
Phase 2: ~15 turns (write >= 60-line reference, wire SKILL.md + docs/index.md)
Phase 3: ~10 turns (version bump, validate, run + paste the full 8-check sweep, fix failures)
Total: ~45 (leave 5 for checker; goal's outer cap is 60 turns per GOAL.md, remaining
headroom covers checker spawn + one fix cycle if the first pass ITERATEs)

## Dependencies
Sequential: Phase 3 depends on Phase 1 AND Phase 2 both complete — the full verification
sweep and the version-bump commit require both prior artifacts in place.
Parallel-safe: Phase 1 and Phase 2 touch disjoint files (`scripts/setup-harness.ts` +
its test file vs. `skills/write-goal-prompt/**`) and have no ordering dependency between
them; this run executes them in PLAN.md order for commit-boundary clarity, matching the
PLANNER_BRIEF's suggested clustering.

## Commit Boundaries
- Phase 1 → `feat(taste-gate): seed personal and repo taste templates with tests`
  (commit once `bun test` is green and the sandbox proof in issue 01 is captured)
- Phase 2 → `docs(taste-gate): add taste-gate reference and wire into SKILL.md`
  (commit once the reference file and both doc-wiring edits are in place)
- Phase 3 → `chore(taste-gate): bump plugin to v1.2.0 and pass verification sweep`
  (commit once all 3 version fields are updated, `claude plugin validate .` passes, and
  the full 8-check sweep is pasted into PROGRESS.md)

All commit messages: conventional prefix, no em dashes, no attribution/Co-Authored-By
lines, on `charles-fork` only — per the goal's `[CONSTRAINTS]` block.

## Guardrails (carried from the goal's [CONSTRAINTS] / [BLOCKERS])
- Quality bar: production-grade; no rewrites needed.
- New markdown matches `references/spec-intake.md` style; the 4 personal templates and
  repo `taste.md` are rules-with-examples, never essays.
- Never touch `~/.claude` outside a `mktemp -d` sandbox `HOME`.
- Never run `claude plugin update` or `claude plugin install`.
- Work only inside this repo (`/home/del13s_ubuntu/MACH4_2/loop-engineer`), branch
  `charles-fork` only.
- Never run `git clean`, `git reset --hard`, or `git checkout -- .` anywhere. If
  confused, stop and report rather than tidy up.
