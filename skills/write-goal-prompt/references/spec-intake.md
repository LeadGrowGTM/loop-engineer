# Spec Intake — Branch S (superpowers spec → goal, no grill)

Chains an interactive design loop into an unattended goal loop. When a brainstormed
spec already exists, the grill's questions are already answered — re-interviewing the
user is waste. This branch converts the spec into the goal prompt directly.

## When this branch fires

- The user provides a spec or plan path (`docs/superpowers/specs/*.md`, `docs/superpowers/plans/*.md`), or
- says "from the spec" / "use the spec we brainstormed" — then locate the newest file under
  `docs/superpowers/specs/` in `$PROJECT_ROOT` and confirm the filename with the user in one line.

Read the spec (and the plan, if one exists for the same topic) before doing anything else.
In spec mode, **never re-ask a question the spec answers.** Only NEW ambiguities discovered
during mapping may be asked, batched into at most one `AskUserQuestion` round.

## The mapping

| Spec section | Goal prompt part | Rule |
| --- | --- | --- |
| Goal / Overview | **Task** | One sentence, verbatim intent |
| Decisions / Requirements | **Done criteria** | One checkable bullet per requirement; copy exact values (versions, counts, paths, thresholds) verbatim |
| Verification plan / How to test | **[EVAL LOOP]** | Test commands → mechanical gate (binary, seconds); quality claims → qualitative gate dimensions; the spec's acceptance line → done condition |
| Plan tasks (`- [ ]` checkboxes) | **Phase slices** (`issues/NN-<slug>.md`) | One plan Task = one slice, preserving order and each Task's Interfaces block. No plan file → derive 3-7 slices from requirement clusters |
| Out of scope / Deliberately left | **Blockers / must-NOT-touch** | Verbatim |
| Tech stack / Global constraints | **Tech/Stack + Constraints** | Verbatim, including commit/message rules |

Everything downstream is unchanged: the output is the standard goal prompt, and
Planner/Maker/Prover/Checker consume it exactly as in a grilled goal.

## The gate (non-negotiable)

A done bullet is **checkable** when a fresh-context Checker can verify it with a command,
a file/grep existence test, or a numeric threshold — no human judgment, no "looks right".

After mapping, count the requirements that produced checkable bullets:

- **All checkable** → proceed to Phase 1 with the mapped fields pre-filled.
- **Any unverifiable requirement** → STOP. Do not launder vagueness into a goal. Return the
  exact list of unverifiable requirements to the user with: "the spec isn't finished — these
  need measurable done-conditions before an unattended run. Finish the brainstorm on these,
  or drop them to stretch goals." A spec that can't be checked is a build-with-human task.

## Worked fixture (from this repo)

`docs/superpowers/specs/2026-07-16-loop-engineer-plugin-design.md` maps as:

- "Verification plan: bun test green after slimming" → mechanical gate: `bun test` exits 0.
- "zero placeholders remain" → mechanical gate: `grep -rn '<loop-engineer>' --include=*.md . | grep -v docs/superpowers` prints nothing.
- "all 6 agents load" → prover step: fresh-session probe lists 6 `loop-engineer:harness-*` types.
- Plan Tasks 1-9 → nine phase slices in order; "Out of scope" section → must-NOT-touch list.
- Its "Open implementation checks" section → slice-level verify steps, not done bullets (they have fallbacks).

## What this branch must NOT do

- No grill, no `/wayfinder`, no re-deriving decisions the spec locked.
- No inventing requirements absent from the spec (YAGNI applies to goals too).
- No weakening: if the spec says an exact value, the done bullet carries the exact value.
