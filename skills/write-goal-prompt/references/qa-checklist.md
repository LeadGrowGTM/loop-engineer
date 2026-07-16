# QA Checklist Reference

## Length Gate — TWO-SIDED, MEASURED, BLOCKING

`/goal` rejects any condition **≥4000 characters** outright ("Goal condition is limited to 4000 characters"). Emitting an over-length goal = failed deliverable. **Measure, never eyeball.**

Write the candidate to a temp file via the Write tool, then measure with the gate script (Bash tool, Bun — works on Windows and Linux):

```bash
bun skills/write-goal-prompt/scripts/check-goal-length.ts temp/_goal-candidate.txt
```

`/goal` strips one trailing newline before counting — the script replicates that exactly. Target **<3990** (≥10 char margin, exit non-zero at/above it = BLOCKED). The script also prints **WARN** (exit 0, not blocked) once the candidate clears a soft `--brevity` budget (default 2200, `--brevity 2800` for genuinely multi-phase tasks) — that WARN means run the Brevity Pass below before emitting. Include `[Measured: XXXX chars]` before emitting. No count shown = gate not run = failure.

Fallback if Bun is unavailable (note `encoding="utf-8"` — without it Python over-counts on Windows and falsely blocks valid prompts):

```bash
python -c "txt=open('temp/_goal-candidate.txt', encoding='utf-8').read().rstrip('\n'); print(len(txt))"
```

**Do NOT use `wc -m` — it does not work on Windows (PowerShell). Use the commands above always.**

To compress when over:

1. Cut adjectives and filler from [TASK] — keep only what changes behavior
2. Collapse multi-line done criteria that test the same thing
3. Move detailed context (copy rules, brand pillars) to a reference file the agent
   reads at runtime instead of inlining. Write it to the task's working dir and add
   `"Read <path> before starting"` to [TASK]. This is preferred over cutting content.
4. Re-check. If still over, the task is too complex for one goal — split into two
   sequential goals.

---

## Brevity Pass — SUBTRACTIVE, runs even when under the cap

Everything else in this checklist is additive ("did you INCLUDE X"). Left unchecked, that pushes every prompt to the ceiling — which is why prompts drift long. This pass is the counterweight. Run it whenever the length gate prints **WARN** (over the brevity budget), and ideally always. **4000 is the reject line; the target is the shortest prompt that still passes the dry-run self-check.**

Go block by block and cut, don't add:

1. **Every block earns its place.** If removing a block wouldn't change what the turn-1 agent does, remove it. Default-present blocks (fallbacks, quality floors, constraints) are only warranted when the task actually has that risk — a no-cost single-artifact task does not need a tiered-fallback ladder or a cost ceiling.
2. **Inline only what changes turn-1 behavior.** Phase plans, rubrics, briefs, copy rules, brand pillars → a reference file in the task working dir, referenced by path. The goal carries the path, not the content. (HARNESS.md is already handled this way — apply the same rule to everything bulky.)
3. **One statement per idea.** Collapse restated done criteria, merge overlapping constraints, kill "in order to / it is important that / make sure to" scaffolding.
4. **No filler verbs or adjectives.** "implement a robust solution for" → "build". "comprehensive" / "seamless" / "properly" add chars, not meaning.
5. **Re-measure.** If it's now under the brevity budget, emit. If it's still large *after* honest subtraction, that's a real signal the task is too big for one goal — split it, don't pad the gate margin.

---

## Context Verification (via subagents)

Spawn 1-3 lightweight subagents (Haiku-tier / Explore) in parallel to confirm:

| Check               | What the subagent does                                                            | Fail action                                     |
| ------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Paths exist**     | Glob/Read every file path referenced in [TASK] and [CONTEXT]                      | Remove dead paths, warn user                    |
| **Skills exist**    | Check each skill name referenced exists in .claude/skills/ or .claude/commands/   | Remove or replace with manual fallback          |
| **Folder patterns** | If referencing "check existing clients/gtm-client-\*", verify at least one exists | Add explicit folder structure to prompt instead |

**Why subagents:** The goal prompt author (often Fable/Opus) shouldn't waste expensive
tokens reading directories. Haiku confirms in 200 tokens what Opus would burn 2000 on.

If any check fails, fix the prompt before emitting. Don't emit a goal that references
nonexistent files or skills — the overnight agent will waste turns discovering this.

---

## Dry-Run Self-Check (12 Questions)

Walk through the goal prompt as if you were the receiving agent on turn 1:

1. Can I start working from [TASK] alone without asking questions? If not → add context.
2. Is every done criterion machine-verifiable (file exists, command exits 0, grep returns)? If not → rewrite.
3. Does [BLOCKERS] cover the most likely failure mode? If not → add it.
4. Are there enough fallbacks that the agent can produce _something_ even if every skill fails?
5. Is the feature list explicit, or would the agent have to guess what to build? If guessing → add "Must include:" block.
6. Is the quality bar stated? Without it the agent defaults to "done = exists" — the fastest path, not the best one.
7. Does the task touch live data, shared infra, or a per-call cost API? If yes → [CONSTRAINTS] block must be present.
8. Are stretch goals clearly separated from required work? Mixed-in optionals cause the agent to deprioritize required items.
9. Is the reward signal single and unambiguous? If it requires human judgment to compute — flag it to the user, offer the three options, do not silently proceed.
10. Does the mechanical gate run in seconds without LLM involvement? If not, split into separate gates.
    10a. Does the qualitative gate have any dimension where two people would score it differently by >1 point? If yes → human judgment flag required.
11. Is max_cycles set? Default 3. If the task has multiple phases, is the cycle limit per-phase or global?
12. Is the done condition an exact threshold? "good enough" is not a threshold.

---

## Skill-Aware Quality Floors

When the goal references a skill (e.g., "run /research-chain", "run /offer-workshop"),
the done criteria must encode the skill's **quality bar**, not just "output file exists."

**The failure mode:** Agent invokes a skill, it takes too long or partially fails, agent
writes the output artifact by hand in 2 minutes. Done criteria says "file exists" → goal
satisfied. But the artifact is thin — trained-knowledge filler, not sourced research.
The overnight agent optimizes for _completion speed_, so it will always prefer the fast
shortcut unless the prompt makes quality non-optional.

**Rules for skill references in goal prompts:**

1. **Time-heavy skills get their own phase** — don't bundle a 20-min research chain
   with 5 other tasks as equals. Give it explicit time allocation: "Phase 3 is the
   critical path. Spend the majority of turns here. Do not shortcut."

2. **Quality criteria, not existence criteria** — instead of `_manifest.yaml exists`,
   write `_manifest.yaml exists AND each research step has >5 unique web sources cited
in the artifact`. The evaluator checks specificity, not just file presence.

3. **Tiered fallbacks** — don't write "if skill fails, do it by hand." Instead:
   - **Tier 1 (skill invocation fails):** Run the skill's underlying process manually
     (same web searches, same sub-agents, same source count). Slower, same quality.
   - **Tier 2 (APIs unavailable):** Do manual web research at reduced scope. Mark
     artifacts as `quality: draft` in frontmatter. Document in HANDOFF.md.
   - **Tier 3 (everything fails):** Write skeleton artifacts from trained knowledge.
     Mark as `quality: placeholder`. HANDOFF.md must flag these for rerun.
     Never let Tier 3 satisfy a done criterion silently.

4. **Distinguish infrastructure from substance** — folder scaffolds, config files, and
   git setup are infrastructure (fast, low risk). Research, copy, and strategy are
   substance (slow, quality-sensitive). The goal prompt should explicitly mark which
   phases are substance and instruct: "Substance phases must not be shortcut. If you
   can't run the full process, mark the phase as DRAFT and continue, but do not claim
   it as complete in done criteria."

5. **Source count as quality proxy** — for research-type skills, add a minimum source
   count to done criteria. "Research playbook cites ≥30 unique external sources" is
   crude but catches the 33-search-total-across-all-steps failure mode.

---

## Git Commit Cadence

Add this to the goal prompt's [TASK] section when the task produces multiple artifacts
across phases:

```
Commit at each phase boundary with a descriptive message. Don't batch all work into
one final commit — if the session dies mid-run, completed phases should be preserved.
```

This ensures partial progress survives session crashes or turn limit exhaustion.

---

## Condition Quality Checklist

Before emitting, verify the condition:

**Scope & Features**

- [ ] **One measurable end state** in the `[GOAL]` line (evaluator reads this first)
- [ ] **Tech / Stack explicit** — language, framework, runtime stated in [TASK], not buried in context
- [ ] **Key features listed** — "Must include:" block present for build/create tasks; agent cannot guess scope
- [ ] **Stretch goals separated** — optional work clearly labeled so agent doesn't deprioritize required items

**Harness Awareness**

- [ ] **Phase 1.5 ran** — 3 discovery agents fired in parallel before formatting
- [ ] **[TOOLS] block populated** — relevant skills, agent types, and CLI tools from discovery; not guessed
- [ ] **No tool hallucination** — every skill/agent name in [TOOLS] confirmed to exist by discovery agents
- [ ] **[TOOLS] omitted if empty** — block not present if discovery returned nothing relevant

**Quality**

- [ ] **Quality bar stated** — "done well" defined, not left to the agent's default (speed = done = exists)
- [ ] **Quality floors** — substance phases have quality criteria, not just existence checks
- [ ] **Tiered fallbacks** — skill failures degrade gracefully (full→manual→draft→placeholder), never silently skip quality
- [ ] **Substance vs infrastructure** — time-heavy quality-sensitive phases are marked and protected from shortcuts

**Eval Loop**

- [ ] **Phase 0 ran** — eval loop designed before intake, not after formatting
- [ ] **[EVAL LOOP] block present** — every goal prompt has one, no exceptions
- [ ] **Reward signal is single and programmatic** — no composite scores, no human-judgment required to compute
- [ ] **Human-judgment flag surfaced if needed** — if any gate requires reading-and-deciding, user was shown the three options before goal was emitted
- [ ] **Mechanical gate is fast and binary** — runs in seconds, no LLM, fails loudly
- [ ] **Qualitative gate produces the reward signal** — scored, not binary; tells the agent WHERE it fell short
- [ ] **max_cycles set** — default 3; circuit breaker on 3 consecutive identical signals
- [ ] **Done condition is a threshold** — exact number, not "looks good" or "is complete"
- [ ] **Inputs fixed across cycles** — spec doesn't change; only the output varies
- [ ] **Cycle logging required** — agent writes cycle number + score to HANDOFF.md each iteration

**Safety & Constraints**

- [ ] **Constraints block present** if task touches live data, shared infra, or per-call cost APIs
- [ ] **Cost ceiling stated** if any API calls will run in volume overnight
- [ ] **Disruption risks named** — live tables, running jobs, shared sheets explicitly called out with "read-only" or "do not touch" guards

**Execution**

- [ ] **Stated check** — how Claude proves done (test exit code, file exists, etc.)
- [ ] **Context-based compaction** at 170k tokens (not turn-based)
- [ ] **Turn limit** included — default 80, never omit
- [ ] **Morning report deliverables** — HANDOFF.md + HANDOFF.html + HANDOFF.excalidraw
- [ ] **Report published PUBLIC** — `lavish-axi share HANDOFF.html` step present with NO `--password` (the link must open in one click and be pasteable into the no-mistakes PR); URL captured in HANDOFF.md; update_key saved to HANDOFF.secret.local (gitignored, never committed — still update/delete-capable); no credentials or client PII in the report body
- [ ] **Overnight framing** — reads as a handoff, not a command
- [ ] **Total length** under 4000 characters (Phase 2.5 length gate passed)
- [ ] **Brevity Pass run** — shortest prompt that passes the dry-run, not the longest that fits; if the gate printed WARN, the subtractive pass above was applied and every remaining block earns its place
- [ ] No vague verbs like "implement" or "handle" without a measurable check
- [ ] **Context verified** — all paths, skills, patterns confirmed to exist (Phase 2.5)
- [ ] **Dry-run passed** — agent can start from [TASK] without asking questions
- [ ] **Git commit cadence** included for multi-phase tasks
- [ ] **Fallbacks** — agent can produce artifacts even if every skill fails
