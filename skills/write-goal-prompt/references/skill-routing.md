# Skill Routing Reference

Used by the Harness Architect agent (Phase 1.5) to map task types to existing skills
and build the Maker's routing plan. Planner agents read this to decide which skills
to invoke per phase and in what order.

---

## Task Type → Skill Routing Table

| Task type                 | Primary skill            | Secondary skill                      | Notes                                     |
| ------------------------- | ------------------------ | ------------------------------------ | ----------------------------------------- |
| New feature (code)        | `/tdd`                   | `/feature-dev:feature-dev`           | Write failing tests first, then implement |
| Ambiguous scope           | `/to-prd`                | `/tdd` or `/feature-dev:feature-dev` | Spec before any code                      |
| New system / architecture | `/codebase-design`       | `/feature-dev:feature-dev`           | Design decision before implementation     |
| Bug investigation         | `/diagnosing-bugs`       | `/to-issues`                         | Root cause before fixing                  |
| Issue backlog             | `/to-issues`             | —                                    | Convert findings to issues                |
| Prototype / validate idea | `/prototype`             | `/tdd`                               | Prove approach before full build          |
| New skill creation        | `/write-a-skill`         | —                                    | Skill authoring skill                     |
| Content / copy            | `/cold-email-copywriter` | `/writing-shape`                     | Write → shape → verify                    |
| Goal prompt itself        | `/write-goal-prompt`     | —                                    | Recursive                                 |
| UI / frontend             | `/prototype`             | `/codebase-design`                   | Visual validate early                     |

---

## Chaining Patterns

These are ordered chains. The Planner wires them into PLAN.md as phase sequences.

### Build: Unknown Scope → Shipped Feature

```
1. /to-prd           — formalize requirements, surface ambiguity
2. /prototype        — validate approach before full build
3. /tdd              — write failing tests that encode intent
4. /feature-dev:feature-dev  — implement to green
```

Use when: user says "build X" with underspecified requirements.

### Build: Clear Scope → Shipped Feature

```
1. /tdd              — tests first (they ARE the spec)
2. /feature-dev:feature-dev  — implement
```

Use when: done criteria are already explicit and machine-verifiable.

### Investigate → Fix

```
1. /diagnosing-bugs  — root cause, reproduce, confirm
2. /to-issues        — file discrete issues from findings
3. /tdd              — tests for each bug scenario (regression prevention)
4. fix inline or via feature-dev
```

Use when: "something is broken" without known cause.

### Design First → Build

```
1. /codebase-design  — architecture decision, tradeoffs, chosen approach
2. /tdd              — tests based on the design
3. /feature-dev:feature-dev  — implementation
```

Use when: task touches system architecture, data models, or API contracts.

### Content Batch

```
1. research (nexus_search + web)
2. /cold-email-copywriter or write-goal-prompt's voice ref
3. /writing-shape    — structure and flow
4. /leadgrow:push-content — publish
```

Use when: producing external-facing copy, emails, or LinkedIn content.

---

## Routing Heuristics for Planner Agents

When mapping phases to skills, apply these in order:

1. **Code involved?** → Check for `/tdd` first. Tests encode intent — they're not optional.
2. **Scope ambiguous?** → `/to-prd` before writing a single line. Ambiguity = rework.
3. **New system or architectural decision?** → `/codebase-design` before implementation.
   Don't build until the design is decided.
4. **Bug or regression?** → `/diagnosing-bugs` first. Never fix a symptom.
5. **UI involved?** → `/prototype` before any CSS. Visual validate early.
6. **No matching skill?** → Direct implementation is fine. Note it in PLAN.md so the
   Checker knows there's no skill quality bar to reference.

---

## Skill Availability Check

Before routing to a skill, confirm it exists. Harness Architect receives the Skill Scanner
(Agent 1) output — if a skill isn't in that list, don't route to it. Fall back to:

- Tier 1: run the skill's underlying process manually (same depth, same steps)
- Tier 2: direct implementation with documented quality bar

Never route to a skill that wasn't confirmed by Agent 1. The Maker will waste turns
discovering it doesn't exist.

---

## Quality Bars by Skill

When the Maker invokes a skill, Checker rubric must encode the skill's quality bar —
not just "output file exists."

| Skill                      | Quality bar (for Checker rubric)                                                |
| -------------------------- | ------------------------------------------------------------------------------- |
| `/tdd`                     | Tests are failing before implementation; all pass after; no `skip` or `xfail`   |
| `/prototype`               | Prototype renders and shows the core interaction; no placeholder UI             |
| `/to-prd`                  | PRD has problem statement, user stories, acceptance criteria, out-of-scope list |
| `/codebase-design`         | ADR has options considered, tradeoffs, decision, consequences                   |
| `/diagnosing-bugs`         | Root cause identified with reproduction steps; not just symptoms                |
| `/feature-dev:feature-dev` | Feature works end-to-end; no TODOs in shipped paths                             |
| `/write-a-skill`           | SKILL.md has frontmatter, phases, reference files; under 100 lines              |
