# 07 - measurement adapter contract (instant + lagging)
Status: ready-for-agent
Blocked by: 02

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
