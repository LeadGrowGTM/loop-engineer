# Handoff: loop-engineer system upgrade session

**Date:** 2026-06-23
**Session:** claude.ai/code/session_01QDCtzWWFyKT2R8FVYBrjoE
**Repo:** https://github.com/LeadGrowGTM/loop-engineer
**Local:** `C:\Users\mitch\Everything_CC\agent-harness\`
**Workspace:** `C:\Users\mitch\Everything_CC\`

---

## What was built this session

### 1. ship-change workflow (verbatim from AI-Builder-Club)
- `C:\Users\mitch\Everything_CC\.claude\workflows\ship-change.js`
- 6-phase end-to-end ship pipeline: Setup worktree → Implement → Simplify → Review → Verify → PR
- Delegates verify+PR to repo's own `/pr` skill when `hasPrSkill=true`
- Commit: `f0a714f`

### 2. Proof Mode in harness-checker
- `C:\Users\mitch\Everything_CC\.claude\agents\harness-checker.md`
- When goal involves a running app: spawns fresh read-only verifier sub-agent at depth 4
- `broken` verdict forces feature-verification dimension ≤ 2/5
- Commit: `202d48a`

### 3. write-goal-prompt docs/ + kb/ scaffold
- `docs/ARCHITECTURE.md` — agent map, file paths, depth budget, plateau detection (196 lines)
- `docs/index.md` — TOC for all 6 references + docs/
- `kb/README.md` + `kb/LOG.md` — global activity feed
- `kb/signals/README.md` + `kb/docs/README.md` — artifact schemas (adapted from AI-Builder-Club ARCHITECTURE.md)
- Commit: `98dc234`

### 4. README index layers
- `.claude/workflows/README.md`, `.claude/agents/README.md`, `kb/README.md`
- Commit: `7d32cf2`

### 5. Triage inbox (SQLite + bun CLI)
- `.claude/state/schema.sql` — `runs` + `signals` tables, WAL mode
- `scripts/triage.ts` — bun CLI: list/review/dismiss/log/signal
- `.gitignore` — exclude `*.db`
- Usage: `bun scripts/triage.ts` for morning inbox
- Commit: `4d8d2a1`

### 6. Matt Pocock skill integration
- `setup-matt-pocock-skills` run on loop-engineer repo
- `CLAUDE.md` created with `## Agent skills` block
- `docs/agents/issue-tracker.md` — GitHub + PLATEAU triage bridge
- `docs/agents/triage-labels.md` — default 5-label vocabulary
- `docs/agents/domain.md` — single-context layout + harness vocabulary seed
- `skill-routing.md` updated: `diagnose`, `improve-codebase-architecture`, `zoom-out`, `triage` added as routing targets
- 3 new chaining patterns: PLATEAU→Escalation, Maker Blocker→Unblock, Architecture Re-plan
- Commits: `949daa5` (workspace) + `a88e8c6` (loop-engineer repo)

---

## Current state

### Repos
| Repo | Remote | Branch | Status |
|---|---|---|---|
| `Everything_CC` | `LeadGrowGTM/everything-cc` | `main` | Clean, all committed |
| `agent-harness` | `LeadGrowGTM/loop-engineer` | `master` | Clean, pushed |

### Boris loops primitive coverage (complete)
| Primitive | Coverage |
|---|---|
| Automations | ✓ CronCreate + triage inbox |
| Worktrees | ✓ ship-change.js |
| Skills | ✓ full ecosystem |
| Plugins/connectors | ✓ MCP servers |
| Sub-agents | ✓ .claude/agents/ |
| State | ✓ SQLite runs+signals + markdown KB |

### Triage inbox state
- DB: `C:\Users\mitch\Everything_CC\.claude\state\triage.db` (local only, gitignored)
- One test run logged + reviewed during build. Inbox clean.

---

## What's next: Karpathy loop additions (prioritized)

The following were discussed and agreed to build. Build in this order — each compounds the previous.

### 1. KB flywheel (HIGHEST PRIORITY)
**What:** PASS runs write artifacts + rubric scores to `kb/` as few-shot examples. Future Planners load last N PASS examples for the same task type before writing PLAN.md.

**Why:** Makes repeated optimization of the same task cheaper + better over time. Each run teaches the next Planner what worked. Critical for long-running goals optimizing a specific task.

**Build:**
- `triage.ts` needs a `pass` command that writes a structured example to `kb/docs/`
- Planner prompt in `harness-planner.md` needs a "load prior PASS examples" step before writing PLAN.md
- Example schema: `kb/docs/pass-example-<slug>.md` with frontmatter: `kind: doc, domain, task-type, reward-signal, rubric-scores, plan-summary`
- `kb/LOG.md` gets an entry per PASS

**Files to edit:**
- `C:\Users\mitch\Everything_CC\.claude\agents\harness-planner.md` — add step: read kb/docs/ for matching task type
- `C:\Users\mitch\Everything_CC\scripts\triage.ts` — add `pass` command
- `C:\Users\mitch\Everything_CC\.claude\skills\write-goal-prompt\kb\docs\README.md` — add pass-example schema

### 2. Reflector agent
**What:** Dedicated agent between Checker (ITERATE) and next Maker cycle. Reads full CYCLE_LOG history, synthesizes WHY the approach keeps failing (pattern-level, not symptom-level), writes a structured improvement brief.

**Why:** Checker's one-liner fix target is symptom diagnosis. Reflector does root-cause pattern analysis across cycles. Directly improves iteration quality.

**Build:**
- New agent: `.claude/agents/harness-reflector.md` (sonnet-4-6, Read/Glob/Write)
- Goal loop spawns Reflector after ITERATE verdict before next Maker cycle
- Reflector writes `REFLECT.md` (not read by Checker — add to Checker's must-NOT-read list)
- Maker reads REFLECT.md on next cycle open

**Files to create/edit:**
- `C:\Users\mitch\Everything_CC\.claude\agents\harness-reflector.md` — new
- `C:\Users\mitch\Everything_CC\.claude\agents\harness-maker.md` — add: read REFLECT.md if exists
- `C:\Users\mitch\Everything_CC\.claude\agents\harness-checker.md` — add REFLECT.md to must-NOT-read list
- `C:\Users\mitch\Everything_CC\.claude\skills\write-goal-prompt\docs\ARCHITECTURE.md` — add Reflector to loop diagram

### 3. Constitutional invariants file
**What:** A single `CONSTITUTION.md` file listing hard rules the harness can't violate, regardless of rubric scores. Currently scattered across agent files.

**Why:** Single source of truth. Checked independently of rubric. Easy to audit and extend.

**Build:**
- `C:\Users\mitch\Everything_CC\.claude\skills\write-goal-prompt\references\constitution.md`
- Checker reads it and reports violations as automatic score overrides (not dimension-specific)
- Seed rules: "Checker never reads PROGRESS.md", "PASS requires file:line evidence on all dimensions", "never ship without mechanical gate pass"

### 4. Checker calibration detection
**What:** Detect when Checker is drifting (scoring everything 3/5 regardless of quality). Use SQLite triage data.

**Build:**
- `triage.ts analyze` command — queries last 20 runs, flags if std-dev < 0.3 across scores
- Adds a `signals/checker-drift.md` entry when detected

### 5. Best-of-N Makers (parallel)
**What:** Spawn N Makers in parallel (via `Workflow` + `parallel()`), Checker scores all, keep best.

**Why:** Test-time compute scaling. More expensive but higher quality ceiling for hard goals.

**Build:**
- New workflow: `.claude/workflows/harness-best-of-n.js`
- N configurable (default 3)
- Checker receives all N artifact sets, scores independently, returns winner index

---

## Key design decisions made

1. **SQLite complements markdown, doesn't replace it.** Markdown KB = durable knowledge. SQLite = ephemeral run/event data.
2. **Matt Pocock skills require `setup-matt-pocock-skills` config** — confirmed for loop-engineer repo, not auto-wired globally.
3. **PLATEAU escalation path:** SQLite signal → GitHub issue → triage queue (via `/triage` skill). Wiring documented in `docs/agents/issue-tracker.md` and `skill-routing.md`.
4. **Reflector must NOT be forked from Checker** — same isolation rule as Checker/Maker. Always spawns fresh.
5. **KB flywheel scope:** only PASS runs write examples. ITERATE/PLATEAU runs write signals, not docs.

---

## Sync protocol (important)

Both repos must stay in sync manually until symlinks are set up:

| Source of truth | Sync to |
|---|---|
| `Everything_CC/.claude/agents/harness-*.md` | `agent-harness/.claude/agents/` |
| `Everything_CC/.claude/skills/write-goal-prompt/` | `agent-harness/skills/write-goal-prompt/` |
| `Everything_CC/scripts/triage.ts` | `agent-harness/scripts/triage.ts` |
| `Everything_CC/.claude/state/schema.sql` | `agent-harness/.claude/state/schema.sql` |

**Recommended:** Convert workspace `.claude/agents/harness-*.md` and `.claude/skills/write-goal-prompt/` to symlinks into `agent-harness/` to eliminate manual sync. User hasn't approved this yet — confirm before doing.
