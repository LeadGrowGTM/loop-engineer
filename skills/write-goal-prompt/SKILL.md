---
disable-model-invocation: true
name: write-goal-prompt
description: >
  Transforms a task description into a ready-to-paste /goal command for Claude Code.
  Use when handing off overnight or unsupervised work — multi-step implementation,
  migration, backlog drains, anything with a verifiable end state. Outputs a structured
  goal condition (up to 4000 chars) with context-based auto-compaction, HTML summary
  page, Excalidraw diagram, and fallback guardrails baked in. Triggered by: "write a
  goal prompt", "turn this into a /goal", "overnight task", "run unsupervised",
  "hand off this task".
version: 3.8.0
maturity: validated
triggers:
  - write a goal prompt
  - turn this into a /goal
  - overnight task
  - run unsupervised
  - hand off this task
  - /goal prompt
  - goal prompt
  - run with gnhf
  - autonomous loop
  - gnhf this
  - run overnight
  - parallel agents
feedback:
  last_reviewed: 2026-06-21
  known_gaps:
    - "Goal evaluator checks existence not quality — quality floors in done criteria are the only defense"
    - "HARNESS.md must be written to task working dir before emitting — easy to forget"
---

# Skill: Write Goal Prompt

Converts a free-form task into a `/goal` command ready to paste into Claude Code, OR a `gnhf` autonomous run command for overnight unattended work. Designed for overnight handoffs — agent runs autonomously, self-evaluates against a fixed signal, leaves a structured morning report. Output: structured goal condition (≤4000 chars) with eval loop, tiered fallbacks, HTML + Excalidraw morning report.

## Execution Router (Run Before Phase 0)

**Step 0 — Resolve project scope (do this before anything else).** The loop anchors every artifact to the project it runs in, not the workspace root. Resolve the project root once:

```bash
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
```

Everything this run writes lives under `$PROJECT_ROOT`:

- **Working dir:** `$PROJECT_ROOT/.harness/goals/<slug>/` — BRIEF.md, PLAN.md, issues/, PROGRESS.md, CYCLE_LOG.md, HANDOFF.*
- **Backlog:** run tasks-axi from `$PROJECT_ROOT` so it resolves the project-local `.tasks.toml` (seeded by `/setup-harness`), not the monorepo one.
- **Commits:** the Maker commits to the `$PROJECT_ROOT` repo.
- **treehouse / gnhf:** launch from `$PROJECT_ROOT` so worktrees and runs anchor to this repo.

Pass the resolved working-dir absolute path to every harness agent — they write bare filenames relative to it. If `$PROJECT_ROOT` is not a git repo, fall back to cwd (old behavior).

Then determine execution mode. Ask if not obvious from context. This is the **infrastructure** axis (where/how the harness runs); it is distinct from the *task-shape* axis in the "Execution Mode Routing" section below (`references/execution-mode-routing.md`).

| Task shape                                   | Mode                                              |
| -------------------------------------------- | ------------------------------------------------- |
| < 1 hr, needs back-and-forth decisions       | **in-session harness** - proceed to Phase 0       |
| > 1 hr, fully specifiable, can run overnight | **gnhf autonomous** - see gnhf Path section below |
| Multiple independent streams simultaneously  | **parallel gnhf + treehouse** - see gnhf Path     |

**Always register in tasks-axi first (both modes) — run from `$PROJECT_ROOT` so it hits the project-local backlog:**

```bash
cd "$PROJECT_ROOT"
tasks-axi add <slug> "<one-line title>"
tasks-axi start <slug>
# On completion: tasks-axi done <slug> [--pr <url>]
```

Slug format: `<domain>-<3-4-word-kebab>` e.g. `outbound-rbs-sequence-v3`, `content-linkedin-batch-q3`.

---

## What `/goal` Is

`/goal <condition>` sets an autonomous loop: Claude works, then a small model checks whether the condition holds. Repeats until met or you run `/goal clear`. Requires Claude Code v2.1.139+.

---

## Phase 0: Eval Loop Design

**No subagents — author decision work. Run before intake.**

A goal without an eval is a task description. Output: completed `[EVAL LOOP]` block. See `references/eval-loop-design.md` for the four design questions, human-judgment flag, and task-type lookup.

Produce: single reward signal (programmatic — flag if human judgment required) · mechanical gate (binary, seconds, no LLM) · qualitative gate (scored) · max_cycles (default 3) · done condition (exact threshold).

---

## Phase 0.5: Clarity Gate

**Run after Phase 0, before Phase 1.** Resolve ambiguity BEFORE authoring the goal. Do not skip lightly - an unclear goal wastes an unsupervised run. Route on task size; branch bodies live in `references/clarity-gate.md`.

**Skip only when** all Phase 1 fields (Task, Tech/Stack, Done criteria, Context) are fully specified in the user's opening message with no open scope questions. When in doubt, do not skip - grill.

| Signal | Route |
| --- | --- |
| Fully specified, zero ambiguity | **Skip** → Phase 1 |
| Large / multi-session / >~5 open scope questions / investigative unknowns | **`/wayfinder`** — chart the work as an investigation-ticket map, resolve, then resume Phase 1 with decisions folded in (Branch B) |
| Single-session scope with some ambiguity | **grill** — `/grilling` for deep interactive depth, or the batch-question agent for one `AskUserQuestion` round (Branch A) |

Fold every answer (or the wayfinder map's decisions) into Phase 1 as if the user specified those fields upfront. See `references/clarity-gate.md` for the grill agent prompt and the full wayfinder routing test.

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

**Ambiguous scope → `/to-prd` intake (optional):** If the task is underspecified and you're authoring interactively, run `/to-prd` first to turn the conversation into a `PRD.md` in the task working dir. The Planner then traces each phase slice's Parent to it (see `references/issue-tracker.md`). Skip for well-specified tasks — don't add ceremony a one-line goal doesn't need.

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

REDTEAM_BRIEF (include only if the goal ships a running app, a user-facing flow, or security-sensitive code — otherwise write "REDTEAM_BRIEF: N/A"):
target: <one paragraph — what was built, written for attackers who owe it no charity>
paths: <files/dirs the red-team roles must read before attacking>
entryPoint: <how a user or caller reaches the feature>
outOfScope: <known-safe things not worth reporting>

CHECKER_BRIEF:
Which artifact paths should Checker evaluate?
What rubric dimensions (1-5) apply? What does a 5 look like vs a 1 for each?
What PASS threshold (default: mean ≥ 3.5/5.0)?
Note: checker agent file enforces fresh context — no extra isolation instructions needed.

LOOP_TRACKER:
A markdown checklist the running agent fills in as the loop progresses.
Emit exactly this template (fill in phase names from MAKER_ROUTING above;
omit Prover rows if PROVER_BRIEF is N/A; omit Red-team rows if REDTEAM_BRIEF is N/A):

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
- [ ] Red-team: worst-first holes triaged — critical/high fixed (adversarial goals)
- [ ] Checker: CYCLE_LOG.md written: `<path>`
- [ ] Reward signal: __/5.0 (threshold: <T>/5.0)
- [ ] Verdict: PASS / ITERATE / PLATEAU

### Cycle 2 (if ITERATE)
- [ ] Fix target: <weakest dimension from Cycle 1>
- [ ] Maker: changes applied — commit: `<SHA>`
- [ ] Mechanical gate: passed
- [ ] Prover: PROOF VERDICT received — Feature: works | broken
- [ ] Red-team: worst-first holes triaged — critical/high fixed (adversarial goals)
- [ ] Checker: CYCLE_LOG.md updated
- [ ] Reward signal: __/5.0
- [ ] Verdict: PASS / ITERATE / PLATEAU

### Cycle 3 (if ITERATE again)
- [ ] Fix target: <weakest dimension from Cycle 2>
- [ ] Maker: changes applied — commit: `<SHA>`
- [ ] Mechanical gate: passed
- [ ] Prover: PROOF VERDICT received — Feature: works | broken
- [ ] Red-team: worst-first holes triaged — critical/high fixed (adversarial goals)
- [ ] Checker: CYCLE_LOG.md updated
- [ ] Reward signal: __/5.0
- [ ] Verdict: PASS / PLATEAU (max cycles reached)

### Final
- [ ] HANDOFF.md written: `<path>`
- [ ] HANDOFF.html written: `<path>`
- [ ] HANDOFF.excalidraw written: `<path>`
- [ ] HANDOFF.html published: `<ht-ml.app URL>` (or export fallback + reason in HANDOFF.md)
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
1. Planner (turns 1-5): decompose task → write PLAN.md (phases, skill routing, checker rubric),
   then mirror each phase to a durable slice in `issues/NN-<slug>.md` (survives /compact, tracks
   per-phase Status). PLAN.md `## Phases` stays canonical; slices are the durable drive-list.
   Do not produce task artifacts until PLAN.md is written.
2. Maker (turns 6-<N>): execute per PLAN.md, invoke skills per phase, commit at each phase boundary.
3. Prover (running-app goals only): spawn harness-prover with PROVER_BRIEF from HARNESS.md.
   Pass feature intent + exercise instructions. Get PROOF VERDICT before Checker.
   Skip this step entirely for static artifact goals (PROVER_BRIEF: N/A).
3b. Red-team (adversarial-verify goals — running app, user-facing flow, or security-sensitive
   code): run the red-team Workflow (`.claude/workflows/red-team.js`) with REDTEAM_BRIEF from
   HARNESS.md (target, paths, entryPoint). Feed its worst-first holes back to the Maker as fix
   input BEFORE Checker scores. Skip for static/internal artifacts (REDTEAM_BRIEF: N/A).
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
  2b. Adversarial-verify goals only: run the red-team Workflow (REDTEAM_BRIEF in HARNESS.md).
     Fix every critical/high hole it returns before step 3. Skip if REDTEAM_BRIEF: N/A.
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
By morning, leave me the morning report in the task's working directory:
1. HANDOFF.md — what completed, workarounds, needs my decision, evidence
2. HANDOFF.html — single-page visual summary (see references/morning-report-specs.md)
3. HANDOFF.excalidraw — architecture/flow diagram (see references/morning-report-specs.md)

Then PUBLISH the report so I wake up to a link, not a file on disk:
4. Run `lavish-axi share HANDOFF.html --password <fresh-random-pw>` — publishes to a
   hosted URL (headless-safe HTTPS POST, no browser needed). --password is mandatory
   (pages are public by default; this is client/business work). Record ONLY the hosted
   URL in a "## 📋 Published Report" block at the TOP of HANDOFF.md. Write the password
   and update_key to HANDOFF.secret.local and add that filename to .gitignore
   immediately — the update_key is update/delete-capable and MUST NEVER be committed
   to any repo. If ht-ml.app is unreachable, fall back to
   `lavish-axi export HANDOFF.html --out HANDOFF.export.html` and note why in HANDOFF.md.
   See references/morning-report-specs.md.

[TURN LIMIT] Stop after <max_turns> turns. If not done, write all three files anyway,
then publish per step 4.
```

---

## Phase 2.5: QA Validation

**Execution: spawn 1-3 parallel Haiku/Explore agents — do not run inline.**

### Step 0 — Write HARNESS.md (before measuring)

Write `HARNESS.md` to the task working directory using Agent 4 output from Phase 1.5.
The file must contain three sections: `PLANNER_BRIEF`, `MAKER_ROUTING`, `CHECKER_BRIEF`.

Then update the `[HARNESS]` block in the goal candidate so the first line reads:
`Read <absolute-path>/HARNESS.md before starting.`

The task working directory is `$PROJECT_ROOT/.harness/goals/<task-slug>/` (resolved in
Execution Router Step 0). Write HARNESS.md there and use that absolute path.

This step happens before length measurement — HARNESS.md content is NOT inlined
into the goal prompt. The goal only carries the path reference.

### HARD LENGTH GATE — BLOCKING, MEASURED, NO EXCEPTIONS

`/goal` **rejects any condition ≥4000 characters** ("Goal condition is limited to 4000 characters"). A rejected goal is a failed deliverable. This gate is mechanical — DO NOT eyeball it.

Before emitting, you MUST run this sequence as actual shell commands (not mentally):

**Step 1 — write candidate to file:**

```
Write (tool) → temp/_goal-candidate.txt
```

**Step 2 — measure and gate in one command (Bun, cross-platform — run via Bash tool):**

```bash
bun skills/write-goal-prompt/scripts/check-goal-length.ts temp/_goal-candidate.txt
```

This counts exactly what `/goal` counts (UTF-16 `String.length` after stripping one trailing newline), prints `[Measured: XXXX chars]`, and **exits non-zero if the candidate is ≥3990** — so a failed gate is a failed command, not a judgment call. Adjust the ceiling with `--target N` / `--cap N` if needed.

Fallback if Bun is unavailable (note the `encoding="utf-8"` — WITHOUT it, Python opens in the Windows codepage and over-counts every non-ASCII char, falsely blocking valid prompts):

```bash
python -c "txt=open('temp/_goal-candidate.txt', encoding='utf-8').read().rstrip('\n'); print(len(txt))"
```

**Step 3 — gate:**

- Command **exits non-zero** (≥3990) → BLOCKED. Compress (see `references/qa-checklist.md` Length Gate steps). Re-write file. Re-run Step 2. Repeat until it exits 0.
- Command **exits 0** (< 3990) → pass. Proceed.

**Step 4 — emit with proof:**
Copy the `[Measured: XXXX chars]` line the script prints, immediately before the code fence. No measured count = gate not run = failure.

Never emit an unmeasured or ≥4000 goal. "Looks about right" is a failure. `wc -m` does NOT work on Windows — use the command above always.

### Remaining QA

Fix any failure before emitting: (1) context verification — subagents confirm paths/skills exist (2) dry-run self-check — 12 checks (3) eval loop check — signal programmatic, gate fast, max_cycles set, done condition a threshold. Full checklists in `references/qa-checklist.md`.

---

## Phase 3: Output

**In-session harness mode:** Emit as a code fence. Add: **"Paste this into a Sonnet session. `/goal clear` to abort early."** See `EXAMPLES.md` for a complete worked example.

**gnhf mode:** Skip this phase. Output is the gnhf command block (see gnhf Path below).

---

## gnhf Path (Overnight Autonomous Mode)

Use when execution mode = gnhf (task > 1hr, fully specifiable, can run unattended). The goal condition from Phase 2 becomes the gnhf objective directly — same content, no `/goal` wrapper, no 4000-char limit.

Skip Phase 2.5 QA. Skip Phase 3.

**Present, do not launch.** Never run `launch-gnhf.ps1`, `gnhf`, or any autonomous command yourself. Emit the command block below, then STOP and wait for the operator's explicit "go". This holds for both modes: a `/goal` prompt is pasted by the operator; a gnhf run is launched by the operator. The skill's deliverable is the reviewed command, not a running process.

**Inline detached launch (no terminal drop, survives this session) — hand this to the operator to run:**

```powershell
pwsh C:\Users\mitch\Everything_CC\tools\agent\agent-harness\scripts\launch-gnhf.ps1 `
  -RepoPath "$PROJECT_ROOT" `
  -Objective "<full objective from Phase 2>" `
  -StopWhen "<done condition from Phase 0 eval loop>" -MaxIterations 30
```
(Add `-Parallel` to force an isolated treehouse worktree; the launcher auto-leases one anyway if it detects a live gnhf run in the repo.)
(`-RepoPath "$PROJECT_ROOT"` anchors the run to the resolved project, not the workspace root. The launcher's own default is `Get-Location`.)

It pre-flights, starts gnhf detached + hidden, logs to `.gnhf-runs/gnhf-<stamp>.log`, and writes a handle JSON (PID + log + args). Register the task in tasks-axi first and mark it done after morning review.

**Manual command block (equivalent, if you prefer to run it yourself):**

```bash
# 1. Register task
tasks-axi add <slug> "<title>"
tasks-axi start <slug>

# 2. Worktree (optional — use for parallel streams or dep-heavy runs)
# path=$(treehouse get --lease --lease-holder "gnhf-<slug>")
# cd $path  # then run gnhf from there

# 3. Launch — clean working tree required (git stash if dirty)
gnhf "<full objective from Phase 2>" \
  --max-iterations 30 \
  --stop-when "<done condition from Phase 0 eval loop>"

# 4. Morning review — open the published report first (URL is atop HANDOFF.md)
head -n 8 HANDOFF.md          # published URL
cat HANDOFF.secret.local      # password + update_key (never committed)
git log --oneline gnhf/<slug>
cat .gnhf/runs/*/notes.md

# 5. Mark done
tasks-axi done <slug>
```

**Model: always Opus/frontier (non-negotiable):**
gnhf main agent = Opus. Cheaper models miss multi-step reasoning and produce cascading iteration failures.
Enforced via `~/.gnhf/config.yml`:

```yaml
agentArgsOverride:
  claude:
    - "--model"
    - "opus"
```

Never change this to Sonnet/Haiku for cost — if cost is a concern, reduce `--max-iterations` instead.

**Pre-flight checks (the launcher does these; verify manually if using the command block):**

- `git config --global commit.gpgSign` — must be empty or `false` (gnhf commits unsigned)
- Working tree clean — `git status` shows nothing (gnhf rejects dirty state)
- `~/.gnhf/config.yml` — agent = `claude`, `agentArgsOverride.claude` = Opus model

**Parallel streams / worktree isolation:** the launcher auto-leases an isolated treehouse worktree when it detects a live gnhf run (or on `-Parallel`); leases are held until returned by hand after review. Full model, lease lifecycle, and manual commands: `references/parallel-execution.md`.

---

## Reference Files

| File                                 | Contents                                                                                                 |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `references/eval-loop-design.md`     | Phase 0 four questions, human-judgment flag, task-type lookup                                            |
| `references/clarity-gate.md`         | Phase 0.5 branch bodies: grill agent prompt + `/grilling`; wayfinder routing test for large tasks        |
| `references/parallel-execution.md`   | Worktree isolation: treehouse pool, auto-lease on collision, lease lifecycle, manual parallel-stream commands |
| `references/subagent-harness.md`     | Planner/maker/checker templates, budget allocation, checker independence rules                           |
| `references/skill-routing.md`        | Task type → skill mappings, chaining patterns, quality bars per skill                                    |
| `references/issue-tracker.md`        | Durable phase-slice tracking: `issues/NN-<slug>.md` schema, Status vocab, `/to-prd` intake, PLATEAU-vs-slice boundary |
| `references/qa-checklist.md`         | Length gate, context verification, dry-run checks, quality floors, git cadence, full condition checklist |
| `references/morning-report-specs.md` | HTML summary spec, Excalidraw JSON structure, color coding                                               |
| `references/context-management.md`   | 170k threshold rationale, checkpoint protocol                                                            |
| `references/execution-mode-routing.md` | Decide task shape before authoring: single-run, goal-loop, time-loop, dynamic-workflow. Decision order, interval guidance, mode-nesting patterns. |
| `references/first-principles-generation.md` | Planner: decompose from observable outcomes. Maker: state reasoning (1-3 sentences) before code. |
| `EXAMPLES.md`                        | Full worked example with Phase 0 design and output                                                       |
| gnhf docs                            | `gnhf --help` - autonomous loop CLI; `~/.gnhf/config.yml` for defaults; `scripts/launch-gnhf.ps1` for inline detached launch |
| treehouse docs                       | `treehouse --help` - worktree pool; `treehouse.toml` in repo root for pool config                        |
| tasks-axi docs                       | `tasks-axi --help` - persistent backlog; `.tasks.toml` for per-repo config                               |

---

## Execution Mode Routing

Before writing a goal prompt, route the task to the right execution shape using `references/execution-mode-routing.md`. This is about _task shape_ (single-run vs goal-loop vs time-loop vs dynamic-workflow), not about harness infrastructure (in-session vs gnhf — that is separate; see the "Execution Router" section above for infrastructure choice).

The router decision tree is first-match-wins: walk the four questions top-down and stop at the first yes. Dynamic-workflow shape (for parallel verification, adversarial red-team, or 50+ item processing) is exemplified by `.claude/workflows/red-team.js`, which runs four attack roles in parallel, deduplicates findings by severity, and validates both per-role and merged output.

**Embedding a workflow inside a goal loop.** A dynamic workflow does not always mean _leaving_ the goal loop — it can nest in one phase. When the goal ships a running app, a user-facing flow, or security-sensitive code, the red-team Workflow nests in the **verify phase**: Agent 4 emits a `REDTEAM_BRIEF`, the `[HARNESS]` block runs `.claude/workflows/red-team.js` (step 3b) before Checker, and the Maker fixes every critical/high hole first. This is complementary to the Prover — Prover proves the feature _works_, red-team proves it _doesn't break_. Static or internal-artifact goals omit it (`REDTEAM_BRIEF: N/A`), exactly as they skip the Prover. Reach for a _standalone_ Workflow (route away from `/goal`) only when the whole task is dynamic-workflow shape (50+ items, many independent hypotheses), not just its verify step.

Planner reads `references/execution-mode-routing.md` as the first step after intake, and emits the chosen shape in PLAN.md's "Execution shape" section.

**Note:** This section (task shape) is orthogonal to the "Execution Router" section near the top of this file (infrastructure choice: in-session harness vs gnhf overnight vs treehouse parallel-gnhf). Both axes inform a full execution plan, but they answer different questions — mode routing (this file) is shape, while the Router is infrastructure.
