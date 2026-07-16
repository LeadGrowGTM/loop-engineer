# 03 - Grill gate in spec-intake.md and SKILL.md Branch S wiring
Status: done
Blocked by: none

## Parent
Spec: docs/superpowers/specs/2026-07-17-run-metrics-grill-gate.md (R5)

## What to build
Add a `## Grill gate (decision point)` section to
`skills/write-goal-prompt/references/spec-intake.md`, at least 25 lines long, placed
BEFORE the existing `## The mapping` section (currently the first `##` heading after the
file's intro). The section must contain:
1. A router-with-default table: GRILL when the spec introduces a new subsystem, is
   external/client-facing, decomposes to more than 5 slices, or the user asks; SKIP
   silently for small internal features whose requirements are already all checkable;
   AMBIGUOUS → ask ONE question. Include the literal rule line "Never grill when the
   default is clear."
2. A procedure: walk the spec's decisions one at a time, adversarially — for each, state
   the strongest objection and a recommended keep/change; amend the spec inline with the
   user's rulings; then proceed to mapping. State explicitly that this attacks existing
   decisions only and NEVER re-gathers requirements (no double interview) — this is the
   load-bearing distinction from a fresh grill.
3. A tooling note: prefer the installed `grill-me` / `grill-with-docs` skills when
   present; otherwise run the procedure inline.

Then edit `skills/write-goal-prompt/SKILL.md`'s Phase 0.5 "Spec mode (Branch S)"
paragraph (the line starting "**Spec mode (Branch S):** if the user provides a
superpowers spec/plan path...") so it mentions the grill gate by the exact phrase "Grill
gate" with a pointer to `spec-intake.md` (it already points there for the mapping — add
the phrase, do not just rely on the existing pointer).

## Acceptance criteria
- `grep -c '## Grill gate (decision point)' skills/write-goal-prompt/references/spec-intake.md` → 1
  — verification check 6, first half.
- `grep -c 'Grill gate' skills/write-goal-prompt/SKILL.md` → >= 1 — verification check 6,
  second half.
- `wc -l` between the `## Grill gate (decision point)` heading and the next `##` heading
  (`## The mapping`) → >= 25 lines.
- The new section appears BEFORE `## The mapping` in file order, not after.
- The router table has all three routes (GRILL / SKIP / AMBIGUOUS) with the exact
  conditions listed above, plus the literal sentence "Never grill when the default is
  clear."
- The procedure text states plainly that it attacks existing decisions only and never
  re-gathers requirements — a fresh-context checker can point to the exact sentence.
- `grep -cE 'TODO|TBD' skills/write-goal-prompt/references/spec-intake.md` → 0 —
  verification check 8, this file's half.
- New markdown matches the repo's reference-file style (model:
  `skills/write-goal-prompt/references/taste-gate.md`).

## Skill routing
direct - skills/write-goal-prompt/references/spec-intake.md (## Grill gate (decision point) section) + skills/write-goal-prompt/SKILL.md (Phase 0.5 Branch S paragraph)
