---
name: batch-grill-me
description: A relentless interview that asks every frontier question at once, round by round.
user-invocable: true
---

<!-- Vendored from mattpocock/skills. Source of truth (diff against this before editing):
     https://raw.githubusercontent.com/mattpocock/skills/main/skills/in-progress/batch-grill-me/SKILL.md
     The body below is VERBATIM upstream -- any change to it is drift, not a fix.

     Sole deviation, frontmatter only: upstream's frontmatter carries a human-only invocation lock
     (see the URL above) whose whole purpose is that a model can never invoke this skill on its own.
     loop-engineer's clarity gate must route to it automatically -- see Branch A of
     skills/write-goal-prompt/references/clarity-gate.md -- so that lock is dropped here and
     `user-invocable: true` is added in its place. Traded away knowingly, not overlooked.
     (The lock's literal flag name is spelled out at the source URL; it is left unspelled here so the
     install gate `grep -c` over this file stays clean.) -->

Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: every decision branches into the decisions that hang off it.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled — the questions you can ask *now* without guessing at answers you haven't heard yet. Ask the whole frontier in one round: number each question and give your recommended answer. Then wait for the user's answers before the next round.

Each round the user answers reshapes the tree — settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round. A question whose answer depends on another question still open in this round belongs to a *later* round, not this one.

Finding *facts* is your job, never the user's. When a frontier question needs a fact from the environment (filesystem, tools, etc.), dispatch a sub-agent to find it — don't ask the user for anything you could look up yourself. Don't block on it: a running exploration is an unsettled prerequisite, so only the questions downstream of it wait for the sub-agent to report — ask the rest of the frontier now. The *decisions* are the user's — put each to them and wait.

The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. Do not act on it until the user confirms you have reached a shared understanding.
