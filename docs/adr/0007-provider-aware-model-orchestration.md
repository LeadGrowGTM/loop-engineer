# ADR 0007: Provider-Aware Model Orchestration

**Date:** 2026-07-27  
**Status:** Accepted  
**Affects:** Harness role spawning, provider detection, concurrent dispatch capabilities

## Problem

Harness goals run with static model assignments (frontmatter `model:` in agent files), making
them inflexible across provider environments: Claude Code native (default), GPT via claudex proxy,
or GPT via codex CLI. When multiple roles must spawn concurrently (e.g., red-team's four attack
angles), shared mutable provider state creates races. A pure resolver with injected detection
eliminates both issues.

## Solution

A provider-aware model resolver (`scripts/resolve-role-model.ts`) that:
1. Accepts provider detection as an injected parameter (no I/O inside the function)
2. Returns `{model, provider, tier}` — a spawn descriptor consumable by concurrent fans-out
3. Degrades to native Claude defaults as a last-resort fallback (never crashes)

Detection is separate and isolated (`scripts/detect-provider.ts`), probing for active provider
signals (claudex session flag, codex CLI availability) and injecting the result into the resolver.

## Role Dependency Chain (Sequential by Default)

The five harness roles form a strict sequence by output/input dependency:

```
Planner → Maker → Prover (optional) → Checker → Shipper
  ↓        ↓         ↓                 ↓         ↓
 PLAN   artifacts  PROOF verdict     PASS+    terminal
       (input to  + Prover output   approval  outcome
        Prover)   + redteam holes
                  (input to Checker)
```

**Dependencies:**
- **Planner → Maker:** Maker reads `PLAN.md` to know what phases to execute.
- **Maker → Prover:** Prover reads the task artifacts Maker produced (running-app goals only).
- **Prover → Checker:** Checker reads the PROOF verdict from Prover (running-app goals only).
- **Checker → Shipper:** Shipper requires Checker PASS verdict + separate explicit shipping approval.
- **Red-team (within verify):** Runs after Maker produces artifacts, feeds holes back to Maker before Checker scores.

**Concurrent-safe boundaries:**
- Within red-team: four attack roles (hostile, careless, perf, security) run in parallel because they consume the same target context and write to a shared `findings` structure. The Workflow executor's `parallel()` (`.claude/workflows/red-team.js`) manages the fan-out.
- Within Checker (if designed): multiple independent verification checks could run in parallel, each resolving its model via the provider-aware resolver without shared mutable state.

**Roles that may NOT run concurrently:**
- Planner with any other role (Planner must complete PLAN.md first)
- Maker with Prover/Checker (Maker must finish producing artifacts first)
- Prover with Checker (Checker must wait for PROOF verdict)

## Resolver Spawn Descriptor

The resolver's return type is the exact shape a concurrent fan-out consumes:

```typescript
interface ResolvedModel {
  model: string;           // e.g., "claude-sonnet-5", "gpt-5.6-sol"
  provider: Provider;      // "native" | "claudex" | "codex"
  tier: Tier;              // "standard" | "fast" | "flagship"
}
```

No adapter, no extra glue. Multiple roles resolve models in parallel:

```typescript
const roles = ["planner", "maker", "prover"];
const spawns = await Promise.all(
  roles.map(role => {
    const resolved = resolveRoleModel(role, detectedProvider);
    // Resolved model passed directly to Agent invocation:
    return Agent({subagent_type: `harness-${role}`, prompt: "...", model: resolved.model});
  })
);
```

Each spawn resolves independently; the pure resolver + injected detection means zero races on shared state.

## Existing Precedent: Red-Team Workflow

The red-team workflow (`.claude/workflows/red-team.js`) already executes four roles in parallel:

```javascript
const perRole = await parallel(
  ROLES.map((r) => () =>
    agent(attackBrief(r.role, r.lens, ctx), {
      label: `attack:${r.role.replace(/\s+/g, '-')}`,
      phase: 'Attack',
      schema: FINDINGS_SCHEMA,
      agentType: 'Explore',
    })
  ),
);
```

Each role gets its own attack brief and resolves independently. For provider-aware spawning, this
pattern extends to passing a resolved model to each invocation:

```javascript
const spawns = ROLES.map((r) => {
  const resolved = resolveRoleModel("attack-" + r.role, detectedProvider);
  return agent(attackBrief(r.role, r.lens, ctx), {
    label: `attack:${r.role.replace(/\s+/g, '-')}`,
    model: resolved.model,  // Provider-aware model override
    ...
  });
});
const perRole = await parallel(spawns.map(s => () => s));
```

The resolver's `{model, provider, tier}` descriptor is directly consumed by this pattern.

## Policy Table (Role × Provider → Model)

Resolved by `scripts/resolve-role-model.ts`:

| Role     | native (Claude)      | claudex (GPT-proxy)      | codex (GPT-native)       |
|----------|----------------------|--------------------------|--------------------------|
| planner  | claude-sonnet-5      | claude-sonnet-5          | gpt-5.6-terra            |
| maker    | claude-haiku-4-5     | claude-haiku-4-5         | gpt-5.3-codex-spark      |
| prover   | claude-sonnet-5      | claude-opus-4-8          | gpt-5.6-sol              |
| checker  | claude-sonnet-5      | claude-opus-4-8          | gpt-5.6-sol              |
| shipper  | claude-sonnet-5      | claude-opus-4-8          | gpt-5.6-sol              |

**Rules:**
- Native provider: every role uses its Claude default (frontmatter value).
- Claudex/codex: verification roles (prover, checker, shipper) bump to flagship tier (never grade your homework with a same-or-weaker model).
- Planner/Maker: stay native tier across all providers (cost-appropriate, already diverse).

## This Goal's Own Phases Stay Sequential

This goal's four phases (Policy+Resolver, Detection, Wire+Contracts, Orchestration) execute
sequentially with a single Maker and one commit per phase boundary. The resolver is the
*capability* that enables concurrent dispatch in *other goals* — not a change to how this
goal runs.

When a future harness goal is authored, the resolver + detection modules become available
instantaneously for that goal's Maker to wire up concurrency if PLAN.md specifies phases
marked as parallel-safe. The first serial execution of phases 1-3 always completes; phase 4
documents the capability for authors who choose to use it.

## Implications

- **Cost:** Native Claude Code is the zero-cost baseline (existing frontmatter); proxy/codex modes are opt-in.
- **Fallback robustness:** The resolver never crashes — unrecognized providers degrade to native.
- **Discovery:** New goals' HARNESS.md will carry a pointer to the resolver and a concurrency matrix so authors know which roles can fan-out safely.
- **Test coverage:** Contract tests (`scripts/harness-agent-contracts.test.ts`) assert all 15 role×provider combinations.

## References

- `scripts/resolve-role-model.ts` — pure resolver, no I/O
- `scripts/detect-provider.ts` — side-effect-isolated detection
- `scripts/harness-agent-contracts.test.ts` — exhaustive policy table coverage
- `.claude/workflows/red-team.js` — existing parallel-dispatch pattern (4 roles)
- `skills/write-goal-prompt/references/subagent-harness.md` — harness agent spawn patterns
