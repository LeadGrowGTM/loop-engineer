import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const repoRoot = join(import.meta.dir, "..");
const agentPath = (name: string) => join(repoRoot, ".claude", "agents", `${name}.md`);
const readAgent = (name: string) => readFileSync(agentPath(name), "utf8");
const goalSkillPath = join(repoRoot, "skills", "write-goal-prompt", "SKILL.md");
const goalExamplesPath = join(repoRoot, "skills", "write-goal-prompt", "EXAMPLES.md");
const readGoalSkill = () => readFileSync(goalSkillPath, "utf8");
const readGoalExamples = () => readFileSync(goalExamplesPath, "utf8");
const gitExecutable = Bun.which("git");
if (!gitExecutable) throw new Error("Git executable not found");
const gitBash = resolve(dirname(gitExecutable), "..", "bin", "bash.exe");
const BASH = existsSync(gitBash) ? gitBash : Bun.which("bash");
if (!BASH) throw new Error("Bash executable not found");

function run(command: string[], cwd: string): string {
  const result = Bun.spawnSync(command, { cwd, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) {
    throw new Error(
      `Command failed (${result.exitCode}): ${command.join(" ")}\nstdout: ${result.stdout.toString()}\nstderr: ${result.stderr.toString()}`,
    );
  }
  return result.stdout.toString().trim();
}

function normalizePath(value: string): string {
  return resolve(value).replaceAll("\\", "/");
}

function resolveSkillRoots(cwd: string): { projectRoot: string; workspaceRoot: string } {
  const match = readGoalSkill().match(/## Execution Router[\s\S]*?```bash\r?\n([\s\S]*?)\r?\n```/);
  if (!match) throw new Error("Execution Router Step 0 shell snippet not found");
  const snippet = match[1].replaceAll("\r\n", "\n");
  const output = run([BASH, "-c", `${snippet}\nprintf '%s\\n' "$PROJECT_ROOT" "$WORKSPACE_ROOT"`], cwd).split(/\r?\n/);
  if (output.length !== 2) throw new Error(`Expected two routing paths, received ${output.length}`);
  return { projectRoot: output[0], workspaceRoot: output[1] };
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

  test("write-goal parent runs the skill-routing resolver before Planner", () => {
    const source = readGoalSkill();

    expect(source).toContain("scripts/resolve-skill-routing.ts");
    expect(source).toContain("--project-root");
    expect(source).toContain("--emit-shell-guard");
    expect(source).toContain("ROUTING_EVIDENCE");
    expect(source).toContain("[ROUTING_GUARD]");
    expect(source).toContain("[SKILL_ROUTING_RESOLUTION]");
    expect(source).not.toContain("<ABSOLUTE_ROUTING_RESOLVER>");
    expect(source).toMatch(/nonzero.*do not invoke (the )?Planner|do not invoke (the )?Planner.*nonzero/is);
  });

  test("complete example runs the routing guard before Planner", () => {
    const source = readGoalExamples();

    expect(source).toContain("resolve-skill-routing.ts");
    expect(source).toContain("--emit-shell-guard");
    expect(source).toContain("ROUTING_EVIDENCE");
    expect(source).toContain("[SKILL_ROUTING_RESOLUTION]");
    expect(source).toMatch(/nonzero.*stop.*Planner|stop.*Planner.*nonzero/is);
    expect(source).toMatch(/PLAN\.md.*exact routing evidence.*selected source.*fallback/is);
  });

  test("Harness Architect supports direct routing without reading a routing file", () => {
    const source = readGoalSkill();
    const match = source.match(
      /\*\*Agent 4[^\n]*Harness Architect[^\n]*\*\*\r?\n\r?\n```\r?\n([\s\S]*?)\r?\n```\r?\n\r?\nSynthesize/,
    );
    expect(match).not.toBeNull();
    const contract = match![1];

    expect(contract).toMatch(
      /selectedSource is project-local or canonical, read only normalizedPath/i,
    );
    expect(contract).toMatch(
      /selectedSource\s+is direct, do not read a routing file/i,
    );
    expect(contract).toMatch(/documented\s+direct quality bar/i);
    expect(contract).toContain("- [ ] routing resolution consumed");
    expect(contract).toMatch(
      /selected routing file read.*project-local or canonical only.*omit for direct/i,
    );
    expect(contract).not.toContain("- [ ] skill-routing.md read");
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
    const guardPath = "$PROJECT_ROOT/scripts/guard-protected-work.ts";
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

  test("write-goal skill keeps canonical pipeline target separate from workspace root", () => {
    const source = readGoalSkill();

    expect(source).toContain('INVOCATION_ROOT=$(normalize_path "$(pwd -P)")');
    expect(source).toContain("GIT_ROOT_RAW=$(git rev-parse --show-toplevel");
    expect(source).toContain('PROJECT_ROOT="$INVOCATION_ROOT"');
    expect(source).toContain('WORKSPACE_ROOT=$(dirname "$GIT_ROOT")');
    expect(source).toMatch(/WORKSPACE_ROOT.*pipelines.*PROJECT_ROOT/s);
    expect(source).toContain('-RepoPath "$PROJECT_ROOT" -WorkspaceRoot "$WORKSPACE_ROOT" -CheckOnly');
    expect(source).toContain('-RepoPath "$PROJECT_ROOT" -WorkspaceRoot "$WORKSPACE_ROOT" -PrepareIsolation -Parallel');
    expect(source).not.toContain("PROJECT_ROOT=$(git rev-parse --show-toplevel");
  });

  test("write-goal skill propagates separate shipping approval to generated goals", () => {
    const source = readGoalSkill();

    expect(source).toMatch(/separate explicit shipping approval/i);
    expect(source).toContain("N/A - shipping not approved");
    expect(source).toMatch(/do not spawn (the )?Shipper unless/i);
    expect(source).toMatch(/Checker PASS.*shipping approval/is);
    expect(source).not.toContain("After Checker returns PASS, spawn a fresh `harness-shipper` agent");
    expect(source).not.toContain("After the first PASS, exit the eval loop and run the Ship stage exactly once");
  });

  test("write-goal Step 0 executes for canonical and standalone targets", () => {
    const workspace = mkdtempSync(join(tmpdir(), "goal-routing-workspace-"));
    const pipeline = join(workspace, "pipelines", "content");
    mkdirSync(pipeline, { recursive: true });
    run(["git", "init", "-b", "main"], workspace);

    const canonical = resolveSkillRoots(pipeline);
    expect(canonical.projectRoot).toBe(normalizePath(pipeline));
    expect(canonical.workspaceRoot).toBe(normalizePath(workspace));

    const parent = mkdtempSync(join(tmpdir(), "goal-routing-standalone-"));
    const repo = join(parent, "repo with spaces");
    mkdirSync(repo, { recursive: true });
    run(["git", "init", "-b", "main"], repo);

    const standalone = resolveSkillRoots(repo);
    expect(standalone.projectRoot).toBe(normalizePath(repo));
    expect(standalone.workspaceRoot).toBe(normalizePath(dirname(repo)));
  });
});
