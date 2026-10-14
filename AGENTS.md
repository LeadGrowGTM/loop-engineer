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
| `scripts/prepare-harness-run.ps1` | Non-launching, fail-fast readiness check for repository, branch, tree, layout, and default-on treehouse isolation (`-NoIsolation` opts out) |
| `scripts/validate-pipeline-layout.ps1` | Pre-flight pipeline-layout check called by `prepare-harness-run.ps1` |
| `scripts/setup-harness.ts` | Installs harness agents + seeds `.harness/`, `.tasks.toml`, `treehouse.toml` into a repo |
| `scripts/rename-to-loop-engineer.ps1` | One-shot: rename this repo's dir `agent-harness` → `loop-engineer` + fix refs (not yet run) |
| `treehouse.toml` | Optional treehouse worktree-pool config (`max_trees`, `root`) for explicit isolation |
| `docs/agents/` | Matt Pocock engineering skill configuration |
| `docs/adr/` | Architectural decision records |

## Core principle

The model that wrote the code grades its own homework generously. Five-agent loop: Planner → Maker → Prover → Checker → Shipper.

- **Prover** (`tools: Read, Bash`) drives the running app, returns binary PROOF verdict. Running-app goals only — skip for static artifacts.
- **Checker** (`tools: Read, Glob, Write`) scores artifacts against rubric. Cannot run Bash, cannot spawn agents. Receives PROOF verdict via invocation context.
- **Shipper** (`tools: Read, Bash`) runs `/no-mistakes` exactly once only after a Checker PASS and explicit post-PASS shipping approval, drives it to a terminal outcome, returns the PR URL. Never runs on ITERATE or PLATEAU.

## Supported execution

Use the managed `goal-lifecycle` operations documented in README.md. The readiness
script is an internal diagnostic seam for lifecycle start, not an operator
pre-goal command or lifecycle bypass. Managed runs require the project-local
backlog, verified Treehouse isolation and pinned grill; no direct-Git or manual
execution fallback is supported. Linux/cloud environments need `pwsh` on PATH.
See docs/COMPATIBILITY.md for public installation and environment prerequisites.

## Key commands

```bash
bun /absolute/path/to/loop-engineer/scripts/goal-lifecycle.ts audit --repo /absolute/path/to/repo
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
