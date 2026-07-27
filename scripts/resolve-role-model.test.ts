import { test, expect } from "bun:test";
import { resolveRoleModel, type Detected } from "./resolve-role-model";

// Policy table from PLAN.md (5 roles × 3 providers = 15 combinations)
const POLICY_TABLE = {
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

test("native provider - all roles resolve to Claude defaults", () => {
  const detected: Detected = { provider: "native" };
  Object.entries(POLICY_TABLE.native).forEach(([role, expected]) => {
    const result = resolveRoleModel(role as any, detected);
    expect(result).toEqual(expected);
  });
});

test("claudex provider - planner and maker stay Claude, verification roles bump to opus", () => {
  const detected: Detected = { provider: "claudex" };
  Object.entries(POLICY_TABLE.claudex).forEach(([role, expected]) => {
    const result = resolveRoleModel(role as any, detected);
    expect(result).toEqual(expected);
  });
});

test("codex provider - all roles resolve to GPT IDs with verification tier bumped", () => {
  const detected: Detected = { provider: "codex" };
  Object.entries(POLICY_TABLE.codex).forEach(([role, expected]) => {
    const result = resolveRoleModel(role as any, detected);
    expect(result).toEqual(expected);
  });
});

test("unrecognized provider degrades to native fallback (not throw)", () => {
  const detected: Detected = { provider: "unknown" as any };
  const result = resolveRoleModel("planner", detected);
  expect(result).toEqual(POLICY_TABLE.native.planner);
});

test("missing provider field degrades to native fallback (not throw)", () => {
  const detected: Detected = {} as any;
  const result = resolveRoleModel("checker", detected);
  expect(result).toEqual(POLICY_TABLE.native.checker);
});

test("all 15 role×provider combinations are exhaustively covered", () => {
  const roles = ["planner", "maker", "prover", "checker", "shipper"] as const;
  const providers = ["native", "claudex", "codex"] as const;

  roles.forEach((role) => {
    providers.forEach((provider) => {
      const detected: Detected = { provider };
      const result = resolveRoleModel(role, detected);
      const expected = POLICY_TABLE[provider][role];
      expect(result).toEqual(expected);
    });
  });
});

test("unrecognized role throws a descriptive error at CLI boundary", () => {
  const detected: Detected = { provider: "native" };
  expect(() => {
    resolveRoleModel("unknown-role" as any, detected);
  }).toThrow();
});

test("shipper/prover/checker under claudex are bumped to flagship tier", () => {
  const detected: Detected = { provider: "claudex" };
  expect(resolveRoleModel("shipper", detected).tier).toBe("flagship");
  expect(resolveRoleModel("prover", detected).tier).toBe("flagship");
  expect(resolveRoleModel("checker", detected).tier).toBe("flagship");
});

test("shipper/prover/checker under codex are bumped to flagship tier", () => {
  const detected: Detected = { provider: "codex" };
  expect(resolveRoleModel("shipper", detected).tier).toBe("flagship");
  expect(resolveRoleModel("prover", detected).tier).toBe("flagship");
  expect(resolveRoleModel("checker", detected).tier).toBe("flagship");
});

test("planner and maker keep their native tier under every provider", () => {
  const plannerExpectations = [
    { provider: "native", tier: "standard" },
    { provider: "claudex", tier: "standard" },
    { provider: "codex", tier: "standard" },
  ];
  const makerExpectations = [
    { provider: "native", tier: "fast" },
    { provider: "claudex", tier: "fast" },
    { provider: "codex", tier: "fast" },
  ];

  plannerExpectations.forEach(({ provider, tier }) => {
    const detected: Detected = { provider } as any;
    expect(resolveRoleModel("planner", detected).tier).toBe(tier);
  });

  makerExpectations.forEach(({ provider, tier }) => {
    const detected: Detected = { provider } as any;
    expect(resolveRoleModel("maker", detected).tier).toBe(tier);
  });
});
