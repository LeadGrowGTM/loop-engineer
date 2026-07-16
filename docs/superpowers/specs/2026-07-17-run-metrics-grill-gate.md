# Run metrics + grill gate v1.3.0 — design spec

- **Date:** 2026-07-17
- **Status:** approved (Charles, 2026-07-17; instrumentation commissioned, grill gate validated in discussion)
- **Branch:** charles-fork
- **Theme:** chain hardening. (a) Every goal run leaves quantitative evidence — the accumulating benchmark for the "2 days of work in 2 hours" claim. (b) Specs get adversarially attacked before they freeze into goals.

## Requirements

### R1. [RUN METRICS] block in the goal template
- `skills/write-goal-prompt/SKILL.md` Phase 2 template gains a `[RUN METRICS]` block (after `[MORNING REPORT]`) instructing the goal agent: at run end, append a `## Run Metrics` section to HANDOFF.md with EXACTLY these fields, one per line, `key: value` format: `started` (ISO-8601 from `date -Is`, captured at turn 1), `finished` (same, at run end), `wall_clock_minutes`, `turns_used`, `turn_budget`, `cycles_used`, `max_cycles`, `reward_final`, `reward_per_cycle` (comma-separated), `commits` (count this run), `tests_delta` (e.g. "25->31").

### R2. Morning-report spec section
- `skills/write-goal-prompt/references/morning-report-specs.md` gains a `## Run Metrics section` describing the same field list verbatim (single source the checker can diff against).

### R3. Metrics aggregator script
- New `scripts/run-metrics.ts` (bun): scans `<repo>/.harness/goals/*/HANDOFF.md` for `## Run Metrics`, prints one aligned table row per run: slug, started, wall_clock_minutes, turns_used, cycles_used, reward_final. Runs missing the section are listed as `<slug>  (no metrics)` and never crash the script; exit 0 either way.
- Parsing lives in an exported function taking the goals dir as a parameter (unit-testable, no hardcoded repo path inside it).

### R4. Tests
- New bun tests: (a) fixture HANDOFF with a full metrics section parses to the expected values; (b) HANDOFF without the section is reported as metrics-missing, not an error; (c) field list in the parser matches R1's field names exactly. Full suite passes.

### R5. Grill gate in spec-intake (Branch S)
- `skills/write-goal-prompt/references/spec-intake.md` gains a `## Grill gate (decision point)` section, >= 25 lines, placed BEFORE "The mapping":
  - Router-with-default table: GRILL when the spec introduces a new subsystem, is external/client-facing, decomposes to more than 5 slices, or the user asks; SKIP silently for small internal features whose requirements are already all checkable; ambiguous → ask ONE question. Rule line: "Never grill when the default is clear."
  - Procedure: walk the spec's decisions one at a time, adversarially — for each, state the strongest objection and a recommended keep/change; amend the spec inline with the user's rulings; then proceed to mapping. Attacks existing decisions only; NEVER re-gathers requirements (no double interview).
  - Tooling note: prefer the installed `grill-me` / `grill-with-docs` skills when present; otherwise run the procedure inline.
- `skills/write-goal-prompt/SKILL.md` Branch S paragraph (Phase 0.5 spec-mode text) mentions the grill gate by the exact phrase "Grill gate" with a pointer to spec-intake.md.

### R6. Release hygiene
- Version `1.3.0` in `.claude-plugin/plugin.json` and both version fields of `.claude-plugin/marketplace.json`; `claude plugin validate .` passes; conventional commits, no em dashes, no attribution; `charles-fork` only.

## Verification plan (mechanical)

1. `bun test` → exit 0, all pass, including >= 3 new run-metrics tests.
2. `claude plugin validate .` → prints "Validation passed".
3. `grep -c '\[RUN METRICS\]' skills/write-goal-prompt/SKILL.md` → 1.
4. `grep -c '## Run Metrics section' skills/write-goal-prompt/references/morning-report-specs.md` → 1.
5. `bun scripts/run-metrics.ts` from repo root → exit 0 AND output contains `taste-gate-v1-2-0` marked `(no metrics)` (that run predates instrumentation).
6. `grep -c '## Grill gate (decision point)' skills/write-goal-prompt/references/spec-intake.md` → 1; `grep -c 'Grill gate' skills/write-goal-prompt/SKILL.md` → >= 1.
7. `grep -c '"version": "1.3.0"' .claude-plugin/plugin.json` → 1.
8. `grep -cE 'TODO|TBD' scripts/run-metrics.ts skills/write-goal-prompt/references/spec-intake.md` → 0 per file.

## Out of scope (deliberate)

- Learning write-back (now v1.4, still blocked on override data).
- Retrofitting metrics into past runs' HANDOFFs (the aggregator tolerates their absence instead).
- Live nexus integration; benchmarking-loop first real run; any superpowers changes.
- Running `claude plugin update` during the build (release after human review).
