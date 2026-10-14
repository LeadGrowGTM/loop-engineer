# Compatibility

Verified against source and local Claude Code 2.1.299 on 2026-10-14, and native
Claude Code 2.1.300 on 2026-10-15.

## Claude Code terminal

Install this repository as the `loop-engineer@loop-engineer` plugin. The manifest
loads seven agents, both top-level skills, and the benchmarking command. Native
agents use the supported `sonnet` and `haiku` aliases so Claude Code selects the
available model for the account/provider. Explicit claudex and Codex routing stays
in `scripts/resolve-role-model.ts`; proxy aliases are not native defaults.

Setup commands resolve bundled files from `${CLAUDE_PLUGIN_ROOT}` rather than a
developer's Windows checkout. For a source checkout, use its absolute path instead.

## Cloud and Linux

A Linux/cloud terminal needs Bun, Git, and PowerShell 7 (`pwsh`) in addition to
Claude Code. Lifecycle subprocesses prefer `pwsh` on Unix and Windows PowerShell
on Windows. The same readiness, dirty-tree, lease, and approval checks apply.

For claude.ai/code, `/plugin` is a terminal UI command and is unavailable in the
cloud session. Provision plugin assets in the environment before starting a
session, or use a checkout with repo-local `.claude/agents/` definitions and
repo-local skills under `.claude/skills/`. Do not assume terminal installation
automatically populates a separate cloud environment. See the official
[cloud session documentation](https://code.claude.com/docs/en/claude-code-on-the-web).

Managed execution also requires the version-pinned `tasks-axi` and Treehouse CLIs
and the bundled pinned grill; shipping requires `no-mistakes` and authenticated
`gh`. All four are public upstream tools — `npm install -g tasks-axi@0.2.6` (Node
20+) and the checksum-verified
[Treehouse v3.1.0 release](https://github.com/kunchenguid/treehouse/releases/tag/v3.1.0)
asset; see [DEPENDENCIES.md](DEPENDENCIES.md) for every install command and the
audited allowlist. This repository ships no installers of its own, so a cloud
environment needs them provisioned before a session (workspace `/onboard` does
this inside an existing LeadGrow workspace). Public plugin discovery works without
those tools, but a managed goal cannot start without them. Missing or unaudited
versions fail readiness; there is no fallback that bypasses lifecycle isolation or
approval gates.

## Verification limits

Plugin validation and local tests do not prove a live Anthropic-hosted cloud run,
a proxy's model availability, or a given host's CLI provisioning. Verify those in
the intended provisioned environment before claiming end-to-end compatibility.

The four build roles are sibling agent calls from the coordinator; their sequence
numbers are phases, not recursive nesting depth. Keep execution in the active
session so approval requests can be answered.

## Real CLI regression verification (2026-10-15)

The opt-in `scripts/live-lifecycle.test.ts` executes the public setup/lifecycle
commands against Bun 1.4.2, tasks-axi 0.2.6, Treehouse 3.1.0 and PowerShell 7.4.6. It uses a
fresh disposable repository and home directory; no production task or lease is
touched. Run with `LOOP_ENGINEER_LIVE_CLI_TEST=1 bun test scripts/live-lifecycle.test.ts` after placing `pwsh` on PATH.

See [DEPENDENCIES.md](DEPENDENCIES.md) for the CLI-version contract and the
[setup guide](../skills/setup-harness/SKILL.md) for pool creation and generated
backlog handling. Restart validation reads the authoritative task from the source
repository rather than an independently copied worktree backlog. Lease recognition
probes `treehouse --version` and selects that version's audited status contract at
one shared boundary: Treehouse 3.1.0 is read from the typed `status --json`
records (`path`, `status`, `lease_holder`) it writes to stdout, and Treehouse
1.8.0 — which has no `--json` status — from its tabular `status` rows. Treehouse
prints its update banner and its `No worktrees in pool.` notice to stderr, so an
empty pool is only accepted from stdout with no rows plus that exact notice. An
unaudited version, a status payload that does not match the probed contract, a
pool status outside Treehouse's own set, and a leased entry without an exact path
and holder all fail closed before any lease is acquired or verified. Lease
identity is probed from the owning repository root, which is where Treehouse
reports its pool. Validate and finish count only `leased` records as an active
holder; a returned (`available`) slot never does. Audit treats every slot
Treehouse lists — leased, available, dirty, in-use — as Treehouse-managed when it
is also physically inside the repository pool, and never suggests removing it; a
worktree Treehouse does not list stays `MISPLACED_WORKTREE`. Validate, finish and
audit compare Treehouse paths by physical identity (`realpathSync.native`), so a
Windows 8.3 alias such as `C:\Users\RUNNER~1` matches its long form.

Deterministic `bun test` runs on `ubuntu-24.04` and `windows-latest` under `pwsh`
through `.github/workflows/tests.yml`, split into `lifecycle`, `readiness` and
`other` groups per OS with a 45-minute limit each. Every job first checks that
the groups list each tracked test file exactly once. The Windows `readiness` job
executes the eight Windows PowerShell process-cleanup tests and the Treehouse JSON
cases under both Windows PowerShell 5.1 and PowerShell 7, which a Linux host
skips. Earlier ungrouped Windows jobs hit the 15-minute limit inside the lifecycle
suite twice, after path-identity failures caused by the runner's 8.3 temp alias.
No Windows pass is claimed until those jobs are green; see
[PR #38](https://github.com/LeadGrowGTM/loop-engineer/pull/38) and its checks for
live platform status.

Claude Code 2.1.299 installed the published v1.4.0 marketplace into an isolated
config directory and initialized all seven agents with the expected model tiers
and tool allowlists. Both skills and the benchmarking command appeared in session
discovery. That install evidence is historical and belongs to v1.4.0; the manifest
version here is the prospective 1.4.1 repair of this public-compatibility release,
which invalidates the release cache and has not itself been published or installed.

### Native execution evidence, this environment only

Native Claude execution ran after the account quota reset: a Sonnet model call
succeeded, native Planner produced real planning artifacts, a Haiku Maker phase
created code and tests and landed guarded commit `ec7f299`, a real Prover returned
a works verdict (`42`, `-6`, `0`, and `abc` exiting 2), and an independent Checker
returned PASS with file:line citations. The same Maker run reproduced a bookkeeping
ordering defect — the issue status edit preceded baseline capture and guard validate
correctly blocked the overlapping hunk — which is fixed in
`.claude/agents/harness-maker.md`. This is scoped evidence from one provisioned
environment, not a claim about every environment or account.

### Evidence at 6a5106c (2026-10-15)

- Native Claude Code 2.1.300 loaded the 1.4.1 plugin from this source with all
  seven agents and both skills.
- A native cloud run completed the Planner, Maker, Prover and Checker phases: 14
  tests, Checker score 4.75, then `finish` OK, the task done and the Treehouse
  slot `available`.
- Three fresh-HOME real-CLI runs each passed all 35 assertions. The test now also
  audits the returned slot after `finish` (39 assertions); that version passed
  locally against Treehouse 3.1.0 and tasks-axi 0.2.6 and has not been re-run
  against Treehouse 1.8.0.
- Hosted test groups: the first group 57 pass; the second at 6a5106c 55 pass with
  the 8 Windows-only tests skipped on Linux; the remaining group 257 pass.
- Native phase prompts are unchanged; source from 9a36e2e to 6a5106c changes only
  test grouping.

Evidence lives in the operator proof bundle `loop-engineer-proof-2026-10-15`
(local proof summary JSON and the cloud final report for 6a5106c). The first
hosted cold run failed for a reason that remains unexplained, earlier hosted
attempts timed out, and a test-bundle schema omission was repaired; those results
stand. The completed cloud and local runs both showed audit classifying the returned `available` slot as external with a `git worktree remove`
suggestion; audit now keeps every Treehouse-listed pool slot managed, and the
real-CLI test asserts it after `finish`.

Restart validation accepts committed progress only when the recorded source is an
ancestor of the current task HEAD; acquisition still requires the exact source
HEAD. The coordinator commits the exact authorized planning artifacts before
Maker captures its clean protected-work baseline, then revalidates the lifecycle.
