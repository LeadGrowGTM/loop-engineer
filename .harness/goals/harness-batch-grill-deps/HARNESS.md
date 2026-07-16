# HARNESS — harness-batch-grill-deps

Goal: install batch-grill-me and route it from the write-goal-prompt clarity gate, document every
loop-engineer dependency, verify the already-built shipper integration, and make the repo skill
copy the single source of truth via a junction.

Decisions are settled (grilled over three frontier rounds). Do not re-litigate them.

---

## PLANNER_BRIEF

**Read first, in this order:**

1. `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\skills\write-goal-prompt\references\clarity-gate.md` — the file being rewritten
2. `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\skills\write-goal-prompt\SKILL.md` — Phase 0.5 routing table must stay in sync with clarity-gate.md
3. `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\scripts\setup-harness.ts` — what is actually installed vs merely assumed
4. `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\README.md` — `## Installation` is where the DEPENDENCIES pointer goes
5. `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\CLAUDE.md` — repo-map table gets a row
6. `C:\Users\mitch\.claude\skills\no-mistakes\SKILL.md` — the shipper's runtime contract

**Phases (ordering is a real dependency chain, not a preference):**

| # | Phase | Depends on | Why |
|---|---|---|---|
| 1 | Install batch-grill-me skill | — | Nothing to route to until it exists |
| 2 | Rewrite clarity-gate Branch A + SKILL.md routing table | 1 | Must reference a skill that exists |
| 3 | Write docs/DEPENDENCIES.md + README pointer + CLAUDE.md row | 1, 2 | batch-grill-me is one of the rows |
| 4 | Audit shipper/no-mistakes integration | — | Independent; can run any time before Checker |
| 5 | Archive stale copy + junction | 1, 2, 3 | Junction LAST — repo copy must be final first |

Phase 5 last is load-bearing: junction before the edits land and you risk editing through a link
whose target is still mid-change.

**Turn budget:** Planner 1-5 · Maker 6-60 (phase 3 is the biggest single chunk) · Checker 61-70 ·
Ship 71-80.

---

## MAKER_ROUTING

- Phase 1: **direct** — WebFetch upstream, Write skill file. No skill matches "install a skill file."
- Phase 2: **direct** — prose rewrite of a reference file. Artifact: `references/clarity-gate.md`
- Phase 3: **direct** (consider `/stop-slop` on the prose once drafted) — Artifact: `docs/DEPENDENCIES.md`
- Phase 4: **direct** — read-only audit. Artifact: audit notes in `PROGRESS.md`
- Phase 5: **direct** — filesystem ops. Artifact: junction + archive dir

No skill in the routing table covers any phase here. That is expected for meta-work on the harness
itself; do not force a skill invocation to look thorough.

---

## PROVER_BRIEF

N/A — static artifact goal. No running app, endpoint, or CLI behaviour ships. The junction and
`bun test` are covered by the mechanical gate, not a Prover.

---

## REDTEAM_BRIEF

N/A — internal tooling and documentation. No user-facing flow, no auth surface, no untrusted input.

---

## CHECKER_BRIEF

**Evaluate these artifacts only:**

- `C:\Users\mitch\.claude\skills\batch-grill-me\SKILL.md`
- `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\skills\write-goal-prompt\references\clarity-gate.md`
- `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\skills\write-goal-prompt\SKILL.md` (Phase 0.5 section only)
- `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\docs\DEPENDENCIES.md`
- `C:\Users\mitch\Everything_CC\tools\agent\agent-harness\README.md`
- `git diff` on the shipper-related files

You did not write these. Do not read `PROGRESS.md` or Maker reasoning.

**Rubric — score each 1-5, cite `file:line` evidence for every score:**

1. **Clarity-gate coherence.** 5 = Branch A presents exactly two paths (`/grilling`, `batch-grill-me`)
   with a crisp "which do I pick" test; the deleted batch-question agent has zero surviving
   references anywhere in the skill; SKILL.md's routing table matches clarity-gate.md exactly.
   1 = dangling references to the deleted agent, or the two paths are indistinguishable in practice.
2. **Frontier mechanic fidelity.** 5 = the routed description preserves upstream's actual mechanic —
   design tree, frontier = prerequisites-settled questions, whole frontier per round, numbered with
   a recommended answer each, wait for answers, recompute, sub-agents find facts while the user makes
   decisions, done when frontier is empty. 1 = reduced to "ask several questions at once."
3. **Dependency doc completeness and accuracy.** 5 = every dependency from the goal has a row with a
   tier, a real install/verify command, and a specific consequence of absence; Optional rows say HOW
   they degrade, not just that they do; claims match what `setup-harness.ts` actually does (it seeds
   `.tasks.toml` and `treehouse.toml` but verifies no binary — the doc must not imply otherwise).
   1 = missing dependencies, invented commands, or tiers that contradict the code.
4. **Upstream fidelity and traceability.** 5 = body verbatim from upstream; the ONLY deviation is
   frontmatter (`disable-model-invocation` dropped, `user-invocable: true` added); the deviation and
   source URL are recorded in the file. 1 = paraphrased body, or an undocumented deviation.
5. **Single source of truth.** 5 = junction resolves, both paths byte-identical, stale copy archived
   (moved, not deleted) to the dated archive path, and nothing edited through the `~/.claude` path.
   1 = a surviving stale copy, a deletion, or a broken link.

**PASS threshold:** mean ≥4.0/5.0 AND no single dimension <3. Anything else is ITERATE.

---

## SHIP_BRIEF

**intent:** Integrate mattpocock's batch-grill-me skill into the write-goal-prompt clarity gate as
the multi-round frontier-batch path (replacing the ad-hoc batch-question agent, keeping `/grilling`
for deep interactive work); document every loop-engineer dependency in `docs/DEPENDENCIES.md` under
Required/Optional/Bundled tiers; verify and close gaps in the existing harness-shipper /
no-mistakes merge-readiness stage; and eliminate skill drift by archiving the stale `~/.claude`
copy and junctioning it to the repo.

**Decisions a reviewer cannot infer from the diff:**

- Dropping `disable-model-invocation` is deliberate. Upstream ships it so only a human can invoke
  the skill; the clarity gate must invoke it automatically, so the flag was traded away knowingly.
  The body stays verbatim.
- The old batch-question agent was deleted, not deprecated — batch-grill-me supersedes it.
- The junction (not a copy) is the drift fix; the repo copy is the only source of truth.
- The shipper work predates this task and was kept deliberately. Only cited gaps were touched.
- `/grilling` resolves ambiguously (local skill + `mattpocock-skills:grilling` plugin). Documented
  in DEPENDENCIES.md rather than resolved here — out of scope.

After Checker returns PASS, spawn a fresh `harness-shipper` with this intent, the project root, the
feature branch, and the PASS verdict. It invokes `/no-mistakes` once and drives it to a terminal
outcome. Never ship inline. Never invoke on ITERATE or PLATEAU. `checks-passed` means the PR is
prepared for human review and merge — not merged.

---

## PROOF_PROTOCOL

Every completed phase needs proof, not assertion. After each phase, append to `PROGRESS.md`:

```
Phase N: <name> — COMPLETE
Artifact: <absolute-path>
Proof: <actual command output — paste it, don't describe it>
Commit: <SHA>
```

Proof means pasted output: `bun test: 24 pass, 0 fail` — not "tests pass". `wc -l docs/DEPENDENCIES.md:
84` — not "doc written". Never write "Phase N complete" without proof on the line below it.

---

## MORNING_REPORT

Leave in the working dir:

1. `HANDOFF.md` — what completed, workarounds, needs my decision, evidence
2. `HANDOFF.html` — single-page visual summary
3. `HANDOFF.excalidraw` — dependency-tier + clarity-gate-routing diagram
4. **Publish it** — `lavish-axi share HANDOFF.html --password <fresh-random-pw>`. Record ONLY the
   hosted URL in a `## 📋 Published Report` block at the TOP of `HANDOFF.md`. Write the password and
   update_key to `HANDOFF.secret.local` and add that filename to `.gitignore` immediately — the
   update_key is update/delete-capable and must NEVER be committed to any repo. If ht-ml.app is
   unreachable, fall back to `lavish-axi export HANDOFF.html --out HANDOFF.export.html` and note why
   in HANDOFF.md.

Context management: run `/compact` near 170k tokens; state your checkpoint after compacting; never
compact on turn 1.

---

## LOOP_TRACKER

> Completed 2026-07-16. PASS on cycle 1; shipped via no-mistakes to PR #18.

### Planner
- [x] HARNESS.md read
- [x] skill-routing.md read (`skills/write-goal-prompt/references/skill-routing.md`)
- [x] PLAN.md written: `.harness/goals/harness-batch-grill-deps/PLAN.md`
- [x] issues/NN-<slug>.md slices written: `issues/01-install-batch-grill-me.md` .. `issues/05-archive-and-junction.md`

### Cycle 1
- [x] Maker: Phase 1 install batch-grill-me — artifact: `C:\Users\mitch\.claude\skills\batch-grill-me\SKILL.md` — commit: `N/A (outside repo tree)`
- [x] Maker: Phase 2 clarity-gate Branch A rewrite — artifact: `skills/write-goal-prompt/references/clarity-gate.md` — commit: `9e668f4`
- [x] Maker: Phase 3 docs/DEPENDENCIES.md + pointers — artifact: `docs/DEPENDENCIES.md` — commit: `2b46e4d`
- [x] Maker: Phase 4 shipper audit — artifact: `PROGRESS.md` audit notes + cited fixes — commit: `6de6f67`
- [x] Maker: Phase 5 archive + junction — artifact: `C:\Users\mitch\Everything_CC\archive\2026-07-16-write-goal-prompt-stale-copy\` + junction — commit: `N/A (outside repo tree)`
- [x] Mechanical gate: passed (6/6)
- [x] Checker: CYCLE_LOG.md written: `.harness/goals/harness-batch-grill-deps/CYCLE_LOG.md`
- [x] Reward signal: **5.0**/5.0 (threshold: 4.0/5.0, no dimension <3)
- [x] Verdict: **PASS**

### Cycle 2 (if ITERATE)
- N/A — cycle 1 returned PASS at 5.0/5.0 with no dimension below 5. No lowest-scoring dimension to
  fix, so the loop exited after the first PASS as specified.

### Cycle 3 (if ITERATE again)
- N/A — see above.

### Final
- [x] No-mistakes: terminal outcome: `checks-passed`
- [x] Pull request: https://github.com/LeadGrowGTM/loop-engineer/pull/18 (OPEN, MERGEABLE — not merged; human merge pending)
- [x] HANDOFF.md written: `.harness/goals/harness-batch-grill-deps/HANDOFF.md`
- [x] HANDOFF.html written: `.harness/goals/harness-batch-grill-deps/HANDOFF.html`
- [x] HANDOFF.excalidraw written: `.harness/goals/harness-batch-grill-deps/HANDOFF.excalidraw`
- [x] HANDOFF.html published: https://19c7d866.ht-ml.app/ (password-protected; earlier 1aefde38 superseded — `lavish-axi share` has no update flag)
- [x] tasks-axi done harness-batch-grill-deps --pr https://github.com/LeadGrowGTM/loop-engineer/pull/18
