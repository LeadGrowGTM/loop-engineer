# Dependencies

Everything loop-engineer leans on, and what actually happens when it is missing.

**Tiers**

- **Required** — the loop breaks without it.
- **Optional** — the loop still runs; it degrades in the specific way named in the row.
- **Bundled** — shipped by this repo. Nothing to install.

**`scripts/setup-harness.ts` verifies none of this.** It seeds `.tasks.toml` and `treehouse.toml`,
installs the harness agent files, and adds `.tmp/treehouse/` + `.gnhf-runs/` to `.gitignore`. It
does **not** check that a single external binary exists. A green setup run says nothing about
whether `gnhf`, `treehouse`, `tasks-axi`, or `no-mistakes` are installed — verify those yourself
with the commands below.

| Dependency | Tier | What it does | Install / verify | What breaks without it |
| --- | --- | --- | --- | --- |
| **Bun** | Required | Runs every script in `scripts/` (`triage.ts`, `setup-harness.ts`) and the test suite. The repo has no `package.json`; Bun runs the TypeScript directly. | `bun --version` → `1.3.9`. Install: `powershell -c "irm bun.sh/install.ps1 \| iex"` | Total. No `bun test`, no triage CLI, no setup script. The mechanical gate of every goal loop is `bun test`. |
| **git** | Required | The Maker commits at each phase boundary; `setup-harness.ts` stamps a provenance SHA via `git rev-parse`. | `git --version` | The loop cannot commit per phase, so a failed cycle cannot be rolled back to a known-good state. |
| **`gh`** (GitHub CLI, authenticated) | Required | Issue tracker (`LeadGrowGTM/loop-engineer`) and PR creation at the Ship stage. | `gh --version` → `gh version 2.83.2`. Auth: `gh auth status` | Ship stage cannot open a PR, so a PASS verdict never reaches a human reviewer. `gh issue list --label needs-triage` stops working. |
| **`no-mistakes`** | Required | The Ship stage. Both a skill (`/no-mistakes`) and a CLI (`no-mistakes axi`) — the skill drives the CLI, which prints machine-readable [TOON](https://toonformat.dev) to stdout. Pipeline: intent, rebase, review, test, document, lint, push, PR, CI. | `no-mistakes --version`. Update: `no-mistakes update` | Stage 5 cannot run. A Checker PASS produces no validated PR — the loop stops one step short of merge-ready. |
| **`tasks-axi`** | Optional | Disk-backed backlog that survives context compaction. `setup-harness.ts` seeds `.tasks.toml` for it. | `tasks-axi --version` → `0.1.1`. Try: `tasks-axi ready` | Degrades to in-session-only tracking: native Claude Code Tasks are ephemeral and lost on compaction, so a long run loses its backlog and cross-session goals lose their slug. The seeded `.tasks.toml` sits inert. |
| **`gnhf`** | Optional | Unattended overnight runs — commits each iteration, rolls back failures. Must run Opus; the override lives in `~/.gnhf/config.yml` (`agentArgsOverride`). Launched via `scripts/launch-gnhf.ps1`. | `gnhf --version` → `0.1.41`. Config: `type ~/.gnhf/config.yml` | Degrades to in-session execution only: work >1hr must be babysat interactively instead of running unattended. Reduce `--max-iterations` for cost — never downgrade the model. |
| **`treehouse`** | Optional | Pre-warmed, dep-cached worktree pool for parallel isolation. `setup-harness.ts` seeds `treehouse.toml` (`max_trees = 16`, `root = ".tmp/treehouse/"`). `launch-gnhf.ps1` auto-leases a worktree on parallel/collision/monorepo-tracked pipelines. | `treehouse --version` → `v1.8.0`. Try: `treehouse get --lease` | Degrades to serial execution in the main worktree: `launch-gnhf.ps1` cannot auto-lease, so parallel runs would collide on one working tree. The seeded `treehouse.toml` sits inert. |
| **`lavish-axi`** | Optional | Publishes the morning report — `lavish-axi share HANDOFF.html` returns a hosted ht-ml.app URL. Published PUBLIC (no `--password`) so the link is one-click and pasteable into the no-mistakes PR; the returned `update_key` stays secret regardless — it goes in `HANDOFF.secret.local` (gitignored), never a commit. | `lavish-axi --version` → `0.1.35` | Degrades to local-only: `HANDOFF.html` still gets written, but there is no shareable URL. Fallback is `lavish-axi export HANDOFF.html --out HANDOFF.export.html` (same binary — a total absence means no export either, just the raw file on disk). |
| **`batch-grill-me`** | Optional | Clarity gate Branch A, wide-but-independent path: multi-round frontier batches. Vendored from mattpocock/skills — **not** in the local marketplace clone, so it is installed by hand at `~/.claude/skills/batch-grill-me/`. | `Test-Path ~/.claude/skills/batch-grill-me/SKILL.md` → `True` | Degrades to `/grilling` for all ambiguity: wide, independent decision sets get walked one question at a time, costing many more turns for the same answers. |
| **`/grilling`** | Optional | Clarity gate Branch A, chained-ambiguity path: one question at a time down the design tree. **Resolves ambiguously** — a local skill at `~/.claude/skills/grilling/` ("Interview the user relentlessly about a plan or design…") *and* a `mattpocock-skills:grilling` plugin at `~/.claude/plugins/marketplaces/mattpocock/skills/productivity/grilling/` ("Grill the user relentlessly about a plan, decision, or idea…"). Different descriptions, same job; which one resolves is not pinned. Documented, not fixed — out of scope here. | `ls ~/.claude/skills/grilling/SKILL.md` and `ls ~/.claude/plugins/marketplaces/mattpocock/skills/productivity/grilling/SKILL.md` | Degrades to `batch-grill-me` for all ambiguity: chained decisions get asked in frontier rounds, where a round can only ask what is already unblocked — so deep chains take more rounds than a live interview would. With **both** paths gone, Branch A has no route and the gate falls back to skipping to Phase 1 under-specified. |
| **`/wayfinder`** | Optional | Clarity gate Branch B: charts oversized/investigative work as a map of investigation tickets on the issue tracker, resolved one at a time. | `ls ~/.claude/skills/wayfinder/SKILL.md` | Degrades badly rather than loudly: large or investigative tasks fall back to grilling, which resolves preferences, not unknowns that need research before they can even be asked. Expect an under-scoped goal instead of an error. |
| **`harness-*` agents** | Bundled | The loop itself: `harness-planner`, `harness-maker`, `harness-prover`, `harness-checker`, `harness-shipper` in `.claude/agents/`. `setup-harness.ts` installs these five (`AGENT_FILES`) into a target repo. | `ls .claude/agents/` | Nothing to install. Note: `harness-inbounds-checker` and `harness-novelty-checker` also live in `.claude/agents/` but are **not** in `AGENT_FILES` — they serve the benchmarking climb loop and are not installed into target repos by `setup-harness.ts`. |
| **Red-team workflow** | Bundled | `.claude/workflows/red-team.js` — spawns four parallel attack roles (hostile user, careless user, performance, security) for the verify phase of a goal loop. | `ls .claude/workflows/red-team.js` | Nothing to install. Skipped for static-artifact and internal-tooling goals, where there is no user-facing flow to attack. |

## Installing the optional CLIs

`tasks-axi`, `gnhf`, `treehouse`, `lavish-axi`, and `no-mistakes` are LeadGrow-internal tools rather
than public packages — they are provisioned by the workspace onboarding flow, not by this repo. If
one is missing, run the workspace `/onboard` flow rather than hand-installing it; that is what keeps
the version and the `~/.gnhf/config.yml` Opus override consistent across machines.

## The one thing to check first

If a goal loop fails in a way that makes no sense, verify the binary before debugging the loop —
`setup-harness.ts` will have told you nothing:

```bash
bun --version && git --version && gh --version && no-mistakes --version
tasks-axi --version && gnhf --version && treehouse --version && lavish-axi --version
```
