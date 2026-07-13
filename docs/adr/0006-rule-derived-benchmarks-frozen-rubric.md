# 0006 - Rule-derived benchmarks allowed under a frozen-rubric guardrail

- Status: accepted (mechanics deferred)
- Date: 2026-07-13
- Context path: root (loop-engineer)

## Context

Most benchmarks are user-supplied (a KPI, a declared target, or a named direction).
A rule-derived benchmark is different: the user hands over a rule-set/rubric and the
loop synthesizes the metric itself (e.g. score research output on citation-density,
recency, source-diversity). This is attractive for goals with no single external
number, but it reopens the self-grading door - the model would be optimizing against
a rubric it interpreted, which exogenous benchmarks exist to avoid.

## Decision

Allow rule-derived benchmarks as a **third benchmark source**, under a guardrail:

- The scoring function is **frozen at authoring time** and pinned in the spec; the
  loop cannot rewrite it mid-run.
- Scoring is computed by an **independent scorer** (fresh-context, same discipline as
  the in-bounds checker in ADR 0003), not the inventor.
- If the rubric cannot be made concrete enough to freeze into a repeatable scoring
  function, the goal is **not** a benchmark goal - it is a build goal with a quality
  gate.

Full mechanics (rubric schema, how the scorer is invoked, tie-breaking) are
**deferred** until a real use case exists.

## Alternatives considered

- **Disallow rule-derived benchmarks** - rejected; too useful for research-quality
  and similar goals with no single external metric.
- **Let the loop evolve its own rubric** - rejected; a mutable self-authored rubric is
  the self-grading failure mode with extra steps.

## Consequences

- The benchmark-intake reference (ADR 0004) must let a user supply a rubric and force
  it to freeze into a concrete scoring function, or fall back to the build path.
- Rule-derived benchmarks depend on the independent-scorer role from ADR 0003.
- A follow-up ADR will specify rubric schema and scorer mechanics.
