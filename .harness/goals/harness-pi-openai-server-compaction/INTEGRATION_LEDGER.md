# Integration ledger

Task: `02-integrate-issues-21-24.md`

## Issue 21
- Source SHA: `da7efde843f4def51aa0910da7df9f50d176a1ca`
- Integration SHA: `717c843d7871762e0389c82fc92347b95f34d76d`
- Parent integration SHA: `8b9501e394c4dc3e7649f11b25ebce5794ef7d5a`
- Source patch ID: `196d37fc3c22fdfe7bfda56ca33ac1432ec96d5b`
- Integration patch ID: `196d37fc3c22fdfe7bfda56ca33ac1432ec96d5b`
- Subject: `docs(readiness): distinguish readiness modes (#21)`
- Changed paths:
  - `CLAUDE.md`
  - `README.md`
  - `scripts/launch-gnhf.ps1`
  - `scripts/prepare-harness-run.ps1`
  - `scripts/prepare-harness-run.test.ts`
- Gate: completed as per phase 2 import sequence (clean cherry-pick).

## Issue 22
- Source SHA: `fcc07154125645eff594f7d37db632311f4d53b7`
- Integration SHA: `24088e4cd93c57d0f251b6bdbf6a1183e7ccbb87`
- Parent integration SHA: `717c843d7871762e0389c82fc92347b95f34d76d`
- Source patch ID: `941ef773b7112835dfe6058606c1a52dc51c604f`
- Integration patch ID: `941ef773b7112835dfe6058606c1a52dc51c604f`
- Subject: `fix(readiness): stabilize Windows tests under load (#22)`
- Changed paths:
  - `scripts/prepare-harness-run.ps1`
  - `scripts/prepare-harness-run.test.ts`
- Gate: completed as per phase 2 import sequence (clean cherry-pick).

## Issue 23
- Source SHA: `d0d8f764e8c495382b43b3b18cd32e3e85ba8ca3`
- Integration SHA: `7be8dcbac18b79742412223da75f6a540dfcdc03`
- Parent integration SHA: `24088e4cd93c57d0f251b6bdbf6a1183e7ccbb87`
- Source patch ID: `398417a136375cba297297149779205d78b00e5b`
- Integration patch ID: `398417a136375cba297297149779205d78b00e5b`
- Subject: `feat(planner): resolve skill routing deterministically (#23)`
- Changed paths:
  - `.claude/agents/harness-planner.md`
  - `scripts/harness-agent-contracts.test.ts`
  - `scripts/setup-harness.test.ts`
  - `scripts/setup-harness.ts`
  - `skills/write-goal-prompt/EXAMPLES.md`
  - `skills/write-goal-prompt/SKILL.md`
  - `skills/write-goal-prompt/references/subagent-harness.md`
  - `skills/write-goal-prompt/scripts/resolve-skill-routing.test.ts`
  - `skills/write-goal-prompt/scripts/resolve-skill-routing.ts`
- Gate: completed as per phase 2 import sequence (clean cherry-pick).

## Issue 24
- Source SHA: `89c899b5a82bdc6a0184d7ccb40e51f4cb49101a`
- Replacement SHA: `b5891b59302feaf695ad6a596cfa4ae077539777`
- Integration SHA: `b44824d8324aa8fe59079bac27018921be8b9031`
- Parent integration SHA: `7be8dcbac18b79742412223da75f6a540dfcdc03`
- Source patch ID: `1a314bf6987a0fd3a628e91b10355b618c5b9e86`
- Replacement patch ID: `9355caa9f28f08af2b1a381c800fae4348858625`
- Integration patch ID: `9355caa9f28f08af2b1a381c800fae4348858625`
- Subject: `feat(maker): guard protected work mechanically (#24)`
- Changed paths:
  - `.claude/agents/harness-maker.md`
  - `scripts/guard-protected-work.ts`
  - `scripts/guard-protected-work.test.ts`
  - `scripts/harness-agent-contracts.test.ts`
  - `scripts/setup-harness.test.ts`
  - `scripts/setup-harness.ts`
  - `skills/setup-harness/SKILL.md`
- Blocked: cherry-pick conflict on `local/integrate-issues-21-25`.
  - Conflicted files: `scripts/setup-harness.ts`, `scripts/setup-harness.test.ts`.
- Resolution: clean replacement patch `b5891b59302feaf695ad6a596cfa4ae077539777` applied then committed as `b44824d8324aa8fe59079bac27018921be8b9031` with matching stable patch IDs.
- Gate: completed as per phase 2 import sequence and replacement re-apply proof.