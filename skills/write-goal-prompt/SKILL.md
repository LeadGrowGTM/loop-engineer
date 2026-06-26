---
name: write-goal-prompt
description: >
  Transforms a task description into a ready-to-paste /goal command for Claude Code.
  Use when handing off overnight or unsupervised work — multi-step implementation,
  migration, backlog drains, anything with a verifiable end state. Outputs a structured
  goal condition (up to 4000 chars) with context-based auto-compaction, HTML summary
  page, Excalidraw diagram, and fallback guardrails baked in. Triggered by: "write a
  goal prompt", "turn this into a /goal", "overnight task", "run unsupervised",
  "hand off this task".
version: 3.6.0
maturity: validated
triggers:
  - write a goal prompt
  - turn this into a /goal
  - overnight task
  - run unsupervised
  - hand off this task
  - /goal prompt
  - goal prompt
feedback:
  last_reviewed: 2026-06-21
  known_gaps:
    - 'Goal evaluator checks existence not quality — quality floors in done criteria are the only defense'
    - 'HARNESS.md must be written to task working dir before emitting — easy to forget'
---

# Skill: Write Goal Prompt

Converts a free-form task into a `/goal` command ready to paste into Claude Code. Designed for overnight handoffs — agent runs autonomously, self-evaluates against a fixed signal, leaves a structured morning report. Output: structured goal condition (≤4000 chars) with eval loop, tiered fallbacks, HTML + Excalidraw morning report.

## What `/goal` Is

`/goal <condition>` sets an autonomous loop: Claude works, then a small model checks whether the condition holds. Repeats until met or you run `/goal clear`. Requires Claude Code v2.1.139+.

---

## Phase 0: Eval Loop Design

**No subagents — author decision work. Run before intake.**

A goal without an eval is a task description. Output: completed `[EVAL LOOP]` block. See `references/eval-loop-design.md` for the four design questions, human-judgment flag, and task-type lookup.

Produce: single reward signal (programmatic — flag if human judgment required) · mechanical gate (binary, seconds, no LLM) · qualitative gate (scored) · max_cycles (default 3) · done condition (exact threshold).

---

## Phase 0.5: Grill Me

**Execution: spawn 1 Haiku/Explore agent — do not run inline. Run after Phase 0, before Phase 1.**

**Skip condition:** All Phase 1 fields (Task, Tech/Stack, Done criteria, Context) are fully specified in the user's opening message — no ambiguity. Otherwise always run.

**Agent prompt:**

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
- Questions must be specific to THIS task — not generic checklist
- Max 5 questions, min 3
- Return ONLY: an array of {question: string, header: string} — header is ≤12 chars

Example for "build a triage dashboard":
[
  {question: "Should unreviewed runs appear or be hidden by default?", header: "Default view"},
  {question: "Read-only or can it write verdict/dismiss from the UI?", header: "Write access"},
  {question: "Mobile-responsive or desktop only?", header: "Responsive"}
]
```

Collect the agent's questions array. Present all questions in ONE AskUserQuestion call (multiSelect: false per question). Then fold answers into Phase 1 — treat each answer as if the user specified that field upfront.

---

## Phase 1: Gather Inputs

| Field                 | What you need                                                                 | Required?                                             |
| --------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Task**              | What to build / fix / migrate — one sentence                                  | Yes                                                   |
| **Tech / Stack**      | Language, framework, runtime, key libraries                                   | Yes — pull from Context if given                      |
| **Key features**      | Explicit must-have list — what the agent must build, not infer                | Yes for build/create tasks                            |
| **Done criteria**     | Verifiable end state (test exits 0, file exists, queue empty)                 | Yes                                                   |
| **Quality bar**       | What "done well" looks like — polish level, production-readiness signal       | Yes — default: "production-grade, no rewrites needed" |
| **Context**           | Repo, docs, branch, access constraints                                        | Yes                                                   |
| **Stretch goals**     | Optional nice-to-haves — tackle only if ahead on turns                        | No — omit if none                                     |
| **Constraints**       | Cost ceilings, disruption risks, things that must NOT be touched unsupervised | No — but always ask for live/shared environments      |
| **Turn budget**       | Max turns before stopping                                                     | No — default 80                                       |
| **Compact threshold** | Context size triggering /compact                                              | No — default 170k                                     |
| **Blockers**          | What Claude should NOT do without a decision                                  | No                                                    |

**Intake rules:** Skip if all fields present. Ask Key features + Quality bar together if missing (one question). Extract Tech/Stack from Context if buried. Surface Constraints before emitting if task touches live env, shared DB, or per-call API.

---

## Phase 1.5: Harness Discovery

**Execution: spawn 4 parallel Haiku/Explore agents — do not run inline.** Fan out after intake to map available skills, agents, CLI tools, and design the runtime harness.

**Agent 1 — Skill Scanner (Explore / Haiku)**

```
Read .claude/agent-context/snapshot.md for workspace context before starting.
Glob these skill locations: .claude/skills/*/SKILL.md, lg-*/skills/*/SKILL.md,
leadgrow-hq/.claude/skills/*/SKILL.md, website/.claude/skills/*/SKILL.md.
For each skill found, read its name and description fields from YAML frontmatter.
Return: array of {name, description, path} for skills relevant to this task: [TASK SUMMARY].
Relevant = skill description mentions any of: [key nouns from the task].
Max 8 results. If more match, prefer the most specific.
```

**Agent 2 — Agent Roster Scanner (Explore / Haiku)**

```
Read .claude/agent-context/snapshot.md for workspace context before starting.
Read .claude/rules/workflow.md (Agent Roster section) and
the available agent types listed in the session system reminder.
Return: array of {agentType, useFor} for agent types relevant to this task: [TASK SUMMARY].
Also note: is smart-searcher available? is task-orchestrator available?
```

**Agent 3 — CLI / Script Scanner (Explore / Haiku)**

```
Read .claude/agent-context/snapshot.md for workspace context before starting.
Check: (1) ~/.claude/reference/cli-map.md for CLI tools relevant to this task: [TASK SUMMARY].
(2) Glob leadgrow-hq/tools/**/*.py and leadgrow-hq/tools/**/*.ts — list scripts whose
filename suggests relevance to the task domain.
(3) Glob the skill's own scripts/ folder if a relevant skill was identified.
Return: array of {tool, purpose, invocation} for up to 5 relevant tools/scripts.
```

**Agent 4 — Harness Architect (Explore / Haiku)**

```
Read .claude/agent-context/snapshot.md for workspace context before starting.
Confirm harness agents exist in at least one of these locations (Glob both):
  - .claude/agents/harness-planner.md, harness-maker.md, harness-checker.md
  - ~/.claude/agents/harness-planner.md, harness-maker.md, harness-checker.md
Read .harness/skill-routing.md (installed by /setup-harness). If missing, fall back to
  .claude/skills/write-goal-prompt/references/skill-routing.md.

Task being goal-prompted: [TASK SUMMARY]
Skills confirmed available (from Agent 1): [SKILL SCANNER RESULTS]

Write HARNESS.md content with FIVE sections:

PLANNER_BRIEF:
What context files should Planner read first for this task?
What phases should PLAN.md have? What ordering/dependency constraints?
What turn budget split makes sense given task complexity?

MAKER_ROUTING:
Map each phase to a specific skill from the confirmed list, or "direct" if none match.
Format: "Phase N: <skill-name or direct> — <artifact it produces>"
Follow skill-routing.md heuristics.

PROVER_BRIEF (include only if goal involves a running app — UI feature, API endpoint, or CLI behaviour; otherwise write "PROVER_BRIEF: N/A — static artifact goal"):
Feature intent: <one sentence — what the feature should do, from the goal>
How to exercise: <exact CLI command, curl call, or browser URL + steps>
Auth: <credentials or "no auth required">
Accept criteria: <observable output that means "works" — paste-able result>

CHECKER_BRIEF:
Which artifact paths should Checker evaluate?
What rubric dimensions (1-5) apply? What does a 5 look like vs a 1 for each?
What PASS threshold (default: mean ≥ 3.5/5.0)?
Note: checker agent file enforces fresh context — no extra isolation instructions needed.

LOOP_TRACKER:
A markdown checklist the running agent fills in as the loop progresses.
Emit exactly this template (fill in phase names from MAKER_ROUTING above;
omit Prover rows if PROVER_BRIEF is N/A):

## Loop Tracker
> Update this file as you complete each step. Check off items in order.

### Planner
- [ ] HARNESS.md read
- [ ] skill-routing.md read
- [ ] PLAN.md written: `<path>`

### Cycle 1
- [ ] Maker: <Phase 1 name> — artifact: `<path>` — commit: `<SHA>`
- [ ] Maker: <Phase N name> — artifact: `<path>` — commit: `<SHA>`
- [ ] Mechanical gate: passed
- [ ] Prover: PROOF VERDICT received — Feature: works | broken
- [ ] Checker: CYCLE_LOG.md written: `<path>`
- [ ] Reward signal: __/5.0 (threshold: <T>/5.0)
- [ ] Verdict: PASS / ITERATE / PLATEAU

### Cycle 2 (if ITERATE)
- [ ] Fix target: <weakest dimension from Cycle 1>
- [ ] Maker: changes applied — commit: `<SHA>`
- [ ] Mechanical gate: passed
- [ ] Prover: PROOF VERDICT received — Feature: works | broken
- [ ] Checker: CYCLE_LOG.md updated
- [ ] Reward signal: __/5.0
- [ ] Verdict: PASS / ITERATE / PLATEAU

### Cycle 3 (if ITERATE again)
- [ ] Fix target: <weakest dimension from Cycle 2>
- [ ] Maker: changes applied — commit: `<SHA>`
- [ ] Mechanical gate: passed
- [ ] Prover: PROOF VERDICT received — Feature: works | broken
- [ ] Checker: CYCLE_LOG.md updated
- [ ] Reward signal: __/5.0
- [ ] Verdict: PASS / PLATEAU (max cycles reached)

### Final
- [ ] HANDOFF.md written: `<path>`
- [ ] HANDOFF.html written: `<path>`
- [ ] HANDOFF.excalidraw written: `<path>`
```

Synthesize Agents 1-3 into `[TOOLS]` block. Agent 4 output becomes `HARNESS.md` (written in Phase 2.5 before length measurement). Omit `[TOOLS]` entirely if nothing relevant found — don't invent tools. Drop CLI tools first if tight on 4000-char limit. Phase 2.5 skills-exist check satisfied by discovery output — no re-glob needed.

---

## Phase 2: Format the Goal Condition

Template below. Keep total **under 4000 characters**.

```
[GOAL] <one-sentence verifiable end state — what the evaluator checks>

[DATE] <today's date in YYYY-MM-DD — deterministic, no Date.now()>

[TASK]
I'm handing you this task to run unsupervised overnight.

<full task description, precise scope>

Stack: <language / framework / runtime / key libraries>

Must include:
- <feature 1>
- <feature 2>
- <feature N — explicit, not inferred>

Quality bar: <what "done well" looks like>

Done means:
- <criterion 1 — existence: file X exists>
- <criterion 2 — quality: file X cites ≥N sources / has ≥N lines / passes grep for Y>
- <criterion 3 — no silent downgrades: HANDOFF.md lists any phase marked DRAFT>

Stretch goals (tackle only if ahead on turns — do NOT delay required work):
- <optional nice-to-have 1>
[Omit this block entirely if no stretch goals were specified]

Use this context:
<repo path / branch / docs / access / constraints>

[TOOLS]
<populated from Phase 1.5 discovery — omit entirely if nothing relevant found>

[HARNESS]
Read HARNESS.md before starting. Four-phase execution:
1. Planner (turns 1-5): decompose task → write PLAN.md (phases, skill routing, checker rubric).
   Do not produce task artifacts until PLAN.md is written.
2. Maker (turns 6-<N>): execute per PLAN.md, invoke skills per phase, commit at each phase boundary.
3. Prover (running-app goals only): spawn harness-prover with PROVER_BRIEF from HARNESS.md.
   Pass feature intent + exercise instructions. Get PROOF VERDICT before Checker.
   Skip this step entirely for static artifact goals (PROVER_BRIEF: N/A).
4. Checker: spawn fresh harness-checker subagent with CHECKER_BRIEF from HARNESS.md.
   Pass artifact paths + PROOF VERDICT (if running-app goal).
   Checker opens "I did not write this." Writes scores to CYCLE_LOG.md.

Work through the task to completion. If you hit a blocker, do not stop. Use mocks, stubs, or documented assumptions. Record each workaround and continue with everything that does not require my decision.

[EVAL LOOP]
At turn 1, before any other work, write your eval plan in HANDOFF.md under
"Eval Loop Design". Do not start the task until this is written. Include:
  - Reward signal: <single metric>
  - Mechanical gate: <fast binary check — runs in seconds, no LLM judgment>
  - Qualitative gate: <scored check — produces the reward signal>
  - Max cycles: <N — default 3>
  - Done condition: <exact threshold>

Then execute the task using this loop — repeat up to <max_cycles> times:
  1. Generate output (inputs are fixed — do not change the spec, only the output)
  2. Run mechanical gate — if it fails, fix and re-run before proceeding to step 3
  3. Spawn checker subagent (checker brief in HARNESS.md) — pass artifact paths only,
     not your context. Checker opens "I did not write this." Writes dimension scores
     + reward signal to CYCLE_LOG.md.
  4. If done condition met → commit, proceed to next phase
  5. If not → read CYCLE_LOG.md, fix only the lowest-scoring dimension, return to step 1
  6. If 3 consecutive cycles produce the same reward signal → exit loop (plateau),
     commit current best, note "plateau after N cycles" in HANDOFF.md

Log each cycle to HANDOFF.md: cycle number, mechanical gate result, reward signal score, what changed.
After each cycle, update the LOOP_TRACKER section in HARNESS.md — check off completed steps, fill in paths, SHAs, and reward signals.

[CONTEXT MANAGEMENT]
Run /compact when context approaches 170k tokens. After compacting, state your current checkpoint before continuing. Do NOT compact on turn 1.

[CONSTRAINTS]
<Include this block whenever any of the following apply — omit entirely if none do>
Cost ceiling: <e.g., "Stay under $5 in API calls total.">
Do NOT touch unsupervised:
- <live table / running job / shared sheet>
If any constraint would be violated: stop that task, document in HANDOFF.md under
"Constraint Block", and continue with everything that doesn't violate.

[BLOCKERS]
If you hit a hard blocker: mock/stub it, document in HANDOFF.md under "Needs My
Decision", and continue all work that does not depend on the blocked piece.
Skill/process failures use tiered fallbacks — never silently downgrade substance:
- Tier 1: Run the same process manually (same depth, same searches)
- Tier 2: Reduced scope — mark artifact quality: draft in frontmatter
- Tier 3: Skeleton from trained knowledge — mark quality: placeholder, flag in HANDOFF

[PROOF PROTOCOL]
Every completed phase needs proof, not assertion. After each phase append to PROGRESS.md:
  Phase N: <name> — COMPLETE
  Artifact: <absolute-path>
  Proof: <actual command output — paste it, don't describe it>
  e.g. "npm test: 47 passed, 0 failed" not "tests pass"
  e.g. "wc -l output.md: 312 lines" not "file written"
  e.g. "grep -c 'https://' research.md: 34 sources" not "well-sourced"
  Commit: <SHA>
Never write "Phase N complete" without proof on the line below it.

[MORNING REPORT]
By morning, leave me three files in the task's working directory:
1. HANDOFF.md — what completed, workarounds, needs my decision, evidence
2. HANDOFF.html — single-page visual summary (see references/morning-report-specs.md)
3. HANDOFF.excalidraw — architecture/flow diagram (see references/morning-report-specs.md)

[TURN LIMIT] Stop after <max_turns> turns. If not done, write all three files anyway.
```

---

## Phase 2.5: QA Validation

**Execution: spawn 1-3 parallel Haiku/Explore agents — do not run inline.**

### Step 0 — Write HARNESS.md (before measuring)

Write `HARNESS.md` to the task working directory using Agent 4 output from Phase 1.5.
The file must contain three sections: `PLANNER_BRIEF`, `MAKER_ROUTING`, `CHECKER_BRIEF`.

Then update the `[HARNESS]` block in the goal candidate so the first line reads:
`Read <absolute-path>/HARNESS.md before starting.`

If the task's working directory is not clear from context, write to
`temp/goals/<task-slug>/HARNESS.md` and use that absolute path.

This step happens before length measurement — HARNESS.md content is NOT inlined
into the goal prompt. The goal only carries the path reference.

### HARD LENGTH GATE — BLOCKING, MEASURED, NO EXCEPTIONS

`/goal` **rejects any condition ≥4000 characters** ("Goal condition is limited to 4000 characters"). A rejected goal is a failed deliverable. This gate is mechanical — DO NOT eyeball it.

Before emitting, you MUST run this sequence as actual shell commands (not mentally):

**Step 1 — write candidate to file:**

```
Write (tool) → temp/_goal-candidate.txt
```

**Step 2 — measure (Python, cross-platform — run via Bash tool):**

```bash
python -c "txt=open('temp/_goal-candidate.txt').read().rstrip('\n'); print(len(txt))"
```

`/goal` strips one trailing newline before counting. This command replicates that exactly.

**Step 3 — gate:**

- Result **≥ 4000** → BLOCKED. Compress (see `references/qa-checklist.md` Length Gate steps). Re-write file. Re-run Step 2. Repeat until result < 3990.
- Result **< 3990** → pass. Proceed.

**Step 4 — emit with proof:**
Include `[Measured: XXXX chars]` immediately before the code fence. No measured count = gate not run = failure.

Never emit an unmeasured or ≥4000 goal. "Looks about right" is a failure. `wc -m` does NOT work on Windows — use the Python command above always.

### Remaining QA

Fix any failure before emitting: (1) context verification — subagents confirm paths/skills exist (2) dry-run self-check — 12 checks (3) eval loop check — signal programmatic, gate fast, max_cycles set, done condition a threshold. Full checklists in `references/qa-checklist.md`.

---

## Phase 3: Output

Emit as a code fence. Add: **"Paste this into a Sonnet session. `/goal clear` to abort early."** See `EXAMPLES.md` for a complete worked example.

---

## Reference Files

| File                                 | Contents                                                                                                 |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `references/eval-loop-design.md`     | Phase 0 four questions, human-judgment flag, task-type lookup                                            |
| `references/subagent-harness.md`     | Planner/maker/checker templates, budget allocation, checker independence rules                           |
| `references/skill-routing.md`        | Task type → skill mappings, chaining patterns, quality bars per skill                                    |
| `references/qa-checklist.md`         | Length gate, context verification, dry-run checks, quality floors, git cadence, full condition checklist |
| `references/morning-report-specs.md` | HTML summary spec, Excalidraw JSON structure, color coding                                               |
| `references/context-management.md`   | 170k threshold rationale, checkpoint protocol                                                            |
| `EXAMPLES.md`                        | Full worked example with Phase 0 design and output                                                       |
