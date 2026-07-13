# CONTEXT — loop-engineer glossary

Ubiquitous language for the harness. Glossary only — no implementation details.
Terms marked *(open)* are still being grilled and not yet settled.

## Loop types

- **Build loop** — a goal that produces an *artifact*. Done-state is binary: the
  artifact exists and passes a completeness gate (the Done-bullets reward,
  `reward = passing/total`). This is the current `/write-goal-prompt` path.

- **Benchmarking loop** — a goal that *optimizes a measurable dimension* rather
  than producing a fixed artifact. Reward is a metric read from outside the model
  and compared against a pre-registered expectation. Distinct path from the build
  loop. Entry command: `/benchmarking-loop` (a thin front-door router, not a second
  authoring interview — see ADR 0004).

## Entry + routing

- **Two front doors, one grill** — `/write-goal-prompt` and `/benchmarking-loop` are
  both thin routers into the *same* shared grill engine. The benchmark-spec intake
  is a lazily-loaded reference (`references/benchmark-intake.md`) that loads only
  when the benchmark path fires, so a plain build goal never pays for it. The loop
  *runner* is separate (different agents/engine). See ADR 0004.

- **Benchmark detection** — the routing key is "does the goal name a measurable
  benchmark (metric + direction)?" The grill auto-detects this from *either* front
  door: if a user invokes the wrong door, the grill catches it mid-interview and
  offers to switch paths. Detection is the fallback against mis-routing, not just a
  front-door choice.

- **Stop condition** (benchmarking loop) — the loop halts on the *first* of three
  to trip: **target** hit (optional), **plateau** (N cycles with sub-threshold
  gain), or **budget** exhausted (cycle / token / spend cap). Always returns the
  best-so-far configuration. Open-ended benchmarks simply omit `target` and ride
  plateau + budget. See ADR 0001.

## Benchmark

- **Benchmark** — the measurable signal a benchmarking loop optimizes. Read from
  outside the model (exogenous), which is what makes it resistant to the model
  grading its own homework. Three flavors, all valid for the benchmarking path:
  - **Programmatic KPI** — a number the loop can fetch/run each cycle: reply rate,
    click-through rate, ad spend, latency, eval score, test-pass %.
  - **Declared target** — a human-stated bar captured during the grill ("beat the
    current prompt's 78%"), still measured each cycle.
  - **Open-ended direction** — minimize/maximize with no fixed target ("get this
    as fast as you can"). Direction only, no ceiling.
  - **Rule-derived benchmark** — the user hands over a rule-set/rubric and the loop
    synthesizes the metric itself (e.g. score research output on citation-density,
    recency, source-diversity). Allowed, but the scoring function is **frozen at
    authoring time** and computed by an **independent scorer** (fresh-context); the
    loop optimizes against it but cannot rewrite it mid-run. If the rubric can't be
    made concrete enough to freeze, it's a build goal with a quality gate, not a
    benchmark. Full mechanics deferred — see ADR 0006.

- **Measurement cadence** — every benchmark is tagged `instant` or `lagging`, which
  selects where the loop runs (see ADR 0002):
  - **Instant** — measurable this second (speed/latency, cost, eval score,
    test-pass %, auto-research provider bake-offs). Runs as a tight in-session
    goal-loop.
  - **Lagging** — real-world metric that accrues over days (reply rate, CTR, ad
    spend). Does NOT run in-session; the loop emits a scheduled job to an external
    orchestrator (n8n / trigger.dev / Hermes agent) with a settle-window, and
    resumes across time from persisted state.

## Search

- **Search mode** — how a benchmarking cycle proposes the next thing to measure:
  - **Sweep** — a fixed, finite candidate set (provider bake-off: Parallel API vs
    Serper.dev; red-team.js's fixed adversarial roles). Run all N, measure each,
    rank, pick winner. No explore/exploit, no plateau; stop = candidate list
    exhausted.
  - **Climb** — an open/unbounded space (email copy for reply rate). Each cycle
    *invents* a new variant, measures, keeps what improves. Uses explore/exploit +
    plateau + Pareto-keep and the full ADR 0001 stop condition.

- **Search space** (climb mode) — the bounded set of things a cycle is allowed to
  vary. Two parts, declared at authoring time:
  - **Mutable levers** — what may change (subject line, body copy, send time).
  - **Invariants / guardrails** — what must NOT change (the call-to-action, the
    offer, price, factual claims). Hard constraints. Every invented variant is
    validated against invariants *before* a measurement is spent on it.

- **Pre-measurement checks** — a variant must clear two independent checks, run by
  agents *other* than the inventor, before it earns a measurement (see ADR 0003):
  1. **In-bounds check** — a fresh-context checker (no view of the inventor's
     reasoning) diffs the variant against the invariant list; a violation kills the
     variant (not counted as a cycle). Required-tier for load-bearing invariants
     (offer/price/claims).
  2. **Novelty check** — the variant is diffed against the **variant ledger**;
     near-duplicates of already-measured variants are rejected so no measurement is
     wasted re-testing known results.

- **Variant ledger** — the benchmarking loop's `run.md`-style durable record: every
  variant tested, its config, and its reward. Feeds the novelty check and
  best-so-far / cohort-chain comparison. Analogous to superdense's `run.md` + the
  `runs/` history.

## Saved loop

Two save kinds, both supported (see ADR 0005):

- **Template** — save only the *spec* (benchmark + measurement + search + stop +
  levers/invariants). Re-invoking starts fresh; portable/parameterized, re-pointed
  at new inputs (e.g. an "email reply-rate optimizer" aimed at a new campaign). The
  reusable asset you build a library of. Lives in a **loop registry**
  (`.harness/loops/`), named. Instantiated via `/benchmarking-loop <template-name>`.
- **Snapshot** — save the spec **plus** the variant ledger + best-so-far. Re-invoking
  **warm-starts**: skips known variants, resumes from the best config. Lets a lagging
  loop resume across days, or a proven optimizer be forked with learnings intact.
  Keyed by run-id; resumed via `--resume <run-id>`.

Template = the recipe you re-point. Snapshot = the in-progress game you resume.

## Existing terms (already in the harness)

- **Planner / Maker / Prover / Checker** — the four-agent build loop.
- **Reward signal** — numeric score a cycle earns; drives PASS / ITERATE / PLATEAU.
- **Mechanical gate** — grep/parse checks that must pass before qualitative eval.
