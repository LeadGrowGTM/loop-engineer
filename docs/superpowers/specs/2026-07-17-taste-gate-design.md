# Taste gate v1.2.0 — design spec (minimal scope)

- **Date:** 2026-07-17
- **Status:** approved (co-designed in Slack by Mitchell + Charles, 2026-07-17; scope locked: minimal gate)
- **Branch:** charles-fork
- **Principle:** taste compiles into the eval rubric at goal-authoring time via a human-approved decision gate. Never a fat md dumped into every context. Router recommends, user resteers.

## Goal

Unattended goal runs currently verify correctness but not "is this what WE would have built." Add a taste layer: personal + repo taste files, and a decision gate in write-goal-prompt that turns approved taste entries into checker rubric criteria before the run starts.

## Requirements

### R1. Personal taste library seeding
- `setup-harness.ts install` seeds `~/.claude/taste/` with exactly 4 template files when the directory or a file is missing: `ux-taste.md`, `ui-taste.md`, `copy-taste.md`, `opinions.md`.
- NEVER overwrite an existing file (existing content byte-preserved on re-run; idempotent).
- Each template contains: a one-line header, the format rule ("one rule per bullet, each rule checkable, each with a concrete example — no essays"), and exactly 2 commented example rules.
- The seeding logic is an exported, unit-testable function taking the home dir as a parameter (no hardcoded `$HOME` inside the function).

### R2. Repo taste seeding
- `setup-harness.ts install <target>` also seeds `<target>/.harness/taste.md` (template with sections: `## Design & UX`, `## Code opinions`, `## Voice`) when absent; never overwrites.

### R3. The decision gate (write-goal-prompt)
- New reference `skills/write-goal-prompt/references/taste-gate.md` (>= 60 lines) containing:
  - Router-with-default: goal shape → taste-relevant? UI/UX/frontend/design/copy/email/content/client-facing → YES; backend/infra/migration/data/tooling-mechanical → NO; ambiguous → ask the user ONE question. Never ask when the default is clear.
  - Layer selection when YES: interface goals load `ux-taste.md` + `ui-taste.md`; content/copy goals load `copy-taste.md`; `opinions.md` loads for every YES; repo `.harness/taste.md` always loads for every YES.
  - Approval step: present the candidate entries as a table (entry, source file, recommended keep/drop) for one-glance approve/edit/drop. Front-load + resteer.
  - Compilation: approved entries become (a) additional "Done means" quality criteria and/or (b) `[CONSTRAINTS]` must-NOT-touch lines in the goal prompt, plus a `Taste applied: <entry list or "none">` audit line inside `[TASK]`.
  - Precedence: client brand > repo > personal for client-facing goals; personal first for internal goals.
  - Nexus hook (documented only, non-blocking): client-facing goal in a client-scoped folder → also query `nexus_context` for brand truth; absence or failure never blocks authoring.
- SKILL.md wiring: a taste-gate step referenced after the Phase 0.5 clarity gate resolution and before Phase 2 formatting, applying to BOTH grilled and spec-mode goals; plus one row in the SKILL.md references table and one row in `docs/index.md`.

### R4. Tests
- New bun tests covering R1/R2: seeds 4 personal files when missing; preserves a pre-existing modified file byte-for-byte on re-run; seeds repo taste.md; full suite passes.

### R5. Release hygiene
- Version `1.2.0` in `.claude-plugin/plugin.json` and both version fields of `.claude-plugin/marketplace.json`.
- `claude plugin validate .` passes.
- Conventional commit messages, no em dashes, no attribution lines. Commits on `charles-fork` only.

## Verification plan (mechanical)

1. `bun test` → exit 0, all pass, including >= 3 new taste-seeding tests.
2. `claude plugin validate .` → prints "Validation passed".
3. `wc -l < skills/write-goal-prompt/references/taste-gate.md` → >= 60.
4. `grep -c 'taste-gate.md' skills/write-goal-prompt/SKILL.md` → >= 2 (gate wiring + references table).
5. `grep -c 'taste-gate.md' skills/write-goal-prompt/docs/index.md` → 1.
6. `grep -cE 'TODO|TBD' scripts/setup-harness.ts skills/write-goal-prompt/references/taste-gate.md` → 0 per file.
7. Sandbox proof: `HOME=$(mktemp -d)`, `T=$(mktemp -d)`, `bun scripts/setup-harness.ts install $T` → `ls $HOME/.claude/taste | wc -l` = 4 AND `test -f $T/.harness/taste.md`; write a sentinel line into `$HOME/.claude/taste/opinions.md`, re-run install, sentinel still present.
8. `grep -c '"version": "1.2.0"' .claude-plugin/plugin.json` → 1.

## Out of scope (deliberate)

- Live Nexus integration (hook is documented text only) — nexus needs sorting first.
- kb/signals learning write-back (v1.3, after real override data exists from runs).
- `interests.md` (nothing consumes it yet).
- Character/personality file; any changes to superpowers.
- Running `claude plugin update` as part of the build (release to the live install happens after human review of the morning report).
