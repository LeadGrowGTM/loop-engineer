# 0004 - Two front doors, one shared grill, benchmark auto-detection

- Status: accepted
- Date: 2026-07-13
- Context path: root (loop-engineer)

## Context

Benchmark goals and build goals need different runtimes, but folding benchmark
authoring inline would bloat `write-goal-prompt` (already a progressive-disclosure
skill with 11 reference files). Yet a single entry point would cost the
human-invoked `/benchmarking-loop` slash command the user relies on, and users can
still invoke the wrong door for a given goal.

## Decision

Separate three axes instead of a one-skill-vs-two toggle:

- **Entry point** - keep **two** invocable commands, `/write-goal-prompt` and
  `/benchmarking-loop`, as thin front-door routers. Preserves discoverability and
  the human-invoked entry the user depends on.
- **Authoring engine** - **shared** grill. Both doors route into the same interview.
  Benchmark-spec intake lives in a lazily-loaded `references/benchmark-intake.md`
  that loads only when the benchmark path fires, so a plain build goal never pays
  for it and SKILL.md stays lean.
- **Runtime** - the benchmark loop **runner** is separate (its own agents/engine per
  ADR 0003); `/benchmarking-loop` runs a spec, it does not re-author it.

**Auto-detection fallback:** the routing key is "does the goal name a measurable
benchmark (metric + direction)?" The shared grill detects this from *either* door.
If a user invokes the wrong command, the grill catches it mid-interview and offers
to switch paths - detection is a mis-routing fallback, not merely a front-door
choice.

## Alternatives considered

- **One command, mode inside write-goal-prompt** - rejected; loses the invocable
  `/benchmarking-loop` door the user relies on.
- **Two fully independent SKILL.md authoring interviews** - rejected; duplicates the
  grill and drifts out of sync.
- **Inline benchmark intake in the main SKILL.md** - rejected; bloats every build-goal
  invocation. Progressive disclosure via a reference keeps it lean.

## Consequences

- Add `references/benchmark-intake.md` (spec fields: benchmark, measurement, search,
  stop) loaded on the benchmark fork.
- Both front-door commands are thin routers over one grill.
- The grill needs a benchmark-detection step that can fire and offer to switch from
  either entry point.
