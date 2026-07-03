# Goal-Loop Issue Tracker (durable phase slices)

How the goal loop tracks work **inside** a run. Each PLAN.md phase is mirrored 1:1 as
a durable slice file on disk, so the work unit survives `/compact` and carries a
per-phase `Status:` - which an ephemeral `## Phases` bullet cannot. Slices AUGMENT
the phases; they do not replace them. PLAN.md `## Phases` stays canonical and is the
fallback drive-list if `issues/` is ever absent. This convention is uniform across
every repo a goal runs in; it does NOT depend on the repo's `docs/agents/issue-tracker.md`.

## Where slices live

Task working directory (defaults to `temp/goals/<task-slug>/`):

```
temp/goals/<task-slug>/
  PRD.md                 <- /to-prd (or Planner) - the product brief
  issues/
    01-<slug>.md         <- one durable slice per phase, numbered from 01
    02-<slug>.md
  PLAN.md                <- Planner: skill routing + rubric + budget + pointer to issues/
  PROGRESS.md            <- Maker: proof per slice
  CYCLE_LOG.md           <- Checker: rubric scores
```

## Naming rule (the 1:1 mapping depends on it)

- File name: `issues/NN-<slug>.md`. `NN` is zero-padded from `01`, in PLAN.md phase order.
- One slice per phase, exactly. Slice `NN` corresponds to phase `N` - never merge or split.
- `<slug>` = a 2-4 word kebab of the phase name (e.g. phase "Add pytest test" -> `02-add-pytest-test.md`).
- `Blocked by:` lists the `NN` numbers of prerequisite slices, or `none`.

## Slice file schema (tracer-bullet vertical slice)

```
# <NN> - <slice title>
Status: ready-for-agent
Blocked by: <NN, NN or "none">

## Parent
<the PRD / goal this traces to>

## What to build
<the thin end-to-end slice through all layers - not a horizontal layer>

## Acceptance criteria
- <observable, checkable outcome 1>
- <observable outcome 2>

## Skill routing
<skill from skill-routing.md, or "direct"> - <artifact path>
```

## Status vocabulary (triage state)

`ready-for-agent` -> `in-progress` -> `done`, or `blocked` (with a `Blocked by:` line).
These are the local-markdown mapping of the five canonical triage roles
(`triage-labels.md`). Maker updates the `Status:` line in place as it works a slice.

## Interactive vs autonomous authoring

- **Interactive** (a human runs `write-goal-prompt`): invoke `/to-prd` to turn the
  conversation into `PRD.md`, then `/to-issues` to decompose it into slice files -
  targeting `temp/goals/<slug>/issues/` with this local schema, regardless of the
  repo's default tracker backend.
- **Autonomous** (the `/goal` loop, no user to quiz): the Planner writes PLAN.md
  `## Phases` as usual, then mirrors each phase into a slice file in this schema (no
  interactive quiz). The Maker drives off the slices when present, else off the phases.

## Boundary: this is NOT PLATEAU escalation

Phase slices are the goal's internal work breakdown (local, per-run). A **PLATEAU**
(3 cycles within ±0.1 reward) is a different event: it escalates OUT to the repo's
configured tracker - GitHub via `docs/agents/issue-tracker.md` - for cross-session
human review. Do not conflate the two. Slices = local markdown; escalation = GitHub.
