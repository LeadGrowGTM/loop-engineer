import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readRunManifest, writeRunManifest } from "./goal-lifecycle/manifest";
import { runProcess } from "./goal-lifecycle/process";

const CLI_PATH = join(import.meta.dir, "goal-lifecycle.ts");

function invokeLifecycle(args: string[]) {
  const result = Bun.spawnSync([process.execPath, CLI_PATH, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = result.stdout.toString();
  const lines = stdout.trim() === "" ? [] : stdout.trim().split(/\r?\n/);

  return {
    exitCode: result.exitCode,
    lines,
    json: lines.length === 1 ? JSON.parse(lines[0]) : undefined,
    stderr: result.stderr.toString(),
  };
}

// Catches a dispatcher that emits a non-JSON result, multiple results, or treats invalid input as success.
test("unknown operation emits exactly one typed JSON result", () => {
  const result = invokeLifecycle(["unknown"]);

  expect(result.exitCode).toBe(2);
  expect(result.lines).toHaveLength(1);
  expect(result.json).toMatchObject({
    schemaVersion: 1,
    operation: "unknown",
    ok: false,
    code: "INVALID_ARGUMENT",
  });
  expect(result.stderr).toBe("");
});

// Catches a manifest reader accepting a future format, and a writer leaving temporary files visible.
test("manifest writes are atomic and reject unsupported schema versions", () => {
  const directory = mkdtempSync(join(tmpdir(), "goal-lifecycle-manifest-"));
  const manifestPath = join(directory, "RUN.json");
  const pathToSchema2 = join(directory, "schema-2.json");

  try {
    writeRunManifest(manifestPath, {
      schemaVersion: 1,
      taskId: "goal-contract",
      title: "Goal contract",
      state: "STARTED",
      repositoryRoot: "C:/repo",
      gitCommonDirectory: "C:/repo/.git",
      worktreePath: "C:/repo/.worktrees/goal-contract",
      poolRoot: "C:/repo/.worktrees",
      leaseHolder: "goal-contract",
      branch: "wt/goal-contract",
      sourceHead: "0123456789abcdef",
      runDirectory: "C:/repo/.worktrees/goal-contract/.harness/goals/goal-contract",
      grillReceiptPath: "C:/repo/.worktrees/goal-contract/.harness/goals/goal-contract/GRILL.json",
    });

    expect(readRunManifest(manifestPath)).toMatchObject({
      schemaVersion: 1,
      taskId: "goal-contract",
      state: "STARTED",
    });
    expect(existsSync(manifestPath)).toBe(true);
    expect(readdirSync(directory).some((name) => name.includes(".tmp-"))).toBe(false);

    writeFileSync(pathToSchema2, JSON.stringify({ schemaVersion: 2 }));
    expect(() => readRunManifest(pathToSchema2)).toThrow("RUN_MANIFEST_UNSUPPORTED");
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

// Catches a process adapter that uses a shell, drops process output, or misreports exit status.
test("process runner executes an argv-only command with bounded captured output", async () => {
  const result = await runProcess(process.execPath, ["-e", "process.stdout.write('lifecycle')"], {
    outputLimitBytes: 1_024,
    timeoutMs: 1_000,
  });

  expect(result).toEqual({
    exitCode: 0,
    stdout: "lifecycle",
    stderr: "",
    timedOut: false,
    outputLimitExceeded: false,
  });
});
