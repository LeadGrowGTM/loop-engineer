# PLAN.md

## Phases

1. Grill Me insertion — skill: direct — artifact: `skills/write-goal-prompt/SKILL.md` (edited)
2. BRIEF.md in planner — skill: direct — artifacts: `.claude/agents/harness-planner.md` (edited), `skills/write-goal-prompt/references/subagent-harness.md` (edited), global + EC sync

## Skill Routing

Phase 1 → direct — reason: editing an existing markdown skill file with a well-specified insertion point; no code, no ambiguous scope, no matching skill for doc editing
Phase 2 → direct — reason: editing agent definition files and reference docs; same class of task — well-specified format, direct file edits across known paths

## Checker Rubric

Artifacts to evaluate:
- `C:\Users\mitch\Everything_CC\agent-harness\skills\write-goal-prompt\SKILL.md`
- `C:\Users\mitch\Everything_CC\agent-harness\.claude\agents\harness-planner.md`
- `C:\Users\mitch\Everything_CC\agent-harness\skills\write-goal-prompt\references\subagent-harness.md`

Dimensions (score 1-5 each):

- Grill me placement: Phase 0.5 exists with its own header, positioned after Phase 0 and before Phase 1, spawns a Haiku Explore agent to generate questions, uses AskUserQuestion in a single call, specifies that answers feed Phase 1 intake fields, documents skip condition (all Phase 1 fields already specified) | Phase 0.5 exists but is misplaced, missing AskUserQuestion, or overwrites intake rather than feeding it

- Grill me question quality spec: Questions are dynamic (generated from task context at runtime, not hardcoded), spec targets 3-5 focus areas (scope edges, done-criteria sharpness, overnight risks, hidden constraints), spec says model should vary questions rather than use a fixed list | Fixed hardcoded question list, or no guidance on what to ask about

- BRIEF.md in planner: harness-planner.md specifies BRIEF.md as the FIRST artifact (written before PLAN.md), format is specified with three sections (Problem 1 sentence, Success Criteria as product-level observables not technical, Out of Scope explicit exclusions), BRIEF.md path is returned in output format, PLAN.md is still written second | BRIEF.md mentioned but no format, written after PLAN.md, or no path returned in output

- Sync completeness: harness-planner.md updated in all 3 locations — `agent-harness/.claude/agents/`, `C:\Users\mitch\Everything_CC\.claude\agents\`, `~/.claude/agents/` | Only one location updated

- Reference doc: `subagent-harness.md` documents BRIEF.md format with example, cross-references harness-planner | Not updated or format not specified

PASS threshold: mean score >= 3.5/5.0

## Turn Budget

Phase 1 (Grill Me): ~4 turns
Phase 2 (BRIEF.md): ~5 turns
Total: ~9 turns (leave 5 for checker)

## Dependencies

Sequential: Phase 1 must complete before Phase 2 — Phase 2 edits harness-planner.md which references the skill structure; numbering context from Phase 1 informs Phase 2 wording
Parallel-safe: none
