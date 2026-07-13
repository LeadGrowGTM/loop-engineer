Build the benchmarking loop - the harness's second goal path - in this repo
(loop-engineer). Run unsupervised.

The full spec is FROZEN and committed. Do not re-decide it. Read these first and
trace every phase to them:
- .harness/goals/harness-benchmarking-loop/PRD.md      (the product brief)
- .harness/goals/harness-benchmarking-loop/HARNESS.md  (planner/maker/checker briefs,
                                                        phase list, rubric, tracker)
- CONTEXT.md                                            (glossary - use exact terms)
- docs/adr/0001..0006                                  (the six frozen decisions)

Stack: this repo's existing conventions - bun/TypeScript for scripts and engines,
Markdown for skills/references/agent-defs/ADRs, the Workflow-DSL shape of
.claude/workflows/red-team.js for sweep/climb engines where it fits.

Build (detail + acceptance in PRD.md "In scope" and HARNESS.md phases P1-P9):
1. references/benchmark-intake.md - lazy grill branch capturing the spec
   (benchmark / measurement / search / stop, incl. rule-derived frozen-rubric path).
2. Variant ledger + snapshot store + loop registry (.harness/loops/) schemas.
3. /benchmarking-loop command - thin router: fresh spec | template name | --resume <run-id>.
4. Sweep engine - finite candidates -> run all -> rank -> pick -> write ledger.
5. Climb engine - invent -> in-bounds check -> novelty check -> measure -> keep;
   explore/exploit + Pareto + stop = first-of(target/plateau/budget), return best-so-far.
6. Independent in-bounds checker + novelty checker agent defs (fresh-context, separate
   from the inventor - reuse harness-checker discipline).
7. Measurement adapter contract: instant (command -> number) + lagging (emit job to
   external orchestrator n8n/trigger.dev/Hermes + snapshot resume; external execution
   stubbed/documented, NOT run live).
8. Benchmark auto-detect wired into references/execution-mode-routing.md + both
   front-door commands (/write-goal-prompt and /benchmarking-loop) with offer-to-switch.
9. Docs sync: CONTEXT.md links, README.md, write-goal-prompt SKILL.md routing section.

Quality bar: production-grade harness plumbing, no rewrites needed. Slots BESIDE the
existing build path (/write-goal-prompt) without regressing it. Progressive
disclosure - intake is a lazy reference, SKILL.md stays lean. Anti-gaming integrity is
non-negotiable: the in-bounds and novelty checks MUST run as agents separate from the
inventor, and measurement MUST be exogenous.

Done means (this is the stop condition):
- All P1-P9 artifacts exist at the paths in HARNESS.md MAKER_ROUTING.
- Mechanical gate green: benchmark-intake.md present; /benchmarking-loop command
  parses; the two checker agent defs exist; ledger/snapshot/registry schemas exist;
  ADR + CONTEXT cross-links resolve.
- Prover PROOF = works: the smallest instant SWEEP smoke test (two fixed candidates,
  a local no-cost benchmark command - NO paid APIs unsupervised) runs end-to-end and
  writes a variant ledger with both candidates scored + a ranked winner.
- Checker mean >= 3.5/5.0 across the four HARNESS.md CHECKER_BRIEF dimensions.

Constraints: do NOT call paid external APIs (Parallel, Serper, ad platforms)
unsupervised - use local/no-cost commands for all smoke tests. Do NOT modify the build
path's existing behavior beyond adding the routing fork. Do NOT run any lagging loop
live - author + emit-stub + snapshot only.

Deferred (do NOT build): full rule-derived rubric schema/scorer mechanics (ADR-0006
records only the guardrail); any new n8n/trigger.dev/Hermes infrastructure.
