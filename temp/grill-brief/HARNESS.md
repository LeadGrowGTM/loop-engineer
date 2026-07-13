# HARNESS.md — grill-me + brief

Task working dir: C:\Users\mitch\Everything_CC\agent-harness

## PLANNER_BRIEF

Context files to read first:
- `skills/write-goal-prompt/SKILL.md` — current skill structure (phases 0-2.5)
- `.claude/agents/harness-planner.md` — current planner agent
- `skills/write-goal-prompt/references/subagent-harness.md` — harness reference doc

Two independent features — can plan as sequential phases:
- Phase 1: Grill Me (SKILL.md only)
- Phase 2: BRIEF.md (planner.md + subagent-harness.md + sync to global + Everything_CC)

Phase 2 depends on Phase 1 (numbering context). No parallel-safe phases.

Turn budget split: Phase 1 ~4 turns, Phase 2 ~5 turns. Leave 5 for checker.

## MAKER_ROUTING

Phase 1: Grill Me — direct — artifact: `skills/write-goal-prompt/SKILL.md` (edited)
Phase 2: BRIEF.md — direct — artifacts: `.claude/agents/harness-planner.md` (edited), `skills/write-goal-prompt/references/subagent-harness.md` (edited or created), global + EC sync

## PROVER_BRIEF

N/A — static artifact goal. No running app.

## CHECKER_BRIEF

Artifacts to evaluate:
- `skills/write-goal-prompt/SKILL.md`
- `.claude/agents/harness-planner.md`
- `skills/write-goal-prompt/references/subagent-harness.md`

Rubric dimensions (1-5 each):

**Grill me placement (1-5):**
5 = Phase 0.5 is clearly after Phase 0 / before Phase 1, has its own header, spawns Haiku agent to generate questions, uses AskUserQuestion in one call, answers feed Phase 1, skip logic documented
1 = Grill me exists but is in wrong position, missing AskUserQuestion, or overwrites intake rather than feeding it

**Grill me question quality spec (1-5):**
5 = Questions are dynamic (generated from task context, not hardcoded), focused on 3-5 scope/criteria/risk targets, spec says model should vary questions not use fixed list
1 = Fixed hardcoded question list, or no guidance on what to ask about

**BRIEF.md in planner (1-5):**
5 = Planner writes BRIEF.md as first artifact (before PLAN.md), format specified (problem + product success criteria + out of scope), path returned in output, PLAN.md still written second
1 = BRIEF.md mentioned but no format, or written after PLAN.md, or no path returned

**Sync completeness (1-5):**
5 = harness-planner.md updated in all 3 locations: agent-harness/.claude/agents/, Everything_CC/.claude/agents/, ~/.claude/agents/
1 = Only one location updated

**Reference doc (1-5):**
5 = subagent-harness.md documents BRIEF.md format with example, cross-references planner
1 = Not updated or format not specified

PASS threshold: mean >= 3.5/5.0

## LOOP_TRACKER

## Loop Tracker
> Update this file as you complete each step. Check off items in order.

### Planner
- [x] HARNESS.md read
- [x] skill-routing.md read
- [x] PLAN.md written: `<path>`

### Cycle 1
- [x] Maker: Phase 1 (Grill Me) — artifact: `C:\Users\mitch\Everything_CC\agent-harness\skills\write-goal-prompt\SKILL.md` — commit: `6286d32`
- [x] Maker: Phase 2 (BRIEF.md) — artifact: `C:\Users\mitch\Everything_CC\agent-harness\.claude\agents\harness-planner.md` — commit: `cec591d` (agent-harness), `d731359` (Everything_CC sync)
- [x] Mechanical gate: passed
- [x] Prover: N/A — static artifact goal
- [x] Checker: CYCLE_LOG.md written: `C:\Users\mitch\Everything_CC\agent-harness\temp\grill-brief\CYCLE_LOG.md`
- [x] Reward signal: 4.8/5.0 (threshold: 3.5/5.0)
- [x] Verdict: PASS

### Cycle 2 (if ITERATE)
- [ ] Fix target: <weakest dimension from Cycle 1>
- [ ] Maker: changes applied — commit: `<SHA>`
- [ ] Mechanical gate: passed
- [ ] Prover: N/A
- [ ] Checker: CYCLE_LOG.md updated
- [ ] Reward signal: __/5.0
- [ ] Verdict: PASS / ITERATE / PLATEAU

### Final
- [ ] HANDOFF.md written: `<path>`
