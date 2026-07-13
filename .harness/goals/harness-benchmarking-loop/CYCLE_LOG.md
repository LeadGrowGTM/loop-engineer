# CYCLE_LOG.md - harness-benchmarking-loop

## Cycle 1 — 2026-07-13

### Proof (running-app verification)
- Feature: works
- Evidence: The smallest instant SWEEP smoke test ran end-to-end via `bun .claude/workflows/benchmark-sweep.js .harness/goals/harness-benchmarking-loop/fixtures/sweep-smoke.spec.json` - both candidates scored (candidate-a v0001 = 0.42, candidate-b v0002 = 0.87), ranked winner = candidate-b (v0002), and a schema-valid variant ledger was written to `.harness/goals/harness-benchmarking-loop/runs/sweep-smoke/ledger.jsonl` with exactly one `is_best_so_far=true` entry, all with `cost_usd=0` (no paid APIs). Independently confirmed by reading the on-disk artifact: `.harness/goals/harness-benchmarking-loop/runs/sweep-smoke/ledger.jsonl:1-2` shows v0001 (candidate-a, reward 0.42, `is_best_so_far:false`) and v0002 (candidate-b, reward 0.87, `is_best_so_far:true`), matching `best.json:1-6` (`variant_id":"v0002","reward":0.87`).

### Dimension Scores

- **Spec fidelity: 4/5** — evidence: all six ADRs have a traceable, correctly-implemented artifact (`docs/adr/0001` → `benchmark-climb.js:121-145` `evaluateStop`/`benchmark-climb.js:81-89` `bestSoFar`; `docs/adr/0002` → `docs/benchmarking/measurement-adapter.md:10-18` cadence table + `scripts/benchmark-adapters/instant.ts` + `lagging-emit.ts`; `docs/adr/0003` → `benchmark-sweep.js` + `benchmark-climb.js:295-329` invent→in-bounds→novelty ordering; `docs/adr/0004` → `.claude/commands/benchmarking-loop.md:1-14` + `skills/write-goal-prompt/references/benchmark-intake.md:12-24`; `docs/adr/0005` → `.harness/loops/README.md` + `docs/benchmarking/snapshot-store.md`; `docs/adr/0006` → `skills/write-goal-prompt/references/benchmark-intake.md:56-70`). **But one material contradiction**: `.claude/commands/benchmarking-loop.md:78-79` states "Both engines write the append-only variant ledger ... plus best.json + snapshot.json under the run directory," yet `.claude/workflows/benchmark-climb.js` (full 437-line file, no `node:fs` import anywhere, no `writeFileSync`/`mkdirSync`/`appendFileSync` calls) never persists anything — `run()` (lines 263-372) only returns an in-memory object `{ best, cycles_done, variants_tried, ledger }`. This means a climb run, as coded, cannot satisfy the ADR-0005 resume contract (`docs/benchmarking/snapshot-store.md:65` "Load `snapshot.json` + `spec.json` + `ledger.jsonl` + `best.json` from the run dir") because nothing writes those files for climb mode. Contrast with `benchmark-sweep.js:118-174`, which does write all four files. This is a real, citable gap between doc claim and code, not a full contradiction of the ADRs themselves.

- **Anti-gaming integrity: 4/5** — evidence: in-bounds/novelty separation from the inventor is airtight and explicitly documented — `harness-inbounds-checker.md:11-16` ("You did NOT invent this variant... If you anchor on the inventor's justification, you are not a checker - you are an accomplice"), `harness-novelty-checker.md:12` ("You did NOT invent this variant. You have not seen the inventor's reasoning"), and `benchmark-climb.js:36-37` (comment: the inventor's "rationale is deliberately NOT part of what the checkers see (anti-gaming) - only the config crosses the seam"); briefs at `benchmark-climb.js:215-233` (`inboundsBrief`/`noveltyBrief`) pass only `config`/`levers`/`invariants`/ledger path, never the inventor's rationale. **But** the climb engine's measurement step does not use a deterministic exogenous function — `benchmark-climb.js:239-248` (`measureBrief`) and its call site `benchmark-climb.js:332-337` obtain the reward via `await agent(measureBrief(...))`, i.e. an LLM turn self-reports the number, rather than calling the same `measureInstant`/`parseReward` deterministic parse that `benchmark-sweep.js:94-99` and `scripts/benchmark-adapters/instant.ts:35-39` use. This is a direct tension with `docs/benchmarking/measurement-adapter.md:5-6`'s own stated invariant: "the **reward is written by the adapter, never by the model**." The comment at `benchmark-climb.js:235-238` asserts this is "the same contract," but functionally the model is the one relaying the number for climb, which is a smaller-but-real erosion of exogeneity relative to sweep's fully deterministic path.

- **Runs end-to-end: 4/5** — evidence: sweep mode is proven working end-to-end (Prover verdict above, independently cross-checked against `runs/sweep-smoke/ledger.jsonl` and `best.json` on disk — exact match). Climb's stop-logic is present and well-structured as a zero-cost self-test — `benchmark-climb.js:377-425` (`demoStopLogic`) runs 15 PASS/FAIL assertions over the pure `evaluateStop`/`isImprovement`/`paretoKeep`/`selectStrategy`/`bestSoFar` functions with no agents and no paid APIs, guarded at `benchmark-climb.js:433-435` (`--selftest` CLI entry). However, this self-test was not run by the Prover (whose verdict only covers the sweep smoke test) and Checker has no Bash tool to execute it independently, so "climb stop logic demonstrable" is verified by static code inspection only, not an execution trace. Combined with the persistence gap noted above (climb's live `run()` path writes no ledger file at all), the climb half of the loop is demonstrably correct in isolation but not shown to produce a durable, resumable artifact the way sweep does.

- **Fits the existing harness: 5/5** — evidence: progressive disclosure is honored explicitly — `skills/write-goal-prompt/references/benchmark-intake.md:1-6` ("Progressive disclosure. This reference loads ONLY when the shared grill detects a benchmark goal... Do not inline any of this into SKILL.md"); the SKILL.md edit is a single lean paragraph appended to the existing "Execution Mode Routing" section (`skills/write-goal-prompt/SKILL.md:564`) that cites ADR-0004 without restructuring the file's existing phases (Phase 0 through gnhf Path, lines 82-536, untouched); `README.md:56-90` adds a "Second goal path" section after the existing 4-agent-loop documentation (lines 37-50) without editing it; `CONTEXT.md:122-138` appends an "Artifact map" table after the existing glossary (lines 1-120) without altering any term definition. New agent/command files (`.claude/commands/benchmarking-loop.md`, `.claude/agents/harness-inbounds-checker.md`, `.claude/agents/harness-novelty-checker.md`) are net-new and do not touch or shadow the existing `harness-planner.md`/`harness-maker.md`/`harness-prover.md`/`harness-checker.md` build-path agents. CONTEXT.md vocabulary (benchmark, cadence, search mode, variant ledger, template/snapshot) is used consistently and verbatim across every artifact read.

### Reward Signal: 4.25/5.0
### Pass threshold: 3.5/5.0
### Verdict: PASS

### Weakest dimension: Spec fidelity and Anti-gaming integrity (tied, 4/5)
Fix target: In `.claude/workflows/benchmark-climb.js`, add the same `writeFileSync`/`mkdirSync`/`appendFileSync` persistence `benchmark-sweep.js:118-174` already has (ledger.jsonl, spec.json, best.json, snapshot.json under the run dir) so climb runs are actually resumable per ADR-0005, and route the climb measurement step through the deterministic `measureInstant`/`parseReward` adapter (or an equivalent non-agent call) instead of `await agent(measureBrief(...))` at `benchmark-climb.js:332-337`, so climb's reward genuinely comes from the adapter and not from a model turn, matching `docs/benchmarking/measurement-adapter.md:5-6`.

### Artifacts evaluated
- `skills/write-goal-prompt/references/benchmark-intake.md` — 190 lines
- `.claude/commands/benchmarking-loop.md` — 102 lines
- `.claude/workflows/benchmark-sweep.js` — 209 lines
- `.claude/workflows/benchmark-climb.js` — 437 lines
- `.claude/agents/harness-inbounds-checker.md` — 64 lines
- `.claude/agents/harness-novelty-checker.md` — 61 lines
- `docs/benchmarking/variant-ledger.md` — 84 lines
- `docs/benchmarking/snapshot-store.md` — 76 lines
- `docs/benchmarking/measurement-adapter.md` — 122 lines
- `.harness/loops/README.md` — 66 lines
- `scripts/benchmark-adapters/instant.ts` — 103 lines
- `scripts/benchmark-adapters/lagging-emit.ts` — 154 lines
- `skills/write-goal-prompt/references/execution-mode-routing.md` — 118 lines
- `skills/write-goal-prompt/SKILL.md` — 573 lines (routing edit: line 564)
- `README.md` — 106 lines (docs-sync section: lines 56-90)
- `CONTEXT.md` — 139 lines (docs-sync table: lines 122-138)
- `.harness/goals/harness-benchmarking-loop/runs/sweep-smoke/ledger.jsonl` — 2 lines (verified against Prover claim)
- `.harness/goals/harness-benchmarking-loop/runs/sweep-smoke/best.json` — 6 lines (verified against Prover claim)
