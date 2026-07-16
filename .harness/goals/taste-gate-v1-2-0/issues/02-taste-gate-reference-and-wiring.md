# 02 - Taste gate reference + SKILL.md/docs wiring
Status: done
Blocked by: none

## Parent
Spec: docs/superpowers/specs/2026-07-17-taste-gate-design.md (R3)

## What to build
New reference file `skills/write-goal-prompt/references/taste-gate.md` (>= 60 lines,
styled like `references/spec-intake.md` — rules-with-examples, no essays) documenting:
- The router-with-default: goal shape → taste-relevant? UI/UX/frontend/design/copy/email/
  content/client-facing → YES; backend/infra/migration/data/tooling-mechanical → NO;
  ambiguous → ask the user exactly ONE question. Never ask when the default is clear.
- The layer-selection table when YES: interface goals load `ux-taste.md` + `ui-taste.md`;
  content/copy goals load `copy-taste.md`; `opinions.md` loads for every YES; repo
  `.harness/taste.md` always loads for every YES.
- The approval step: present candidate entries as a table (entry, source file,
  recommended keep/drop) for one-glance approve/edit/drop.
- Compilation: approved entries become (a) additional "Done means" quality criteria
  and/or (b) `[CONSTRAINTS]` must-NOT-touch lines, plus a `Taste applied: <entry list or
  "none">` audit line inside `[TASK]`.
- Precedence: client brand > repo > personal for client-facing goals; personal-first for
  internal goals.
- The Nexus hook, documented-text-only and non-blocking: client-facing goal in a
  client-scoped folder → also query `nexus_context` for brand truth; absence or failure
  never blocks authoring.

Then wire it into `SKILL.md`: a taste-gate step referenced after the Phase 0.5 clarity-gate
resolution and before Phase 2 formatting, applying to BOTH grilled and spec-mode goals;
plus one row in the SKILL.md references table; plus one row in `docs/index.md`.

## Acceptance criteria
- `wc -l < skills/write-goal-prompt/references/taste-gate.md` → >= 60 — verification check 3.
- The file contains, verifiably, all six R3 elements: the router-with-default rule set,
  the layer-selection table, the approve/edit/drop table format, the compilation rule
  (Done-means + `[CONSTRAINTS]` + `Taste applied:` audit line), the precedence rule, and
  the Nexus hook described as documented-text-only / non-blocking.
- `grep -c 'taste-gate.md' skills/write-goal-prompt/SKILL.md` → >= 2 (one hit for the
  gate-wiring step reference, one for the references-table row) — verification check 4.
  The gate step is positioned after the Phase 0.5 section and before the Phase 2 section,
  and its wording states it applies to both grilled and spec-mode goals.
- `grep -c 'taste-gate.md' skills/write-goal-prompt/docs/index.md` → 1 — verification check 5.
- `grep -cE 'TODO|TBD' skills/write-goal-prompt/references/taste-gate.md` → 0 —
  verification check 6, this file's half.

## Skill routing
direct - skills/write-goal-prompt/references/taste-gate.md + skills/write-goal-prompt/SKILL.md + skills/write-goal-prompt/docs/index.md
