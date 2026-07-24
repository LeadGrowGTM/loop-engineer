# 03 - Write docs/DEPENDENCIES.md + pointers
Status: ready-for-agent
Blocked by: 01, 02

## Parent
SPEC.md Item 3 (no PRD.md exists — traced directly to SPEC.md).

## What to build
Write `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\docs\DEPENDENCIES.md`: one
table, tiers **Required** (loop breaks without it) | **Optional** (degrades gracefully —
state *how*) | **Bundled** (shipped by this repo). Columns: dependency · tier · what it
does · install/verify command · what breaks without it.

Cover at minimum: `tasks-axi`, `gnhf`, `treehouse`, `no-mistakes`, `lavish-axi`,
`batch-grill-me`, `grilling`, `wayfinder`, `git`/`gh`, Bun, and the bundled `harness-*`
agents + red-team workflow.

Accuracy constraints (verified facts from `scripts/setup-harness.ts` and this Planner's
read of the repo — do not contradict):
- `scripts/setup-harness.ts` seeds `.tasks.toml` and `treehouse.toml` and gitignores
  `.tmp/treehouse/` + `.gnhf-runs/` (see `install` command, `scripts/setup-harness.ts:
  169-206`), but **verifies no external binary** — no row may imply `setup-harness.ts`
  checks that `tasks-axi`, `gnhf`, `treehouse`, etc. are actually installed.
- `/grilling` resolves **ambiguously**: a local `~/.claude/skills/grilling` skill AND a
  `mattpocock-skills:grilling` plugin exist, with different descriptions. Document this
  ambiguity; do not resolve it here (SHIP_BRIEF explicitly marks it out of scope).
- `no-mistakes` is both a skill (`/no-mistakes`, invoked via the skill prompt) and a CLI
  (`no-mistakes axi ...`, the actual driver — see `~/.claude/skills/no-mistakes/SKILL.md`).
  Say so.
- gnhf must run Opus; the override lives in `~/.gnhf/config.yml`
  (`agentArgsOverride.claude` → `--model opus`, per `SKILL.md:541-552`). Never document a
  path that changes this to Sonnet/Haiku.

Add one pointer to `README.md`'s `## Installation` section (it currently names zero
external prerequisites — see `README.md:104-108`) linking to `docs/DEPENDENCIES.md`.

Add one row to the `CLAUDE.md` repo-map table (`CLAUDE.md:7-22`) for `docs/DEPENDENCIES.md`.

## Acceptance criteria
- `docs/DEPENDENCIES.md` exists with exactly one table, three tiers used correctly, and
  all five documented columns present on every row.
- Every dependency in the "cover at minimum" list has a row.
- Every Optional row states HOW it degrades (not just that it degrades).
- No row implies `setup-harness.ts` verifies an external binary.
- The `/grilling` ambiguity (local skill + plugin) is documented as unresolved, not fixed.
- The `no-mistakes` skill-vs-CLI duality is documented.
- gnhf's Opus override and its config path are stated correctly, with no suggestion of
  changing it.
- `README.md`'s `## Installation` section links to `docs/DEPENDENCIES.md`.
- `CLAUDE.md`'s repo-map table has a new row for `docs/DEPENDENCIES.md`.
- Traces to CHECKER_BRIEF dimension 3 (Dependency doc completeness and accuracy): 5 = every
  dependency has tier + real command + specific consequence, Optional rows say how they
  degrade, claims match `setup-harness.ts`; 1 = missing dependencies, invented commands, or
  tiers contradicting the code.

## Skill routing
direct (consider `/stop-slop` on the prose once drafted, per MAKER_ROUTING) — `docs\DEPENDENCIES.md` + `README.md` (`## Installation`) + `CLAUDE.md` (repo-map row)
