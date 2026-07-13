# PRD - Benchmarking Loop (second goal path)

Source: `/grill-with-docs` session 2026-07-13. Canonical decisions live in root
`CONTEXT.md` (glossary) and `docs/adr/0001`-`0006`. This PRD is the product brief the
build phases trace to.

## Problem

The harness has one goal shape: the **build loop** (`/write-goal-prompt` →
Planner→Maker→Prover→Checker), which produces an artifact judged by *completeness*
(Done-bullets reward). That reward is the model grading its own homework - the exact
weakness the harness exists to fight, only narrowed by a fresh-context Checker, never
closed. It also has no way to *optimize a measurable outcome* (reply rate, latency,
cost, eval score) or to *compound* learning across runs.

## Goal

Add a second goal path - the **benchmarking loop** - that optimizes a measurable
benchmark read from outside the model (exogenous), against a pre-registered
expectation. This structurally beats self-grading and unlocks optimization,
provider bake-offs, and real-world-metric loops. Both paths share one grill and one
harness spine; only the reward source, search engine, and cadence differ.

## Users / entry

- Human-invoked via slash command (primary), and gnhf autonomous.
- **Two front doors, one grill** (ADR-0004): `/write-goal-prompt` and
  `/benchmarking-loop` are thin routers into the same grill. Benchmark-spec intake is
  a lazily-loaded reference so a plain build goal never pays for it. The grill
  **auto-detects** a benchmark goal (metric + direction) from either door and offers
  to switch on mis-route.

## Core concepts (see CONTEXT.md)

- **Benchmark** - the exogenous signal optimized. Flavors: programmatic KPI, declared
  target, open-ended direction, rule-derived (frozen rubric, ADR-0006).
- **Measurement cadence** (ADR-0002) - `instant` runs in-session (speed/cost/eval/
  bake-offs); `lagging` (reply rate, CTR, ad spend) emits a scheduled job to an
  external orchestrator (n8n / trigger.dev / Hermes) with a settle-window and resumes
  from persisted state.
- **Search mode** (ADR-0003) - `sweep` (finite candidate set, run-all-and-rank;
  red-team.js is a sweep) or `climb` (open space, invent-measure-keep with
  explore/exploit + Pareto).
- **Search space** (climb) - **mutable levers** + frozen **invariants**. Every invented
  variant clears two **pre-measurement checks** run by agents *other* than the
  inventor: an **in-bounds check** (fresh-context; kills invariant violators before a
  measurement is spent) and a **novelty check** (diff vs the **variant ledger**;
  rejects near-dupes of already-measured variants).
- **Variant ledger** - durable `run.md`-style record of every tested variant + reward;
  feeds novelty + best-so-far comparison.
- **Stop condition** (ADR-0001) - first-of(`target` / `plateau` / `budget`); always
  returns best-so-far. Open-ended omits target.
- **Saved loop** (ADR-0005) - **template** (spec only, re-pointed, lives in a loop
  registry `.harness/loops/`) and **snapshot** (spec + ledger, warm-start via
  `--resume <run-id>`).

## In scope (build)

1. `references/benchmark-intake.md` - the lazy grill branch that captures the spec:
   `benchmark` (metric+direction±target) · `measurement` (instant|lagging +
   settle_window) · `search` (sweep candidates | climb {levers, invariants}) · `stop`
   (target?/plateau/budget). Includes the frozen-rubric path for rule-derived.
2. Benchmark detection + routing wired into `references/execution-mode-routing.md` and
   both front-door commands (thin routers; auto-detect + offer-to-switch).
3. `/benchmarking-loop` command - runs a spec (fresh) or `--resume <run-id>` (warm);
   accepts a template name from the registry.
4. The **runner**: sweep engine (run-all, rank, pick) and climb engine (invent →
   in-bounds check → novelty check → measure → keep; explore/exploit + Pareto +
   ADR-0001 stop).
5. Independent checker roles: **in-bounds checker** and **novelty checker** (fresh
   context, separate from the inventor). Reuse harness-checker discipline.
6. **Variant ledger** schema + **snapshot** store (keyed by run-id) + **loop registry**
   (`.harness/loops/` named templates).
7. Measurement adapter contract: instant (run a command, read a number) and lagging
   (emit job to external orchestrator; resume from snapshot).
8. Docs: update root CONTEXT.md links, README, and the write-goal-prompt SKILL.md
   routing section to name the second path.

## Non-goals / deferred

- Full rule-derived rubric schema + scorer mechanics - deferred to a follow-up ADR
  (ADR-0006 records the guardrail only).
- Building new n8n/trigger.dev/Hermes infrastructure - the harness *emits* a job to
  existing orchestrators; it does not own the scheduler.
- Changing the build loop's existing behavior beyond adding the routing fork.

## Success criteria

- A user can invoke `/benchmarking-loop`, be grilled into a valid spec, and run an
  **instant sweep** (e.g. Parallel API vs Serper.dev on a fixed research task) to a
  ranked winner with a variant ledger written.
- An **instant climb** (e.g. optimize a prompt against an eval score) runs multiple
  cycles, enforces invariants via the independent in-bounds checker, rejects
  duplicate variants, and halts on first-of(target/plateau/budget) returning
  best-so-far.
- A spec can be saved as a **template** and re-instantiated; a run can be
  **snapshotted** and `--resume`d.
- A **lagging** benchmark authors correctly and emits a scheduled job + snapshot
  (external execution stubbed/documented, not run live).
- Mis-invoking `/write-goal-prompt` on a benchmark goal triggers the auto-detect
  switch offer.

## Open questions (for Planner / future ADRs)

- Measurement-adapter interface: exact contract for a benchmark command's stdout →
  number, and the lagging emit-payload schema.
- Snapshot storage format (reuse `.claude/state/` SQLite vs flat files under the run).
- Explore/exploit tuning defaults (explore ratio, UCB weighting) for climb.
- Rule-derived rubric schema + independent-scorer invocation (deferred ADR).
