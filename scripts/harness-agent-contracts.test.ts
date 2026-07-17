import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "..");
const agentPath = (name: string) => join(repoRoot, ".claude", "agents", `${name}.md`);
const readAgent = (name: string) => readFileSync(agentPath(name), "utf8");

const roles = [
  "harness-planner",
  "harness-maker",
  "harness-prover",
  "harness-checker",
  "harness-shipper",
] as const;

describe("approval-aware harness agent contracts", () => {
  test("every role reads its task-specific HARNESS brief", () => {
    const expectedBrief = {
      "harness-planner": "PLANNER_BRIEF",
      "harness-maker": "MAKER_ROUTING",
      "harness-prover": "PROVER_BRIEF",
      "harness-checker": "CHECKER_BRIEF",
      "harness-shipper": "SHIP_BRIEF",
    } as const;

    for (const role of roles) {
      const source = readAgent(role);
      expect(source).toContain("HARNESS.md");
      expect(source).toContain(expectedBrief[role]);
    }
  });

  test("planner plans only explicitly approved scope", () => {
    const source = readAgent("harness-planner");
    expect(source).toContain("PRE_PLANNER_APPROVAL");
    expect(source).toMatch(/approved IDs only/i);
    expect(source).toMatch(/rejected.*deferred.*missing.*unapproved/i);
    expect(source).toMatch(/new proposal ID/i);
  });

  test("maker commits source, status, and proof atomically per phase", () => {
    const source = readAgent("harness-maker");
    expect(source).toMatch(/one approved ID.*one phase.*one slice.*one commit/i);
    expect(source).toMatch(/append proof.*before.*commit/i);
    expect(source).toMatch(/status.*proof.*source changes.*same commit/i);
  });

  test("prover runs only for applicable runtime behavior", () => {
    const source = readAgent("harness-prover");
    expect(source).toMatch(/only.*applicable runtime/i);
    expect(source).toMatch(/static.*skip/i);
  });

  test("checker uses named process proof without maker qualitative opinions", () => {
    const source = readAgent("harness-checker");
    expect(source).toContain("CHECKER_BRIEF");
    expect(source).toMatch(/exact process proof/i);
    expect(source).toMatch(/Maker self-assessment.*qualitative evidence/i);
  });

  test("shipper requires separate explicit approval and never merges", () => {
    const source = readAgent("harness-shipper");
    expect(source).toMatch(/separate explicit shipping approval/i);
    expect(source).toMatch(/in addition to.*PASS/i);
    expect(source).toMatch(/never merge/i);
  });
});
