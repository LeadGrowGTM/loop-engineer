# Doc Sweep Proof

## Issue #3 — Docs describe old 3-part system

Files changed:
- README.md
- docs/agents/domain.md

Key changes:
- README line 3: "mechanical enforcement" → "structural enforcement"
- README line 12: Added harness-prover description in file tree
- README line 30: Clarified Checker isolation is tool-enforced; step ordering is instruction-based
- README line 32: "The 3-agent loop" → "The 4-agent loop"
- README lines 35-39: Updated loop diagram to include prover at depth 3
- README line 43: Updated depth budget (prover=3, checker=4, sub-skills max=5)
- README lines 45-46: Added Prover role explanation (when to use for running-app goals)
- docs/agents/domain.md line 31: "3-agent loop" → "4-agent loop"
- docs/agents/domain.md line 32: Updated cycle definition to note prover skipped for static goals

## Issue #5 — "Mechanically guaranteed" oversell

Key language fixes:
- Removed overselling of mechanical guarantees
- Clarified that Checker tool isolation IS enforced by the tool layer (it cannot access Bash or Agent tools)
- Clarified that step ordering (invoke Planner → Maker → Prover → Checker) relies on the goal agent's instruction-following, not tool enforcement
- Used honest language: "This isolation is enforced by the tool layer, not by prompt instruction"

## Commit

Commit SHA: dee4b8e
Message: "docs: update to 4-agent architecture, honest guarantee language"

Commit closes both issues: #3 and #5

## Verification

Files verified exist:
- C:\Users\mitch\Everything_CC\agent-harness\README.md — updated, contains 4-agent loop diagram
- C:\Users\mitch\Everything_CC\agent-harness\docs\agents\domain.md — updated, contains 4-agent vocabulary
- C:\Users\mitch\Everything_CC\agent-harness\.claude\agents\harness-prover.md — existing, source of truth for Prover spec
- C:\Users\mitch\Everything_CC\agent-harness\.claude\agents\harness-checker.md — existing, source of truth for Checker spec
- C:\Users\mitch\Everything_CC\agent-harness\CLAUDE.md — verified, already correct (mentions all 4 agents)
