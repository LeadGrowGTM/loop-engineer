import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";

const scriptPath = join(import.meta.dir, "validate-pipeline-layout.ps1");
const fixtures: string[] = [];

function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "pipeline-layout-"));
  fixtures.push(root);
  mkdirSync(join(root, "pipelines"), { recursive: true });
  return root;
}

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function runValidator(repoRoot: string) {
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-RepoRoot", repoRoot],
    { encoding: "utf8" },
  );
  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}`,
  };
}

function snapshotFiles(root: string): Record<string, string> {
  const files: Record<string, string> = {};
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      const path = join(directory, entry);
      const metadata = statSync(path);
      if (metadata.isDirectory()) {
        visit(path);
      } else {
        files[relative(root, path)] = readFileSync(path).toString("base64");
      }
    }
  };
  visit(root);
  return files;
}

function snapshotRefs(repo: string): string {
  return git(repo, ["for-each-ref", "--format=%(refname) %(objectname)"]);
}

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true });
  }
});

describe("validate-pipeline-layout.ps1", () => {
  test("accepts a canonical pipeline and allowlisted project", () => {
    const root = fixtureRoot();
    mkdirSync(join(root, "pipelines", "gtm-orchestrator"));
    mkdirSync(join(root, "pipelines", "content"));

    const result = runValidator(root);

    expect(result.status).toBe(0);
    expect(result.output).toContain("OK: pipelines/ contains only allowlisted workspaces.");
  });

  test("reports a sibling task checkout registered by another pipeline as misplaced_worktree without changing fixtures or refs", () => {
    const root = fixtureRoot();
    const pipelines = join(root, "pipelines");
    const owner = join(pipelines, "gtm-orchestrator");
    const sibling = join(pipelines, "gtm-orchestrator-funnel-batch");
    mkdirSync(owner);
    git(owner, ["init"]);
    git(owner, ["config", "user.email", "fixture@example.test"]);
    git(owner, ["config", "user.name", "Fixture"]);
    git(owner, ["config", "core.autocrlf", "false"]);
    writeFileSync(join(owner, "README.md"), "fixture\n");
    git(owner, ["add", "README.md"]);
    git(owner, ["commit", "-m", "fixture"]);
    git(owner, ["worktree", "add", "--detach", sibling, "HEAD"]);
    const beforeFiles = snapshotFiles(root);
    const beforeRefs = snapshotRefs(owner);

    const result = runValidator(root);

    expect(result.status).toBe(1);
    expect(result.output).toContain("  - gtm-orchestrator-funnel-batch [misplaced_worktree]");
    expect(result.output).toContain(`Audit: git -C '${owner}' worktree list --porcelain`);
    expect(result.output).toContain(`Cleanup (after audit): git -C '${owner}' worktree remove '${sibling}'`);
    expect(snapshotFiles(root)).toEqual(beforeFiles);
    expect(snapshotRefs(owner)).toBe(beforeRefs);
  });

  test("reports a malformed .git file as malformed_git_file instead of misplaced_worktree", () => {
    const root = fixtureRoot();
    const malformed = join(root, "pipelines", "broken-checkout");
    mkdirSync(malformed);
    writeFileSync(join(malformed, ".git"), "not a gitdir declaration\n");

    const result = runValidator(root);

    expect(result.status).toBe(1);
    expect(result.output).toContain("  - broken-checkout [malformed_git_file]");
    expect(result.output).not.toContain("broken-checkout [misplaced_worktree]");
  });

  test("does not treat an unregistered gitdir-shaped file as a misplaced worktree", () => {
    const root = fixtureRoot();
    const candidate = join(root, "pipelines", "lookalike-checkout");
    mkdirSync(candidate);
    writeFileSync(
      join(candidate, ".git"),
      `gitdir: ${join(root, "pipelines", "gtm-orchestrator", ".git", "worktrees", "missing")}\n`,
    );

    const result = runValidator(root);

    expect(result.status).toBe(1);
    expect(result.output).toContain("  - lookalike-checkout [unknown_directory]");
    expect(result.output).not.toContain("lookalike-checkout [misplaced_worktree]");
  });

  test("reports an ordinary unknown directory as unknown_directory", () => {
    const root = fixtureRoot();
    mkdirSync(join(root, "pipelines", "scratch"));

    const result = runValidator(root);

    expect(result.status).toBe(1);
    expect(result.output).toContain("  - scratch [unknown_directory]");
  });
});
