# Snapshot store schema

A **snapshot** persists the benchmark **spec plus** the variant ledger and best-so-far
(ADR-0005). Re-invoking **warm-starts**: it skips known variants (the novelty check,
ADR-0003, reads the resumed ledger) and resumes climbing from the best config. Keyed by
`run_id`; resumed with `/benchmarking-loop --resume <run-id>`.

Two things a snapshot enables:
- a **lagging** loop (ADR-0002) resumes across days - the external orchestrator returns,
  the loop reloads the snapshot and continues cycle N+1;
- a proven optimizer is **forked with its learnings intact**.

Contrast with a **template** (spec only, re-pointed, fresh each time) in the loop
registry `.harness/loops/`. Template = the recipe you re-point. Snapshot = the
in-progress game you resume.

## On-disk location

A snapshot is not a separate copy - it IS the run directory (the ledger is the bulk of
a snapshot). `--resume <run-id>` reloads it in place:

```
.harness/goals/<slug>/runs/<run_id>/
  snapshot.json      <- the snapshot header (below)
  spec.json          <- frozen benchmark spec
  ledger.jsonl       <- variant ledger (see variant-ledger.md) - the bulk of the snapshot
  best.json          <- best-so-far pointer
```

## Snapshot header schema (`snapshot.json`)

```json
{
  "run_id": "<uuid or slug-timestamp>",
  "template": "<template-name if instantiated from the registry, else null>",
  "status": "running | settling | plateau | target-hit | budget-exhausted | done",
  "search_mode": "sweep | climb",
  "cadence": "instant | lagging",
  "cycles_done": 7,
  "best_variant_id": "v0003",
  "best_reward": 0.071,
  "created_at_cycle": 0,
  "lagging": {
    "settle_window": "72h",
    "emitted_job": { "orchestrator": "n8n | trigger.dev | hermes", "job_ref": "<external id>",
                     "resume_key": "<run_id>", "emitted": true, "returned": false }
  }
}
```

### Field notes

- **status** - drives `--resume`: a `settling` lagging run waits for its external job;
  a `plateau`/`target-hit`/`budget-exhausted` run is terminal and resume returns
  best-so-far without new cycles.
- **cycles_done** - resume continues from here; the plateau/budget counters (ADR-0001)
  read this so a resumed loop does not double-count.
- **lagging.emitted_job** - present only for lagging cadence. The harness EMITS this job
  (payload schema in `docs/benchmarking/measurement-adapter.md`) and persists the
  `resume_key`; it does NOT own the scheduler (ADR-0002). Under unsupervised builds this
  is authored + stubbed only, never dispatched live.

## Resume contract (`--resume <run-id>`)

1. Load `snapshot.json` + `spec.json` + `ledger.jsonl` + `best.json` from the run dir.
2. If `status` terminal -> print best-so-far, exit (no new cycles).
3. If `status == settling` (lagging) -> check `emitted_job.returned`; if false, exit
   (still within settle window); if true, ingest the settled reward, mark the variant
   `settled: true`, continue.
4. Else (instant/climb mid-flight) -> hand the loaded ledger to the novelty checker so
   known variants are skipped, resume from `cycles_done`, continue to the stop condition.

A fresh run (no `--resume`) assigns a new `run_id` and starts an empty ledger. A template
instantiation (`/benchmarking-loop <template-name>`) is a fresh run whose `spec` is
copied from the registry and `template` recorded in the header.
