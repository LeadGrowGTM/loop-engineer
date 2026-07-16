# 01 - Taste seeding function, templates, and tests
Status: done
Blocked by: none

## Parent
Spec: docs/superpowers/specs/2026-07-17-taste-gate-design.md (R1, R2, R4)

## What to build
TDD, failing-test-first: an exported, home-dir-parameterized seeding function in
`scripts/setup-harness.ts` that `install` calls to seed `~/.claude/taste/` with exactly
4 template files (`ux-taste.md`, `ui-taste.md`, `copy-taste.md`, `opinions.md`) when the
directory or any file is missing, plus a companion seeding path that writes
`<target>/.harness/taste.md` (sections: `## Design & UX`, `## Code opinions`, `## Voice`)
when absent. Both paths must never overwrite an existing file (byte-preserved content on
re-run, idempotent). Each of the 4 personal templates carries a one-line header, the
format rule ("one rule per bullet, each rule checkable, each with a concrete example — no
essays"), and exactly 2 commented example rules. Write the tests before the
implementation — this slice is TDD, not test-after.

## Acceptance criteria
- A new bun test file (or a `describe` block appended to `scripts/setup-harness.test.ts`)
  has >= 3 new tests covering R1/R2: (a) seeds all 4 personal files when
  `~/.claude/taste/` is missing, (b) preserves a pre-existing modified personal file
  byte-for-byte on re-run (idempotency), (c) seeds `<target>/.harness/taste.md` when
  absent. `bun test` exits 0, all tests passing — verification check 1.
- The seeding function(s) are exported from `scripts/setup-harness.ts` and take the home
  dir as a parameter — no hardcoded `$HOME` inside the function body (R1's explicit
  constraint).
- Each of the 4 personal templates and the repo `taste.md` template match the content
  spec exactly: 1-line header, the exact format-rule sentence, exactly 2 commented
  example rules (personal templates); repo template has the 3 named `##` sections.
- `grep -cE 'TODO|TBD' scripts/setup-harness.ts` → 0 — verification check 6, this file's half.
- Sandbox proof captured in PROGRESS.md, run and pasted verbatim (verification check 7):
  `HOME=$(mktemp -d)`, `T=$(mktemp -d)`, `bun scripts/setup-harness.ts install $T` →
  `ls $HOME/.claude/taste | wc -l` = 4 AND `test -f $T/.harness/taste.md`; then write a
  sentinel line into `$HOME/.claude/taste/opinions.md`, re-run install, sentinel still
  present.

## Skill routing
tdd - scripts/setup-harness.ts (seeding functions) + scripts/setup-harness.test.ts (or a new taste-seed test file)
