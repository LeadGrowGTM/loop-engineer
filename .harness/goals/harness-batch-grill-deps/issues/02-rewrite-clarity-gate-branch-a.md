# 02 - Rewrite clarity-gate Branch A
Status: ready-for-agent
Blocked by: 01

## Parent
SPEC.md Item 2 (no PRD.md exists — traced directly to SPEC.md).

## What to build
Rewrite `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\skills\write-goal-prompt\references\clarity-gate.md`
Branch A section (currently lines 5-40: "Branch A - grill (single-session tasks with some
ambiguity)") so it ends up with **exactly two** paths and a crisp "which do I pick" test:

- **`/grilling`** — deep interactive depth, one question at a time. Use when ambiguity is
  deep or decisions depend on each other. (This path already exists in the current file,
  lines 9 — keep/tighten it.)
- **`batch-grill-me`** — multi-round frontier batches. Preserve the real upstream mechanic
  verbatim in spirit (do not flatten it): model the work as a design tree; the frontier is
  every decision whose prerequisites are settled; ask the whole frontier in one round,
  numbered, each with a recommended answer; wait for answers; answers reshape the tree, so
  recompute the frontier and ask the next round; sub-agents find *facts* while the
  *decisions* stay the user's; done when the frontier is empty.

**DELETE** the old ad-hoc batch-question Sonnet agent prompt entirely (currently lines
11-40 of clarity-gate.md: the "Batch mode: spawn 1 Sonnet agent..." block and its embedded
prompt). It is superseded, not deprecated — leave **zero** surviving references to it
anywhere in the skill (grep the whole `skills/write-goal-prompt/` tree, not just this file).

Then update the Phase 0.5 routing table in
`C:\Users\mitch\Everything_CC\tools\agent\agent-harness\skills\write-goal-prompt\SKILL.md`
(currently lines 98-103, the `| Signal | Route |` table) to match exactly — the "Single-
session scope with some ambiguity" row currently reads "grill — `/grilling` for deep
interactive depth, or the batch-question agent for one `AskUserQuestion` round (Branch A)"
and must instead name `/grilling` and `batch-grill-me` as the two Branch A paths.

Do not touch Branch B (wayfinder) — out of scope for this slice.

## Acceptance criteria
- `references/clarity-gate.md` Branch A presents exactly two paths (`/grilling`,
  `batch-grill-me`) with an explicit "which do I pick" test between them.
- `grep -rc "batch-question" skills/write-goal-prompt/` returns `0` across every file in
  the skill tree (zero surviving references to the deleted agent).
- SKILL.md's Phase 0.5 routing table row for Branch A names `/grilling` and
  `batch-grill-me` and matches clarity-gate.md's two paths exactly.
- The batch-grill-me description preserves the frontier mechanic: design tree → frontier
  = prerequisites-settled → whole frontier per round, numbered, recommended answer each →
  wait → recompute → sub-agents find facts, user makes decisions → done when frontier
  empty. Not flattened to "ask several questions at once."
- Traces to CHECKER_BRIEF dimensions 1 (Clarity-gate coherence) and 2 (Frontier mechanic
  fidelity): dimension 1's 5 = exactly two paths + crisp test + zero dangling references +
  table match; dimension 2's 5 = full mechanic preserved, 1 = reduced to "ask several
  questions at once."

## Skill routing
direct — `skills\write-goal-prompt\references\clarity-gate.md` + `skills\write-goal-prompt\SKILL.md` (Phase 0.5 table)
