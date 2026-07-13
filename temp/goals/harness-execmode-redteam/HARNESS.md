# HARNESS.md — harness-execmode-redteam

Static-artifact goal (docs + a Workflow JS script + a TS diagnosis). No running app →
**skip Prover, go straight to Checker.**

## PLANNER_BRIEF

Read first, in order:
1. `README.md` (4-agent architecture, canonical-source rule)
2. `skills/write-goal-prompt/SKILL.md` (canonical repo copy — drifted from the global copy)
3. `skills/write-goal-prompt/references/skill-routing.md`
4. `scripts/setup-harness.ts` (the setup system under diagnosis)
5. The two existing DRAFTS — verify and harden, do not trust blindly:
   - `skills/write-goal-prompt/references/execution-mode-routing.md`
   - `.claude/workflows/red-team.js`

Phases (sequential, no inter-phase parallelism needed — all touch shared skill files):
1. **Router** — harden `execution-mode-routing.md`; verify it covers 4 modes, decision
   order (first-match-wins), interval guidance, and nesting. Cross-check against the two
   Anthropic articles (loops; dynamic workflows).
2. **Red-team** — harden `.claude/workflows/red-team.js`; confirm valid JS, `meta.name`,
   4 parallel roles, barrier + worst-first merge, schema validation.
3. **First-principles** — write `references/first-principles-generation.md`; wire the
   directive into `.claude/agents/harness-planner.md` (decomposition) and
   `.claude/agents/harness-maker.md` (reasoning-before-code).
4. **Setup diagnosis** — write `docs/setup-system-diagnosis.md`. Must name the
   prover-not-installed defect at `scripts/setup-harness.ts:156` and the smoke-test gap.
5. **Wire + sync** — add an "Execution Mode Routing" section to the canonical SKILL.md
   pointing at the new ref + red-team; sync changed files repo→global
   (`~/.claude/skills/write-goal-prompt/`, `~/.claude/workflows/`, `~/.claude/agents/`).

Firstmate: grep confirmed zero matches in files + git history. Phase 0 = run
`git log --all -i --grep=firstmate` and `grep -ri firstmate .` once, record "nothing to
revert" with the empty output as proof. Do NOT alter history.

Turn budget: ~6 turns/phase, 5 reserved for checker. ~35 total.

## MAKER_ROUTING

- Phase 1: direct — `references/execution-mode-routing.md`
- Phase 2: direct — `.claude/workflows/red-team.js`
- Phase 3: direct — `references/first-principles-generation.md` + planner/maker edits
- Phase 4: direct — `docs/setup-system-diagnosis.md`
- Phase 5: direct — `SKILL.md` edit + sync copies
(No external skill matches; this is harness-internal authoring. Commit at each phase boundary.)

## CHECKER_BRIEF

Evaluate these artifacts (fresh context — you did not write them):
- `skills/write-goal-prompt/references/execution-mode-routing.md`
- `.claude/workflows/red-team.js`
- `skills/write-goal-prompt/references/first-principles-generation.md`
- `docs/setup-system-diagnosis.md`
- The SKILL.md "Execution Mode Routing" section

Dimensions (1-5, cite file:line for every score):
- **Router correctness**: 5 = decision order is unambiguous, first-match-wins, the 4
  modes + signals match the two articles; 1 = modes blur, no clear router.
- **Red-team validity**: 5 = parses as JS, 4 distinct attack angles, real barrier +
  worst-first dedup, schema-validated findings; 1 = won't run or roles are redundant.
- **First-principles wiring**: 5 = directive present AND actually referenced in both
  planner and maker agent files; 1 = doc only, not wired.
- **Diagnosis teeth**: 5 = names the prover-install defect with line evidence, lists
  generalization + concrete prioritized fixes; 1 = vague summary, no defects found.

PASS threshold: mean ≥ 3.5/5.0. Write scores + verdict (PASS/ITERATE/PLATEAU) to CYCLE_LOG.md.
