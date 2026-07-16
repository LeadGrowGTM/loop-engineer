# PLAN.md

## Phases
1. Metrics aggregator script + tests — skill: tdd — artifact: `scripts/run-metrics.ts` + `scripts/run-metrics.test.ts`
2. `[RUN METRICS]` template block + morning-report-specs section — skill: direct — artifact: `skills/write-goal-prompt/SKILL.md` (Phase 2 template) + `skills/write-goal-prompt/references/morning-report-specs.md`
3. Grill gate in spec-intake.md + SKILL.md Branch S mention — skill: direct — artifact: `skills/write-goal-prompt/references/spec-intake.md` + `skills/write-goal-prompt/SKILL.md` (Phase 0.5 Branch S paragraph)
4. Version bump + full 8-check verification sweep — skill: direct — artifact: `.claude-plugin/plugin.json` + `.claude-plugin/marketplace.json` + `PROGRESS.md` (verification sweep output)

(Each phase is mirrored 1:1 as a durable slice in `issues/NN-<slug>.md`.)

## Skill Routing

Note: this repo has no top-level `.harness/skill-routing.md` (it is the plugin's own
source repo, not an installed target) — routing below falls back to
`skills/write-goal-prompt/references/skill-routing.md`, per that file's own fallback rule.
This matches the precedent set by the prior cycle (`.harness/goals/taste-gate-v1-2-0/PLAN.md`).

- Phase 1 → `tdd` — reason: skill-routing.md heuristic #1 ("Code involved? Check for
  `/tdd` first — tests encode intent, they're not optional") and the spec's R4, which is
  explicit TDD ("failing test first"). Per user CLAUDE.md skill-arsenal rule, `tdd` is the
  pick over superpowers `test-driven-development` when both are available. Quality bar:
  tests failing before implementation, all pass after, no skip/xfail.
- Phase 2 → `direct` — reason: heuristic #6 ("No matching skill? Direct implementation is
  fine.") No skill in skill-routing.md covers template/reference-doc editing; the quality
  bar is R1/R2's exact field list, not a skill's rubric.
- Phase 3 → `direct` — reason: same heuristic #6. Writing a decision-point reference
  section and a one-line doc pointer is not a skill-shaped task; the quality bar is R5's
  itemized requirements plus the `references/taste-gate.md` style model named in GOAL.md.
- Phase 4 → `direct` — reason: same heuristic #6. Version bump, `claude plugin validate`,
  and running a fixed mechanical checklist is release hygiene, not a skill-shaped task.

## Checker Rubric
Artifacts to evaluate: `scripts/run-metrics.ts`, `scripts/run-metrics.test.ts`,
`skills/write-goal-prompt/SKILL.md`, `skills/write-goal-prompt/references/morning-report-specs.md`,
`skills/write-goal-prompt/references/spec-intake.md`, `.claude-plugin/plugin.json`,
`.claude-plugin/marketplace.json`, and `PROGRESS.md` proof lines for the 8-check
verification sweep. (Matches HARNESS.md CHECKER_BRIEF exactly — this section expands it
with 5-vs-1 anchors.)

Dimensions (score 1-5 each):
- **Metrics script + tests (R3/R4, Phase 1):** 5 = `scripts/run-metrics.ts` exports a
  parser function taking the goals dir as a parameter (no hardcoded repo path inside it);
  scans `<goals-dir>/*/HANDOFF.md` for `## Run Metrics`; prints one aligned table row per
  run (slug, started, wall_clock_minutes, turns_used, cycles_used, reward_final); a run
  missing the section prints `<slug>  (no metrics)` and the script still exits 0 (never
  throws); >= 3 tests exist covering (a) a fixture HANDOFF with a full metrics section
  parses to expected values, (b) a HANDOFF without the section is reported metrics-missing
  not an error, (c) the parser's field list matches R1's 11 field names exactly — each
  claim cited by file:line. 1 = parser hardcodes a repo path, crashes on a missing
  section, or fewer than 3 tests / a missing case.
- **Template + report-spec wiring (R1/R2, Phase 2):** 5 = `[RUN METRICS]` block placed
  immediately after `[MORNING REPORT]` in SKILL.md's Phase 2 template, instructing the
  goal agent to append `## Run Metrics` to HANDOFF.md at run end with EXACTLY these 11
  `key: value` fields, one per line: `started`, `finished`, `wall_clock_minutes`,
  `turns_used`, `turn_budget`, `cycles_used`, `max_cycles`, `reward_final`,
  `reward_per_cycle` (comma-separated), `commits`, `tests_delta` (e.g. "25->31");
  `morning-report-specs.md` has a `## Run Metrics section` heading listing the identical
  11 fields verbatim (a checker can diff the two lists and find them identical). 1 = block
  missing, misplaced (not after `[MORNING REPORT]`), field list incomplete/renamed, or the
  two lists disagree.
- **Grill gate fidelity (R5, Phase 3):** 5 = `spec-intake.md` gains a
  `## Grill gate (decision point)` section, >= 25 lines, positioned BEFORE `## The
  mapping`, containing: a router-with-default table (GRILL when new subsystem /
  external-client-facing / >5 slices / user asks; SKIP for small internal features whose
  requirements are already all checkable; AMBIGUOUS → ask ONE question) plus the literal
  rule line "Never grill when the default is clear."; a procedure that walks the spec's
  decisions one at a time adversarially (strongest objection + recommended keep/change per
  decision, amend inline, then proceed to mapping) with an explicit statement that it
  attacks existing decisions only and never re-gathers requirements (no double interview);
  a tooling note preferring installed `grill-me`/`grill-with-docs` skills when present,
  else run the procedure inline. SKILL.md's Phase 0.5 Branch S paragraph contains the
  exact phrase "Grill gate" with a pointer to `spec-intake.md`. 1 = section under 25
  lines, placed after "The mapping", missing the router/default rule/no-re-gather
  constraint, or SKILL.md doesn't name "Grill gate".
- **Release hygiene (R6 + Verification plan, Phase 4):** 5 = `1.3.0` in all 3 version
  fields (`plugin.json`, marketplace.json `metadata.version`, marketplace.json
  `plugins[0].version`); `claude plugin validate .` passes; all 8 spec verification checks
  run in sequence with pasted real output in `PROGRESS.md`; every commit in the goal is
  conventional-prefix, no em dashes, no attribution lines, on `charles-fork` only. 1 = any
  version field mismatched, validate fails, any of the 8 checks not actually run/pasted, or
  any commit violates the message rules.

PASS threshold: mean score ≥ 4.0/5.0 (matches HARNESS.md CHECKER_BRIEF).

## Turn Budget
Phase 1: ~18 turns (write failing tests first, implement parser + CLI, verify against the
  `taste-gate-v1-2-0` fixture which has no `## Run Metrics` section)
Phase 2: ~10 turns (insert template block, add matching reference-doc section, grep-verify
  field-list parity)
Phase 3: ~12 turns (write >= 25-line grill-gate section before "The mapping", wire the
  Branch S paragraph mention)
Phase 4: ~10 turns (version bump, run + paste the full 8-check sweep, fix any failures,
  dogfood this run's own `## Run Metrics` into HANDOFF.md)
Total: ~50 (leaves ~10 of the goal's 60-turn cap for checker spawn + one fix cycle if the
  first pass ITERATEs; the eval loop allows up to 3 cycles total, drawing on this buffer)

## Dependencies
Sequential: Phase 4 depends on Phases 1, 2, AND 3 all complete — the full verification
sweep and the version-bump commit require every prior artifact in place (the sweep
re-runs checks against Phase 1's script, Phase 2's grep counts, and Phase 3's grep counts
simultaneously).
Parallel-safe: Phase 1 (`scripts/run-metrics.ts` + its test file) is disjoint from Phases
2 and 3 in files touched and has no ordering dependency on either.
Caution: Phases 2 and 3 both edit `skills/write-goal-prompt/SKILL.md` (Phase 2 touches the
Phase 2 goal-condition template near `[MORNING REPORT]`; Phase 3 touches the earlier Phase
0.5 Branch S paragraph) — different regions of the same file, not a logical dependency,
but run them in PLAN.md order (2 then 3) rather than as literally-parallel edits to avoid
one Maker pass clobbering the other's in-flight diff.

## Commit Boundaries
- Phase 1 → `feat(run-metrics): add goals-dir-parameterized aggregator with tests`
  (commit once `bun test` is green and the sandbox proof against `taste-gate-v1-2-0` is
  captured)
- Phase 2 → `docs(run-metrics): add RUN METRICS template block and report-spec section`
  (commit once both the SKILL.md block and morning-report-specs.md section are in place
  and field lists are grep-verified identical)
- Phase 3 → `docs(grill-gate): add grill gate section to spec-intake and wire SKILL.md`
  (commit once the >= 25-line section is in place before "The mapping" and SKILL.md's
  Branch S paragraph names it)
- Phase 4 → `chore(v1.3.0): bump plugin to v1.3.0 and pass verification sweep`
  (commit once all 3 version fields are updated, `claude plugin validate .` passes, the
  full 8-check sweep is pasted into PROGRESS.md, and this run's own HANDOFF.md carries its
  `## Run Metrics` section)

All commit messages: conventional prefix, no em dashes, no attribution/Co-Authored-By
lines, on `charles-fork` only — per the goal's `[CONSTRAINTS]` block.

## Guardrails (carried from the goal's [CONSTRAINTS] / [BLOCKERS])
- Quality bar: production-grade; new markdown matches the repo's reference-file style
  (model: `skills/write-goal-prompt/references/taste-gate.md`); metrics table aligned and
  scannable.
- Do not invent requirements beyond the spec — R1-R6 are exact, do not re-decide anything
  the spec locked.
- This run's own HANDOFF.md must carry the new `## Run Metrics` section built in Phase 2
  (per GOAL.md's `[RUN METRICS]` instruction) — dogfooding is a done-condition, not
  optional polish, but it is not a separate Maker phase/slice: the outer run instructions
  in GOAL.md already own writing it at run end, after Phase 2's block exists to follow.
- Never touch `master`, `~/.claude`, or anything outside this repo.
- Never run `claude plugin update` or `claude plugin install`.
- Never run `git clean`, `git reset --hard`, or `git checkout -- .` anywhere. If confused,
  stop and report rather than tidy up.
- Work only inside this repo (`/home/del13s_ubuntu/MACH4_2/loop-engineer`), branch
  `charles-fork` only.
