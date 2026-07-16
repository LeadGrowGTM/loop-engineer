# 04 - Audit the existing shipper integration
Status: ready-for-agent
Blocked by: none

## Parent
SPEC.md Item 4 (no PRD.md exists — traced directly to SPEC.md).

## What to build
Read-only audit first, then fix ONLY genuine gaps citable with `file:line` — do not
rewrite what already works. Already in the working tree, uncommitted, and deliberately
kept: `.claude/agents/harness-shipper.md`, `SHIP_BRIEF` + stage 5 in
`skills/write-goal-prompt/SKILL.md`, Phase 4 in `references/subagent-harness.md`,
`AGENT_FILES` in `scripts/setup-harness.ts` + its tests. This Planner already located
several stale counts left behind by the five-stage change — verify and fix each on
sight, don't re-derive from scratch:

- `skills/write-goal-prompt/docs/ARCHITECTURE.md:3` — "Three agents. Strict roles. No
  overlap." — stale; the repo has five harness agents (Planner, Maker, Prover, Checker,
  Shipper).
- `skills/write-goal-prompt/docs/ARCHITECTURE.md:9-13` — the Agents table lists only
  Planner, Maker, Checker — missing rows for `harness-prover.md` and `harness-shipper.md`.
- `skills/write-goal-prompt/docs/ARCHITECTURE.md:48` — Depth Budget table, depth-0 row
  reads "Spawns Planner + Maker + Checker" — missing Prover and Shipper.
- `skills/write-goal-prompt/docs/ARCHITECTURE.md:63-72` — the "Loop Flow" ASCII diagram
  has no Prover step at all (Shipper is at least mentioned in the prose at lines 76-80,
  just not in the diagram itself).
- `skills/write-goal-prompt/references/subagent-harness.md:17` — "The 4 harness agents
  are defined..." with a table of exactly 4 rows (Planner, Maker, Prover, Checker) —
  missing the `harness-shipper.md` row; should read "5" and add the row.
- `skills/write-goal-prompt/references/subagent-harness.md:96,98` — heading "## The
  3-Phase Runtime Harness" and text "Every goal prompt runs three logical phases" — stale;
  the body directly below enumerates Phase 1 Planner, Phase 2 Maker, Phase 3 Checker,
  Phase 4 Ship (four phases as written, and doesn't even list Prover as a phase despite
  the agent file existing) — needs the heading/count corrected and Prover accounted for
  (as the conditional running-app-only phase it already is elsewhere in HARNESS.md/
  SKILL.md).
- `skills/write-goal-prompt/docs/index.md:9` — describes `subagent-harness.md` as
  "3-agent loop design, depth budget, checker independence rules" — stale one-line summary.

Also check `EXAMPLES.md` for the same class of stale count before ruling it out — its
"Four-stage execution" list (line 65) omits Prover, but that specific worked example has
no running app, so Prover is legitimately N/A there; confirm this is NOT a gap (Prover
being absent from a non-running-app example is correct, not stale) before leaving it
untouched.

Do not touch `AGENT_FILES` in `scripts/setup-harness.ts` (`scripts/setup-harness.ts:
29-35`) — it already lists all five agent files including `harness-shipper.md`; this part
already works.

Every fix must cite the `file:line` it corrects. If the audit finds nothing beyond what's
listed above, say so — do not invent additional changes to look thorough.

## Acceptance criteria
- Each cited stale count above is corrected in place (agent count, phase count, table
  rows, one-line summaries) without a wholesale rewrite of any file.
- `AGENT_FILES` and its tests in `scripts/setup-harness.ts` / `setup-harness.test.ts` are
  left untouched (already correct).
- `EXAMPLES.md` is either left untouched (if the audit confirms Prover's absence there is
  correct) or fixed with a cited reason if genuinely stale.
- Every fix in the diff traces to a specific `file:line` citation recorded in PROGRESS.md.
- `git diff --stat` on the shipper-related files shows only the cited fixes — no
  unrelated rewrites.
- Feeds the CHECKER_BRIEF artifact list's "git diff on the shipper-related files" entry
  as a scope-discipline check (per PLAN.md, this phase has no dedicated scored rubric
  dimension — the diff is reviewed for restraint, not scored 1-5).

## Skill routing
direct — read-only audit; fixes land in `references/subagent-harness.md`,
`docs/ARCHITECTURE.md`, `docs/index.md` (only where cited above); audit notes recorded in
`PROGRESS.md`
