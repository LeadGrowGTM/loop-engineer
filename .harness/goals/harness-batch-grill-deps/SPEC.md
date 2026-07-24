# SPEC — harness-batch-grill-deps

Authoritative scope. Every decision here is settled — grilled over three frontier rounds with the
operator. Do not re-litigate, re-ask, or "improve" them.

Repo: `C:\Users\mitch\Everything_CC\tools\agent\agent-harness` (loop-engineer)
Stack: Markdown skill files, TypeScript on Bun, PowerShell, Windows 11.
Working dir: `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\.harness\goals\harness-batch-grill-deps\`
Branch: cut a feature branch off `master`. Task registered in tasks-axi as `harness-batch-grill-deps`.

**The repo skill copy is the ONLY source of truth. Never edit `C:\Users\mitch\.claude\skills\write-goal-prompt\` directly.**

---

## Item 1 — Install batch-grill-me

Write `C:\Users\mitch\.claude\skills\batch-grill-me\SKILL.md`.

Body **verbatim** from
`https://raw.githubusercontent.com/mattpocock/skills/main/skills/in-progress/batch-grill-me/SKILL.md`
— fetch it, do not paraphrase, do not reconstruct from memory.

Frontmatter is the **only** permitted deviation:

- Keep `name` and `description`.
- **DROP** `disable-model-invocation: true` — upstream ships this so only a human can invoke the
  skill; our clarity gate must invoke it automatically, so we trade the flag away knowingly.
- **ADD** `user-invocable: true`.

Record the deviation and the upstream URL in a comment line directly under the frontmatter so the
drift stays traceable to a later reader.

## Item 2 — Rewrite clarity-gate Branch A

File: `skills\write-goal-prompt\references\clarity-gate.md`

Branch A ends up with exactly **two** paths and a crisp "which do I pick" test between them:

- **`/grilling`** — deep interactive depth, one question at a time. For when ambiguity is deep or
  decisions depend on each other.
- **`batch-grill-me`** — multi-round frontier batches. Preserve the real upstream mechanic: model
  the work as a design tree; the *frontier* is every decision whose prerequisites are settled; ask
  the whole frontier in one round, numbered, each with your recommended answer; wait for answers;
  answers reshape the tree, so recompute the frontier and ask the next round; sub-agents find
  *facts* while the *decisions* stay the user's; done when the frontier is empty. Do not flatten
  this into "ask several questions at once" — the round structure is the point.

**DELETE** the old ad-hoc batch-question Sonnet agent prompt entirely. It is superseded, not
deprecated. Leave zero surviving references to it anywhere in the skill.

Update the Phase 0.5 routing table in `skills\write-goal-prompt\SKILL.md` to match exactly.

## Item 3 — docs/DEPENDENCIES.md

One table. Tiers: **Required** (loop breaks without it) | **Optional** (degrades gracefully — say
*how* it degrades) | **Bundled** (shipped by this repo).

Columns: dependency · tier · what it does · install/verify command · what breaks without it.

Cover at minimum: `tasks-axi`, `gnhf`, `treehouse`, `no-mistakes`, `lavish-axi`, `batch-grill-me`,
`grilling`, `wayfinder`, `git`/`gh`, Bun, and the bundled `harness-*` agents + red-team workflow.

Accuracy constraints — these are verified facts, do not contradict them:

- `scripts/setup-harness.ts` seeds `.tasks.toml` and `treehouse.toml` and gitignores `.tmp/treehouse/`
  + `.gnhf-runs/`, but verifies **no** external binary. Do not imply it checks anything.
- `/grilling` resolves **ambiguously** — a local `~/.claude/skills/grilling` skill AND a
  `mattpocock-skills:grilling` plugin, with different descriptions. **Document this; do not fix it.**
- `no-mistakes` is both a skill (`/no-mistakes`) and a CLI (`no-mistakes axi`). Say so.
- gnhf must run Opus; the override lives in `~/.gnhf/config.yml`.

Pointers: add one to `README.md`'s `## Installation` section (it currently names zero external
prerequisites) and a row to the `CLAUDE.md` repo map.

## Item 4 — Audit the existing shipper integration

Already in the working tree, uncommitted, and deliberately kept: `.claude/agents/harness-shipper.md`,
`SHIP_BRIEF` + stage 5 in `skills/write-goal-prompt/SKILL.md`, Phase 4 in
`references/subagent-harness.md`, `AGENT_FILES` in `scripts/setup-harness.ts` + its tests.

Keep it. Fix **only** genuine gaps you can cite with `file:line`. Check `EXAMPLES.md`,
`docs/ARCHITECTURE.md`, and the reference index for stale "four-phase" / "three-section" counts left
behind by the five-stage change. Do not rewrite what already works.

## Item 5 — Archive the stale copy, then junction

Order matters: this is **last**, after items 1-3 land. Junction before the edits are final and you
risk editing through a link whose target is still moving.

1. **MOVE** (never delete — workspace archive-safety rule) `C:\Users\mitch\.claude\skills\write-goal-prompt\`
   to `C:\Users\mitch\Everything_CC\archive\2026-07-16-write-goal-prompt-stale-copy\`
2. `cmd /c mklink /J "C:\Users\mitch\.claude\skills\write-goal-prompt" "C:\Users\mitch\Everything_CC\tools\agent\agent-harness\skills\write-goal-prompt"`
   (a junction needs no admin rights)
3. Verify both paths read byte-identical.

---

## Constraints

- **NEVER delete.** Archive by moving.
- Do not edit `C:\Users\mitch\.claude\skills\write-goal-prompt\` directly — repo copy is truth.
- Do not touch other skills in `~\.claude\skills\` — this junction is scoped to write-goal-prompt.
- Do not change gnhf's Opus override or any `launch-gnhf.ps1` safety guard.

If a constraint would be violated: stop that item, document under "Constraint Block" in HANDOFF.md,
continue the rest.

## Blocker fallbacks

Hard blocker → mock/stub, document under "Needs My Decision", continue unblocked work. Never
silently downgrade:

- Tier 1: do the same process manually, same depth
- Tier 2: reduced scope — mark `quality: draft` in frontmatter
- Tier 3: skeleton from trained knowledge — mark `quality: placeholder`, flag in HANDOFF

**If the upstream batch-grill-me URL is unreachable:** that is Tier 1 — do NOT paraphrase from
memory. Stop item 1, document it, continue items 2-5.
