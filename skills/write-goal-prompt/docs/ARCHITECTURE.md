# write-goal-prompt Harness Architecture

Five agents. Strict roles. No overlap.

---

## Agents

| Agent   | File                                | Role                           | Tools                                | Model      |
| ------- | ----------------------------------- | ------------------------------ | ------------------------------------ | ---------- |
| Planner | `.claude/agents/harness-planner.md` | Decompose goal → PLAN.md       | Read, Glob, Write                    | sonnet-4-6 |
| Maker   | `.claude/agents/harness-maker.md`   | Execute phases, commit each    | Read, Glob, Write, Edit, Bash, Agent | haiku-4-5  |
| Prover  | `.claude/agents/harness-prover.md`  | Drive running app → PROOF verdict | Read, Bash                        | sonnet-4-6 |
| Checker | `.claude/agents/harness-checker.md` | Score artifacts → CYCLE_LOG.md | Read, Glob, Write                    | sonnet-4-6 |
| Shipper | `.claude/agents/harness-shipper.md` | `/no-mistakes` once after PASS → PR | Read, Bash                      | sonnet-4-6 |

Checker's tool restriction (`Read, Glob, Write` only) is **mechanical isolation** — it cannot
run Bash, spawn subagents, or see anything Maker produced via tool calls. Independence by design.

---

## File Paths Each Agent Reads / Writes

```
$PROJECT_ROOT/.harness/goals/<slug>/
├── PLAN.md          ← Planner writes; Maker + Checker read
├── issues/NN-<slug>.md ← Planner mirrors each PLAN.md phase 1:1; Maker drives off these
│                        when present (Status: ready-for-agent → in-progress → done|blocked)
├── PROGRESS.md      ← Maker writes after each phase; Checker must NOT read
├── CYCLE_LOG.md     ← Checker writes (appends); Planner reads on re-plan
├── HARNESS.md       ← Goal loop writes before spawning; all agents read
└── <task-artifacts> ← Maker writes; Checker scores (reads only)
```

Anchored to `$PROJECT_ROOT` (the project the goal is about, resolved via `git rev-parse
--show-toplevel`), never the workspace monorepo root. See `references/issue-tracker.md`
for the slice schema and `references/parallel-execution.md` for worktree isolation.

**Hard rule:** Checker reads PLAN.md + final artifact files only. It never reads PROGRESS.md
or any file the Maker wrote about its own process. Reading Maker self-assessment = echo chamber.

---

## Depth Budget

Claude Code enforces a 5-level agent depth limit. Design to stay within it.

| Depth | Agent                          | Notes                            |
| ----- | ------------------------------ | -------------------------------- |
| 0     | Goal loop agent                | Spawns Planner + Maker + Prover + Checker + Shipper |
| 1     | harness-planner                | Write-only phase; spawns nothing |
| 2     | harness-maker                  | Can spawn skill agents (depth 3) |
| 3     | harness-checker / skill agents | Checker runs here                |
| 4     | Sub-skill agents               | Final usable depth               |

**Never design a harness that needs depth 5** — Agent tool is not provided there.

Checker at depth 3 can spawn a read-only verifier sub-agent at depth 4 (Proof Mode).
That verifier cannot spawn further.

---

## Loop Flow

```
Goal loop
  → spawn Planner  → writes PLAN.md
  → spawn Maker    → executes phases, commits, writes PROGRESS.md
  → spawn Checker  → scores final artifacts, writes CYCLE_LOG.md
       ↓
  PASS  → /no-mistakes → review/test/lint/push/PR/CI → PR ready for human merge
  ITERATE → spawn Maker again (reads CYCLE_LOG.md fix target)
  PLATEAU → commit best, write HANDOFF.md, stop
```

Max cycles: 3 (default). Plateau = last 3 reward signals within ±0.1.

`/no-mistakes` is a terminal shipping gate, not an eval cycle. After PASS, the goal agent spawns
a fresh `harness-shipper`; it never drives the pipeline inline. The shipper runs it exactly once
with committed task changes on a feature branch and the original objective as its intent, then
drives decision gates until a terminal outcome. `checks-passed` prepares the merge but does not
perform it; ITERATE and PLATEAU never enter the shipping gate.

---

## Plateau Detection

Checker reads all previous CYCLE_LOG.md entries. If the last 3 reward signals are within
±0.1 of each other: verdict = PLATEAU. Maker is not spawned again. Goal loop commits current
best artifact and records the plateau in HANDOFF.md.

**Why:** Uncapped loops drain budget without improvement. Plateau detection is the safety valve.

---

## Key Invariants

1. Maker never scores its own work — only Checker decides PASS/ITERATE
2. Checker never forks from Maker — always spawns fresh (blank context)
3. Every Checker score requires `file:line` evidence — "looks good" is invalid
4. Planner writes PLAN.md and stops — it does not produce task artifacts
5. Maker commits after each phase — partial work survives session death
6. No-mistakes runs only after PASS — failed validation cannot be reported as merge-ready
