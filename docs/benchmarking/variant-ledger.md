# Variant ledger schema

The benchmarking loop's `run.md`-style durable record (CONTEXT.md "Variant ledger"):
**every variant tested, its config, and its reward.** Analogous to superdense's
`run.md` + the `runs/` history. It feeds two things:

1. the **novelty check** (ADR-0003) - `harness-novelty-checker` diffs a proposed variant
   against every ledger entry to reject near-duplicates before a measurement is spent;
2. **best-so-far** comparison - the stop condition (ADR-0001) always returns the
   best-so-far config, read from the ledger.

The ledger is exogenous and append-only: the inventor writes a proposed variant, but the
**reward is written by the measurement adapter** (P7), not the inventor - measurement
stays outside the model.

## On-disk location

Keyed by `run_id` under the run's working directory:

```
.harness/goals/<slug>/runs/<run_id>/
  spec.json          <- the frozen benchmark spec (references/benchmark-intake.md "Emit")
  ledger.jsonl       <- one JSON object per line, one line per variant (append-only)
  ledger.md          <- human-readable mirror (optional, regenerated from ledger.jsonl)
  best.json          <- pointer to the best-so-far variant_id + its reward
```

`ledger.jsonl` (JSON Lines) is canonical - append-only, one variant per line, so a
crashed/resumed run never rewrites history. `ledger.md` is a regenerated view for humans.

## Ledger entry schema (one line of `ledger.jsonl`)

```json
{
  "variant_id": "v0007",
  "cycle": 7,
  "search_mode": "sweep | climb",
  "config": { "<lever>": "<value>", "...": "..." },
  "candidate_label": "<sweep only: the fixed candidate name>",
  "checks": {
    "in_bounds": { "verdict": "in-bounds | violation | n/a", "by": "harness-inbounds-checker", "cited_invariant": null },
    "novelty":   { "verdict": "novel | duplicate | n/a", "by": "harness-novelty-checker", "closest_variant_id": null }
  },
  "measurement": {
    "cadence": "instant | lagging",
    "reward": 0.062,
    "unit": "<e.g. reply_rate | latency_ms | usd | eval_score>",
    "cost_usd": 0.0,
    "source": "<the command run, or the lagging job/run reference>",
    "measured_at_cycle": 7,
    "settled": true
  },
  "kept": true,
  "is_best_so_far": false
}
```

### Field notes

- **variant_id** - stable, monotonic (`v0001`, `v0002`, ...). The novelty check dedups on
  `config`, not on id.
- **checks** - `n/a` for sweep (fixed candidates skip both pre-measurement checks).
  For climb, a `violation` or `duplicate` verdict means the variant was **killed before
  measurement** and does NOT count as a cycle (ADR-0003); such entries carry a null
  `reward` and `kept: false`.
- **measurement.reward** - the numeric reward from the adapter (P7). Direction
  (maximize/minimize) lives in the spec, not here; comparison uses it.
- **measurement.cost_usd** - per-variant cost, so `budget.max_spend_usd` (ADR-0001) can
  be enforced.
- **measurement.settled** - `false` while a lagging variant waits out its
  `settle_window`; flipped `true` on resume when the job returns (ADR-0002/0005).
- **is_best_so_far** - recomputed each append against `direction`; exactly one entry
  carries `true` (mirrored into `best.json`).

## Best-so-far (`best.json`)

```json
{ "variant_id": "v0003", "reward": 0.071, "unit": "reply_rate", "cycle": 3 }
```

Updated whenever an appended, kept variant beats the current best under the spec's
`direction`. The stop condition returns this on halt (target/plateau/budget), so a
budget/plateau halt still yields the best configuration.
