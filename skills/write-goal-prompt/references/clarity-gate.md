# Clarity Gate - grill vs wayfinder

Phase 0.5 routes on task size. This file holds the two branch bodies. The routing table and skip condition stay in SKILL.md.

## Branch A - grill (single-session tasks with some ambiguity)

Default clarity path. Prefer the real `/grilling` skill for depth; fall back to the batch-question agent below when you want all questions in one `AskUserQuestion` round instead of an interactive one-at-a-time interview.

**Interactive depth:** invoke `/grilling` (or `grill-me`) - a relentless one-question-at-a-time interview that walks each branch of the design tree and recommends an answer per question. Use when the ambiguity is deep or decisions depend on each other.

**Batch mode:** spawn 1 Sonnet agent (not Haiku - question quality needs judgment) with this prompt, then present its questions in ONE `AskUserQuestion` call (multiSelect: false per question):

```
Read .claude/agent-context/snapshot.md for workspace context before starting.
You are a goal-grilling agent. Your job is to surface hidden scope gaps, vague done criteria,
and overnight risks BEFORE a goal prompt is written.

Task description so far: [TASK DESCRIPTION FROM USER]

Generate 3-5 targeted questions. Focus on:
- Scope edges: what is explicitly NOT included?
- Done criteria sharpness: is the end state verifiable without judgment?
- Overnight risk: what could block autonomous execution?
- Hidden constraints: live data, shared systems, cost ceilings, auth?

Rules:
- Never ask about fields already answered
- Questions must be specific to THIS task - not a generic checklist
- Max 5 questions, min 3
- Return ONLY: an array of {question: string, header: string} - header is <=12 chars

Example for "build a triage dashboard":
[
  {question: "Should unreviewed runs appear or be hidden by default?", header: "Default view"},
  {question: "Read-only or can it write verdict/dismiss from the UI?", header: "Write access"},
  {question: "Mobile-responsive or desktop only?", header: "Responsive"}
]
```

Fold every answer into Phase 1 - treat each as if the user specified that field upfront.

## Branch B - wayfinder (large / multi-session / many-unknowns)

When the task is too big for one agent session, or clarity needs more than a handful of questions (the route from here to a plan is itself unclear), hand off to `/wayfinder` instead of grilling. Wayfinder charts the work as a shared map of investigation tickets on the repo's issue tracker and resolves them one at a time until the plan is clear.

Route to wayfinder when **any** hold:

- The task spans more than one agent session of work.
- More than ~5 distinct open scope questions - a single `AskUserQuestion` round can't resolve them.
- The unknowns are investigative ("figure out how X works before we can scope Y"), not just preferences.
- Multiple independent workstreams need mapping before execution.

After wayfinder produces its map, resume Phase 1 with the resolved decisions folded in - the map's Decisions-so-far becomes the goal's scope. For genuinely huge efforts the map may replace a single `/goal` entirely (each ticket its own run); note that and stop rather than forcing one 4000-char condition.
