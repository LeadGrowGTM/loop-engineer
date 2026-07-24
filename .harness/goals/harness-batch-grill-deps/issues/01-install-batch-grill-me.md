# 01 - Install batch-grill-me
Status: ready-for-agent
Blocked by: none

## Parent
SPEC.md Item 1 (no PRD.md exists for this goal — traced directly to SPEC.md, the
authoritative settled scope).

## What to build
Write `C:\Users\mitch\.claude\skills\batch-grill-me\SKILL.md`. Body **verbatim** from
`https://raw.githubusercontent.com/mattpocock/skills/main/skills/in-progress/batch-grill-me/SKILL.md`
— already fetched successfully (HTTP 200, 1642 bytes) and cached verbatim at
`C:\Users\mitch\AppData\Local\Temp\claude\C--Users-mitch-Everything-CC-tools-agent-agent-harness\4a6f71d2-1e02-4e45-b0b8-95d2b42b414d\scratchpad\batch-grill-me-upstream.md`
— read the cache, do not re-fetch or reconstruct from memory. No Tier-1 blocker on this item.

Frontmatter is the **only** permitted deviation from upstream:
- Keep `name: batch-grill-me` and the `description` field verbatim.
- **DROP** `disable-model-invocation: true`.
- **ADD** `user-invocable: true`.

Record the deviation and the upstream URL in a comment line directly under the frontmatter
(e.g. `<!-- Deviation from upstream <url>: dropped disable-model-invocation (upstream
restricts to human-only invocation; our clarity gate must invoke it automatically),
added user-invocable: true. Body verbatim. -->`).

This is a **filesystem write outside the `agent-harness` repo** — `~/.claude/skills/` is
not tracked by this repo's git. Do not attempt a repo commit for this phase alone (see
PLAN.md Commit boundaries).

## Acceptance criteria
- File exists at `C:\Users\mitch\.claude\skills\batch-grill-me\SKILL.md`.
- Body below the frontmatter is byte-identical to the cached upstream fetch (minus the one
  added deviation-comment line).
- Frontmatter has `name`, `description` (verbatim upstream), `user-invocable: true`; does
  NOT have `disable-model-invocation`.
- A comment line records both the deviation and the source URL.
- Traces to CHECKER_BRIEF dimension 4 (Upstream fidelity and traceability): 5 = verbatim
  body + only-frontmatter deviation + recorded deviation/URL; 1 = paraphrased body or an
  undocumented deviation.

## Skill routing
direct — `C:\Users\mitch\.claude\skills\batch-grill-me\SKILL.md`
