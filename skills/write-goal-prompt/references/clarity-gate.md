# Clarity Gate - grill vs wayfinder

Phase 0.5 routes on task size. This file holds the two branch bodies. The routing table and skip condition stay in SKILL.md.

## Branch A - grill (single-session tasks with some ambiguity)

Default clarity path. Two paths, both real skills. Pick with the test below, then run that skill to completion - do not blend them.

### Which do I pick?

Ask one question: **are the open decisions tangled, or merely many?**

| If... | Pick | Because |
| --- | --- | --- |
| Answers change what the *next* question even is - the decisions are chained, and asking round 2 before hearing round 1 would mean guessing | **`/grilling`** | One question at a time is the only way to walk a chain; each answer picks the next branch |
| The open decisions are largely independent - you could sensibly ask all of them right now without guessing at any answer | **`batch-grill-me`** | A whole frontier per round collapses many independent decisions into far fewer turns |

Tie-breaker: if you cannot tell, start with `batch-grill-me`. Its first round surfaces which decisions are actually chained; if the frontier turns out to be one question wide round after round, you are in `/grilling` territory - switch.

### `/grilling` - deep interactive depth

Invoke `/grilling` - a relentless one-question-at-a-time interview that walks each branch of the design tree and recommends an answer per question. Use when the ambiguity is deep or decisions depend on each other.

Note: `/grilling` currently resolves ambiguously - a local `~/.claude/skills/grilling` skill and a `mattpocock-skills:grilling` plugin skill, with different descriptions. Either satisfies this branch. See `docs/DEPENDENCIES.md`.

### `batch-grill-me` - multi-round frontier batches

Invoke `batch-grill-me`. It models the work as a **design tree** and works it in **rounds**:

- The **frontier** is every decision whose prerequisites are already settled - the questions answerable *now* without guessing at answers not yet heard.
- Ask the **whole frontier in one round**, numbered, each with your recommended answer. Then wait for the user's answers.
- Answers **reshape the tree**: settled decisions push the frontier outward and unblock what depended on them. **Recompute the frontier** and ask the next round. A question depending on another still open in this round belongs to a *later* round.
- **Sub-agents find facts; the user makes decisions.** When a frontier question needs a fact from the environment, dispatch a sub-agent rather than asking the user something you could look up. Don't block on it - only questions downstream of that exploration wait; ask the rest of the frontier now.
- **Done when the frontier is empty** - every branch visited, nothing silently assumed.

The round structure is the point. Do not flatten it into "ask several questions at once" - a single unstructured batch asks questions whose prerequisites are still open, which is exactly what the frontier rule prevents.

Fold every answer into Phase 1 - treat each as if the user specified that field upfront.

## Branch B - wayfinder (large / multi-session / many-unknowns)

When the task is too big for one agent session, or clarity needs more than a handful of questions (the route from here to a plan is itself unclear), hand off to `/wayfinder` instead of grilling. Wayfinder charts the work as a shared map of investigation tickets on the repo's issue tracker and resolves them one at a time until the plan is clear.

Route to wayfinder when **any** hold:

- The task spans more than one agent session of work.
- More than ~5 distinct open scope questions *and* answering them needs investigation first - grilling (either path) resolves preferences, not unknowns that must be researched before they can even be asked.
- The unknowns are investigative ("figure out how X works before we can scope Y"), not just preferences.
- Multiple independent workstreams need mapping before execution.

After wayfinder produces its map, resume Phase 1 with the resolved decisions folded in - the map's Decisions-so-far becomes the goal's scope. For genuinely huge efforts the map may replace a single `/goal` entirely (each ticket its own run); note that and stop rather than forcing one 4000-char condition.
