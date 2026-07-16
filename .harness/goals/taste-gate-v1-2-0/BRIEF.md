# Goal Brief — taste-gate-v1-2-0

## Problem
Unattended goal runs verify correctness but not "is this what WE would have built" — taste (UX, UI, copy, house opinions) silently drops out of every autonomous run because nothing compiles it into the checker rubric before the run starts.

## Success criteria (product-level)
- Running `bun scripts/setup-harness.ts install <target>` on a fresh machine seeds `~/.claude/taste/` with exactly the 4 template files (`ux-taste.md`, `ui-taste.md`, `copy-taste.md`, `opinions.md`) and `<target>/.harness/taste.md`, and never clobbers a file the user has already edited — even across repeated installs (proven by tests, not just by inspection).
- A goal author using `/write-goal-prompt` on a UI/UX/copy/email/content/client-facing task is, by default and without being asked, routed through a one-glance approve/edit/drop taste gate that compiles approved entries into the goal's "Done means" criteria and/or `[CONSTRAINTS]` block before the run starts, with a `Taste applied:` audit line recorded in `[TASK]`. Backend/infra/migration/data/tooling-mechanical goals are never gated; only genuinely ambiguous goals are asked, and only one question.
- `loop-engineer` ships as v1.2.0: `claude plugin validate .` passes, and every one of the spec's 8 mechanical verification checks passes when run exactly as written.

## Out of scope
- Live Nexus integration (the gate documents the hook as text only — nexus needs sorting first).
- kb/signals learning write-back (deferred to v1.3, after real override data exists from runs).
- `interests.md` (nothing consumes it yet).
- Any changes to superpowers, or to a character/personality file.
- Running `claude plugin update` as part of this build (release to the live install happens after human review of the morning report).
