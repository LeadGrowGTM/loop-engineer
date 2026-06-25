# Skill Routing — auto-seeded by setup-harness
# Edit this file to tune routing for this repo.
# Source of truth: LeadGrowGTM/loop-engineer skills/write-goal-prompt/references/skill-routing.md

| Task type | Primary skill | Secondary skill | Notes |
| --- | --- | --- | --- |
| New feature (code) | `/tdd` | `/feature-dev:feature-dev` | Write failing tests first, then implement |
| Ambiguous scope | `/to-prd` | `/tdd` | Spec before any code |
| New system / architecture | `/codebase-design` | `/feature-dev:feature-dev` | Design decision before implementation |
| Architecture refactor | `/improve-codebase-architecture` | `/tdd` | Systematic refactor with tests |
| Bug investigation | `/diagnosing-bugs` | `/to-issues` | Root cause before fixing |
| Blocker mid-phase | `/diagnose` | `/to-issues` | Runtime-registered — verify via available-skills before routing |
| Issue backlog | `/to-issues` | — | Convert findings to issues |
| PLATEAU escalation | `/triage` | `/to-issues` | Plateau → GitHub issue → triage queue |
| Prototype / validate idea | `/prototype` | `/tdd` | Prove approach before full build |
| New skill creation | `/write-a-skill` | — | Skill authoring |
| Content / copy | `/cold-email-copywriter` | `/writing-shape` | Write → shape → verify |
| Goal prompt authoring | `/write-goal-prompt` | — | Recursive |
| UI / frontend | `/prototype` | `/codebase-design` | Visual validate early |
| Re-plan after low score | `/zoom-out` | — | Runtime-registered — verify via available-skills before routing |
| Ship a focused change | `ship-change` workflow | — | Worktree → implement → review → PR |
