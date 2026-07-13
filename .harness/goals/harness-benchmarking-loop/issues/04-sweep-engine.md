# 04 - sweep engine (run-all -> rank -> pick -> ledger)
Status: ready-for-agent
Blocked by: 02

## Parent
PRD.md "In scope" 4; ADR-0003 (sweep).

## What to build
`.claude/workflows/benchmark-sweep.js` - a Workflow-DSL engine mirroring
`.claude/workflows/red-team.js`. Takes a finite candidate set, measures each via the
instant measurement adapter (P7), ranks by reward, picks the winner, writes the variant
ledger. No explore/exploit, no plateau; stop = candidate list exhausted.

## Acceptance criteria
- File parses clean on a bare `import()` (executor globals guarded, like red-team.js).
- Accepts a spec with N fixed candidates + a benchmark command.
- Runs all N, records each candidate's numeric reward to the ledger.
- Emits a ranked winner line.
- The Prover smoke test (two fixed candidates, local no-cost command) runs end-to-end
  and writes a ledger with both scored + a ranked winner.

## Skill routing
direct - `.claude/workflows/benchmark-sweep.js`
