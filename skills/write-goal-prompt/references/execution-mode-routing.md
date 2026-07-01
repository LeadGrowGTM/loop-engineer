# Execution Mode Routing

Decide the *shape* of execution before authoring anything. A task can run as a
single pass, a self-paced goal loop, a recurring time-based loop, or a dynamic
multi-agent workflow. Picking wrong wastes turns (over-engineered) or under-delivers
(single pass on work that needed verification).

Sources: Anthropic, *Getting started with loops* and *A harness for every task:
dynamic workflows in Claude Code*. This file codifies their signals into a router.

## The four modes

| Mode | Tool | Ends when | Core fit |
|---|---|---|---|
| **Single run** | direct agent / one `/goal`-free pass | output produced | Bounded, one pass, correctness obvious on inspection |
| **Goal loop** | `/goal <condition>` | success condition met or turn limit | One task, self-paced, needs iteration to *reliably* clear a measurable bar |
| **Time-based loop** | `/loop`, `/schedule` | you cancel, or the watched work completes | Recurring task with changing inputs, or watching external state you don't control |
| **Dynamic workflow** | `Workflow` script | script returns | Massively parallel, highly structured, or needs adversarial verification |

## Decision order (first match wins)

Walk these top-down. Stop at the first yes.

1. **Is the work recurring, or does it watch state that changes outside your control?**
   (a PR collecting reviews, a queue filling, a daily summary, a deploy you're waiting on)
   → **time-based loop**. The task is fixed; only the inputs/time change.

2. **Is the surface large or adversarial?** Any of:
   - 50+ items to categorize / transform / verify (resumes, tickets, files, findings)
   - multiple *independent* hypotheses each needing its own exploration
   - the output must be adversarially verified (red-team, judge panel, refute-loop)
   - a single context would get lazy, drift from the goal, or grade its own homework
   → **dynamic workflow**. Fan out, verify independently, synthesize.

3. **Is there a measurable success condition that one pass won't reliably hit?**
   (a quality bar, a test that must go green, a score threshold, a count to reach)
   → **goal loop**. Iterate against the condition until met or turns run out.

4. **None of the above** — bounded, single pass, correctness visible on read →
   **single run**. *"Not all tasks require complex loops; start with the simplest solution."*

## Signal cheat-sheet

**Time-based loop** — "every", "each morning", "keep checking", "watch", "until it
merges/empties", "when X changes". Interval rule: **match the interval to how often
the watched thing actually changes; never run more often than you need.** A PR that
gets reviews hourly doesn't need a 1-minute poll.

**Goal loop** — "until it passes", "get it to <bar>", "self-evaluate", one cohesive
deliverable with a checkable done-state. This is the home turf of `write-goal-prompt`.

**Dynamic workflow** — "audit everything", "be comprehensive", "for each of these N",
"prove it's right", "compare approaches". Workflows exist to defeat three single-context
failure modes the articles name: **agentic laziness** (declares done after partial
progress), **self-preferential bias** (favors its own output when judging), **goal drift**
(loses the original objective across summarizations).

**Single run** — one file, one fix, one answer; you'd know at a glance if it's wrong.

## Modes nest — they aren't exclusive

- A **goal loop** can spawn a **workflow** inside one phase (e.g. the adversarial
  red-team in `.claude/workflows/red-team.js` is invoked from the verify phase).
- A **workflow** can contain a **loop-until-done** stage internally.
- A **time-based loop** can, on each tick, run a **single** goal pass.

So the router picks the *outer* shape. Inner phases re-route independently.

## Worked calls

| Task | Outer mode | Why |
|---|---|---|
| "Add a rate limiter, get the test green" | goal loop | one deliverable, measurable bar, needs iteration |
| "Check the deploy every 5 min and ping me when live" | time-based loop | watching external state; interval = deploy cadence |
| "Audit all 80 client repos for the leaked-key pattern" | dynamic workflow | 50+ items, parallel, verification |
| "Fix this typo in the header" | single run | bounded, obvious |
| "Build feature X overnight, prove it works" | goal loop (outer) → red-team workflow (verify phase) | iteration to a bar + adversarial proof |

## How the harness consumes this

`write-goal-prompt`'s Execution Router runs this file **first**. If the answer is
*time-based loop* or *single run*, the skill does **not** emit a `/goal` prompt — it
tells the user the simpler shape and (for loops) the `/loop`/`/schedule` invocation +
interval. If *goal loop*, it proceeds through the normal phases. If *dynamic workflow*,
it routes to a `Workflow` script (and notes the user must opt in — workflows are
billed and can spawn many agents).
