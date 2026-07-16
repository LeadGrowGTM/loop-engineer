# PLAN.md — harness-batch-grill-deps

Execution shape: goal-loop (already fixed by HARNESS.md's five-stage Planner → Maker →
Checker → Ship structure, max 3 cycles). Not a benchmarking loop — no exogenous metric.
Static-artifact goal: Prover and Red-team stages are skipped (both N/A in HARNESS.md).

Ordering below is the real dependency chain from PLANNER_BRIEF, not a preference. Phase 5
(junction) is last and load-bearing — junctioning before edits 1–3 land risks editing
through a link whose target is still moving.

## Phases

1. Install batch-grill-me — skill: direct — artifact: `C:\Users\mitch\.claude\skills\batch-grill-me\SKILL.md`
2. Rewrite clarity-gate Branch A + SKILL.md routing table — skill: direct — artifact: `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\skills\write-goal-prompt\references\clarity-gate.md` (+ `skills\write-goal-prompt\SKILL.md` Phase 0.5 table)
3. Write docs/DEPENDENCIES.md + README pointer + CLAUDE.md row — skill: direct (consider `/stop-slop` on prose once drafted) — artifact: `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\docs\DEPENDENCIES.md`
4. Audit shipper/no-mistakes integration — skill: direct (read-only audit → cited fixes) — artifact: audit notes in `PROGRESS.md` + fixes to `references/subagent-harness.md`, `docs/ARCHITECTURE.md`, `docs/index.md` (only if a genuine `file:line` gap is found)
5. Archive stale copy + junction — skill: direct (filesystem ops) — artifact: `C:\Users\mitch\Everything_CC\archive\2026-07-16-write-goal-prompt-stale-copy\` + junction at `C:\Users\mitch\.claude\skills\write-goal-prompt`

(Each phase is mirrored 1:1 as a durable slice in `issues/NN-<slug>.md`.)

## Skill Routing

No skill in `references/skill-routing.md` covers meta-work on the harness itself (skill
authoring, reference-file prose rewrites, dependency documentation, filesystem archival).
Per the routing heuristics' step 6 ("No matching skill? Direct implementation is fine."),
every phase routes **direct**. This is expected, not a shortfall — do not force a skill
invocation to look thorough. Phase 3 optionally runs `/stop-slop` on the drafted prose
(not a build skill, a polish pass) per MAKER_ROUTING.

- Phase 1 → direct — reason: "install a skill file" matches no skill in the table; WebFetch + Write is the whole job.
- Phase 2 → direct — reason: prose rewrite of an existing reference file; no skill authors reference docs.
- Phase 3 → direct (+ optional `/stop-slop`) — reason: dependency-table authoring is direct; `/stop-slop` is a prose-tightening pass, not a routing target.
- Phase 4 → direct — reason: read-only audit + narrowly cited fixes; no skill performs a doc-drift audit.
- Phase 5 → direct — reason: filesystem move + `mklink /J` are direct OS operations.

## Checker Rubric

Artifacts to evaluate (from CHECKER_BRIEF — exact list, do not add or drop):
- `C:\Users\mitch\.claude\skills\batch-grill-me\SKILL.md`
- `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\skills\write-goal-prompt\references\clarity-gate.md`
- `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\skills\write-goal-prompt\SKILL.md` (Phase 0.5 section only)
- `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\docs\DEPENDENCIES.md`
- `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\README.md`
- `git diff` on the shipper-related files (`.claude/agents/harness-shipper.md`, SHIP_BRIEF/stage-5 text in `SKILL.md`, Phase 4 in `references/subagent-harness.md`, `AGENT_FILES` in `scripts/setup-harness.ts` + its tests)

Dimensions (score 1-5 each — reproduced verbatim from CHECKER_BRIEF, do not reword):

1. **Clarity-gate coherence** — fed by Phase 2. 5 = Branch A has exactly two paths (`/grilling`, `batch-grill-me`) with a crisp "which do I pick" test; zero surviving references to the deleted batch-question agent anywhere in the skill; SKILL.md's routing table matches clarity-gate.md exactly. 1 = dangling references to the deleted agent, or the two paths are indistinguishable in practice.
2. **Frontier mechanic fidelity** — fed by Phase 2. 5 = preserves upstream's actual mechanic (design tree, frontier = prerequisites-settled questions, whole frontier per round numbered with a recommended answer each, wait, recompute, sub-agents find facts while the user decides, done when frontier is empty). 1 = reduced to "ask several questions at once."
3. **Dependency doc completeness and accuracy** — fed by Phase 3. 5 = every dependency from the goal has a row with a tier, a real install/verify command, and a specific consequence of absence; Optional rows say HOW they degrade; claims match `setup-harness.ts` (seeds `.tasks.toml`/`treehouse.toml`, verifies no binary). 1 = missing dependencies, invented commands, or tiers contradicting the code.
4. **Upstream fidelity and traceability** — fed by Phase 1. 5 = body verbatim from upstream; the ONLY deviation is frontmatter (`disable-model-invocation` dropped, `user-invocable: true` added); deviation + source URL recorded in the file. 1 = paraphrased body, or an undocumented deviation.
5. **Single source of truth** — fed by Phase 5 (post-Phases 1-3 final). 5 = junction resolves, both paths byte-identical, stale copy archived (moved, not deleted) to the dated archive path, nothing edited through the `~/.claude` path. 1 = a surviving stale copy, a deletion, or a broken link.

Note: Phase 4 (shipper audit) has no dedicated scored dimension — its artifact (`git diff`
on shipper-related files) is in the evaluated list as a scope-discipline check (confirms
only cited gaps were touched, nothing pre-existing was rewritten), not a sixth rubric
score. Do not invent a sixth dimension; this asymmetry is inherited from HARNESS.md as-is.

**PASS threshold:** mean ≥4.0/5.0 AND no single dimension <3. Anything else is ITERATE.

## Turn Budget

Planner: turns 1-5 (this phase).
Maker: turns 6-60 —
- Phase 1 (install batch-grill-me): turns 6-11 (~6 turns — WebFetch already done and cached in scratchpad; just verify + Write)
- Phase 2 (clarity-gate + SKILL.md table): turns 12-21 (~10 turns)
- Phase 3 (DEPENDENCIES.md + pointers): turns 22-41 (~20 turns — biggest single chunk per PLANNER_BRIEF)
- Phase 4 (shipper audit): turns 42-51 (~10 turns)
- Phase 5 (archive + junction): turns 52-60 (~9 turns)
Checker: turns 61-70 (~10 turns, per cycle).
Ship: turns 71-80 (~10 turns — harness-shipper drives `/no-mistakes` to a terminal outcome).
Total: ~80 (matches HARNESS.md's stated split; 5 reserved inside Checker's block for report/margin).

## Dependencies

Sequential (hard chain, per PLANNER_BRIEF table): 1 → 2 → 3 → 5. Phase 5 must run only
after 1, 2, and 3 are final — junctioning through a still-changing target risks editing
the live repo copy via the `~/.claude` symlink mid-edit.

Parallel-safe: Phase 4 is independent of 1-3 and 5 — it audits pre-existing, deliberately
kept files (harness-shipper.md, SHIP_BRIEF, subagent-harness.md Phase 4, AGENT_FILES) that
no other phase touches. It may run any time before the Checker cycle; kept at position 4
in phase order to match PLANNER_BRIEF and its own slice numbering, but the Maker may
interleave it with 1-3 if that's more efficient, so long as 5 still runs strictly last.

## Commit boundaries (per PROOF_PROTOCOL — every phase needs proof, not all need a repo commit)

- Phase 1: artifact is outside the repo (`C:\Users\mitch\.claude\skills\batch-grill-me\`).
  No `agent-harness` repo diff exists for this phase alone — record `Commit: N/A (outside
  repo tree)` in PROGRESS.md, with the file's own existence + byte count as proof instead.
- Phase 2: real repo commit — `skills/write-goal-prompt/references/clarity-gate.md` +
  `skills/write-goal-prompt/SKILL.md` are both tracked in `agent-harness`.
- Phase 3: real repo commit — `docs/DEPENDENCIES.md`, `README.md`, `CLAUDE.md` are all
  tracked.
- Phase 4: real repo commit only if a genuine gap was found and fixed (cited `file:line`);
  if the audit finds nothing to fix, record that finding with no commit.
- Phase 5: artifact is outside the repo (archive move + junction both target
  `C:\Users\mitch\.claude\` and `C:\Users\mitch\Everything_CC\archive\`, neither inside
  `agent-harness`). Record `Commit: N/A (outside repo tree)`, with the junction-resolves +
  byte-identical verification commands as proof instead.

Proof-of-completion command per PROOF_PROTOCOL (paste actual output, not description):

- Phase 1: `Get-Content "C:\Users\mitch\.claude\skills\batch-grill-me\SKILL.md" | Measure-Object -Line` (or `wc -l` under Bash) — confirm non-empty, body matches the cached upstream fetch byte-for-byte below the frontmatter.
- Phase 2: `grep -c "batch-question" skills\write-goal-prompt\references\clarity-gate.md skills\write-goal-prompt\SKILL.md` → must print `0` for both (zero surviving references to the deleted agent).
- Phase 3: `wc -l docs\DEPENDENCIES.md` + `grep -c "DEPENDENCIES" README.md` (pointer present).
- Phase 4: `git diff --stat -- .claude/agents/harness-shipper.md skills/write-goal-prompt/SKILL.md skills/write-goal-prompt/references/subagent-harness.md scripts/setup-harness.ts scripts/setup-harness.test.ts skills/write-goal-prompt/docs/ARCHITECTURE.md skills/write-goal-prompt/docs/index.md skills/write-goal-prompt/EXAMPLES.md` — shows only the cited fixes, nothing else.
- Phase 5: `cmd /c fc /b "C:\Users\mitch\.claude\skills\write-goal-prompt\SKILL.md" "C:\Users\mitch\Everything_CC\tools\agent\agent-harness\skills\write-goal-prompt\SKILL.md"` → no differences (byte-identical through the junction); `Test-Path "C:\Users\mitch\Everything_CC\archive\2026-07-16-write-goal-prompt-stale-copy\SKILL.md"` → `True` (archived, not deleted).
