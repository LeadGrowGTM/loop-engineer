# Measurement adapter contract (instant + lagging)

The **measurement adapter** is the exogenous layer that turns a benchmark run into a
numeric reward on the variant ledger (`docs/benchmarking/variant-ledger.md`). It is the
integrity boundary named in ADR-0002/0003: the inventor proposes a variant, but the
**reward is written by the adapter, never by the model**. Both engines (sweep P4, climb
P5) read reward through this contract so the reward/stop/search machinery is identical
across cadences - **one loop, two clocks** (ADR-0002).

Two cadences, selected by the spec's `measurement` field:

| Cadence | Clock | Who runs the benchmark | Resume |
|---|---|---|---|
| `instant` | in-session, model-paced | the harness, synchronously | n/a - completes in-session |
| `lagging` | days, real-world | an external orchestrator (n8n / trigger.dev / Hermes) | snapshot `--resume <run-id>` |

Only the clock and the cross-time resume differ. `reward`, `unit`, `direction`, the stop
condition (ADR-0001), and the two pre-measurement checks (ADR-0003) are shared.

## Shared reward contract

Every measurement - instant or lagging - resolves to one ledger `measurement` block:

```json
{
  "cadence": "instant | lagging",
  "reward": 0.062,
  "unit": "<reply_rate | latency_ms | usd | eval_score | ...>",
  "cost_usd": 0.0,
  "source": "<the command run, or the lagging job/run reference>",
  "measured_at_cycle": 7,
  "settled": true
}
```

- `reward` is a single finite number. `direction` (maximize/minimize) lives in the spec,
  not here - comparison and ranking apply it (`benchmark-sweep.js#rankByDirection`,
  `benchmark-climb.js#isImprovement`).
- `cost_usd` is per-variant so `budget.max_spend_usd` (ADR-0001) is enforceable. Instant
  local commands are `0.0`.
- `settled` is `true` the moment an instant measurement returns; for lagging it is `false`
  until the settle window elapses and the job returns (flipped on `--resume`).

## Instant cadence: stdout -> number

The instant adapter runs a local command and reads its reward from **stdout**. The rule is
deterministic and model-free:

> **Reward = the last numeric token of stdout.** A number is
> `-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?`. If stdout contains no number, the measurement
> **fails** (recorded with a null reward, `kept: false`) - it does not default to 0.

Rationale for *last* token: a benchmark command commonly logs progress lines and prints
its final score last; taking the last token lets an unmodified command double as a
benchmark without a wrapper. A command that needs a different field should print only that
number (or pipe through `| tail`).

Reference impl: `scripts/benchmark-adapters/instant.ts` (`measureInstant`, `parseReward`).
`benchmark-sweep.js` inlines the identical rule (`parseReward`/`measureInstant`); this file
is the canonical contract both share and the extraction target if the rule ever changes.

No paid API is ever called for instant smoke tests - the command is a local no-cost
process (`bun -e '...'`, an echo, a latency probe).

## Lagging cadence: emit-job payload

A lagging benchmark cannot finish in-session: the variant must ship live and data must
accrue over a `settle_window`. The harness **emits a scheduled job to an external
orchestrator and hands off** - it does not own the scheduler (ADR-0002) and, under
unsupervised builds, **authors + stubs the payload only, never dispatching it live**.

Emit-job payload schema (built by `scripts/benchmark-adapters/lagging-emit.ts`):

```json
{
  "orchestrator": "n8n | trigger.dev | hermes",
  "job_ref": "<external job id, filled by the orchestrator on accept; null when stubbed>",
  "resume_key": "<run_id>",
  "run_dir": ".harness/goals/<slug>/runs/<run_id>",
  "variant_id": "v0007",
  "settle_window": "72h",
  "benchmark": {
    "unit": "reply_rate",
    "direction": "maximize",
    "ship_command": "<how the orchestrator deploys the variant live>",
    "measure_command": "<how the orchestrator reads the reward after settle_window>"
  },
  "resume": {
    "command": "/benchmarking-loop --resume <run_id>",
    "on_return": "ingest reward -> ledger measurement (cadence=lagging, settled=true) -> continue cycle N+1"
  },
  "emitted": true,
  "returned": false,
  "dispatched_live": false
}
```

### Field notes

- `resume_key` **is** the `run_id` - the orchestrator carries it back so `--resume` finds
  the snapshot (`docs/benchmarking/snapshot-store.md`). This is the cross-time bridge:
  cycle N emits, the loop exits, cycle N+1 resumes days later from the snapshot.
- `settle_window` is copied from the spec (`stop`/`measurement` section, ADR-0002); it is
  how long the orchestrator lets data accrue before running `measure_command`.
- `ship_command` / `measure_command` are the orchestrator's two hooks. The harness does
  **not** run them - it names them so the external job can. `measure_command`'s stdout maps
  to a reward by the **same last-number rule** as instant, keeping one reward contract.
- `dispatched_live: false` + `job_ref: null` mark a stubbed emit (the only mode an
  unsupervised build produces). A live run flips `dispatched_live: true` and the
  orchestrator fills `job_ref`.
- On return, the settled reward is ingested into the ledger under the shared reward
  contract above with `cadence: "lagging"`, `settled: true` - identical downstream to an
  instant reward. The snapshot header's `lagging.emitted_job` mirrors this payload's
  `emitted`/`returned` flags (`snapshot-store.md`).

## Why one contract, two clocks

The stop condition, Pareto keep, novelty/in-bounds checks, and ledger schema never branch
on cadence - they read `measurement.reward`. Cadence changes only **when** the reward
arrives (now vs after `settle_window`) and **who** produces it (the harness vs an external
orchestrator). That is the whole of ADR-0002: a scheduling knob, not a second loop.
