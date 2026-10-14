# Compatibility

Verified against source and local Claude Code 2.1.299 on 2026-10-14.

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

Managed execution also requires the versioned **internal** `tasks-axi` and
Treehouse CLIs and the bundled pinned grill; shipping requires `no-mistakes` and
authenticated `gh`. See [DEPENDENCIES.md](DEPENDENCIES.md). Public plugin discovery
works without those tools, but a managed goal cannot start without them. They
must be provisioned by the workspace owner in a cloud environment; this public
repository does not supply their installers. Missing tools fail readiness;
there is no fallback that bypasses lifecycle isolation or approval gates.

## Verification limits

Plugin validation and local tests do not prove a live Anthropic-hosted cloud run,
a proxy's model availability, or access to internal CLI packages. Verify those in
the intended provisioned environment before claiming end-to-end compatibility.

The four build roles are sibling agent calls from the coordinator; their sequence
numbers are phases, not recursive nesting depth. Keep execution in the active
session so approval requests can be answered.

## Real CLI regression verification (2026-10-15)

The opt-in `scripts/live-lifecycle.test.ts` executes the public setup/lifecycle
commands against tasks-axi 0.2.6, Treehouse 3.1.0 and PowerShell 7.4.6. It uses a
fresh disposable repository and home directory; no production task or lease is
touched. Run with `LOOP_ENGINEER_LIVE_CLI_TEST=1 bun test scripts/live-lifecycle.test.ts` after placing `pwsh` on PATH.

See [DEPENDENCIES.md](DEPENDENCIES.md) for the CLI-version contract and the
[setup guide](../skills/setup-harness/SKILL.md) for pool creation and generated
backlog handling. Restart validation reads the authoritative task from the source
repository rather than an independently copied worktree backlog. Treehouse status
parsing accepts the newer optional branch annotation while preserving exact lease
path and holder checks.

Claude Code 2.1.299 installed the published v1.4.0 marketplace into an isolated
config directory and initialized all seven agents with the expected model tiers
and tool allowlists. Both skills and the benchmarking command appeared in session
discovery. Native model execution was blocked by the account's weekly usage limit,
so initialization does not prove prompt following or a complete agent loop.

Restart validation accepts committed progress only when the recorded source is an
ancestor of the current task HEAD; acquisition still requires the exact source
HEAD. The coordinator commits the exact authorized planning artifacts before
Maker captures its clean protected-work baseline, then revalidates the lifecycle.
