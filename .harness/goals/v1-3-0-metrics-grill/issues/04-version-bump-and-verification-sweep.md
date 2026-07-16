# 04 - Version bump, plugin validation, and full verification sweep
Status: done
Blocked by: 01, 02, 03

## Parent
Spec: docs/superpowers/specs/2026-07-17-run-metrics-grill-gate.md (R6 + Verification plan (mechanical))

## What to build
Bump the version to `1.3.0` in `.claude-plugin/plugin.json` and in both version fields
of `.claude-plugin/marketplace.json` (`metadata.version` and `plugins[0].version`).
Confirm `claude plugin validate .` prints "Validation passed". Run the full 8-check
verification plan from the spec exactly as written, end to end, and paste every
command's actual output into PROGRESS.md — fix anything that fails before marking this
slice done. Verify commit hygiene across every commit made in this goal (conventional
prefix, no em dashes, no attribution lines, all on `charles-fork`). Confirm this run's
own HANDOFF.md carries the `## Run Metrics` section built in slice 02 (per GOAL.md's
`[RUN METRICS]` instruction — the run is its own first datapoint; this is the outer run
loop's responsibility at run end, this slice just confirms it landed before final
commit).

## Acceptance criteria
- `grep -c '"version": "1.3.0"' .claude-plugin/plugin.json` → 1 — verification check 7.
- `.claude-plugin/marketplace.json` has `1.3.0` in both `metadata.version` and
  `plugins[0].version`.
- `claude plugin validate .` → prints "Validation passed" — verification check 2.
- All 8 verification-plan checks from the spec run in sequence with pasted output in
  PROGRESS.md:
  1. `bun test` → exit 0, all pass, including >= 3 new run-metrics tests.
  2. `claude plugin validate .` → prints "Validation passed".
  3. `grep -c '\[RUN METRICS\]' skills/write-goal-prompt/SKILL.md` → 1.
  4. `grep -c '## Run Metrics section' skills/write-goal-prompt/references/morning-report-specs.md` → 1.
  5. `bun scripts/run-metrics.ts` from repo root → exit 0 AND output contains
     `taste-gate-v1-2-0` marked `(no metrics)`.
  6. `grep -c '## Grill gate (decision point)' skills/write-goal-prompt/references/spec-intake.md` → 1;
     `grep -c 'Grill gate' skills/write-goal-prompt/SKILL.md` → >= 1.
  7. `grep -c '"version": "1.3.0"' .claude-plugin/plugin.json` → 1.
  8. `grep -cE 'TODO|TBD' scripts/run-metrics.ts skills/write-goal-prompt/references/spec-intake.md` → 0 per file.
- `git log` on `charles-fork` for this goal's commits shows conventional-prefix
  messages, no em dashes, no `Co-Authored-By` or attribution lines.
- HANDOFF.md for this run (`.harness/goals/v1-3-0-metrics-grill/HANDOFF.md`) contains a
  `## Run Metrics` section with all 11 fields populated (dogfood check — not a spec
  verification-plan number, but explicit in GOAL.md's done criteria).

## Skill routing
direct - .claude-plugin/plugin.json + .claude-plugin/marketplace.json + PROGRESS.md (verification sweep output)
