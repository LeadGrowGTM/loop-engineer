# 03 - Version bump, plugin validation, and full verification sweep
Status: done
Blocked by: 01, 02

## Parent
Spec: docs/superpowers/specs/2026-07-17-taste-gate-design.md (R5 + Verification plan (mechanical))

## What to build
Bump the version to `1.2.0` in `.claude-plugin/plugin.json` and in both version fields
of `.claude-plugin/marketplace.json` (`metadata.version` and `plugins[0].version`).
Confirm `claude plugin validate .` prints "Validation passed". Run the full 8-check
verification plan from the spec exactly as written, end to end, and paste every command's
actual output into PROGRESS.md — fix anything that fails before marking this slice done.
Verify commit hygiene across every commit made in this goal (conventional prefix, no em
dashes, no attribution lines, all on `charles-fork`).

## Acceptance criteria
- `grep -c '"version": "1.2.0"' .claude-plugin/plugin.json` → 1 — verification check 8.
- `.claude-plugin/marketplace.json` has `1.2.0` in both `metadata.version` and
  `plugins[0].version`.
- `claude plugin validate .` → prints "Validation passed" — verification check 2.
- All 8 verification-plan checks from the spec run in sequence with pasted output in
  PROGRESS.md:
  1. `bun test` → exit 0, all pass, including >= 3 new taste-seeding tests.
  2. `claude plugin validate .` → prints "Validation passed".
  3. `wc -l < skills/write-goal-prompt/references/taste-gate.md` → >= 60.
  4. `grep -c 'taste-gate.md' skills/write-goal-prompt/SKILL.md` → >= 2.
  5. `grep -c 'taste-gate.md' skills/write-goal-prompt/docs/index.md` → 1.
  6. `grep -cE 'TODO|TBD' scripts/setup-harness.ts skills/write-goal-prompt/references/taste-gate.md` → 0 per file.
  7. Sandbox proof: `HOME=$(mktemp -d)`, `T=$(mktemp -d)`, `bun scripts/setup-harness.ts install $T`
     → `ls $HOME/.claude/taste | wc -l` = 4 AND `test -f $T/.harness/taste.md`; sentinel
     line in `$HOME/.claude/taste/opinions.md` survives a re-run.
  8. `grep -c '"version": "1.2.0"' .claude-plugin/plugin.json` → 1.
- `git log` on `charles-fork` for this goal's commits shows conventional-prefix messages,
  no em dashes, no `Co-Authored-By` or attribution lines.

## Skill routing
direct - .claude-plugin/plugin.json + .claude-plugin/marketplace.json + PROGRESS.md (verification sweep output)
