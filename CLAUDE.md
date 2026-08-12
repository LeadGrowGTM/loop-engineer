# loop-engineer

Goal prompt writer + approval-gated planner/maker/checker harness for in-session Claude Code loop engineering.

## Repo Map

| Path | What |
|---|---|
| `.claude/agents/` | Harness agent definitions (planner, maker, prover, checker, shipper) + benchmarking checkers (inbounds, novelty) |
| `.claude/state/` | SQLite triage schema + README |
| `docs/DEPENDENCIES.md` | Every external tool the loop uses — Required/Optional/Bundled tiers, verify commands, what breaks without each |
| `skills/write-goal-prompt/` | Goal authoring skill — phases, eval loop, harness discovery |
| `skills/write-goal-prompt/references/` | 12 reference files (eval-loop-design, subagent-harness, skill-routing, clarity-gate, issue-tracker, parallel-execution, benchmark-intake, etc.) |
| `skills/write-goal-prompt/docs/` | Architecture map, reference index |
| `skills/write-goal-prompt/kb/` | KB scaffold — LOG.md, signals/, docs/ |
| `scripts/triage.ts` | Bun CLI: list/review/dismiss/log/signal for the triage inbox |
| `scripts/goal-lifecycle.ts` | The only supported managed lifecycle entry point: `start`, `record-grill`, `validate`, `finish`, and read-only `audit` |
| `scripts/prepare-harness-run.ps1` | Non-launching bounded readiness check used by managed lifecycle start; not a manual isolation entry point |
| `scripts/validate-pipeline-layout.ps1` | Pre-flight pipeline-layout check called by `prepare-harness-run.ps1` |
| `scripts/setup-harness.ts` | Seeds `.harness/`, project-local `.tasks.toml`, `.worktrees/` Treehouse config and ignore rule; installs harness assets and verifies the pinned grill |
| `scripts/rename-to-loop-engineer.ps1` | One-shot: rename this repo's dir `agent-harness` → `loop-engineer` + fix refs (not yet run) |
| `treehouse.toml` | Required managed-worktree config: repo-owned `.worktrees/` pool; Treehouse controls its nested layout |
| `docs/agents/` | Matt Pocock engineering skill configuration |
| `docs/adr/` | Architectural decision records |

## Core principle

The model that wrote the code grades its own homework generously. Five-agent loop: Planner → Maker → Prover → Checker → Shipper.

- **Prover** (`tools: Read, Bash`) drives the running app, returns binary PROOF verdict. Running-app goals only — skip for static artifacts.
- **Checker** (`tools: Read, Glob, Write`) scores artifacts against rubric. Cannot run Bash, cannot spawn agents. Receives PROOF verdict via invocation context.
- **Shipper** (`tools: Read, Bash`) runs `/no-mistakes` exactly once only after a Checker PASS and explicit post-PASS shipping approval, drives it to a terminal outcome, returns the PR URL. Never runs on ITERATE or PLATEAU.

## Supported execution

Runs stay in the active Claude Code session so approval gates remain visible. Use `goal-lifecycle`, never a direct Git/Treehouse/manual path or `-NoIsolation` fallback. `start` requires `tasks-axi`, Treehouse, and the pinned `batch-grill-me` skill; it registers the task, creates `wt/<task-id>`, and leases a verified worktree only from the repo-owned `.worktrees/` pool. Treehouse owns the pool's nested internal layout; use only the returned worktree path.

The required sequence is: start; unconditional grill; `record-grill`; persist `RUN.json`, `GRILL.json`, `BRIEF.md`, and `HARNESS.md` in the recorded run directory; emit the lean pointer or clear context; `/goal clear`; `validate`; then Planner and Maker. Validation failure blocks Planner and Maker. `finish` verifies task/branch/lease identity before completion and lease return. A blocked or failed run retains its lease. `audit` is read-only and reports, but never removes or changes, a pre-existing `misplaced_worktree`.

`/setup-harness` creates the repository configuration and installs/verifies harness assets, including the pinned grill; workspace `/onboard` provides the internal `tasks-axi` and Treehouse CLIs. Setup does not start a task or acquire a lease. The readiness script is an internal lifecycle implementation/diagnostic seam, not an operator pre-goal command or alternate path.

## Key commands

```powershell
# Start the managed lifecycle; it registers, leases, and persists RUN.json.
bun scripts/goal-lifecycle.ts start `
  --repo C:\path\to\repo --task-id my-task --title <title>

```

```bash
bun scripts/triage.ts                          # morning inbox — pending runs + open signals
bun scripts/triage.ts log --type goal \        # log a harness run
  --label "my-goal cycle 1" --verdict PASS \
  --reward 4.2
gh issue list --label needs-triage             # triage queue
```

## Agent skills

### Issue tracker

Issues live in GitHub (`LeadGrowGTM/loop-engineer`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default mattpocock/skills vocabulary (needs-triage, ready-for-agent, etc.). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo. `CONTEXT.md` at root (create lazily) + `docs/adr/`. See `docs/agents/domain.md`.
