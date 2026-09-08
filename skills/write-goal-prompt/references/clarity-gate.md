# Clarity Gate — Mandatory Grill Receipt

Every goal invokes `batch-grill-me` after `goal-lifecycle start` returns a managed run and before
`goal-lifecycle record-grill`. There is no alternate interview route and no omission for an
apparently complete request.

Run the grill inside the returned absolute run path. Record its ordered rounds, settled decisions,
recommendations, final frontier count, and completion status in the candidate receipt. A fully
specified request records a completed zero-question frontier. Submit the receipt through
`goal-lifecycle record-grill --run <RUN.json> --receipt <candidate-GRILL.json>`; only a successful
result permits authoring durable artifacts.

Fold settled decisions into `BRIEF.md`. Investigative uncertainty is a bounded item in the brief,
not a reason to bypass the receipt.

## Escalation routes

The receipt is always produced by `batch-grill-me`. Two escalations may run inside it when the
frontier cannot resolve the ambiguity on its own; their settled decisions are folded into the same
candidate receipt.

| If... | Pick | Because |
| --- | --- | --- |
| Answers change what the next question even is, so the frontier stays one question wide | `/grilling` | One question at a time is the only way to walk a chain |
| The task spans more than one session, has more than ~5 open scope questions that need investigation first, or the unknowns are investigative rather than preferences | `/wayfinder` | Grilling resolves preferences, not unknowns that must be researched before they can be asked |

Tie-breaker: start with the frontier. Its first round shows which decisions are actually chained.
Subagents find facts; the user makes decisions. If Wayfinder's map shows the work is larger than one
goal, stop and emit the mapped sequence; each ticket becomes its own lifecycle `start`.
