# loop-engineer scoped-agent-name migration — prefix fix report

Date: 2026-07-16
Repo: /home/del13s_ubuntu/MACH4_2/loop-engineer
Branch: charles-fork (verified via `git branch --show-current` before starting; clean working tree)

## Task

Plugin agents only resolve by their scoped names (`loop-engineer:harness-planner` etc — bare
`harness-planner` does NOT resolve, per live probe). Every site that ADDRESSES an agent by bare
type name (spawns/invokes/dispatches it) must be prefixed with `loop-engineer:`. Sites that merely
DESCRIBE an agent (file paths, prose role descriptions, ledger/data schema `by:` labels, agent
frontmatter `name:` fields) are left untouched. Then bump plugin version 1.0.0 -> 1.0.1.

## Search command

```
grep -rn "harness-planner\|harness-maker\|harness-prover\|harness-checker\|harness-inbounds-checker\|harness-novelty-checker" \
  .claude/workflows/ skills/ .claude/commands/ --include=*.js --include=*.md
```

37 total hits reviewed (both the non-md-only pass and the full pass including markdown). Also
separately confirmed via `grep -rn "subagent_type\|agentType"` across the same dirs, and checked
`.claude/workflows/red-team.js` (no harness-* references — it only ever addresses the built-in
`Explore` agent type, untouched) and `.claude/workflows/benchmark-sweep.js` (no `agentType`
literal calls at all — its two hits are ledger data labels, see below).

## Classification — every hit, file:line, verdict

### ADDRESSING — prefixed (5 sites)

1. `.claude/workflows/benchmark-climb.js:310` — `agentType: 'harness-inbounds-checker'` inside the
   in-bounds-check `agent()` call in `run()`. Literal dispatch value. -> `'loop-engineer:harness-inbounds-checker'`
2. `.claude/workflows/benchmark-climb.js:323` — `agentType: 'harness-novelty-checker'` inside the
   novelty-check `agent()` call in `run()`. Literal dispatch value. -> `'loop-engineer:harness-novelty-checker'`
3. `skills/write-goal-prompt/references/subagent-harness.md:29` — `` Agent({subagent_type: "harness-planner", prompt: "..."}) `` —
   literal spawn-code template shown to whoever invokes the harness. -> `"loop-engineer:harness-planner"`
4. `skills/write-goal-prompt/SKILL.md:319` — "3. Prover (running-app goals only): spawn
   harness-prover with PROVER_BRIEF from HARNESS.md." — goal-prompt template instruction to spawn
   by bare type name. -> "spawn loop-engineer:harness-prover with PROVER_BRIEF..."
5. `skills/write-goal-prompt/SKILL.md:326` — "4. Checker: spawn fresh harness-checker subagent with
   CHECKER_BRIEF from HARNESS.md." — goal-prompt template instruction to spawn by bare type name.
   -> "spawn fresh loop-engineer:harness-checker subagent..."

### DESCRIBING — left unchanged (32 sites)

File-path references (`.claude/agents/harness-*.md`, glob patterns, or the `${CLAUDE_PLUGIN_ROOT}/...`
form) — left bare, these are filesystem paths, not spawn addresses:
- `skills/write-goal-prompt/SKILL.md:180-183` (glob `.claude/agents/harness-*.md` + the four/six
  `.md` filenames it expects to find)
- `skills/write-goal-prompt/references/benchmark-intake.md:187-188` (`.claude/agents/harness-inbounds-checker.md`, `.claude/agents/harness-novelty-checker.md`)
- `skills/write-goal-prompt/references/subagent-harness.md:21-24` (Agent Files table, `.claude/agents/harness-*.md` column)
- `skills/write-goal-prompt/references/subagent-harness.md:197` ("must match harness-checker.md format exactly" — file-format reference)
- `skills/write-goal-prompt/docs/ARCHITECTURE.md:11-14` (Agents table, `.claude/agents/harness-*.md` column)
- `.claude/commands/benchmarking-loop.md:109-110` (`.claude/agents/harness-inbounds-checker.md`, `.claude/agents/harness-novelty-checker.md`)

Prose describing roles (no spawn/invoke verb + bare type name pairing):
- `.claude/workflows/benchmark-climb.js:19` — top-of-file comment explaining where verdicts come from
- `skills/write-goal-prompt/kb/LOG.md:9` — historical changelog entry
- `skills/write-goal-prompt/references/benchmark-intake.md:111,115` — "a fresh-context checker (`harness-inbounds-checker`) diffs..." / "diffed against the variant ledger (`harness-novelty-checker`)" — descriptive naming of which checker performs a step, not a spawn instruction
- `.claude/commands/benchmarking-loop.md:73-74` — same descriptive-naming pattern in the dispatch-by-mode writeup
- `skills/write-goal-prompt/references/subagent-harness.md:88-90` — Depth Budget table, role column
- `skills/write-goal-prompt/docs/ARCHITECTURE.md:50-52` — Depth Budget table, role column

Ledger/data schema values (record labels, not dispatch calls) — explicitly called out in the task
as stay-as-is, confirmed by reading the surrounding `climbLedgerEntry()` / `ledgerEntry()` functions:
- `.claude/workflows/benchmark-climb.js:168,173` — `checks.in_bounds.by` / `checks.novelty.by` fields
  written into the variant ledger record
- `.claude/workflows/benchmark-sweep.js:75-76` — same `checks.in_bounds.by` / `checks.novelty.by`
  fields in the sweep engine's ledger entry (sweep sets these to `'n/a'` verdicts since it never
  actually runs either check, but keeps the `by:` label for ledger-schema consistency with climb)

## Files changed

- `.claude/workflows/benchmark-climb.js` — 2 `agentType` values prefixed
- `skills/write-goal-prompt/references/subagent-harness.md` — 1 `subagent_type` template value prefixed
- `skills/write-goal-prompt/SKILL.md` — 2 "spawn <name>" instructions prefixed
- `.claude-plugin/plugin.json` — `version` 1.0.0 -> 1.0.1
- `.claude-plugin/marketplace.json` — `metadata.version` and `plugins[0].version` 1.0.0 -> 1.0.1

## Verification output

`bun test scripts/`:
```
25 pass
0 fail
40 expect() calls
Ran 25 tests across 2 files. [177.00ms]
```

`bun .claude/workflows/benchmark-climb.js --selftest`:
```
PASS  target trips when best crosses the bar
PASS  target does NOT trip below the bar
PASS  budget trips at the cycle cap
PASS  budget trips at the spend cap
PASS  plateau trips after N no-improve cycles
PASS  no halt while still improving under budget
PASS  first-of prefers target over a co-tripping budget
PASS  minimize: lower reward is an improvement
PASS  sub-min_gain change is NOT an improvement
PASS  Pareto: dominated (worse reward, higher cost) not kept
PASS  Pareto: new best reward always kept
PASS  explore when no best yet
PASS  exploit on a non-explore cycle
PASS  explore every 3rd cycle
PASS  best-so-far picks the top kept+settled variant

climb stop-logic demo: 15 passed, 0 failed
```

`bun -e "await import('./.claude/workflows/benchmark-climb.js'); await import('./.claude/workflows/benchmark-sweep.js'); await import('./.claude/workflows/red-team.js'); console.log('imports clean')"`:
```
imports clean
```

## Commit

Commit message:
```
fix(agents): address plugin agents by their loop-engineer scoped names; v1.0.1
```

SHA: filled in after commit (see final report line).
