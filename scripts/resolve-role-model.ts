// Pure function: resolve a harness role to a model based on provider detection
// No I/O (no Bun.which, no process.env, no Bun.spawnSync) — detection is injected

export type Role = "planner" | "maker" | "prover" | "checker" | "shipper";
export type Provider = "native" | "claudex" | "codex";
export type Tier = "standard" | "fast" | "flagship";

export interface Detected {
  provider: Provider;
}

export interface ResolvedModel {
  model: string;
  provider: Provider;
  tier: Tier;
}

// Policy table from PLAN.md (5 roles × 3 providers = 15 combinations)
const POLICY: Record<Provider, Record<Role, ResolvedModel>> = {
  native: {
    planner: { model: "claude-sonnet-5", provider: "native", tier: "standard" },
    maker: { model: "claude-haiku-4-5", provider: "native", tier: "fast" },
    prover: { model: "claude-sonnet-5", provider: "native", tier: "standard" },
    checker: { model: "claude-sonnet-5", provider: "native", tier: "standard" },
    shipper: { model: "claude-sonnet-5", provider: "native", tier: "standard" },
  },
  claudex: {
    planner: { model: "claude-sonnet-5", provider: "claudex", tier: "standard" },
    maker: { model: "claude-haiku-4-5", provider: "claudex", tier: "fast" },
    prover: { model: "claude-opus-4-8", provider: "claudex", tier: "flagship" },
    checker: { model: "claude-opus-4-8", provider: "claudex", tier: "flagship" },
    shipper: { model: "claude-opus-4-8", provider: "claudex", tier: "flagship" },
  },
  codex: {
    planner: { model: "gpt-5.6-terra", provider: "codex", tier: "standard" },
    maker: { model: "gpt-5.3-codex-spark", provider: "codex", tier: "fast" },
    prover: { model: "gpt-5.6-sol", provider: "codex", tier: "flagship" },
    checker: { model: "gpt-5.6-sol", provider: "codex", tier: "flagship" },
    shipper: { model: "gpt-5.6-sol", provider: "codex", tier: "flagship" },
  },
};

const KNOWN_ROLES: Set<Role> = new Set([
  "planner",
  "maker",
  "prover",
  "checker",
  "shipper",
]);

/**
 * Pure resolver function: resolve a harness role to a model based on provider detection.
 *
 * Deterministic fallback chain (no I/O):
 * 1. If detected.provider === 'codex' → look up the role in the `codex` column
 * 2. Else if detected.provider === 'claudex' → look up the role in the `claudex` column
 * 3. Else (detected.provider === 'native', or unrecognized/missing) → look up the role
 *    in the `native` column (last-resort fallback, never crashes)
 *
 * @param role - one of the five known harness roles
 * @param detected - injected provider detection; provider is optional (defaults to 'native')
 * @returns {model, provider, tier} resolved from the policy table
 * @throws if role is not one of the five known roles
 */
export function resolveRoleModel(
  role: Role,
  detected: Detected
): ResolvedModel {
  // Validate role at the function boundary only (not inside normal path)
  if (!KNOWN_ROLES.has(role)) {
    throw new Error(
      `Unknown role: "${role}". Must be one of: ${Array.from(KNOWN_ROLES).join(", ")}`
    );
  }

  // Deterministic fallback chain
  let provider = detected.provider;

  // If provider is unrecognized or missing, degrade to native (never throw)
  if (provider !== "codex" && provider !== "claudex" && provider !== "native") {
    provider = "native";
  }

  // Provider is now guaranteed to be 'native', 'claudex', or 'codex'
  return POLICY[provider][role];
}

// CLI wrapper: bun scripts/resolve-role-model.ts <role> --provider <native|claudex|codex>
if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.length < 3 || args[1] !== "--provider") {
    console.error(
      "Usage: bun scripts/resolve-role-model.ts <role> --provider <native|claudex|codex>"
    );
    process.exit(1);
  }

  const role = args[0];
  const provider = args[2];

  try {
    const detected: Detected = {
      provider: (provider as Provider) || "native",
    };
    const result = resolveRoleModel(role as Role, detected);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
}
