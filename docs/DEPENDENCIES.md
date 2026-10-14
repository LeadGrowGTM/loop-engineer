# Dependencies

Everything loop-engineer leans on, and what actually happens when it is missing.

**Tiers**

- **Required** — the loop breaks without it.
- **Optional** — the loop still runs; it degrades in the specific way named in the row.
- **Bundled** — shipped by this repo. Nothing to install.

**Managed lifecycle dependencies are not optional.** See the [setup guide](../skills/setup-harness/SKILL.md)
for repository preparation and pinned-grill installation. `tasks-axi` and Treehouse are public
upstream CLIs — install the audited versions from their official distributions
([Installing the required CLIs](#installing-the-required-clis)); inside an existing LeadGrow
workspace, `/onboard` provisions the same versions. Setup and lifecycle start both enforce the
[audited CLI-version allowlist](../scripts/lifecycle-dependencies.ts); unknown versions fail
readiness. Lifecycle `start` owns the bounded readiness check; use the verify commands below
for dependency diagnostics.

| Dependency | Tier | What it does | Install / verify | What breaks without it |
| --- | --- | --- | --- | --- |
| **Bun** | Required | Runs every script in `scripts/` (`triage.ts`, `setup-harness.ts`) and the test suite. The repo has no `package.json`; Bun runs the TypeScript directly. | `bun --version` → `1.4.2`. Install: `powershell -c "irm bun.sh/install.ps1 \| iex"` | Total. No `bun test`, no triage CLI, no setup script. The mechanical gate of every goal loop is `bun test`. |
| **git** | Required | The Maker commits at each phase boundary; `setup-harness.ts` stamps a provenance SHA via `git rev-parse`. | `git --version` | The loop cannot commit per phase, so a failed cycle cannot be rolled back to a known-good state. |
| **`gh`** (GitHub CLI, authenticated) | Required | Issue tracker (`LeadGrowGTM/loop-engineer`) and PR creation at the Ship stage. | `gh --version` → `gh version 2.83.2`. Auth: `gh auth status` | Ship stage cannot open a PR, so a PASS verdict never reaches a human reviewer. `gh issue list --label needs-triage` stops working. |
| **`no-mistakes`** | Required | The Ship stage. Both a skill (`/no-mistakes`) and a CLI (`no-mistakes axi`) — the skill drives the CLI, which prints machine-readable [TOON](https://toonformat.dev) to stdout. Pipeline: intent, rebase, review, test, document, lint, push, PR, CI. | `no-mistakes --version`. Install: see the [official installation guide](https://kunchenguid.github.io/no-mistakes/start-here/installation/). Update: `no-mistakes update` | Stage 5 cannot run. A Checker PASS produces no validated PR — the loop stops one step short of merge-ready. |
| **`tasks-axi`** | Required | Durable task identity for every managed lifecycle run. `start` registers and starts the project-local task; `finish` updates it only after identity checks. | `tasks-axi --version`: must match the [audited allowlist](../scripts/lifecycle-dependencies.ts). Install: `npm install -g tasks-axi@0.2.6` (Node 20+ per the [official README](https://github.com/kunchenguid/tasks-axi#readme)). | `start` fails safely. There is no in-session-only, manual, or direct-Git fallback. |
| **Readiness preflight** | Bundled | Internal non-launching implementation and diagnostic seam used by lifecycle `start`. It reports repository, branch, dirty-tree, pipeline-layout, and pool state as one JSON object without mutating Git state. | Invoked by lifecycle `start`; not an operator pre-goal command or lifecycle bypass. | Lifecycle start fails safely rather than running from an unsafe repository, branch, tree, layout, or pool. |
| **`treehouse`** | Required | Leases the managed worktree from the repository-owned `.worktrees/` pool. `start` verifies the returned lease and canonical `wt/<task-id>` branch. Lifecycle readiness, validate, finish, audit, and setup pool repair read leases through one shared boundary that probes `treehouse --version` and parses that version's audited status contract from stdout — typed `status --json` records on 3.1.0, tabular `status` rows on 1.8.0, whose empty pool is the `No worktrees in pool.` notice Treehouse writes to stderr — failing closed on an unaudited version, pool status, or row. Treehouse alone controls the pool's nested internal layout. | `treehouse --version`: must match the [audited allowlist](../scripts/lifecycle-dependencies.ts). Install the pinned [v3.1.0 release](https://github.com/kunchenguid/treehouse/releases/tag/v3.1.0) asset for your platform and verify it against that release's `checksums.txt`. | `start` fails safely. No `-NoIsolation`, direct-Git, or manual-worktree fallback is supported. |
| **Pi OpenAI server compaction** | Optional | Explicit, project-local server compaction, off by default. The manager accepts only `git:github.com/algal/pi-openai-server-compaction@c6d593087709e9481223dc6c6c2269b371b5e055`. Ordinary harness setup and readiness never invoke it. | Node: `node --version` must be `>=22`. Pi: `pi --version` must be `>=0.80.9 <0.81.0`. State: `bun scripts/manage-pi-openai-server-compaction.ts check <project-root>`. Enabling requires `setup <project-root> --enable --acknowledge-openai-retention`. | Missing or incompatible Node or Pi makes explicit setup return `NOT_READY`. If the exact extension cannot be reconciled and verified, setup retains inert state and cannot return `READY`. The ordinary harness still runs. Disable remains available through the manager and retains project-local rollback state. |
| **`lavish-axi`** | Optional | Publishes the morning report — `lavish-axi share HANDOFF.html` returns a hosted ht-ml.app URL. Published PUBLIC (no `--password`) so the link is one-click and pasteable into the no-mistakes PR; the returned `update_key` stays secret regardless — it goes in `HANDOFF.secret.local` (gitignored), never a commit. | `lavish-axi --version` → `0.1.35`. Install the public skill: `npx skills add kunchenguid/lavish-axi --skill lavish`, which runs the CLI through `npx -y lavish-axi`. | Degrades to local-only: `HANDOFF.html` still gets written, but there is no shareable URL. Fallback is `lavish-axi export HANDOFF.html --out HANDOFF.export.html` (same binary — a total absence means no export either, just the raw file on disk). |
| **Pinned `batch-grill-me`** | Required | The unconditional managed-goal clarity grill. `/setup-harness` installs the exact pinned content; lifecycle `start` verifies its hash before work begins. | `Test-Path ~/.claude/skills/batch-grill-me/SKILL.md` → `True`; rerun `/setup-harness` to repair drift. | `start` fails safely. The grill cannot be skipped or replaced with an unpinned/manual fallback. |
| **`harness-*` agents** | Bundled | The in-session loop itself: `harness-planner`, `harness-maker`, `harness-prover`, `harness-checker`, `harness-shipper` in `.claude/agents/`. Task execution stays attached to the current Claude Code session. `setup-harness.ts` installs these five (`AGENT_FILES`) into a target repo. | `ls .claude/agents/` | Nothing to install. Note: `harness-inbounds-checker` and `harness-novelty-checker` also live in `.claude/agents/` but are **not** in `AGENT_FILES`. They serve the benchmarking climb loop and are not installed into target repos by `setup-harness.ts`. |
| **Red-team workflow** | Bundled | `.claude/workflows/red-team.js` — spawns four parallel attack roles (hostile user, careless user, performance, security) for the verify phase of a goal loop. | `ls .claude/workflows/red-team.js` | Nothing to install. Skipped for static-artifact and internal-tooling goals, where there is no user-facing flow to attack. |

## PowerShell on Linux/cloud hosts

Managed lifecycle subprocesses require PowerShell. On Linux and macOS they prefer
PowerShell 7's `pwsh`; on Windows they prefer `powershell` with a `pwsh` fallback.
Provision the executable on the environment PATH before managed execution. The
public plugin installs no runtimes or CLIs of its own. See
[COMPATIBILITY.md](COMPATIBILITY.md) for the supported paths and verification limits.

## Installing the required CLIs

`tasks-axi`, `treehouse`, `lavish-axi`, and `no-mistakes` are public tools; this repo ships none of
them. Install the audited versions from their own upstreams — the version checks are exact, so an
unpinned install of a newer release fails readiness rather than running:

- **`tasks-axi` 0.2.6** — `npm install -g tasks-axi@0.2.6`, or `npm install -g --prefix ~/.local tasks-axi@0.2.6`
  and put `~/.local/bin` on PATH where a global install is not available. Needs Node 20 or newer
  ([official README](https://github.com/kunchenguid/tasks-axi#readme)).
- **Treehouse v3.1.0** — download the platform asset from the
  [v3.1.0 release](https://github.com/kunchenguid/treehouse/releases/tag/v3.1.0), verify it against
  that release's `checksums.txt`, and put the binary on PATH. Do **not** use the unpinned
  `install.sh`: it installs the current release (v3.1.3), which is outside the audited allowlist.
  v1.8.0 is the older validated allowlist entry, read through its tabular `status` contract.
- **`no-mistakes`** — [official installation guide](https://kunchenguid.github.io/no-mistakes/start-here/installation/)
  (`curl -fsSL https://raw.githubusercontent.com/kunchenguid/no-mistakes/main/docs/install.sh | sh` on
  macOS/Linux), then `no-mistakes init` to install the `/no-mistakes` skill.
- **`lavish-axi`** — `npx skills add kunchenguid/lavish-axi --skill lavish` (optional; report sharing only).

Inside an existing LeadGrow workspace, `/onboard` provisions these same versions and is still the
quickest path. Either way, then run `/setup-harness` to seed the repository configuration and repair
the pinned grill; do not create a worktree, alter an existing lease, or clean up a misplaced checkout
by hand.

## Running under claudex (GPT via proxy)

`claudex` runs the whole harness on a GPT upstream that presents under real Anthropic
model IDs (so Claude Code sends full prompts, tool schemas, and skill descriptions —
these are trimmed for any model ID the harness does not recognize). The proxy maps a
**fixed set** of IDs; a subagent pinned to any other ID gets an unrecognized-model
session and runs degraded. Native `.claude/agents/*.md` definitions use `sonnet` and `haiku` aliases.
Explicit claudex model overrides from `resolve-role-model.ts` must be one of:

| `model:` frontmatter | Resolves under claudex to |
| --- | --- |
| `claude-opus-4-8` | `gpt-5.6-sol` (flagship, max reasoning effort) |
| `claude-sonnet-5` | `gpt-5.6-terra` (max reasoning effort) |
| `claude-haiku-4-5` | `gpt-5.3-codex-spark` (fast tier) |

Rules for adding or editing an agent:

- For explicit claudex overrides, use only the three IDs above — **undated**. A dated pin (`claude-haiku-4-5-20251001`)
  will not match the proxy alias and breaks under claudex.
- The mapping lives in `~/.cliproxyapi/cliproxyapi.conf` and the claudex repo's
  `config/cliproxyapi.conf.template`. Adding a new tier means adding an alias there too.
- Caveat, not a break: under claudex every tier is the same GPT upstream, so the
  Checker's "fresh eyes vs the Maker" independence is weaker than on native Claude
  (where Checker=sonnet, Maker=haiku are genuinely different models). The role/tool
  isolation still holds; the model-diversity part does not.

**Detection signal.** The harness detects a claudex session by the `ANTHROPIC_BASE_URL`
environment variable being set — that override (pointing Claude Code at the local CLIProxyAPI)
*is* the claudex mechanism, and native Claude Code never sets it. A raw OpenAI Codex CLI session
is detected by `CODEX_SANDBOX` (which Codex sets in the environment of commands it runs). Neither
present → native. See `scripts/detect-provider.ts`.

## Lifecycle diagnostics

Before goal work, use lifecycle `start`; its internal readiness and dependency diagnostics fail
safely with exact errors and dirty paths instead of starting execution. The readiness script is not
an operator pre-goal command or lifecycle bypass. The upstream installs above (or workspace
`/onboard`) plus `/setup-harness` remain the supported routes for repairing missing dependencies or
repository configuration.
