import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveRoleModel } from "./resolve-role-model";

const repoRoot = join(import.meta.dir, "..");
const agentPath = (name: string) => join(repoRoot, ".claude", "agents", `${name}.md`);
const readAgent = (name: string) => readFileSync(agentPath(name), "utf8");
const goalSkillPath = join(repoRoot, "skills", "write-goal-prompt", "SKILL.md");
const goalExamplesPath = join(repoRoot, "skills", "write-goal-prompt", "EXAMPLES.md");
const issueTrackerPath = join(repoRoot, "skills", "write-goal-prompt", "references", "issue-tracker.md");
const readGoalSkill = () => readFileSync(goalSkillPath, "utf8");
const readGoalExamples = () => readFileSync(goalExamplesPath, "utf8");
const readIssueTracker = () => readFileSync(issueTrackerPath, "utf8");
const lifecycleReferencePaths = [
  goalSkillPath,
  goalExamplesPath,
  join(repoRoot, "skills", "write-goal-prompt", "references", "clarity-gate.md"),
  join(repoRoot, "skills", "write-goal-prompt", "references", "parallel-execution.md"),
  join(repoRoot, "skills", "write-goal-prompt", "references", "context-management.md"),
  agentPath("harness-planner"),
  agentPath("harness-maker"),
  agentPath("harness-shipper"),
];

function readLifecycleContracts(): string {
  return lifecycleReferencePaths.map((path) => readFileSync(path, "utf8")).join("\n");
}
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

  test("write-goal routes only after lifecycle validation", () => {
    const source = readGoalSkill();

    expect(source).toContain("[ROUTING_GUARD]");
    expect(source).toContain("[SKILL_ROUTING_RESOLUTION]");
    expect(source).toMatch(/validation.*before.*routing.*Planner/is);
    expect(source).toMatch(/nonzero.*stop.*Planner|stop.*Planner.*nonzero/is);
  });

  test("complete example validates before routing or Planner", () => {
    const source = readGoalExamples();

    expect(source).toMatch(/First action: goal-lifecycle validate --run <RUN\.json>/);
    expect(source).toMatch(/Validate before routing, Planner, or Maker/i);
  });

  test("planner consumes exact routing evidence without gaining Bash", () => {
    const source = readAgent("harness-planner");

    expect(source).toMatch(/^tools: Read, Glob, Write$/m);
    expect(source).not.toMatch(/^tools:.*Bash.*$/m);
    expect(source).toContain("[SKILL_ROUTING_RESOLUTION]");
    expect(source).toMatch(/copy.*JSON.*exactly.*PLAN\.md/is);
    expect(source).toMatch(/selected source.*fallback.*PLAN\.md/is);
    expect(source).toMatch(/HARNESS routing/i);
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

  test("maker invokes the installed protected-work guard before edits and every commit", () => {
    const source = readAgent("harness-maker");
    const guardPath = "$RUN_WORKTREE_PATH/scripts/guard-protected-work.ts";
    const captureCommand = `bun "${guardPath}" capture`;
    const validateCommand = `bun "${guardPath}" validate`;
    const captureIndex = source.indexOf(captureCommand);
    const sourceEditIndex = source.indexOf("source edits");
    const validateIndex = source.indexOf(validateCommand);
    const commitIndex = source.indexOf("Before every commit");

    expect(captureIndex).toBeGreaterThan(-1);
    expect(captureIndex).toBeLessThan(sourceEditIndex);
    expect(validateIndex).toBeGreaterThan(-1);
    expect(validateIndex).toBeGreaterThan(commitIndex);
    expect(source).toContain("--active-id");
    expect(source).toContain("--allowed-path");
    expect(source).toContain("--baseline");
    expect(source).toContain("$PROTECTED_WORK_BASELINE");
    expect(source).toMatch(/BLOCKED.*stop|stop.*BLOCKED/is);
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

  test("write-goal skill exposes the complete lifecycle interface", () => {
    const source = readGoalSkill();

    expect(source).toContain("goal-lifecycle start");
    expect(source).toContain("goal-lifecycle record-grill");
    expect(source).toContain("goal-lifecycle validate");
    expect(source).toContain("goal-lifecycle finish");
    expect(source).toContain("goal-lifecycle audit");
  });

  test("write-goal skill propagates separate shipping approval to generated goals", () => {
    const source = readGoalSkill();

    expect(source).toMatch(/separate explicit shipping approval/i);
    expect(source).toContain("N/A - shipping not approved");
    expect(source).toMatch(/Run the Shipper only after Checker PASS plus separate explicit shipping approval/i);
    expect(source).toMatch(/Checker PASS.*shipping approval/is);
    expect(source).not.toContain("After Checker returns PASS, spawn a fresh `harness-shipper` agent");
    expect(source).not.toContain("After the first PASS, exit the eval loop and run the Ship stage exactly once");
  });

  test("authoring follows the mandatory managed lifecycle order before emitting a restart pointer", () => {
    const source = readLifecycleContracts();
    const start = source.indexOf("goal-lifecycle start");
    const grill = source.indexOf("batch-grill-me");
    const record = source.indexOf("goal-lifecycle record-grill", grill);
    const durableArtifacts = source.indexOf("RUN.json + GRILL.json + BRIEF.md + HARNESS.md", record);
    const pointer = source.indexOf("restart pointer", durableArtifacts);

    expect(start).toBeGreaterThan(-1);
    expect(grill).toBeGreaterThan(start);
    expect(source).toMatch(/unconditionally invoke batch-grill-me|batch-grill-me.*unconditionally/is);
    expect(record).toBeGreaterThan(grill);
    expect(durableArtifacts).toBeGreaterThan(record);
    expect(pointer).toBeGreaterThan(durableArtifacts);
  });

  test("restart pointers carry only persisted run identity and validate before routing or execution", () => {
    const source = `${readGoalSkill()}\n${readGoalExamples()}`;

    expect(source).toMatch(/task ID.*absolute run path.*manifest path/is);
    expect(source).toMatch(/goal-lifecycle validate --run <RUN\.json>.*first action/is);
    expect(source).toMatch(/validate.*before.*routing.*Planner/is);
    expect(source).toMatch(/validate.*before.*Planner.*Maker/is);
  });

  test("planner and maker reject an invocation without successful lifecycle validation", () => {
    for (const role of ["harness-planner", "harness-maker"] as const) {
      const source = readAgent(role);
      expect(source).toContain("LIFECYCLE_VALIDATION: OK");
      expect(source).toMatch(/stop.*LIFECYCLE_VALIDATION|LIFECYCLE_VALIDATION.*stop/is);
      expect(source).toMatch(/goal-lifecycle validate --run <RUN\.json>/);
    }
  });

  test("maker uses explicit manifest roots for task work, artifacts, and ownership", () => {
    const source = readAgent("harness-maker");

    expect(source).toContain("worktreePath");
    expect(source).toContain("runDirectory");
    expect(source).toContain("repositoryRoot");
    expect(source).toContain("gitCommonDirectory");
    expect(source).toContain("RUN_WORKTREE_PATH");
    expect(source).toContain("RUN_DIRECTORY");
    expect(source).toContain("REPOSITORY_ROOT");
    expect(source).toContain("GIT_COMMON_DIRECTORY");
    expect(source).not.toContain("$PROJECT_ROOT");
    expect(source).toMatch(/worktreePath.*guard.*commit root/is);
    expect(source).toMatch(/runDirectory.*artifacts/is);
    expect(source).toMatch(/workspace root.*never.*task work.*commit target/is);
  });

  test("each restart pointer names its persisted routing action after validation", () => {
    for (const source of [readGoalSkill(), readGoalExamples()]) {
      expect(source).toMatch(/First action: goal-lifecycle validate --run <RUN\.json>/);
      expect(source).toMatch(/exact \[ROUTING_GUARD\] block persisted in HARNESS\.md/i);
      expect(source).toMatch(/Validate before routing, Planner, or Maker/i);
    }
  });

  test("authoring resolves the nested target repository root before lifecycle start", () => {
    const source = readGoalSkill();

    expect(source).toContain("git -C <candidate-target> rev-parse --show-toplevel");
    expect(source).toMatch(/exact absolute output.*--repo/is);
    expect(source).toMatch(/nested repository.*not.*workspace.*monorepo/i);
  });

  test("issue slices consume the manifest run directory instead of deleted router roots", () => {
    const source = readIssueTracker();

    expect(source).toContain("worktreePath");
    expect(source).toContain("runDirectory");
    expect(source).toMatch(/runDirectory.*artifacts/is);
    expect(source).toMatch(/worktreePath.*task work.*commit root/is);
    expect(source).not.toContain("$PROJECT_ROOT");
    expect(source).not.toContain("Execution Router");
  });

  test("supported contracts never offer direct task, worktree, bypass, or conditional-grill paths", () => {
    const source = readLifecycleContracts();

    expect(source).not.toMatch(/tasks-axi/i);
    expect(source).not.toMatch(/treehouse/i);
    expect(source).not.toMatch(/git worktree/i);
    expect(source).not.toMatch(/-NoIsolation/i);
    expect(source).not.toMatch(/primary checkout/i);
    expect(source).not.toMatch(/model[- ]chosen.*worktree|choose.*worktree path/i);
    expect(source).not.toMatch(/skip.*grill|\bconditional\b.*grill|grill.*only when/i);
  });
});

describe("provider-aware model routing for harness roles", () => {
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

  test("all 15 role×provider combinations resolve per the policy table", () => {
    const roleNames = ["planner", "maker", "prover", "checker", "shipper"] as const;
    const providerNames = ["native", "claudex", "codex"] as const;

    for (const provider of providerNames) {
      for (const role of roleNames) {
        const detected = { provider };
        const resolved = resolveRoleModel(role, detected as any);
        const expected = POLICY_TABLE[provider][role];
        expect(resolved).toEqual(expected);
      }
    }
  });

  test("native provider resolves to Claude defaults from agent frontmatter", () => {
    for (const role of ["planner", "maker", "prover", "checker", "shipper"] as const) {
      const resolved = resolveRoleModel(role, { provider: "native" });
      const agentName = `harness-${role}`;
      const agentSource = readAgent(agentName);

      // Extract model: from frontmatter
      const modelMatch = agentSource.match(/^model:\s*(.+?)$/m);
      expect(modelMatch).toBeTruthy();
      const frontmatterModel = modelMatch![1].trim();
      expect(resolved.model).toBe(frontmatterModel);
    }
  });

  test("claudex provider bumps prover/checker/shipper to flagship tier", () => {
    const verificationRoles = ["prover", "checker", "shipper"] as const;
    for (const role of verificationRoles) {
      const resolved = resolveRoleModel(role, { provider: "claudex" });
      expect(resolved.tier).toBe("flagship");
    }
  });

  test("codex provider bumps prover/checker/shipper to flagship tier (gpt-5.6-sol)", () => {
    const verificationRoles = ["prover", "checker", "shipper"] as const;
    for (const role of verificationRoles) {
      const resolved = resolveRoleModel(role, { provider: "codex" });
      expect(resolved.tier).toBe("flagship");
      expect(resolved.model).toBe("gpt-5.6-sol");
    }
  });

  test("planner and maker keep native tier across all providers", () => {
    const plannerTiers = [
      { provider: "native", expected: "standard" },
      { provider: "claudex", expected: "standard" },
      { provider: "codex", expected: "standard" },
    ];
    for (const { provider, expected } of plannerTiers) {
      const resolved = resolveRoleModel("planner", { provider } as any);
      expect(resolved.tier).toBe(expected);
    }

    const makerTiers = [
      { provider: "native", expected: "fast" },
      { provider: "claudex", expected: "fast" },
      { provider: "codex", expected: "fast" },
    ];
    for (const { provider, expected } of makerTiers) {
      const resolved = resolveRoleModel("maker", { provider } as any);
      expect(resolved.tier).toBe(expected);
    }
  });

  test("native fallback works when provider is unrecognized (no crash)", () => {
    const resolved = resolveRoleModel("planner", { provider: "unknown" } as any);
    expect(resolved).toEqual(POLICY_TABLE.native.planner);
  });
});
