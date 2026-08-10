# Claude task-aware subagent routing (2026-08-10)

## Scope and evidence

Primary Anthropic sources only. Product positioning and specifications below are verified; routing choices are explicitly marked as recommendations/inferences. Anthropic does not publish a unique "copywriting model" or "research model". Its guidance is capability/cost based and says to validate model choice with task-specific evals.

## Current model ladder

| Model | Verified Anthropic positioning | Context / output | Price per MTok (input / output) |
| --- | --- | --- | --- |
| `claude-fable-5` | Highest available capability; long-running agents, deep reasoning, long-horizon agentic tasks, advanced research | 1M / 128k | $10 / $50 |
| `claude-opus-5` | Complex agentic coding and enterprise work; deep reasoning, multihour autonomy, refactoring, vision-heavy workflows, computer use, and multi-agent coordination | 1M / 128k | $5 / $25 |
| `claude-sonnet-5` | Best combination of speed and intelligence; coding, agents, knowledge work, content creation, data analysis, visual understanding, tool use | 1M / 128k | $2 / $10 introductory through 2026-08-31, then $3 / $15 |
| `claude-haiku-4-5` | Fastest, most economical near-frontier model; real-time/high-volume processing and subagent tasks | 200k / 64k | $1 / $5 |

Sources: [Anthropic model selection guide](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model), [Opus 5 release notes and specifications](https://platform.claude.com/docs/en/about-claude/models/whats-new-claude-4-8), [Sonnet 5 launch](https://www.anthropic.com/news/claude-sonnet-5), [Sonnet 5 migration/specifications](https://platform.claude.com/docs/en/about-claude/models/whats-new-sonnet-5), and [Haiku 4.5 model page](https://www.anthropic.com/claude/haiku).

All four current generally available tiers accept visual input according to Anthropic's current model comparison/features documentation. Anthropic specifically positions Opus 5 for vision-heavy workflows and Sonnet 5 for visual understanding; that supports visual routing by difficulty, not a blanket rule that visual work always needs the most expensive tier. [Model selection guide](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model)

## Recommended routing policy (inference)

Use **Sonnet 5 as the default**, then escalate or downshift based on task risk and measured performance:

| Work shape | Default | Escalate when |
| --- | --- | --- |
| Orchestration, goal decomposition, architecture, difficult review | Opus 5 | Fable 5 only for genuinely long-horizon/high-uncertainty coordination where failure cost justifies ~2x Opus token price |
| Long-running exploration or advanced research | Opus 5 | Fable 5 for the hardest open-ended investigation; Sonnet 5 for bounded web/document research |
| Coding / implementation | Sonnet 5 | Opus 5 for large refactors, thorny debugging, security/high-stakes changes, or repeated Sonnet failure; Haiku for narrow mechanical edits with strong tests |
| Visual/UI understanding and creation | Sonnet 5 | Opus 5 for vision-heavy, high-fidelity, multi-step work; do not choose solely because an image is present |
| Copywriting/content | Sonnet 5 | Opus 5 when voice/taste, complex constraints, or consequential editorial judgment dominate; Haiku for templated variants/extraction/classification |
| Verification/checking | Sonnet 5 or Opus 5 based on consequence | Prefer a different model/tier from the maker where independence matters; Opus 5 for subtle correctness or high-stakes review |
| Fan-out subtasks: search, classify, summarize, format, simple tests | Haiku 4.5 | Sonnet 5 when synthesis, ambiguity, or long context becomes material |

This means an all-Fable agent team is usually wasteful: Fable costs 2x Opus and 5x Sonnet at Sonnet's temporary launch price (about 3.33x after 2026-08-31), while Anthropic explicitly recommends Haiku for subagent tasks and Sonnet for scalable agentic work. Keep Fable as an explicit escalation tier, not an inherited session default. This is a cost-policy inference, not an Anthropic claim about the user's exact workload.

The prompt should route on **task shape**, not occupational labels alone. Require the orchestrator to state: required capability, expected context size, autonomy horizon, visual/tool needs, consequence of error, parallel fan-out, and why a cheaper tier is insufficient. Also require task-specific evals and allow escalation after failure; Anthropic says effort tuning is often a better lever than switching models. [Anthropic model selection guide](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model)

## Local alias drift

- `[VERIFIED: scripts/resolve-role-model.ts:21-32]` Native routing already uses Sonnet 5 and Haiku 4.5, but claudex's flagship paths still use `claude-opus-4-8`. It has no Fable 5 or Opus 5 tier and only five coarse roles.
- `[VERIFIED: docs/DEPENDENCIES.md:42-59]` The claudex proxy recognizes only `claude-opus-4-8`, `claude-sonnet-5`, and `claude-haiku-4-5`; unknown IDs degrade. Therefore changing agent frontmatter to Opus 5/Fable 5 before updating and verifying the proxy aliases would break claudex compatibility.
- `[INFERRED]` Sonnet 5 and Haiku 4.5 are current and correctly aligned with Anthropic's standard/fast tiers. Opus 4.8 is one generation behind Opus 5 but remains available. The safe migration sequence is: add verified proxy mappings for `claude-opus-5` (and `claude-fable-5` only if truly needed), test them, update `docs/DEPENDENCIES.md`, then update resolver policy/tests.
- `[INFERRED]` The current fixed role table cannot express task-aware routing inside a role (for example, a Maker doing either formatting or a difficult refactor). Add complexity/risk/visual/autonomy signals or an explicit escalation decision instead of mapping every instance of a role to one model.

## Prompt-ready rule

> Select the cheapest model expected to meet the task's quality bar. Default to Sonnet 5; use Haiku 4.5 for bounded, high-volume, low-risk subtasks; use Opus 5 for deep reasoning, complex orchestration, vision-heavy work, difficult coding/review, or high consequence of error; reserve Fable 5 for the hardest long-running, long-horizon agent/research work. Do not route by job title alone. State the reason, use task-specific evals, tune effort before automatically upgrading, and escalate only when evidence shows the current tier is insufficient. Respect the provider's supported alias set; never emit an unrecognized model ID.
