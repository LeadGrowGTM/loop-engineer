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

  test("planner follows a deterministic skill-routing fallback chain", () => {
    const source = readAgent("harness-planner");
    const primary = "<PROJECT_ROOT>/.harness/skill-routing.md";
    const canonical = "skills/write-goal-prompt/references/skill-routing.md";
    const primaryIndex = source.indexOf(primary);
    const canonicalIndex = source.indexOf(canonical);
    const directIndex = source.indexOf("direct implementation quality bar");

    expect(primaryIndex).toBeGreaterThan(-1);
    expect(canonicalIndex).toBeGreaterThan(primaryIndex);
    expect(directIndex).toBeGreaterThan(canonicalIndex);
    expect(source).toMatch(/HARNESS routing/i);
    expect(source).toMatch(/record.*fallback.*PLAN\.md/i);
    expect(source).toMatch(/never invent.*unavailable skill/i);
  });

  test("maker captures branch, HEAD, status, and protected diff hashes before source edits", () => {
    const source = readAgent("harness-maker");
    expect(source).toMatch(/capture.*branch/i);
    expect(source).toMatch(/HEAD/i);
    expect(source).toMatch(/git status --short/i);
    expect(source).toMatch(/snapshot\.md/i);
    expect(source).toMatch(/diff hashes/i);
    expect(source).toMatch(/launch-gnhf\.ps1/i);
  });

  test("maker forbids broad staging and destructive worktree operations", () => {
    const source = readAgent("harness-maker");
    expect(source).toMatch(/git add -A/i);
    expect(source).toMatch(/git add \./i);
    expect(source).toMatch(/git stash/i);
    expect(source).toMatch(/git reset/i);
    expect(source).toMatch(/git checkout/i);
    expect(source).toMatch(/overwrite/i);
    expect(source).toMatch(/broad staging|destructive/i);
  });

  test("maker requires staged-path set validation before every commit", () => {
    const source = readAgent("harness-maker");
    expect(source).toMatch(/diff --cached --name-only/i);
    expect(source).toMatch(/subset|subset of/i);
    expect(source).toMatch(/snapshot\.md.*must.*print nothing|must print nothing.*snapshot\.md/i);
  });

  test("maker handles dirty approved files with task-only patch staging", () => {
    const source = readAgent("harness-maker");
    expect(source).toMatch(/task-only patch/i);
    expect(source).toMatch(/already dirty|dirty approved/i);
    expect(source).toMatch(/non-approved.*dirty path|non-approved dirty/i);
  });

  test("maker blocks unisolatable overlap and requests new proposal", () => {
    const source = readAgent("harness-maker");
    expect(source).toMatch(/BLOCKED/i);
    expect(source).toMatch(/new proposal/i);
    expect(source).toMatch(/overlap|not.*isolate|cannot be isolated/i);
  });
});
