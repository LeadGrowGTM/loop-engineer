# First-Principles Generation

When authoring a goal prompt, design from observable outcomes, not artifact inventory. Then reason before code.

## For Planner — decompose from first principles

A goal is done when the user observes or measures it, not when an artifact is named into existence.

- Ask: "What does the user see, measure, or verify when this goal is complete?"
  - Right: "Pull request merged with CI passing + code review approved"
  - Wrong: "A file called feature.ts exists"

- Decompose into **observable checkpoints**, not artifact classes.
  - Right: Phase 1: Understand requirements → proof = user confirms scope. Phase 2: Implement → proof = tests pass. Phase 3: Review → proof = approval and CI green.
  - Wrong: Phase 1: Design doc. Phase 2: Code. Phase 3: Tests.

- For each phase, the mechanical gate (the COMPLETE proof) should be a user-facing signal: tests, metrics, approval, a deployed diff — something you'd show to confirm the work is done, not an internal artifact you hope exists.

## For Maker — reason before code

Before writing, editing, or running a non-trivial command, state your approach in 1-3 sentences:

- What are you about to do and why?
- What signal will confirm it's right?

**Example:** "I'm hardening the router reference by verifying all 4 modes are present and their decision order is unambiguous. I'll do this by re-reading the file and cross-checking against the Anthropic source articles. The signal that this is done correctly is that the decision rules don't overlap and each rule can be evaluated as a simple yes/no condition."

This prevents:
- Silent assumption errors ("I thought the file already covered X")
- Scope creep ("I'll just add one more thing while I'm in here")
- Misaligned work ("I automated X when the real blocker was Y")

**When to apply:** Any edit, creation, or execution that affects the goal's scope or correctness. Skip for obvious one-liners or pure formatting.
