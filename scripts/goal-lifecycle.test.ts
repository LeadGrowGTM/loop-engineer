import { expect, setDefaultTimeout, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { readRunManifest, writeRunManifest } from "./goal-lifecycle/manifest";
import { runProcess } from "./goal-lifecycle/process";
import { lifecycleFailure } from './goal-lifecycle/contracts';
import { decodeTaskDetail } from './goal-lifecycle/tasks-axi';

const CLI_PATH = join(import.meta.dir, "goal-lifecycle.ts");
setDefaultTimeout(60_000);
const PINNED_GRILL_BASE64 = 'LS0tCm5hbWU6IGJhdGNoLWdyaWxsLW1lCmRlc2NyaXB0aW9uOiBBIHJlbGVudGxlc3MgaW50ZXJ2aWV3IHRoYXQgYXNrcyBldmVyeSBmcm9udGllciBxdWVzdGlvbiBhdCBvbmNlLCByb3VuZCBieSByb3VuZC4KdXNlci1pbnZvY2FibGU6IHRydWUKLS0tCgo8IS0tIFZlbmRvcmVkIGZyb20gbWF0dHBvY29jay9za2lsbHMuIFNvdXJjZSBvZiB0cnV0aCAoZGlmZiBhZ2FpbnN0IHRoaXMgYmVmb3JlIGVkaXRpbmcpOgogICAgIGh0dHBzOi8vcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbS9tYXR0cG9jb2NrL3NraWxscy9tYWluL3NraWxscy9pbi1wcm9ncmVzcy9iYXRjaC1ncmlsbC1tZS9TS0lMTC5tZAogICAgIFRoZSBib2R5IGJlbG93IGlzIFZFUkJBVElNIHVwc3RyZWFtIC0tIGFueSBjaGFuZ2UgdG8gaXQgaXMgZHJpZnQsIG5vdCBhIGZpeC4KCiAgICAgU29sZSBkZXZpYXRpb24sIGZyb250bWF0dGVyIG9ubHk6IHVwc3RyZWFtJ3MgZnJvbnRtYXR0ZXIgY2FycmllcyBhIGh1bWFuLW9ubHkgaW52b2NhdGlvbiBsb2NrCiAgICAgKHNlZSB0aGUgVVJMIGFib3ZlKSB3aG9zZSB3aG9sZSBwdXJwb3NlIGlzIHRoYXQgYSBtb2RlbCBjYW4gbmV2ZXIgaW52b2tlIHRoaXMgc2tpbGwgb24gaXRzIG93bi4KICAgICBsb29wLWVuZ2luZWVyJ3MgY2xhcml0eSBnYXRlIG11c3Qgcm91dGUgdG8gaXQgYXV0b21hdGljYWxseSAtLSBzZWUgQnJhbmNoIEEgb2YKICAgICBza2lsbHMvd3JpdGUtZ29hbC1wcm9tcHQvcmVmZXJlbmNlcy9jbGFyaXR5LWdhdGUubWQgLS0gc28gdGhhdCBsb2NrIGlzIGRyb3BwZWQgaGVyZSBhbmQKICAgICBgdXNlci1pbnZvY2FibGU6IHRydWVgIGlzIGFkZGVkIGluIGl0cyBwbGFjZS4gVHJhZGVkIGF3YXkga25vd2luZ2x5LCBub3Qgb3Zlcmxvb2tlZC4KICAgICAoVGhlIGxvY2sncyBsaXRlcmFsIGZsYWcgbmFtZSBpcyBzcGVsbGVkIG91dCBhdCB0aGUgc291cmNlIFVSTDsgaXQgaXMgbGVmdCB1bnNwZWxsZWQgaGVyZSBzbyB0aGUKICAgICBpbnN0YWxsIGdhdGUgYGdyZXAgLWNgIG92ZXIgdGhpcyBmaWxlIHN0YXlzIGNsZWFuLikgLS0+CgpJbnRlcnZpZXcgdGhlIHVzZXIgcmVsZW50bGVzc2x5IHVudGlsIHlvdSByZWFjaCBhIHNoYXJlZCB1bmRlcnN0YW5kaW5nLiBNYXAgdGhpcyBhcyBhICoqZGVzaWduIHRyZWUqKjogZXZlcnkgZGVjaXNpb24gYnJhbmNoZXMgaW50byB0aGUgZGVjaXNpb25zIHRoYXQgaGFuZyBvZmYgaXQuCgpXb3JrIHRoZSB0cmVlIGluICoqcm91bmRzKiouIFRoZSAqKmZyb250aWVyKiogaXMgZXZlcnkgZGVjaXNpb24gd2hvc2UgcHJlcmVxdWlzaXRlcyBhcmUgYWxyZWFkeSBzZXR0bGVkIOKAlCB0aGUgcXVlc3Rpb25zIHlvdSBjYW4gYXNrICpub3cqIHdpdGhvdXQgZ3Vlc3NpbmcgYXQgYW5zd2VycyB5b3UgaGF2ZW4ndCBoZWFyZCB5ZXQuIEFzayB0aGUgd2hvbGUgZnJvbnRpZXIgaW4gb25lIHJvdW5kOiBudW1iZXIgZWFjaCBxdWVzdGlvbiBhbmQgZ2l2ZSB5b3VyIHJlY29tbWVuZGVkIGFuc3dlci4gVGhlbiB3YWl0IGZvciB0aGUgdXNlcidzIGFuc3dlcnMgYmVmb3JlIHRoZSBuZXh0IHJvdW5kLgoKRWFjaCByb3VuZCB0aGUgdXNlciBhbnN3ZXJzIHJlc2hhcGVzIHRoZSB0cmVlIOKAlCBzZXR0bGVkIGRlY2lzaW9ucyBwdXNoIHRoZSBmcm9udGllciBvdXR3YXJkIGFuZCB1bmJsb2NrIHF1ZXN0aW9ucyB0aGF0IGRlcGVuZGVkIG9uIHRoZW0uIFJlY29tcHV0ZSB0aGUgZnJvbnRpZXIgYW5kIGFzayB0aGUgbmV4dCByb3VuZC4gQSBxdWVzdGlvbiB3aG9zZSBhbnN3ZXIgZGVwZW5kcyBvbiBhbm90aGVyIHF1ZXN0aW9uIHN0aWxsIG9wZW4gaW4gdGhpcyByb3VuZCBiZWxvbmdzIHRvIGEgKmxhdGVyKiByb3VuZCwgbm90IHRoaXMgb25lLgoKRmluZGluZyAqZmFjdHMqIGlzIHlvdXIgam9iLCBuZXZlciB0aGUgdXNlcidzLiBXaGVuIGEgZnJvbnRpZXIgcXVlc3Rpb24gbmVlZHMgYSBmYWN0IGZyb20gdGhlIGVudmlyb25tZW50IChmaWxlc3lzdGVtLCB0b29scywgZXRjLiksIGRpc3BhdGNoIGEgc3ViLWFnZW50IHRvIGZpbmQgaXQg4oCUIGRvbid0IGFzayB0aGUgdXNlciBmb3IgYW55dGhpbmcgeW91IGNvdWxkIGxvb2sgdXAgeW91cnNlbGYuIERvbid0IGJsb2NrIG9uIGl0OiBhIHJ1bm5pbmcgZXhwbG9yYXRpb24gaXMgYW4gdW5zZXR0bGVkIHByZXJlcXVpc2l0ZSwgc28gb25seSB0aGUgcXVlc3Rpb25zIGRvd25zdHJlYW0gb2YgaXQgd2FpdCBmb3IgdGhlIHN1Yi1hZ2VudCB0byByZXBvcnQg4oCUIGFzayB0aGUgcmVzdCBvZiB0aGUgZnJvbnRpZXIgbm93LiBUaGUgKmRlY2lzaW9ucyogYXJlIHRoZSB1c2VyJ3Mg4oCUIHB1dCBlYWNoIHRvIHRoZW0gYW5kIHdhaXQuCgpUaGUgc2Vzc2lvbiBpcyBkb25lIHdoZW4gdGhlIGZyb250aWVyIGlzIGVtcHR5OiBldmVyeSBicmFuY2ggb2YgdGhlIGRlc2lnbiB0cmVlIHZpc2l0ZWQsIG5vdGhpbmcgbGVmdCBzaWxlbnRseSBhc3N1bWVkLiBEbyBub3QgYWN0IG9uIGl0IHVudGlsIHRoZSB1c2VyIGNvbmZpcm1zIHlvdSBoYXZlIHJlYWNoZWQgYSBzaGFyZWQgdW5kZXJzdGFuZGluZy4K';

function invokeLifecycle(args: string[], env: Record<string, string | undefined> = process.env, cwd?: string) {
  const result = Bun.spawnSync([process.execPath, CLI_PATH, ...args], {
    env,
    cwd,
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

function runGit(args: string[], cwd: string): string {
  const result = Bun.spawnSync(['git', ...args], { cwd, stdout: 'pipe', stderr: 'pipe' });
  if (result.exitCode !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr.toString()}`);
  }
  return result.stdout.toString().trim();
}

function initializeRepository(repo: string): void {
  mkdirSync(repo, { recursive: true });
  runGit(['init', '-b', 'main'], repo);
  runGit(['config', 'user.name', 'Lifecycle Test'], repo);
  runGit(['config', 'user.email', 'lifecycle@example.invalid'], repo);
  writeFileSync(join(repo, 'README.md'), '# lifecycle fixture\n');
  runGit(['add', 'README.md'], repo);
  runGit(['commit', '-m', 'fixture'], repo);
  runGit(['switch', '-c', 'feature/lifecycle'], repo);
  writeFileSync(join(repo, '.gitignore'), '.worktrees/\n');
  writeFileSync(join(repo, 'treehouse.toml'), 'max_trees = 16\nroot = ".worktrees/"\n');
  runGit(['add', '.gitignore', 'treehouse.toml'], repo);
  runGit(['commit', '-m', 'configure lifecycle pool'], repo);
  mkdirSync(join(repo, '.worktrees'), { recursive: true });
}

interface LifecycleFixtureOptions {
  taskState?: 'missing' | 'queued' | 'in_flight' | 'done';
  taskTitle?: string;
  tasksBroken?: boolean;
  treehouseMode?: 'valid' | 'malformed' | 'sibling' | 'foreign' | 'reparse';
  nested?: boolean;
}

function createTasksAxiFake(
  bin: string,
  root: string,
  taskId: string,
  title: string,
  state: LifecycleFixtureOptions['taskState'],
): { calls: string; stateFile: string } {
  const calls = join(root, 'tasks-calls.txt');
  const stateFile = join(root, 'tasks-state.txt');
  if (state && state !== 'missing') writeFileSync(stateFile, `${state}\n`);
  writeFileSync(join(bin, 'tasks-axi.cmd'), '@echo off\r\nnode "%~dp0\\tasks-axi-fake.cjs" %*\r\n');
  writeFileSync(
    join(bin, 'tasks-axi-fake.cjs'),
    [
      'const fs = require("node:fs");',
      'const args = process.argv.slice(2);',
      'fs.appendFileSync(process.env.TASKS_CALLS, `${args.join(" ")}\\n`);',
      'if (args[0] === "--version") {',
      '  if (process.env.TASKS_BROKEN === "1") { console.error("broken launcher"); process.exit(1); }',
      '  console.log("0.1.1"); process.exit(0);',
      '}',
      'if (args[0] === "show") {',
      '  if (!fs.existsSync(process.env.TASKS_STATE_FILE)) { console.error("code: NOT_FOUND"); process.exit(1); }',
      '  const state = fs.readFileSync(process.env.TASKS_STATE_FILE, "utf8").trim();',
      '  const title = JSON.stringify(process.env.TASKS_TITLE);',
      '  const repo = JSON.stringify("C:\\\\work\\\\goal");',
      '  console.log(`task:\\n  id: ${process.env.TASKS_ID}\\n  "title": ${title}\\n  state: ${state}\\n  repo: ${repo}`);',
      '  process.exit(0);',
      '}',
      'if (args[0] === "add") { fs.writeFileSync(process.env.TASKS_STATE_FILE, "queued\\n"); process.exit(0); }',
      'if (args[0] === "start") { fs.writeFileSync(process.env.TASKS_STATE_FILE, "in_flight\\n"); process.exit(0); }',
      'process.exit(2);',
      '',
    ].join('\n'),
  );
  return { calls, stateFile };
}

function createTreehouseFake(
  bin: string,
  root: string,
  repo: string,
  mode: NonNullable<LifecycleFixtureOptions['treehouseMode']>,
): { calls: string; lease: string } {
  const pool = join(repo, '.worktrees');
  const calls = join(root, 'treehouse-calls.txt');
  let registrationRepo = repo;
  let lease = join(pool, 'slot-1', 'repository');
  let outputLease = lease;

  if (mode === 'sibling') lease = outputLease = join(dirname(repo), 'gtm-orchestrator-funnel-batch');
  if (mode === 'foreign') {
    registrationRepo = join(root, 'foreign-repository');
    initializeRepository(registrationRepo);
    lease = outputLease = join(pool, 'foreign-slot', 'repository');
  }
  if (mode === 'reparse') {
    const external = join(root, 'external-pool');
    mkdirSync(external, { recursive: true });
    const alias = join(pool, 'escape');
    symlinkSync(external, alias, 'junction');
    lease = join(external, 'repository');
    outputLease = join(alias, 'repository');
  }
  mkdirSync(dirname(lease), { recursive: true });
  runGit(['worktree', 'add', '--detach', lease, 'main'], registrationRepo);

  writeFileSync(
    join(bin, 'treehouse.ps1'),
    [
      '[System.IO.File]::AppendAllText($env:TREEHOUSE_CALLS, (($args -join " ") + "`r`n"))',
      '$command = $args[0]',
      'if ($command -eq "--version") { [Console]::Out.WriteLine("v1.8.0"); exit 0 }',
      'if ($command -eq "get") {',
      '  [Console]::Out.WriteLine($env:TREEHOUSE_LEASE)',
      '  if ($env:TREEHOUSE_MODE -eq "malformed") { [Console]::Out.WriteLine("unexpected banner") }',
      '  exit 0',
      '}',
      'if ($command -eq "return") { exit 0 }',
      'if ($command -eq "status") {',
      '  if ($env:TREEHOUSE_STATUS_MODE -eq "validate") { [Console]::Out.WriteLine("1 leased $env:TREEHOUSE_LEASE (held by $env:TREEHOUSE_HOLDER)") }',
      '  exit 0',
      '}',
      'exit 2',
      '',
    ].join('\r\n'),
  );
  return { calls, lease: outputLease };
}

function createLifecycleFixture(options: LifecycleFixtureOptions = {}) {
  const root = mkdtempSync(join(tmpdir(), 'goal-lifecycle-start-'));
  const outer = join(root, 'workspace');
  const repo = options.nested ? join(outer, 'outer-repository', 'nested-repository') : join(outer, 'repository');
  if (options.nested) {
    initializeRepository(join(outer, 'outer-repository'));
  }
  initializeRepository(repo);
  const bin = join(root, 'bin');
  const userHome = join(root, 'home');
  const grillPath = join(userHome, '.claude', 'skills', 'batch-grill-me', 'SKILL.md');
  mkdirSync(bin, { recursive: true });
  mkdirSync(dirname(grillPath), { recursive: true });
  writeFileSync(grillPath, Buffer.from(PINNED_GRILL_BASE64, 'base64'));

  const taskId = 'canonical-goal';
  const title = options.taskTitle ?? 'Canonical goal';
  const tasks = createTasksAxiFake(bin, root, taskId, title, options.taskState ?? 'missing');
  const treehouse = createTreehouseFake(bin, root, repo, options.treehouseMode ?? 'valid');
  const env: Record<string, string | undefined> = {
    ...process.env,
    PATH: `${bin};${process.env.PATH ?? ''}`,
    HOME: userHome,
    USERPROFILE: userHome,
    PSModuleAnalysisCachePath: join(root, 'powershell-module-cache'),
    TASKS_CALLS: tasks.calls,
    TASKS_STATE_FILE: tasks.stateFile,
    TASKS_ID: taskId,
    TASKS_TITLE: title,
    TASKS_BROKEN: options.tasksBroken ? '1' : '0',
    TREEHOUSE_CALLS: treehouse.calls,
    TREEHOUSE_LEASE: treehouse.lease,
    TREEHOUSE_MODE: options.treehouseMode ?? 'valid',
    TREEHOUSE_STATUS_MODE: 'start',
    TREEHOUSE_HOLDER: taskId,
  };
  return { root, repo, taskId, title, tasks, treehouse, env, grillPath };
}

function startFixture(fixture: ReturnType<typeof createLifecycleFixture>) {
  return invokeLifecycle(
    ['start', '--repo', fixture.repo, '--task-id', fixture.taskId, '--title', fixture.title],
    fixture.env,
  );
}

const PINNED_GRILL_HASH = '92a426f9ed319ca6f54ecf8fabe8c57f82e42dd71e7e5a2d11415fb6f903557f';

function completeGrillReceipt(taskId: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    taskId,
    skill: {
      name: 'batch-grill-me',
      version: '1.0.0',
      sourceHash: PINNED_GRILL_HASH,
    },
    rounds: [],
    recommendations: [],
    settledDecisions: [],
    finalFrontierCount: 0,
    status: 'complete',
    redaction: {
      redacted: false,
      fields: [],
    },
    ...overrides,
  };
}

function recordGrillFixture(
  fixture: ReturnType<typeof createLifecycleFixture>,
  receipt: Record<string, unknown>,
) {
  const start = startFixture(fixture);
  expect(start.exitCode).toBe(0);
  const manifestPath = start.json.data.manifestPath as string;
  const candidatePath = join(dirname(manifestPath), 'candidate-GRILL.json');
  writeFileSync(candidatePath, JSON.stringify(receipt, null, 2));
  return {
    candidatePath,
    manifestPath,
    result: invokeLifecycle(['record-grill', '--run', manifestPath, '--receipt', candidatePath], fixture.env),
  };
}

function validateFixture(
  fixture: ReturnType<typeof createLifecycleFixture>,
  manifestPath: string,
  cwd?: string,
) {
  fixture.env.TREEHOUSE_STATUS_MODE = 'validate';
  return invokeLifecycle(['validate', '--run', manifestPath], fixture.env, cwd);
}

function expectSafeRemediation(result: { remediation?: unknown }): void {
  expect(Array.isArray(result.remediation)).toBe(true);
  const remediation = result.remediation as unknown[];
  expect(remediation.length).toBeGreaterThan(0);
  expect(remediation.every((entry) => typeof entry === 'string' && entry.trim().length > 0)).toBe(true);
  expect(remediation.join(' ')).not.toMatch(
    /primary[- ]checkout|direct[- ]git|git worktree|-NoIsolation|skip(?:ping)?(?: the)? grill/i,
  );
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
  expectSafeRemediation(result.json);
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

test('typed tasks-axi adapter decodes TOON escapes and rejects invalid task shapes', () => {
  const toon = [
    'task:\n  id: canonical-goal\n  title: "Open \"quoted\" file C:\\\\work\\\\goal"\n  state: in_flight\n  repo: "C:\\\\work\\\\goal"\n',
  ].join('').replace(
    'Open "quoted"',
    `Open ${String.fromCharCode(92)}"quoted${String.fromCharCode(92)}"`,
  );
  const task = decodeTaskDetail(toon);

  expect(task).toEqual({
    id: 'canonical-goal',
    title: 'Open "quoted" file C:\\work\\goal',
    state: 'in_flight',
  });
  expect(() => decodeTaskDetail('task:\n  id: canonical-goal\n  title: 42\n  state: in_flight\n')).toThrow(
    'title must be a non-empty string',
  );
  expect(() =>
    decodeTaskDetail('task:\n  id: canonical-goal\n  title: first\n  title: second\n  state: in_flight\n'),
  ).toThrow('Duplicate sibling key "title"');
  expect(() =>
    decodeTaskDetail('task:\n  id: canonical-goal\n  title: nested\n  state: in_flight\n  labels[1]: lifecycle\n'),
  ).toThrow('flat scalar fields');
});

test('typed tasks-axi adapter accepts official TOON quoted-key syntax', () => {
  const task = decodeTaskDetail(
    'task:\n  id: canonical-goal\n  "title": Official TOON task\n  state: in_flight\n',
  );

  expect(task).toEqual({
    id: 'canonical-goal',
    title: 'Official TOON task',
    state: 'in_flight',
  });
});

test('all typed public lifecycle errors provide supported non-bypass remediation', () => {
  for (const code of [
    'INVALID_ARGUMENT',
    'NOT_IMPLEMENTED',
    'DEPENDENCY_SETUP_REQUIRED',
    'DEPENDENCY_SETUP_FAILED',
    'TASK_REGISTRATION_FAILED',
    'TASK_STATE_CONFLICT',
    'TREEHOUSE_CONFIG_UNSAFE',
    'TREEHOUSE_LEASE_FAILED',
    'LEASE_OUTSIDE_REPOSITORY',
    'LEASE_IDENTITY_MISMATCH',
    'BRANCH_IDENTITY_MISMATCH',
    'REPOSITORY_NOT_READY',
    'INTERNAL_ERROR',
  ]) {
    const result = lifecycleFailure('start', code, 'fixture failure');
    expectSafeRemediation(result);
  }
});

test('lifecycle start fails closed when a present tasks-axi launcher is broken', () => {
  const fixture = createLifecycleFixture({ tasksBroken: true });

  const start = startFixture(fixture);

  expect(start.exitCode).not.toBe(0);
  expect(start.json).toMatchObject({ operation: 'start', ok: false, code: 'DEPENDENCY_SETUP_REQUIRED' });
  expectSafeRemediation(start.json);
  expect(readFileSync(fixture.tasks.calls, 'utf8').trim().split(/\r?\n/)).toEqual(['--version']);
  expect(existsSync(fixture.treehouse.calls)).toBe(false);
});

test('lifecycle start requires the byte-exact pinned batch-grill-me installation', () => {
  const fixture = createLifecycleFixture();
  writeFileSync(fixture.grillPath, 'drifted skill\n');

  const start = startFixture(fixture);

  expect(start.exitCode).not.toBe(0);
  expect(start.json).toMatchObject({ ok: false, code: 'DEPENDENCY_SETUP_REQUIRED' });
  expectSafeRemediation(start.json);
  expect(start.json.message).toContain('batch-grill-me');
  expect(existsSync(fixture.treehouse.calls)).toBe(true);
  expect(readFileSync(fixture.treehouse.calls, 'utf8').trim().split(/\r?\n/)).toEqual(['--version']);
});

test('lifecycle start creates and starts one canonical task then persists the exact managed identity', () => {
  const fixture = createLifecycleFixture();
  const sourceHead = runGit(['rev-parse', 'HEAD'], fixture.repo);

  const start = startFixture(fixture);

  expect(start.exitCode).toBe(0);
  expect(start.lines).toHaveLength(1);
  expect(start.json.data).toMatchObject({
    taskId: fixture.taskId,
    leaseHolder: fixture.taskId,
    branch: `wt/${fixture.taskId}`,
    repositoryRoot: fixture.repo,
    sourceHead,
  });
  const manifestPath = start.json.data.manifestPath as string;
  const manifest = readRunManifest(manifestPath);
  expect(manifest).toMatchObject({
    state: 'STARTED',
    taskId: fixture.taskId,
    title: fixture.title,
    repositoryRoot: fixture.repo,
    worktreePath: fixture.treehouse.lease,
    poolRoot: join(fixture.repo, '.worktrees'),
    leaseHolder: fixture.taskId,
    branch: `wt/${fixture.taskId}`,
    sourceHead,
  });
  expect(readdirSync(dirname(manifestPath)).some((name) => name.includes('.tmp-'))).toBe(false);
  expect(readFileSync(fixture.tasks.calls, 'utf8').trim().split(/\r?\n/)).toEqual([
    '--version',
    `show ${fixture.taskId} --full`,
    `add ${fixture.taskId} ${fixture.title}`,
    `start ${fixture.taskId}`,
    `show ${fixture.taskId} --full`,
  ]);
  const treehouseCalls = readFileSync(fixture.treehouse.calls, 'utf8').trim().split(/\r?\n/);
  expect(treehouseCalls).toEqual([
    '--version',
    'status',
    `get --lease --lease-holder ${fixture.taskId}`,
  ]);
});

test('lifecycle start reuses a compatible active tasks-axi identity without mutating it', () => {
  const fixture = createLifecycleFixture({ taskState: 'in_flight' });

  const start = startFixture(fixture);

  expect(start.exitCode).toBe(0);
  const calls = readFileSync(fixture.tasks.calls, 'utf8').trim().split(/\r?\n/);
  expect(calls).toEqual(['--version', `show ${fixture.taskId} --full`]);
});

test('lifecycle start decodes escaped quotes and Windows paths from tasks-axi TOON', () => {
  const title = 'Open "quoted" file C:\\work\\goal';
  const fixture = createLifecycleFixture({ taskState: 'in_flight', taskTitle: title });

  const start = startFixture(fixture);

  expect(start.exitCode).toBe(0);
  expect(start.json.data).toMatchObject({ taskId: fixture.taskId });
  expect(readRunManifest(start.json.data.manifestPath as string).title).toBe(title);
  expect(readFileSync(fixture.tasks.calls, 'utf8').trim().split(/\r?\n/)).toEqual([
    '--version',
    `show ${fixture.taskId} --full`,
  ]);
});

test('lifecycle start rejects conflicting tasks-axi title or terminal state before acquisition', () => {
  for (const conflict of ['title', 'state'] as const) {
    const fixture = createLifecycleFixture({ taskState: conflict === 'state' ? 'done' : 'in_flight' });
    if (conflict === 'title') fixture.env.TASKS_TITLE = 'Different durable task';

    const start = startFixture(fixture);

    expect(start.exitCode).not.toBe(0);
    expect(start.json).toMatchObject({ ok: false, code: 'TASK_STATE_CONFLICT' });
    expectSafeRemediation(start.json);
    expect(readFileSync(fixture.treehouse.calls, 'utf8').trim().split(/\r?\n/)).toEqual(['--version']);
  }
});

test('lifecycle start gives a nested repository ownership of its own pool and Git identity', () => {
  const fixture = createLifecycleFixture({ nested: true });

  const start = startFixture(fixture);

  expect(start.exitCode).toBe(0);
  expect(start.json.data).toMatchObject({
    repositoryRoot: fixture.repo,
    poolRoot: join(fixture.repo, '.worktrees'),
  });
  expect((start.json.data.worktreePath as string).startsWith(join(fixture.repo, '.worktrees'))).toBe(true);
});

test('lifecycle start rejects unsafe Treehouse config before lease acquisition', () => {
  const fixture = createLifecycleFixture();
  writeFileSync(join(fixture.repo, 'treehouse.toml'), 'max_trees = 16\nroot = "../gtm-orchestrator-funnel-batch"\n');
  runGit(['add', 'treehouse.toml'], fixture.repo);
  runGit(['commit', '-m', 'unsafe pool regression'], fixture.repo);

  const start = startFixture(fixture);

  expect(start.exitCode).not.toBe(0);
  expect(start.json).toMatchObject({ ok: false, code: 'TREEHOUSE_CONFIG_UNSAFE' });
  expectSafeRemediation(start.json);
  expect(readFileSync(fixture.treehouse.calls, 'utf8').trim().split(/\r?\n/)).toEqual(['--version']);
});

test('lifecycle start rejects the original sibling worktree regression and returns only that lease', () => {
  const fixture = createLifecycleFixture({ treehouseMode: 'sibling' });

  const start = startFixture(fixture);

  expect(start.exitCode).not.toBe(0);
  expect(start.json.code).toBe('LEASE_OUTSIDE_REPOSITORY');
  expectSafeRemediation(start.json);
  const calls = readFileSync(fixture.treehouse.calls, 'utf8');
  expect(calls.trim().split(/\r?\n/)).toEqual([
    '--version',
    'status',
    `get --lease --lease-holder ${fixture.taskId}`,
    `return ${fixture.treehouse.lease}`,
  ]);
  expect(calls).not.toContain('git worktree');
});

test('lifecycle start rejects reparse escapes and foreign Git common directories', () => {
  const reparse = createLifecycleFixture({ treehouseMode: 'reparse' });
  const escaped = startFixture(reparse);
  expect(escaped.exitCode).not.toBe(0);
  expect(escaped.json.code).toBe('LEASE_OUTSIDE_REPOSITORY');
  expectSafeRemediation(escaped.json);

  const foreign = createLifecycleFixture({ treehouseMode: 'foreign' });
  const wrongIdentity = startFixture(foreign);
  expect(wrongIdentity.exitCode).not.toBe(0);
  expect(wrongIdentity.json.code).toBe('LEASE_IDENTITY_MISMATCH');
  expectSafeRemediation(wrongIdentity.json);
  expect(readFileSync(foreign.treehouse.calls, 'utf8').trim().split(/\r?\n/)).toEqual([
    '--version',
    'status',
    `get --lease --lease-holder ${foreign.taskId}`,
  ]);
});

test('lifecycle start rejects malformed Treehouse output and returns its one identity-proven candidate', () => {
  const fixture = createLifecycleFixture({ treehouseMode: 'malformed' });

  const start = startFixture(fixture);

  expect(start.exitCode).not.toBe(0);
  expect(start.json.code).toBe('TREEHOUSE_LEASE_FAILED');
  expectSafeRemediation(start.json);
  expect(readFileSync(fixture.treehouse.calls, 'utf8').trim().split(/\r?\n/)).toEqual([
    '--version',
    'status',
    `get --lease --lease-holder ${fixture.taskId}`,
    `return ${fixture.treehouse.lease}`,
  ]);
});

// Catches accepting a no-op grill as missing proof instead of persisting its completed zero frontier.
test('record-grill persists a completed zero-question receipt and advances the run', () => {
  const fixture = createLifecycleFixture();
  const recorded = recordGrillFixture(fixture, completeGrillReceipt(fixture.taskId));

  expect(recorded.result.exitCode).toBe(0);
  expect(recorded.result.lines).toHaveLength(1);
  expect(recorded.result.json).toMatchObject({ operation: 'record-grill', ok: true, code: 'OK' });
  expect(readRunManifest(recorded.manifestPath).state).toBe('GRILL_COMPLETE');
  expect(JSON.parse(readFileSync(join(dirname(recorded.manifestPath), 'GRILL.json'), 'utf8'))).toEqual(
    completeGrillReceipt(fixture.taskId),
  );
});

// Catches round normalization that loses the interview order or omits required per-round arrays.
test('record-grill preserves ordered completed multi-round receipts', () => {
  const fixture = createLifecycleFixture();
  const rounds = [
    {
      questions: ['Which users are in scope?'],
      recommendations: ['Start with active accounts.'],
      settledDecisions: ['Active accounts are in scope.'],
    },
    {
      questions: ['Which timezone applies?'],
      recommendations: ['Use America/Toronto.'],
      settledDecisions: ['America/Toronto is the canonical timezone.'],
    },
  ];
  const recorded = recordGrillFixture(fixture, completeGrillReceipt(fixture.taskId, { rounds }));

  expect(recorded.result.exitCode).toBe(0);
  expect(JSON.parse(readFileSync(join(dirname(recorded.manifestPath), 'GRILL.json'), 'utf8')).rounds).toEqual(rounds);
});

// Catches writing a receipt from another durable task into this run directory.
test('record-grill rejects a task-mismatched receipt without changing the started run', () => {
  const fixture = createLifecycleFixture();
  const recorded = recordGrillFixture(fixture, completeGrillReceipt('other-goal'));

  expect(recorded.result.exitCode).not.toBe(0);
  expect(recorded.result.json).toMatchObject({ operation: 'record-grill', ok: false, code: 'GRILL_RECEIPT_INVALID' });
  expectSafeRemediation(recorded.result.json);
  expect(readRunManifest(recorded.manifestPath).state).toBe('STARTED');
  expect(existsSync(join(dirname(recorded.manifestPath), 'GRILL.json'))).toBe(false);
});

// Catches an accepted invalid receipt leaving an invalid or advanced durable run behind.
for (const invalidReceipt of [
  ['an incomplete receipt', completeGrillReceipt('canonical-goal', { status: 'in_progress' })],
  ['a receipt with a nonzero frontier', completeGrillReceipt('canonical-goal', { finalFrontierCount: 1 })],
  ['a structurally malformed receipt', completeGrillReceipt('canonical-goal', { rounds: [{ questions: ['Question'], recommendations: [], settledDecisions: 'not-an-array' }] })],
  ['an unpinned receipt', completeGrillReceipt('canonical-goal', { skill: { name: 'batch-grill-me', version: '1.0.0', sourceHash: 'drifted' } })],
] as const) {
  test(`record-grill fails closed for ${invalidReceipt[0]}`, () => {
    const fixture = createLifecycleFixture();
    const recorded = recordGrillFixture(fixture, invalidReceipt[1]);

    expect(recorded.result.exitCode).not.toBe(0);
    expect(recorded.result.json).toMatchObject({ operation: 'record-grill', ok: false, code: 'GRILL_RECEIPT_INVALID' });
    expectSafeRemediation(recorded.result.json);
    expect(readRunManifest(recorded.manifestPath).state).toBe('STARTED');
  });
}

// Catches identity metadata that can persist secret-like content or drift from the approved pinned skill.
for (const invalidIdentity of [
  ['a wrong skill name', { name: 'other-grill', version: '1.0.0', sourceHash: PINNED_GRILL_HASH }],
  ['a wrong skill version', { name: 'batch-grill-me', version: '1.0.1', sourceHash: PINNED_GRILL_HASH }],
  ['secret-like skill version content', { name: 'batch-grill-me', version: 'authorization: Bearer hunter2', sourceHash: PINNED_GRILL_HASH }],
  ['secret-like source hash content', { name: 'batch-grill-me', version: '1.0.0', sourceHash: 'api_key=abc123' }],
] as const) {
  test(`record-grill rejects ${invalidIdentity[0]} before persistence`, () => {
    const fixture = createLifecycleFixture();
    const recorded = recordGrillFixture(
      fixture,
      completeGrillReceipt(fixture.taskId, { skill: invalidIdentity[1] }),
    );

    expect(recorded.result.exitCode).not.toBe(0);
    expect(recorded.result.json).toMatchObject({ operation: 'record-grill', ok: false, code: 'GRILL_RECEIPT_INVALID' });
    expect(readRunManifest(recorded.manifestPath).state).toBe('STARTED');
    expect(existsSync(join(dirname(recorded.manifestPath), 'GRILL.json'))).toBe(false);
  });
}

// Catches root task identity being treated as non-sensitive because it is checked only after parsing.
test('record-grill rejects secret-like root task identity before persistence', () => {
  const fixture = createLifecycleFixture();
  const recorded = recordGrillFixture(fixture, completeGrillReceipt('api_key=abc123'));

  expect(recorded.result.exitCode).not.toBe(0);
  expect(recorded.result.json).toMatchObject({ operation: 'record-grill', ok: false, code: 'GRILL_RECEIPT_INVALID' });
  expect(recorded.result.json.message).toContain('unredacted secret-like content at taskId');
  expect(readRunManifest(recorded.manifestPath).state).toBe('STARTED');
  expect(existsSync(join(dirname(recorded.manifestPath), 'GRILL.json'))).toBe(false);
});

// Catches retrying an already persisted proof as an illegal state transition.
test('record-grill is idempotent for an already completed matching receipt', () => {
  const fixture = createLifecycleFixture();
  const first = recordGrillFixture(fixture, completeGrillReceipt(fixture.taskId));
  expect(first.result.exitCode).toBe(0);
  const canonical = readFileSync(join(dirname(first.manifestPath), 'GRILL.json'), 'utf8');
  const retry = invokeLifecycle(['record-grill', '--run', first.manifestPath, '--receipt', first.candidatePath], fixture.env);

  expect(retry.exitCode).toBe(0);
  expect(retry.json).toMatchObject({ operation: 'record-grill', ok: true, code: 'OK' });
  expect(readRunManifest(first.manifestPath).state).toBe('GRILL_COMPLETE');
  expect(readFileSync(join(dirname(first.manifestPath), 'GRILL.json'), 'utf8')).toBe(canonical);
});

// Catches a retry rejecting the canonical receipt solely because its first write redacted prose.
test('record-grill is idempotent after canonical redaction', () => {
  const fixture = createLifecycleFixture();
  const receipt = completeGrillReceipt(fixture.taskId, {
    recommendations: ['Set api_key=abc123 before continuing.'],
  });
  const first = recordGrillFixture(fixture, receipt);
  expect(first.result.exitCode).toBe(0);
  const retry = invokeLifecycle(['record-grill', '--run', first.manifestPath, '--receipt', first.candidatePath], fixture.env);

  expect(retry.exitCode).toBe(0);
  expect(retry.json).toMatchObject({ operation: 'record-grill', ok: true, code: 'OK' });
});

// Catches canonical proof retries being treated as fresh unredacted candidates.
test('record-grill accepts its canonical redacted GRILL.json on retry without changing it', () => {
  const fixture = createLifecycleFixture();
  const first = recordGrillFixture(fixture, completeGrillReceipt(fixture.taskId, {
    recommendations: ['Set api_key=abc123 before continuing.'],
  }));
  expect(first.result.exitCode).toBe(0);
  const canonicalPath = join(dirname(first.manifestPath), 'GRILL.json');
  const canonical = readFileSync(canonicalPath, 'utf8');
  const retry = invokeLifecycle(['record-grill', '--run', first.manifestPath, '--receipt', canonicalPath], fixture.env);

  expect(retry.exitCode).toBe(0);
  expect(retry.json).toMatchObject({ operation: 'record-grill', ok: true, code: 'OK' });
  expect(readFileSync(canonicalPath, 'utf8')).toBe(canonical);
  expect(JSON.parse(canonical).redaction).toEqual({ redacted: true, fields: ['recommendations[0]'] });
});

// Catches a fresh run accepting forged redaction markers merely because they resemble canonical proof.
test('record-grill rejects forged redaction metadata at the canonical path before its first transition', () => {
  const fixture = createLifecycleFixture();
  const start = startFixture(fixture);
  expect(start.exitCode).toBe(0);
  const manifestPath = start.json.data.manifestPath as string;
  const manifest = readRunManifest(manifestPath);
  writeFileSync(manifest.grillReceiptPath, JSON.stringify(completeGrillReceipt(fixture.taskId, {
    recommendations: ['[REDACTED]'],
    redaction: { redacted: true, fields: ['recommendations[0]'] },
  }), null, 2));

  const result = invokeLifecycle(['record-grill', '--run', manifestPath, '--receipt', manifest.grillReceiptPath], fixture.env);

  expect(result.exitCode).not.toBe(0);
  expect(result.json).toMatchObject({ operation: 'record-grill', ok: false, code: 'GRILL_RECEIPT_INVALID' });
  expect(readRunManifest(manifestPath).state).toBe('STARTED');
});

// Catches persisting credentials hidden in receipt prose or under a secret-like unknown key.
test('record-grill recursively redacts secret-like content and rejects secret-like receipt keys', () => {
  const fixture = createLifecycleFixture();
  const recorded = recordGrillFixture(
    fixture,
    completeGrillReceipt(fixture.taskId, {
      rounds: [{
        questions: ['Should authorization: Bearer hunter2 be used?'],
        recommendations: ['Set api_key=abc123 before continuing.'],
        settledDecisions: ['Credentials are supplied out of band.'],
      }],
    }),
  );

  expect(recorded.result.exitCode).toBe(0);
  const canonical = JSON.parse(readFileSync(join(dirname(recorded.manifestPath), 'GRILL.json'), 'utf8'));
  expect(JSON.stringify(canonical)).not.toContain('hunter2');
  expect(JSON.stringify(canonical)).not.toContain('abc123');
  expect(canonical.redaction).toMatchObject({ redacted: true });
  expect(canonical.redaction.fields).toEqual([
    'rounds[0].questions[0]',
    'rounds[0].recommendations[0]',
  ]);

  const unsafeFixture = createLifecycleFixture();
  const unsafe = recordGrillFixture(
    unsafeFixture,
    completeGrillReceipt(unsafeFixture.taskId, { api_key: 'abc123' }),
  );
  expect(unsafe.result.exitCode).not.toBe(0);
  expect(unsafe.result.json).toMatchObject({ ok: false, code: 'GRILL_RECEIPT_INVALID' });
  expect(readRunManifest(unsafe.manifestPath).state).toBe('STARTED');
});

test('validate restarts from only persisted run state in a fresh process and is idempotent', () => {
  const fixture = createLifecycleFixture();
  const recorded = recordGrillFixture(fixture, completeGrillReceipt(fixture.taskId));
  expect(recorded.result.exitCode).toBe(0);
  const run = readRunManifest(recorded.manifestPath);

  const first = validateFixture(fixture, recorded.manifestPath, run.worktreePath);
  expect(first.exitCode).toBe(0);
  expect(first.lines).toHaveLength(1);
  expect(first.json).toMatchObject({ operation: 'validate', ok: true, code: 'OK', data: {
    taskId: fixture.taskId,
    worktreePath: run.worktreePath,
    runDirectory: run.runDirectory,
    state: 'VALIDATED',
  } });
  expect(JSON.stringify(first.json)).not.toMatch(/planner|maker/i);
  expect(readRunManifest(recorded.manifestPath).state).toBe('VALIDATED');

  const retry = validateFixture(fixture, recorded.manifestPath, run.worktreePath);
  expect(retry.exitCode).toBe(0);
  expect(retry.json).toMatchObject({ operation: 'validate', ok: true, code: 'OK' });
  expect(readRunManifest(recorded.manifestPath).state).toBe('VALIDATED');
});

test('validate fails closed for every persisted restart invariant', () => {
  const cases: Array<{
    name: string;
    mutate: (fixture: ReturnType<typeof createLifecycleFixture>, manifestPath: string) => void;
    cwd: (fixture: ReturnType<typeof createLifecycleFixture>, manifestPath: string) => string;
    code: string;
  }> = [
    { name: 'wrong current directory', mutate: () => {}, cwd: (fixture) => fixture.repo, code: 'CONTEXT_RESTART_INVALID' },
    {
      name: 'inactive durable task',
      mutate: (fixture) => writeFileSync(fixture.tasks.stateFile, 'queued\n'),
      cwd: (_fixture, manifestPath) => readRunManifest(manifestPath).worktreePath,
      code: 'CONTEXT_RESTART_INVALID',
    },
    {
      name: 'wrong canonical branch',
      mutate: (_fixture, manifestPath) => {
        const run = readRunManifest(manifestPath);
        writeRunManifest(manifestPath, { ...run, branch: 'wt/other-goal' });
      },
      cwd: (_fixture, manifestPath) => readRunManifest(manifestPath).worktreePath,
      code: 'BRANCH_IDENTITY_MISMATCH',
    },
    {
      name: 'missing canonical grill receipt',
      mutate: (_fixture, manifestPath) => rmSync(readRunManifest(manifestPath).grillReceiptPath),
      cwd: (_fixture, manifestPath) => readRunManifest(manifestPath).worktreePath,
      code: 'GRILL_RECEIPT_MISSING',
    },
    {
      name: 'wrong Treehouse lease holder',
      mutate: (fixture) => { fixture.env.TREEHOUSE_HOLDER = 'other-goal'; },
      cwd: (_fixture, manifestPath) => readRunManifest(manifestPath).worktreePath,
      code: 'LEASE_IDENTITY_MISMATCH',
    },
    {
      name: 'repository common-directory identity drift',
      mutate: (fixture, manifestPath) => {
        const run = readRunManifest(manifestPath);
        writeRunManifest(manifestPath, { ...run, gitCommonDirectory: fixture.repo });
      },
      cwd: (_fixture, manifestPath) => readRunManifest(manifestPath).worktreePath,
      code: 'LEASE_IDENTITY_MISMATCH',
    },
    {
      name: 'pool containment drift before registered-worktree use',
      mutate: (fixture, manifestPath) => {
        const run = readRunManifest(manifestPath);
        writeRunManifest(manifestPath, { ...run, poolRoot: join(fixture.repo, '.worktrees', 'wrong-pool') });
      },
      cwd: (_fixture, manifestPath) => readRunManifest(manifestPath).worktreePath,
      code: 'LEASE_OUTSIDE_REPOSITORY',
    },
    {
      name: 'invalid canonical grill receipt',
      mutate: (_fixture, manifestPath) => writeFileSync(readRunManifest(manifestPath).grillReceiptPath, '{"schemaVersion":1}\n'),
      cwd: (_fixture, manifestPath) => readRunManifest(manifestPath).worktreePath,
      code: 'GRILL_RECEIPT_INVALID',
    },
  ];

  const fixture = createLifecycleFixture();
  const recorded = recordGrillFixture(fixture, completeGrillReceipt(fixture.taskId));
  expect(recorded.result.exitCode).toBe(0);
  const canonicalManifest = readFileSync(recorded.manifestPath, 'utf8');
  const canonicalReceipt = readFileSync(readRunManifest(recorded.manifestPath).grillReceiptPath, 'utf8');
  const canonicalTaskState = readFileSync(fixture.tasks.stateFile, 'utf8');

  for (const scenario of cases) {
    writeFileSync(recorded.manifestPath, canonicalManifest);
    writeFileSync(readRunManifest(recorded.manifestPath).grillReceiptPath, canonicalReceipt);
    writeFileSync(fixture.tasks.stateFile, canonicalTaskState);
    fixture.env.TREEHOUSE_HOLDER = fixture.taskId;
    scenario.mutate(fixture, recorded.manifestPath);

    const result = validateFixture(fixture, recorded.manifestPath, scenario.cwd(fixture, recorded.manifestPath));
    expect(result.exitCode).not.toBe(0);
    expect(result.json).toMatchObject({ operation: 'validate', ok: false, code: scenario.code });
    expect(JSON.stringify(result.json)).not.toMatch(/planner|maker/i);
    expectSafeRemediation(result.json);
    expect(readRunManifest(recorded.manifestPath).state).toBe('GRILL_COMPLETE');
  }
});
