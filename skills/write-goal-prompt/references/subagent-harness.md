# Subagent Harness Reference

## Why This Exists

The model that wrote the code is too generous grading its own homework. Self-eval = the
agent scores 8/10, decides it's done, exits early. Loop spins. Budget drains. You wake up
to a half-finished job that "passed" its own gate.

The fix: **never let the maker be the checker.** Separate agents. Different context.
The checker reads only the final artifacts — not the maker's reasoning, not its planning,
not its self-talk. Fresh eyes or it doesn't count.

---

## Agent Files (Canonical Definitions)

The 4 harness agents are defined as proper Claude Code agents in `.claude/agents/`:

| File                                | Role                             | tools                                | model      |
| ----------------------------------- | -------------------------------- | ------------------------------------ | ---------- |
| `.claude/agents/harness-planner.md` | Decompose goal → BRIEF.md, PLAN.md | Read, Glob, Write                  | sonnet-4-6 |
| `.claude/agents/harness-maker.md`   | Execute phases, commit           | Read, Glob, Write, Edit, Bash, Agent | haiku-4-5  |
| `.claude/agents/harness-prover.md`  | Drive running app → PROOF verdict | Read, Bash                          | sonnet-4-6 |
| `.claude/agents/harness-checker.md` | Score artifacts, write CYCLE_LOG | Read, Glob, Write                    | sonnet-4-6 |

Checker's `tools: Read, Glob, Write` is **mechanical isolation** — it literally cannot run
Bash, spawn subagents, or access anything the Maker produced via tool calls. Fresh by design.

Invoke by name: `Agent({subagent_type: "harness-planner", prompt: "..."})`. HARNESS.md
supplies task-specific context; the agent files contain structural templates.

### Canonical install paths (agents are global; project state is not)

Harness agents ship in ONE runtime location — the loop-engineer plugin:

```
${CLAUDE_PLUGIN_ROOT}/.claude/agents/harness-*.md   ← source of truth, loaded at runtime for every repo
```

No sync, no copies, ever. Do NOT copy harness agents into the user-level `.claude/agents/`
directory (`$HOME/.claude/agents/`) or a project's own `.claude/agents/` directory — a user- or
project-level copy silently SHADOWS the plugin's agent (project > user > plugin precedence) and
recreates the exact copy-drift this model replaced. There is nothing to keep "in sync" because
there is only one copy.

What IS project-scoped lives under each project's `.harness/`: `skill-routing.md`, `goals/<slug>/`
(this run's artifacts), and the per-project `.tasks.toml` backlog. `/setup-harness <repo-root>`
seeds that project's `.harness/`, `.tasks.toml`, and `treehouse.toml` — and verifies plugin
integrity (confirms every agent the plugin claims to ship actually exists in the plugin source).
It does not install, copy, or sync agents anywhere.

---

## BRIEF.md — Product Brief

**What it is:** Planner writes BRIEF.md as the first artifact (before PLAN.md). It anchors the goal at the product level — why this work matters and what success looks like from the user's perspective.

**Format (3 sections):**

```
# Goal Brief — <task-slug>

## Problem
<one sentence — why this work matters, from the user's perspective>

## Success criteria (product-level)
- <what the user observes when done — not "tests pass", not "file exists">
- <observable outcome 2>

## Out of scope
- <explicit exclusion 1 — things NOT being built>
- <explicit exclusion 2>
```

**Why separate from PLAN.md:** PLAN.md is technical (phases, skill routing, checker dimensions). BRIEF.md is product — it answers "should we be doing this at all?" and "did we solve the right problem?" Checker uses BRIEF.md to detect scope drift. If Maker produces "all tests pass" but the brief's success criteria are unmet, Checker catches it.

**Cross-reference:** PLAN.md checker rubric must align with BRIEF.md success criteria. If BRIEF.md says "user can generate reports in 2 clicks", the rubric should score UX/ease-of-use. If BRIEF.md excludes mobile, the rubric should not penalize "mobile responsive".

---

## Depth Budget

Claude Code enforces a 5-level agent depth limit. At depth 5, `Agent` tool is not provided.

| Level | Agent                          | Notes                            |
| ----- | ------------------------------ | -------------------------------- |
| 0     | Goal loop agent                | Spawns planner and maker         |
| 1     | harness-planner                | Write-only phase; spawns nothing |
| 2     | harness-maker                  | Can spawn skill agents (depth 3) |
| 3     | Skill agents / harness-checker | Can spawn nothing below depth 4  |
| 4     | Sub-skill agents (max)         | Final usable level               |

**Design rule:** Checker runs at depth 3 max. If verification needs a sub-verifier,
run it at depth 4. Never design a harness that needs depth 5 — it silently loses the Agent tool.

---

## The 3-Phase Runtime Harness

Every goal prompt runs three logical phases. Simple tasks collapse them; complex tasks
keep them explicit. The Harness Architect agent (Phase 1.5 of the skill) customizes
HARNESS.md for the specific task; the agent files contain the structural templates.

---

### Phase 1: Planner

**Role:** Decompose the goal into phases. Select the right skills. Write BRIEF.md (product brief)
and the execution plan before any artifacts are produced. This is the only phase that reads the full spec.

**Inputs:** Goal statement, [TASK] block, [TOOLS] block, HARNESS.md planner brief.

**Output — BRIEF.md must contain (written first):**
- Problem: one sentence on why this work matters
- Success criteria: product-level observables (not technical)
- Out of scope: explicit exclusions

**Output — PLAN.md must contain (written second):**

- Phase list with names and ordering (e.g., Phase 1: Research, Phase 2: Draft, Phase 3: Finalize)
- Skill-per-phase routing: which skill or direct implementation step covers each phase
- Checker rubric: exact dimensions the checker will score (1-5), threshold for PASS
- Dependency graph: which phases can run in parallel vs. must be sequential
- Turn budget allocation: estimated turns per phase

**Constraint:** Planner writes BRIEF.md and PLAN.md, then stops. It does not produce task artifacts.
Maker reads both files on its first turn. Checker reads BRIEF.md to detect scope drift.

**Template prompt for PLAN.md:**

```
You are the Planner for this task. Your job is to set up the Maker for success, not to
do the work yourself. Write PLAN.md with these four sections:

## Phases
[numbered list: name, skill/method, expected output artifact]

## Checker Rubric
[dimensions the Checker will score 1-5, plus PASS threshold]

## Turn Budget
[turns-per-phase estimate; planner itself uses turns 1-5]

## Dependencies
[what must complete before what; which phases are parallelizable]

Write PLAN.md. Do not produce any task artifacts. Stop when PLAN.md is written.
```

---

### Phase 2: Maker

**Role:** Execute the task phase by phase, per PLAN.md. Invoke skills as specified by
Planner's routing. Commit at each phase boundary.

**Inputs:** PLAN.md (read on first turn), goal context, skills listed in [TOOLS].

**Rules:**

- Follow PLAN.md phase order. Don't skip or reorder without noting it.
- Invoke skills exactly as specified in maker routing. Don't improvise alternatives
  unless a skill is unavailable — in that case, Tier 1 fallback: same process manually.
- Commit after each phase. If session dies, completed phases survive.
- Write progress to PROGRESS.md after each phase: phase name, status, artifact path.

**Maker does NOT:**

- Run the qualitative gate (that's Checker's job)
- Score its own work
- Decide whether it's done enough — only the Checker decides PASS/ITERATE

**Mechanical gate:** Maker runs the fast binary check after each phase (tests pass, file
exists, lint clean). This is not eval — it's "is the artifact present and structurally
valid." If mechanical gate fails, Maker fixes and re-runs before signaling Checker.

---

### Phase 3: Checker

**Critical: Checker is a separate subagent. It does NOT inherit Maker's context.**

**Role:** Evaluate the final artifacts against the checker rubric in PLAN.md. Produce
the reward signal. Decide PASS or ITERATE. Name the weakest dimension if ITERATE.

**Checker prompt must open with (verbatim):**

> "You are a fresh reviewer. You did NOT write this work. You have not seen the
> Maker's reasoning, planning, or self-assessment. Approach this output as if
> you are evaluating someone else's work for the first time."

**Inputs (artifacts ONLY — no reasoning context):**

- Final output artifacts (files, not console output or logs)
- Checker rubric from PLAN.md (read this, not PROGRESS.md)

**Output — CYCLE_LOG.md entry** (must match harness-checker.md format exactly):

```
## Cycle N — YYYY-MM-DD
### Dimension Scores
- [Dimension 1]: X/5 — evidence: `file:line or exact command output`
- [Dimension 2]: X/5 — evidence: `file:line or exact command output`
- [Dimension N]: X/5 — evidence: `file:line or exact command output`
### Reward Signal: X.X / 5.0
### Pass threshold: <from PLAN.md>
### Verdict: PASS | ITERATE | PLATEAU
### Weakest dimension: [name] ([score]/5)
Fix target: [one sentence citing the evidence above]
### Artifacts evaluated
- `<path>` — <line count> lines
```

Scores without `evidence:` citations are invalid. "Looks good" is not evidence.

**Checker stops after writing CYCLE_LOG.md.** Maker reads it on the next cycle.

---

## Budget Allocation (defaults — adjust per task complexity)

| Phase                  | Turns         | Notes                        |
| ---------------------- | ------------- | ---------------------------- |
| Planner                | 1–5           | Never more than 10           |
| Maker (main execution) | 6–70          | Bulk of the budget           |
| Checker (per cycle)    | 3–5 per cycle | Runs after each maker pass   |
| Buffer / report        | 75–80         | Morning report, final commit |

Default max_cycles: 3. If 3 consecutive cycles return the same reward signal → plateau,
commit best, note in HANDOFF.md.

---

## When to Split Into Multiple Makers

Use a single Maker unless:

- Task has 3+ independent phases that don't share context
- Phases require different skills that would bloat a single context
- Parallelism is possible (PLAN.md marks phases as parallel-safe)

When splitting: each Maker gets its own phase brief, reads PLAN.md, writes to separate
artifact paths, signals completion via PROGRESS.md. Checker evaluates all artifacts together.

---

## Fork Mode (Planner → Maker Handoff)

Default: Maker spawns fresh (blank context), reads PLAN.md from disk. This works.

Fork mode alternative: fork the Maker from the Planner so it inherits context without
re-reading PLAN.md. Cheaper when PLAN.md is large (shared prompt cache ~10x cost reduction
for children 2-N). Use fork when PLAN.md exceeds ~2000 tokens.

**Never fork the Checker.** Checker must start blank — fork would inherit Maker context
and defeat isolation. Checker always spawns fresh.

---

## Checker Independence Rules (Non-Negotiable)

1. Checker is spawned as a subagent — `Agent(prompt, {label: "checker-cycle-N"})`
2. Checker prompt does NOT include Maker's tool output, planning notes, or self-comments
3. Checker reads final artifacts via file paths — not via context passed from Maker
4. If Maker's self-assessment exists in a file, Checker is explicitly told NOT to read it
5. Checker rubric comes from PLAN.md, not from Maker's assessment of what it did well
6. On a PASS, Checker names the score threshold it cleared — not just "looks good"

The single most expensive failure mode: Maker outputs "I scored myself 8/10 on all dimensions"
and Checker reads that, anchors on it, and confirms. This is not a checker. It's an echo.
Checkers must derive scores from artifact evidence, not from Maker testimony.
