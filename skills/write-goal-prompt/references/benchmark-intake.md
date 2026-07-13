# Benchmark Intake (lazy grill branch)

**Progressive disclosure.** This reference loads ONLY when the shared grill detects a
benchmark goal (metric + direction) from either front door (ADR-0004). A plain build
goal never loads it, so `SKILL.md` stays lean. Do not inline any of this into
`SKILL.md`.

Purpose: turn a benchmark goal into a concrete, frozen **benchmark spec** the
`/benchmarking-loop` command (P3) hands to the sweep engine (P4) or climb engine (P5).
Uses the exact vocabulary of root `CONTEXT.md`; every field traces to an ADR.

## When this branch fires

The routing key (ADR-0004): **does the goal name a measurable benchmark - a metric plus
a direction to move it?** ("get reply rate up", "make it faster", "cheapest provider
that still passes", "highest eval score"). The grill auto-detects this from either door:

- Invoked via `/benchmarking-loop` -> load this reference, grill the spec below.
- Invoked via `/write-goal-prompt` but the goal names a metric+direction -> catch it
  mid-interview, **offer to switch** to the benchmark path, then load this reference.
- Invoked via `/benchmarking-loop` but the goal has no measurable metric (just "build
  X") -> **offer to switch** back to the build path (`/write-goal-prompt`). If a rubric
  cannot be frozen (see Section 1, rule-derived), it is a build goal with a quality
  gate, not a benchmark (ADR-0006).

## The spec has four sections

Grill until all four are captured. Missing a load-bearing field (metric, direction,
measurement cadence, search mode) blocks a valid run - do not emit a partial spec.

```
benchmark    - what exogenous signal, which direction, optional target
measurement  - instant | lagging (+ settle_window if lagging)
search       - sweep {candidates} | climb {levers, invariants}
stop         - target? / plateau / budget  (first-of; ADR-0001)
```

---

## 1. benchmark - the exogenous signal (CONTEXT.md "Benchmark")

Capture the metric, its direction, and (optionally) a target. The signal MUST be read
from outside the model (exogenous) - that is what makes it resistant to self-grading.
Pick the flavor:

| Flavor | What the user gives | Example |
|---|---|---|
| **Programmatic KPI** | a number the loop can fetch/run each cycle | latency ms, cost $, eval score, test-pass %, reply rate, CTR |
| **Declared target** | a human-stated bar, still measured each cycle | "beat the current prompt's 78%" |
| **Open-ended direction** | minimize/maximize, no ceiling | "as fast as you can" |
| **Rule-derived** (ADR-0006) | a rule-set/rubric the loop scores against | citation-density + recency + source-diversity |

**Direction is required**: `maximize` or `minimize`. **Target is optional** (open-ended
omits it and rides plateau + budget).

### Rule-derived -> frozen-rubric guardrail (ADR-0006)

If the benchmark is a rubric the user hands over, force it to freeze:

1. The scoring function is **frozen at authoring time** and pinned in the spec. The loop
   optimizes against it but **cannot rewrite it mid-run**.
2. Scoring is computed by an **independent scorer** (fresh-context, same discipline as
   the in-bounds checker, ADR-0003) - never the inventor.
3. **If the rubric cannot be made concrete enough to freeze** into a repeatable scoring
   function -> this is NOT a benchmark goal. Offer to switch to the build path
   (`/write-goal-prompt`) with a quality gate instead.

Full rubric-schema + scorer-invocation mechanics are **deferred** (ADR-0006 records the
guardrail only). Capture the frozen rubric text verbatim into the spec now; the scorer
wiring lands in the follow-up ADR.

---

## 2. measurement - the cadence (ADR-0002)

Every benchmark is tagged `instant` or `lagging`. This selects where the loop runs; the
reward/stop/search machinery is identical across both (one loop, two clocks).

- **instant** - measurable this second (speed, cost, eval score, test-pass %, provider
  bake-offs). Runs as a tight in-session goal-loop.
- **lagging** - real-world metric that accrues over days (reply rate, CTR, ad spend).
  Does NOT run in-session. The loop emits a scheduled job to an external orchestrator
  (n8n / trigger.dev / Hermes) carrying a **`settle_window`** (how long to let data
  accrue) + persisted state, and resumes across time from a snapshot (ADR-0005).

If `lagging`, grill the **`settle_window`** (e.g. `72h`, `7d`). A lagging spec that
omits it blocks.

> Unsupervised builds: lagging loops are **authored + emit-stub + snapshot only** - the
> external execution is stubbed/documented, never run live (P7).

---

## 3. search - how the next candidate is proposed (ADR-0003)

- **sweep** - a fixed, finite candidate set (provider bake-off; red-team.js's fixed
  roles). Run all N, measure each, rank, pick winner. No explore/exploit, no plateau;
  stop = candidate list exhausted. Capture the **candidate list**.
- **climb** - an open/unbounded space (email copy for reply rate). Each cycle invents a
  new variant, measures, keeps improvements. Uses explore/exploit + plateau + Pareto-keep
  and the full ADR-0001 stop. Capture the **search space**:
  - **mutable levers** - what may vary (subject line, body copy, send time).
  - **invariants / guardrails** - what must NOT change (CTA, offer, price, factual
    claims). Hard constraints, checked BEFORE a measurement is spent.

### Climb requires two independent pre-measurement checks (ADR-0003)

Every invented variant clears two checks run by agents **other than the inventor**
(anti-gaming is non-negotiable):

1. **In-bounds check** - a fresh-context checker (`harness-inbounds-checker`) diffs the
   variant against the invariant list. A violation kills the variant (not counted as a
   cycle). Required-tier for load-bearing invariants (offer/price/claims).
2. **Novelty check** - the variant is diffed against the **variant ledger**
   (`harness-novelty-checker`). Near-duplicates of already-measured variants are rejected
   so no measurement is wasted.

Sweep skips both (its candidates are fixed and pre-declared).

---

## 4. stop - when the loop halts (ADR-0001)

The loop halts on the **first of** three to trip, and **always returns best-so-far**:

1. **target** (optional) - metric crosses the declared bar (e.g. reply rate >= 8%).
2. **plateau** - N cycles with improvement below a threshold (default: **3 cycles,
   < X% gain**). Same shape as the build loop's PLATEAU.
3. **budget** - a cycle-count / token / spend cap is hit.

Open-ended benchmarks omit `target` and ride plateau + budget. Sweep ignores
plateau/target (it stops when the candidate list is exhausted) but still respects a
budget cap. Sensible defaults apply when the user gives only a direction (plateau 3
cycles, a budget cap).

---

## Emit: the benchmark spec (JSON)

Freeze the grilled answers into this shape. The command (P3) and engines (P4/P5)
consume it. `run_id` is assigned by the command at run start (used to key the snapshot
store, ADR-0005).

```json
{
  "run_id": "<assigned-at-run-start>",
  "benchmark": {
    "flavor": "programmatic-kpi | declared-target | open-ended | rule-derived",
    "metric": "<name, e.g. latency_ms | eval_score | reply_rate>",
    "direction": "maximize | minimize",
    "target": "<optional number, omit for open-ended>",
    "frozen_rubric": "<verbatim rubric text - rule-derived only, else omit>"
  },
  "measurement": {
    "cadence": "instant | lagging",
    "command": "<instant: shell command whose stdout -> a number; see measurement-adapter>",
    "settle_window": "<lagging only, e.g. 72h | 7d>"
  },
  "search": {
    "mode": "sweep | climb",
    "candidates": ["<sweep only: fixed candidate A>", "<candidate B>"],
    "levers": ["<climb only: what may vary>"],
    "invariants": ["<climb only: what must NOT change - checked in-bounds>"]
  },
  "stop": {
    "target": "<optional>",
    "plateau": { "cycles": 3, "min_gain_pct": 1.0 },
    "budget": { "max_cycles": 10, "max_spend_usd": null, "max_tokens": null }
  }
}
```

## Saving the spec (ADR-0005)

- **Template** (spec only, re-pointed) -> save to the loop registry `.harness/loops/`,
  named. Re-invoke fresh via `/benchmarking-loop <template-name>`.
- **Snapshot** (spec + variant ledger + best-so-far, keyed by `run_id`) -> warm-start
  via `/benchmarking-loop --resume <run-id>`. Lagging loops snapshot by construction so
  the external scheduler can resume them.

## Related

- Command router: `.claude/commands/benchmarking-loop.md`
- Ledger/snapshot/registry schemas: `docs/benchmarking/variant-ledger.md`,
  `docs/benchmarking/snapshot-store.md`, `.harness/loops/README.md`
- Measurement adapter contract: `docs/benchmarking/measurement-adapter.md`
- Independent checkers: `.claude/agents/harness-inbounds-checker.md`,
  `.claude/agents/harness-novelty-checker.md`
- ADRs: `docs/adr/0001`-`0006`. Glossary: root `CONTEXT.md`.
