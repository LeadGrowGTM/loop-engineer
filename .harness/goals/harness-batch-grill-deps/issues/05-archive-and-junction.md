# 05 - Archive the stale copy, then junction
Status: ready-for-agent
Blocked by: 01, 02, 03

## Parent
SPEC.md Item 5 (no PRD.md exists — traced directly to SPEC.md). Order matters: this is
last, after items 1-3 land. Junction before the edits are final risks editing through a
link whose target is still moving.

## What to build
1. **MOVE** (never delete — workspace archive-safety rule)
   `C:\Users\mitch\.claude\skills\write-goal-prompt\` to
   `C:\Users\mitch\Everything_CC\archive\2026-07-16-write-goal-prompt-stale-copy\`.
2. `cmd /c mklink /J "C:\Users\mitch\.claude\skills\write-goal-prompt" "C:\Users\mitch\Everything_CC\tools\agent\agent-harness\skills\write-goal-prompt"`
   (a junction needs no admin rights).
3. Verify both paths read byte-identical.

Constraints carried into this slice:
- Do not touch other skills in `~\.claude\skills\` — this junction is scoped to
  `write-goal-prompt` only.
- Do not edit `C:\Users\mitch\.claude\skills\write-goal-prompt\` directly at any point —
  the repo copy (`skills\write-goal-prompt\` in `agent-harness`) is the only source of
  truth, and after step 2 they are the same files anyway.
- If this constraint would be violated (e.g. the move fails, or something is already
  writing through the old path), stop this item, document it under "Constraint Block" in
  HANDOFF.md, and continue — do not force it.

This is a **filesystem operation outside the `agent-harness` repo** — both the archive
destination (`Everything_CC\archive\`) and the junction target
(`~\.claude\skills\write-goal-prompt`) sit outside this repo's git tree. No repo commit
applies to this phase alone (see PLAN.md Commit boundaries).

## Acceptance criteria
- `C:\Users\mitch\Everything_CC\archive\2026-07-16-write-goal-prompt-stale-copy\` exists
  and contains the full former contents of the stale `~/.claude` copy (moved, not
  deleted — nothing lost).
- `C:\Users\mitch\.claude\skills\write-goal-prompt` is a junction (`mklink /J`), verified
  via `fsutil reparsepoint query` or `dir` showing `<JUNCTION>`.
- `cmd /c fc /b` (or equivalent byte-diff) between
  `C:\Users\mitch\.claude\skills\write-goal-prompt\SKILL.md` and
  `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\skills\write-goal-prompt\SKILL.md`
  shows zero differences — proves the junction resolves to the live repo copy.
- No other skill under `~\.claude\skills\` was touched.
- Traces to CHECKER_BRIEF dimension 5 (Single source of truth): 5 = junction resolves,
  both paths byte-identical, stale copy archived (moved, not deleted) to the dated
  archive path, nothing edited through the `~/.claude` path; 1 = a surviving stale copy,
  a deletion, or a broken link.

## Fallback tier if blocked
Tier 1 (hard blocker → do the same process manually, same depth): if `mklink /J` fails
(e.g. permissions, existing non-empty target), do not silently downgrade to a copy —
document the exact error under "Needs My Decision" in HANDOFF.md, leave the archived
move in place (already safe — nothing deleted), and leave the old path exactly as
archived rather than improvising a symlink alternative that wasn't asked for.

## Skill routing
direct — `C:\Users\mitch\Everything_CC\archive\2026-07-16-write-goal-prompt-stale-copy\` + junction at `C:\Users\mitch\.claude\skills\write-goal-prompt`
