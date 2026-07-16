# HANDOFF — harness-batch-grill-deps

## 📋 Published Report

**https://c3bd0db3.ht-ml.app/** — public, one click, no password.

Verified `HTTP 200` with no credentials; `public: true`, `password_protected: false`; no update_key
in the served HTML. Linked from PR #18 so reviewers open it from the PR itself. The `update_key` is
still a secret and lives in `HANDOFF.secret.local` (gitignored) — a public page does not mean a
public key.

> **Operational wart worth knowing:** `lavish-axi share` has **no update flag** — every run mints a
> brand-new site with a new URL and key. Updating a page in place needs a direct ht-ml.app `/v1` API
> call with its update_key. So a report should be published **once, last**, after the HTML is final;
> publishing early then editing strands the old link. This run produced four sites doing exactly
> that. The superseded ones (`15785292` public, `19c7d866` + `1aefde38` password-gated drafts) were
> left in place rather than deleted (archive-safety); all keys are in `HANDOFF.secret.local` if you
> want them gone. **This is the strongest candidate for the next fix to
> `references/morning-report-specs.md`.**

---

**Status: COMPLETE and SHIPPED.** Checker PASS 5.0/5.0 on cycle 1; no-mistakes returned
**`checks-passed`**; **PR #18 open and awaiting your review and merge**:
https://github.com/LeadGrowGTM/loop-engineer/pull/18

All five SPEC items landed. All six mechanical-gate checks pass. No item is DRAFT, placeholder, or
reduced scope. `checks-passed` means the PR is prepared with green CI — **not merged**. I did not
merge it.

Branch `feat/batch-grill-deps`, 7 commits off `master` (4 mine, 2 from the pipeline, 1 follow-up
fix).

---

## Eval Loop Design

| Element | Definition |
|---|---|
| **Reward signal** | Checker mean across the 5 CHECKER_BRIEF dimensions, each 1-5 |
| **Mechanical gate** | Six binary Done-means checks (seconds, no LLM) |
| **Qualitative gate** | CHECKER_BRIEF rubric, `file:line` evidence required per score |
| **Max cycles** | 3 |
| **Done condition** | Mechanical gate passes AND mean ≥4.0/5.0 AND no dimension <3 |
| **Plateau rule** | 3 identical reward signals → exit, commit best, note here |

Loop: generate → mechanical gate (fix until green) → fresh Checker on artifact paths only → done? ship : fix ONLY the lowest dimension and repeat.

## Cycle Log

| Cycle | Mechanical gate | Reward | Verdict | What changed |
|---|---|---|---|---|
| 1 | PASS (6/6) | **5.0/5.0** | **PASS** | Initial build of all five items |

Cycle 1 scored 5/5 on every dimension, so there was no lowest-scoring dimension to fix and no
cycle 2. Loop exited after the first PASS, as specified.

Per-dimension (Checker's own citations, full evidence in `CYCLE_LOG.md`):

| # | Dimension | Score | Anchor evidence |
|---|---|---|---|
| 1 | Clarity-gate coherence | 5/5 | `clarity-gate.md:9-18` two paths + test; `SKILL.md:98-103` table matches; zero batch-question refs across 8 skill files |
| 2 | Frontier mechanic fidelity | 5/5 | `clarity-gate.md:28-36` — every upstream element present |
| 3 | Dependency doc accuracy | 5/5 | `DEPENDENCIES.md:17-31`; cross-checked vs `setup-harness.ts:150-206` + `red-team.js:7-10` |
| 4 | Upstream fidelity | 5/5 | installed body line-for-line identical to cached upstream; sole deviation documented |
| 5 | Single source of truth | 5/5 | junction + repo return identical 20-file sets; archive holds genuinely stale 21-file snapshot |

## What completed

**1. batch-grill-me installed** → `C:\Users\mitch\.claude\skills\batch-grill-me\SKILL.md`
Body byte-identical to upstream — assembled programmatically from the cached fetch rather than
retyped, so fidelity is mechanical, not a matter of care. Sole deviation is frontmatter, recorded
in-file with the source URL. Runtime registered the skill on write, proving the frontmatter parses.

**2. clarity-gate Branch A rewritten** → `skills\write-goal-prompt\references\clarity-gate.md`
(+ Phase 0.5 table in `SKILL.md`). Exactly two paths, selected on one axis: are the open decisions
*chained* (→ `/grilling`) or *wide but independent* (→ `batch-grill-me`), with a tie-breaker. The
batch-question agent is deleted, not deprecated — zero surviving references anywhere in the skill.

**3. `docs/DEPENDENCIES.md`** — 13 rows: 4 Required, 7 Optional, 2 Bundled. Every verify command in
the table was executed on this machine first; the quoted versions are real output, not invented
flags. Pointers added to README `## Installation` and the CLAUDE.md repo map.

**4. Shipper integration audited** — kept as-is and committed; only cited `file:line` gaps touched.
See "Audit findings" below.

**5. Stale copy archived + junctioned** — 21 files **moved** (never deleted) to
`C:\Users\mitch\Everything_CC\archive\2026-07-16-write-goal-prompt-stale-copy\`, then junctioned.
Whole tree verified byte-identical. Ran strictly last, after items 1-4 were committed, so nothing
was ever edited through a link whose target was still moving.

## Items marked DRAFT

**None.** No blocker was hit, so no fallback tier was used. The upstream URL was reachable
(HTTP 200, 1642 bytes), so item 1's Tier-1 stop condition never triggered. Nothing is
`quality: draft` or `quality: placeholder`.

## Needs My Decision

**1. A third copy of write-goal-prompt still drifts — the junction does not close it.**
`C:\Users\mitch\Everything_CC\.claude\skills\write-goal-prompt` is a real directory (not a link)
and already differs from the repo. SPEC item 5 scoped the junction to `~/.claude`, so this was
documented, not touched. The same is true of `C:\Users\mitch\Everything_CC\.claude\agents\` —
`harness-checker.md` differs from the repo copy and `harness-shipper.md` is absent entirely, so
workspace-level agent discovery may resolve a stale checker and no shipper at all.
**Decision needed:** junction the workspace copies too, or accept them as an independent install?

**2. The install gate and SPEC item 1 pull against each other.**
SPEC says record the deviation in a comment; the Done-means gate says
`grep -c disable-model-invocation` must return `0` over that same file. Naming the flag literally
trips the gate (it returned `1`). Resolved by describing the lock precisely and pointing to the
upstream URL where its literal name is visible — rather than hyphen-breaking the token to sneak a
`grep`. The gate's intent (flag not active in frontmatter) is met honestly and traceability is
preserved, but the resolution is a judgment call worth your eye. If you want the literal name in
the file, the gate needs to scope to the frontmatter block instead of the whole file.

**3. ~~The no-password preference~~ — RESOLVED 2026-07-16, landed properly.**
The operator confirmed the preference is real and asked for it. It is now landed across **five**
files (not the four the finding named — `docs/DEPENDENCIES.md` was a fifth site nobody had listed),
reports publish PUBLIC, and this report is re-shared public at https://15785292.ht-ml.app/.

The route matters: the review gate caught it as scope creep, I reverted it rather than ratify an
operator decision on the operator's behalf, and then the operator made the call and it landed as its
own reviewed change with a regression guard. That is the process working, not friction.

`scripts/publish-policy.test.ts` now makes this class of drift a test failure rather than a
reviewer's lucky catch. See **Regression guard** below.

**4. `docs/setup-system-diagnosis.md` now describes fixed defects as present.**
`:22-27` claims the smoke test hardcodes three agents at lines 113/117/121; `setup-harness.ts:156`
now iterates `AGENT_FILES`, so the defect is fixed and the doc reads as a live bug report. It is a
dated diagnosis snapshot outside item 4's three named targets, so it was flagged rather than
rewritten. **Decision needed:** add a resolved banner, or leave it as a historical record?

## Regression guard — `scripts/publish-policy.test.ts`

**A benchmark is the wrong instrument here, so I did not build one.** The benchmarking loop
(ADR-0001/0003) optimizes a *measurable dimension* against an exogenous metric — reply rates, token
cost, latency. It is for problems where you do not know the best answer and must climb toward it.
The publish policy is not that. It has one correct answer, it is already known, and the only
question is whether every file still agrees with it. Climbing a hill with a summit already marked is
ceremony, not evidence. What this needed is a **deterministic consistency test**: milliseconds, no
LLM, no judgment, fails loudly on the exact bug.

**The bug class, precisely.** Policy lives in prose, restated across many files. One file changes.
The others do not. Nothing catches it, because nothing knows the files are supposed to agree. That
is what happened at the review gate today — and then happened *again* in a fifth file
(`docs/DEPENDENCIES.md`) that the finding never listed.

**So the guard scans; it does not hardcode a file list.** It walks every `.md` under `skills/` and
`docs/` plus `README.md`/`CLAUDE.md`, keeps the ones mentioning `lavish-axi share`, and asserts
against *those*. A sixth file drifting is covered the day it is written. A guard that only knows
today's files would reproduce today's bug.

| Test | Asserts | Catches |
|---|---|---|
| guard is not vacuous | at least one file documents the publish command | the scan silently matching nothing and passing trivially |
| no invocation passes `--password` | no `lavish-axi share <file> --password` anywhere | the exact drift the review gate caught by hand |
| no password mandate | no "`--password` is MANDATORY" prose | a file re-asserting the old policy in words |
| update_key still routed to the secret file | any file naming `update_key` also names `HANDOFF.secret.local` | **the real risk**: dropping the password quietly dropping key secrecy too |
| `.gitignore` covers `**/HANDOFF.secret.local` | not root-anchored | goal dirs live at `.harness/goals/<slug>/`, so `/HANDOFF.secret.local` would silently not match |
| no update_key value committed | no long opaque token in tracked markdown | a pasted key reaching git |

**It was mutation-tested, not just run green.** A test that passes on first write proves nothing. I
re-introduced the exact bug (`sed` the password flag back into `morning-report-specs.md`), confirmed
the guard **failed**, then restored and confirmed it passed:

```
=== MUTATION TEST: reintroduce the exact bug, guard MUST fail ===
43:lavish-axi share HANDOFF.html --password <pw>
(fail) publish policy: reports are public, never password-gated > no `lavish-axi share` invocation passes --password
--- restoring ---
 6 pass, 0 fail
```

**It immediately earned its keep.** On first run against the supposedly-finished state it failed on
a real defect I had just written: `docs/DEPENDENCIES.md` named `update_key` but never said where it
goes. The guard caught my own gap before you did.

```
=== FULL SUITE ===
 27 pass
 0 fail
Ran 27 tests across 3 files. [101.00ms]
```

21 → 27 tests. No regression in the existing 21.

### What this guard does NOT cover — stated honestly

- **Whether the prose is any good.** It checks agreement and secret-routing, not clarity. A file
  could agree with the policy and still explain it badly.
- **Runtime publish behavior.** It reads markdown; it does not invoke `lavish-axi`. Verified
  out-of-band instead: `HTTP 200` with no credentials, `public: true`,
  `password_protected: false`, and `grep` confirming no update_key leaked into the served HTML.
- **Other policies stated across files.** Only the publish policy is guarded. The same
  multi-file-prose-drift risk applies to agent counts (which bit this repo twice today — I fixed
  five files by hand and the pipeline's document gate found four more). **That is the obvious next
  guard, and this test is the template for it.**

## Audit findings (item 4)

Kept and committed as-is; the five-stage change had updated the code and primary docs but left
secondary docs asserting the old shape. Each fix is a cited gap, not a rewrite:

| File:line | Was | Now |
|---|---|---|
| `subagent-harness.md:17` | "The 4 harness agents", no shipper row | 5, shipper row added |
| `subagent-harness.md:96,98` | "The 3-Phase Runtime Harness" / "three logical phases" | 4 — the file already documented "Phase 4: Ship" at `:218`, contradicting its own heading |
| `ARCHITECTURE.md:3` | "Three agents" | Five; Prover + Shipper rows added |
| `ARCHITECTURE.md:48` | depth-0 listed Planner + Maker + Checker | all five |
| `index.md:9` | "3-agent loop design" | 5-agent |
| `index.md` + `SKILL.md:570` | advertised "grill agent prompt" | dangling refs to the deleted agent — removed |
| `index.md` | listed 11 of 12 reference files | `benchmark-intake.md` added |
| `CLAUDE.md:9,12,26` | 4 agents / "11 reference files" / "Four-agent loop" | 5 / 12 / five, with the Shipper's contract |
| `README.md:10-13,41-44` | 4 of 5 agents in both trees | shipper added (Checker caught this one) |

Verified **not** gaps, deliberately untouched:
- `EXAMPLES.md:65` "Four-stage execution" is **correct** — it lists Planner/Maker/Checker/Ship and
  already includes the shipper; that worked example drives no running app, so Prover is legitimately
  N/A. The Planner flagged it for confirmation rather than assuming; confirmed and left alone.
- Shipper test coverage is implicit but real: the smoke test derives fixtures from `AGENT_FILES`
  (`setup-harness.test.ts:144,157`) and `setup-harness.ts:156` iterates it, so `harness-shipper.md`
  is covered without a hardcoded assertion. No test gap.

## Workarounds

None affecting output. Two mechanical notes:
- `cmd /c move` failed on path escaping under Git Bash; used PowerShell `Move-Item`. Source was
  intact throughout (21 files verified before and after) — nothing was lost.
- One judgment call beyond the literal spec: `clarity-gate.md:47` routed to wayfinder because
  "a single `AskUserQuestion` round can't resolve them" — a limitation of the *deleted* agent. The
  agent's name was already absent, so no grep would have caught it, but the rule rested on dead
  logic. Only the justification was replaced; the ~5 threshold and routing outcome are unchanged.

## Constraint Block

None. No constraint was violated or blocked. Nothing was deleted (item 5 moved 21 files); nothing
was edited through the `~/.claude` path; gnhf's Opus override and `launch-gnhf.ps1` untouched.

## Evidence

```
############ MECHANICAL GATE — ALL SIX PASS ############
1. bun test exits 0                               exit code: 0   (21 pass, 0 fail)
2a. batch-grill-me SKILL.md exists                EXISTS
2b. grep -c disable-model-invocation (must be 0)  0
3. junction resolves + byte-identical             byte-identical: YES
4. DEPENDENCIES.md tiered row per SPEC dep        all SPEC item-3 deps have a tiered row
5a. clarity-gate POSITIVE for batch-grill-me      4
5b. clarity-gate NEGATIVE for deleted agent       0
6. archive exists (moved, not deleted)            ARCHIVED: 21 files
```

```
=== junction integrity ===
Junction created: C:\Users\mitch\.claude\skills\write-goal-prompt <<===>> C:\Users\mitch\Everything_CC\tools\agent\agent-harness\skills\write-goal-prompt
is reparse point: True
junction SKILL.md sha256: 072CF7D3D8511A034EB55800937CAE568A15E5B4C4FB77885504D538B5E49D6E
repo     SKILL.md sha256: 072CF7D3D8511A034EB55800937CAE568A15E5B4C4FB77885504D538B5E49D6E
FC: no differences encountered
FULL TREE: IDENTICAL through junction

=== archive (moved, never deleted) ===
source is reparse/link: False   <- was a real dir, safe to move
files in source: 21  ->  files in archive: 21
source path now clear: True
```

Commits on `feat/batch-grill-deps`:

| SHA | What |
|---|---|
| `9e668f4` | Branch A → `/grilling` + batch-grill-me; batch-question agent deleted |
| `2b46e4d` | `docs/DEPENDENCIES.md` + README/CLAUDE.md pointers + stale counts |
| `6de6f67` | Shipper stage landed + cited doc gaps closed — **also swept in the out-of-scope password flip; reverted at `40b3497`** |
| `4c8dc68` | README agent trees + `HANDOFF.secret.local` gitignore |
| `40b3497` | pipeline: revert the out-of-scope password flip (my decision at the review gate) |
| `85aaa07` | pipeline: sync 4 more files with stale agent counts |
| `4037bab` | restore backticks around `` `--password <pw>` `` (fixes a regression in `40b3497`) |

## Ship

| | |
|---|---|
| **no-mistakes outcome** | **`checks-passed`** (terminal) |
| **Pull request** | https://github.com/LeadGrowGTM/loop-engineer/pull/18 — OPEN, MERGEABLE |
| **Run id** | `01KXP1C6ATYT2AZ0Y2TZRTHACP` — one run, driven by a fresh `harness-shipper`, never inline |
| **Pipeline fixes forced** | 1 (see below) |
| **Merged?** | **No.** `checks-passed` = prepared for human review. Yours to merge. |

All nine gates: intent, rebase, review, test, document, lint, push, pr, ci — all completed.
`bun test` inside the pipeline: 21 pass, 0 fail.

### The one fix the pipeline forced — and it caught a real mistake of mine

The review gate raised an `ask-user` finding, `password-mandate-contradiction`. It was right, and
the fault was mine.

`skills/write-goal-prompt/references/morning-report-specs.md` was already modified-but-uncommitted
in the working tree when this task began (someone else's in-progress work; last committed at
`43e55bf`). It flips `lavish-axi share` from a mandatory `--password` to an explicit "Do NOT
password-protect", citing an operator preference dated 2026-07-15. **I `git add`-ed it into
`6de6f67` without reading its diff.** SPEC item 4 named the shipper files to keep exactly —
`harness-shipper.md`, SHIP_BRIEF + stage 5 in `SKILL.md`, Phase 4 in `subagent-harness.md`,
`AGENT_FILES` + tests — and that file is **not** on the list. It was scope creep I introduced by
being careless with `git add`.

The shipper refused to approve, fix, or skip it and escalated, which is exactly right. My decision:
**revert it out of this PR** (`40b3497`), because —

1. It is out of scope and I introduced it by accident.
2. It is a security-relevant behavior change (public vs password-gated reports describing client and
   business work) citing an operator preference I cannot corroborate. Propagating it would mean me
   ratifying your decision on your behalf.
3. **This goal's own HARNESS.md is newer (2026-07-16) and mandates `--password <fresh-random-pw>`** —
   which is what I actually did when publishing. Reverting made all four files consistent again
   *and* matched the authoritative brief.

Notably, the shipper did not take my word for it: it independently re-derived SPEC item 4's
allowlist from the stash and confirmed master's wording before sending the response.

**Nothing was lost.** The reverted diff survives in `6de6f67` in this branch's history and is
reproduced verbatim below so you can land it deliberately if you still want it.

### The unlanded preference, preserved verbatim

If the 2026-07-15 no-password preference is real, it needs its own change touching **all four**
files — `morning-report-specs.md`, `SKILL.md:401-402`, `EXAMPLES.md:125-126`, `qa-checklist.md:194`
— not one. The diff that was reverted:

```diff
-lavish-axi share HANDOFF.html --password <pw>
+lavish-axi share HANDOFF.html

-- **`--password <pw>` is MANDATORY.** ht-ml.app pages are PUBLIC by default and may be
-  indexed/scraped. Morning reports describe client and business work — never publish
-  one without a password. Generate a fresh random password per report (do not reuse a
-  hardcoded one, do not commit it to a public repo).
+- **Do NOT password-protect the report (operator preference, 2026-07-15).** Publish it
+  PUBLIC (no `--password`) so the link opens with one click from anywhere, including a
+  phone, with nothing to type. The URL is an unguessable slug; keep genuinely sensitive
+  values (credentials, keys) out of the report body rather than gating the whole page.
+  (Password-protecting handoffs was previously mandatory here; that requirement is
+  removed - flagged by the operator as friction.)
```

**This directly affects this report:** I published it *with* a password, per HARNESS.md. If you want
the no-password behavior, that is the change to land — and this report's URL should then be
re-shared public.

### Pipeline-authored commits on the branch

| SHA | What | Whose |
|---|---|---|
| `40b3497` | Restore mandatory `--password` in morning-report-specs.md | pipeline, on my decision |
| `85aaa07` | Sync stale agent-count refs (4→5-agent loop incl. shipper) across `CONTEXT.md`, `README.md`, `docs/agents/domain.md`, `skills/setup-harness/SKILL.md` | pipeline's document gate |
| `4037bab` | Restore backticks around `` `--password <pw>` `` | mine, follow-up |

`85aaa07` is worth noting: the pipeline's document gate independently found **four more** files with
the same stale agent-count defect I had been fixing by hand — including `CONTEXT.md:118`, which I
had spotted early but left alone. The five-stage change had drifted wider than either the SPEC's
three named targets or my own audit caught.

`4037bab` fixes a regression the review gate's own fix introduced: reconstructing the mandatory-password
line by hand dropped the code-span backticks, and unbackticked `<pw>` parses as an HTML tag in
rendered Markdown and vanishes — leaving "--password  is MANDATORY." with no argument. The em dash →
plain dash from that same fix was kept deliberately (master's em dash violated the workspace rule),
so the file now differs from master by exactly that one intentional character.
