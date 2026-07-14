# 0003 - Benchmarking search modes (sweep vs climb) and bounded, independently-checked invention

- Status: accepted
- Date: 2026-07-13
- Context path: root (loop-engineer)

## Context

Benchmark goals optimize in two structurally different ways. A provider bake-off
(Parallel API vs Serper.dev) and red-team.js's fixed adversarial roles enumerate a
finite candidate set. An email reply-rate loop searches an unbounded space of copy.
The same engine cannot serve both: enumerating an infinite space is impossible, and
running a finite bake-off through hill-climb machinery is wasteful.

Open-ended invention also creates a safety hole: an inventor free to change anything
can drift the offer or CTA and - if it also judges itself - rationalize that it did
not. That is the exact self-grading failure the harness exists to prevent, surfacing
inside the loop.

## Decision

A benchmark declares a **search mode**:

- **sweep** - finite candidate set; run all N, measure each, rank, pick winner.
  Ignores plateau/target; stops when the candidate list is exhausted. red-team.js is
  a sweep.
- **climb** - open space; each cycle invents a new variant, measures, keeps
  improvements. Uses explore/exploit + plateau + Pareto-keep and the full ADR 0001
  stop condition.

Climb mode operates over a declared **search space**: **mutable levers** (what may
vary) and **invariants** (what must stay fixed). Every invented variant clears two
**pre-measurement checks**, run by agents *other* than the inventor:

1. **In-bounds check** - a fresh-context checker with no view of the inventor's
   reasoning diffs the variant against the invariant list; violations are killed
   before any measurement and do not count as a cycle. Required-tier (ADR 0001) for
   load-bearing invariants (offer / price / claims).
2. **Novelty check** - the variant is diffed against the **variant ledger** (the
   loop's run.md-style record of every tested variant + reward); near-duplicates of
   already-measured variants are rejected to avoid wasting measurements.

## Alternatives considered

- **One search engine for all benchmarks** - rejected; sweep and climb have
  incompatible proposers and stop conditions.
- **Inventor self-certifies in-bounds** - rejected; reintroduces self-grading. Multi-
  agent separation is the harness's core premise, so enforcement belongs to a
  distinct agent.
- **No novelty check** - rejected; the loop would burn budget re-measuring known
  variants.

## Consequences

- The benchmark spec needs `search: sweep | climb`; climb needs `levers` +
  `invariants`.
- A durable variant ledger is required (feeds novelty + best-so-far comparison).
- Two independent checker roles run per climb cycle before measurement; exogenous
  measurement still guards the score itself.
