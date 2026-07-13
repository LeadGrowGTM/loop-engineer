# 06 - independent checker roles (in-bounds + novelty)
Status: done
Blocked by: none

## Parent
PRD.md "In scope" 5; ADR-0003 (two pre-measurement checks), ADR-0006 (scorer discipline).

## What to build
Two fresh-context agent defs that reuse the harness-checker discipline:
- `.claude/agents/harness-inbounds-checker.md` - diffs a proposed variant against the
  invariant list; violation kills the variant (not counted as a cycle). No view of the
  inventor's reasoning. Required-tier for load-bearing invariants (offer/price/claims).
- `.claude/agents/harness-novelty-checker.md` - diffs a proposed variant against the
  variant ledger; near-duplicates of already-measured variants are rejected.

## Acceptance criteria
- Both files exist and parse (YAML frontmatter: name, description, tools, model).
- Each states it did NOT invent the variant and has no view of inventor reasoning.
- In-bounds checker returns a binary IN-BOUNDS | VIOLATION verdict with cited invariant.
- Novelty checker returns a binary NOVEL | DUPLICATE verdict with the closest ledger
  match cited.
- Tools are read-only-plus-verdict (no invention capability); separate agents, not one.

## Skill routing
direct - `.claude/agents/harness-inbounds-checker.md`,
`.claude/agents/harness-novelty-checker.md`
