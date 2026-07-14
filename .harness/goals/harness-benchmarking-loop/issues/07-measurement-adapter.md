# 07 - measurement adapter contract (instant + lagging)
Status: done
Blocked by: 02

## Completion note
Delivered `docs/benchmarking/measurement-adapter.md` (shared reward contract, instant
stdout->last-number rule, lagging emit-job payload schema - one loop two clocks per
ADR-0002), `scripts/benchmark-adapters/instant.ts` (measureInstant/parseReward reference
impl, canonical for the rule sweep inlines; 7/7 parse selftest; live `echo latency 42.7`
-> reward 42.7), and `scripts/benchmark-adapters/lagging-emit.ts` (buildEmitJob/writeEmitJob
stub, dispatched_live=false + job_ref=null always, 11/11 selftest incl. resume_key=run_id
bridge and missing-settle_window throw). Both import-clean (side-effect-free named exports),
guarded by import.meta.main. No regression: sweep smoke re-ran green (winner v0002=0.87).

## Parent
PRD.md "In scope" 7; ADR-0002 (instant vs lagging cadence).

## What to build
- `docs/benchmarking/measurement-adapter.md` - the contract: how a benchmark command's
  stdout maps to a numeric reward (instant); the lagging emit-payload schema.
- `scripts/benchmark-adapters/instant.ts` - reference impl: run a command, read a number.
- `scripts/benchmark-adapters/lagging-emit.ts` - emit-job stub: builds the payload for an
  external orchestrator (n8n/trigger.dev/Hermes) + settle_window + snapshot resume key.
  Documented/stubbed - does NOT run live and does NOT call paid APIs.

## Acceptance criteria
- Contract doc defines stdout->number rule and the lagging emit-payload schema.
- instant.ts runs a local command and returns a numeric reward (used by P4 smoke test).
- lagging-emit.ts constructs a valid job payload with settle_window + resume key and
  writes/returns it WITHOUT dispatching to any live orchestrator.
- Both cadences share the same reward/stop/search contract (ADR-0002: one loop, two clocks).

## Skill routing
direct - `docs/benchmarking/measurement-adapter.md`,
`scripts/benchmark-adapters/instant.ts`, `scripts/benchmark-adapters/lagging-emit.ts`
