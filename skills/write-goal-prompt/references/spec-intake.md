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

## Grill gate (decision point)

Before mapping the spec into a goal, decide whether the spec needs adversarial review of its
existing decisions. The grill gate attacks decisions the spec already made (the strongest
objections, the trade-offs, the alternatives rejected), then proceeds to mapping. This is
not a re-gathering of requirements — the spec is already brainstormed and locked. The grill
answers: "Does this decision set survive a challenge round, or should the spec be amended
before we build it?"

## When to grill

Answer: does this spec warrant an adversarial review of its decisions?

| Spec shape | Grill? | Rule |
| --- | --- | --- |
| Introduces a new subsystem, tool, or infrastructure component | **GRILL** | Run the adversarial procedure to harden new system boundaries |
| External-facing feature, user-visible behavior, or client spec | **GRILL** | User-facing specs must survive scrutiny before build commit |
| Decomposes to more than 5 slices, or the user explicitly asks for it | **GRILL** | Large/multi-phase specs need decision review; follow user intent |
| Small internal feature, bug fix, or refactor whose requirements are already all checkable | **SKIP** | No open decisions to attack; proceed straight to mapping |
| Ambiguous (could be either — e.g., "add a field to an internal schema") | **AMBIGUOUS** | Ask the user ONE clarifying question: "Is this feature user-visible or internal-only?" Then route on the answer. |

**Rule:** Never grill when the default is clear. For a genuinely ambiguous spec, ask the ONE question above, inline, in a single question round — then route on the answer.

## The procedure

Grilling the spec means walking its decisions adversarially:

1. **List the spec's decisions:** Read through the spec's "Decisions / Requirements" section and list each major call: "We chose framework X over Y", "We require exactly 5 slices for this", "We said this is external-facing", "We hardcoded path Z", etc.

2. **Attack each decision:** For each decision, state the strongest objection — the best argument for the opposite choice. What breaks if we flip it? What cost do we pay for this tradeoff?

3. **Recommend keep or change:** For each decision, respond to the objection with a choice: "Keep" (the spec is right, the objection is outweighed by other constraints) or "Change" (amend the spec inline to reflect a new approach).

4. **Amend the spec inline:** If recommending a change, propose new text inline and present it to the user. The user decides: approve, edit, or revert.

5. **Proceed to mapping:** Once all decisions are reviewed and settled, continue to the mapping section.

**Load-bearing constraint:** This procedure attacks *existing* decisions only and NEVER re-gathers requirements. No re-interviewing the user about what the feature should do. If the spec is incomplete, bounce it per "The gate" below (missing done conditions = back to brainstorm). The grill is not a second design phase; it's a decision checkup.

## Tooling

When available, use installed skills to run the procedure:
- `grill-me` — lightweight, single-decision mode; use for quick decision reviews
- `grill-with-docs` — full procedural mode with spec-anchored objections; use for high-stakes decisions

If neither skill is available, run the procedure inline: list decisions, state strongest objections, recommend keep/change, amend inline, ask user for ruling, proceed to mapping.

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
