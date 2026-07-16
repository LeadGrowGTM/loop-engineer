# loop-engineer

Goal prompt writer + planner/maker/checker harness for Claude Code loop engineering.

## Repo Map

| Path | What |
|---|---|
| `.claude/agents/` | Harness agent definitions (planner, maker, prover, checker) |
| `.claude-plugin/` | Plugin + marketplace manifests: this repo installs as the `loop-engineer` Claude Code plugin |
| `hooks/` | Plugin SessionStart hook that auto-updates the marketplace |
| `.claude/state/` | SQLite triage schema + README |
| `skills/write-goal-prompt/` | Goal authoring skill — phases, eval loop, harness discovery |
| `skills/write-goal-prompt/references/` | 11 reference files (eval-loop-design, subagent-harness, skill-routing, clarity-gate, issue-tracker, parallel-execution, etc.) |
| `skills/write-goal-prompt/docs/` | Architecture map, reference index |
| `skills/write-goal-prompt/kb/` | KB scaffold — LOG.md, signals/, docs/ |
| `scripts/triage.ts` | Bun CLI: list/review/dismiss/log/signal for the triage inbox |
| `scripts/launch-gnhf.ps1` | Detached gnhf launcher — repo-safety guards, auto-lease treehouse worktree on parallel/collision/monorepo-tracked pipelines |
| `scripts/validate-pipeline-layout.ps1` | Pre-flight pipeline-layout check called by `launch-gnhf.ps1` |
| `scripts/setup-harness.ts` | Seeds `.harness/`, `.tasks.toml`, `treehouse.toml` into a repo and verifies plugin integrity |
| `scripts/rename-to-loop-engineer.ps1` | One-shot: rename this repo's dir `agent-harness` → `loop-engineer` + fix refs (not yet run) |
| `treehouse.toml` | This repo's own treehouse worktree-pool config (`max_trees`, `root`) |
| `docs/agents/` | Matt Pocock engineering skill configuration |
| `docs/adr/` | Architectural decision records |

## Core principle

The model that wrote the code grades its own homework generously. Four-agent loop: Planner → Maker → Prover → Checker.

- **Prover** (`tools: Read, Bash`) drives the running app, returns binary PROOF verdict. Running-app goals only — skip for static artifacts.
- **Checker** (`tools: Read, Glob, Write`) scores artifacts against rubric. Cannot run Bash, cannot spawn agents. Receives PROOF verdict via invocation context.

## Key commands

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
