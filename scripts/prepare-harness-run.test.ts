import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { delimiter, dirname, join, resolve } from 'path';

const SCRIPT = join(import.meta.dir, 'prepare-harness-run.ps1');
const LAUNCHER = join(import.meta.dir, 'launch-gnhf.ps1');
const POWERSHELL = Bun.which('pwsh') ?? Bun.which('powershell.exe') ?? Bun.which('powershell');
if (!POWERSHELL) throw new Error('PowerShell executable not found');

function run(command: string[], cwd?: string): string {
  const result = Bun.spawnSync(command, {
    cwd,
    env: process.env,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  if (result.exitCode !== 0) {
    throw new Error(
      `Command failed (${result.exitCode}): ${command.join(' ')}\nstdout: ${result.stdout.toString()}\nstderr: ${result.stderr.toString()}`,
    );
  }
  return result.stdout.toString().trim();
}

function createFeatureRepo(defaultBranch = 'main'): { workspace: string; repo: string } {
  const workspace = mkdtempSync(join(tmpdir(), 'prepare-harness-run-'));
  const repo = join(workspace, 'repos', 'repo with spaces & chars');
  mkdirSync(repo, { recursive: true });
  run(['git', 'init', '-b', defaultBranch], repo);
  run(['git', 'config', 'user.name', 'Harness Test'], repo);
  run(['git', 'config', 'user.email', 'harness-test@example.invalid'], repo);
  writeFileSync(join(repo, 'README.md'), '# fixture\n');
  run(['git', 'add', 'README.md'], repo);
  run(['git', 'commit', '-m', 'fixture'], repo);
  run(['git', 'switch', '-c', 'feature/readiness'], repo);
  return { workspace, repo };
}

function createCanonicalPipeline(): { workspace: string; pipeline: string } {
  const workspace = mkdtempSync(join(tmpdir(), 'prepare-harness-canonical-'));
  const pipeline = join(workspace, 'pipelines', 'content');
  mkdirSync(pipeline, { recursive: true });
  run(['git', 'init', '-b', 'main'], workspace);
  run(['git', 'config', 'user.name', 'Harness Test'], workspace);
  run(['git', 'config', 'user.email', 'harness-test@example.invalid'], workspace);
  writeFileSync(join(workspace, '.gitignore'), '!pipelines/content/\n');
  writeFileSync(join(pipeline, 'README.md'), '# canonical fixture\n');
  run(['git', 'add', '.gitignore', 'pipelines/content/README.md'], workspace);
  run(['git', 'commit', '-m', 'fixture'], workspace);
  run(['git', 'switch', '-c', 'feature/readiness'], workspace);
  return { workspace, pipeline };
}

function createRootRepo(defaultBranch = 'main', createFeature = true): string {
  const repo = mkdtempSync(join(tmpdir(), 'prepare-harness-root-'));
  run(['git', 'init', '-b', defaultBranch], repo);
  run(['git', 'config', 'user.name', 'Harness Test'], repo);
  run(['git', 'config', 'user.email', 'harness-test@example.invalid'], repo);
  writeFileSync(join(repo, 'README.md'), '# root fixture\n');
  run(['git', 'add', 'README.md'], repo);
  run(['git', 'commit', '-m', 'fixture'], repo);
  if (createFeature) run(['git', 'switch', '-c', 'feature/readiness'], repo);
  return repo;
}

function invokePrepareCommand(
  repo: string,
  workspace: string,
  args: string[],
  env: Record<string, string | undefined> = process.env,
) {
  return Bun.spawnSync(
    [
      POWERSHELL,
      '-NoProfile',
      '-File',
      SCRIPT,
      '-RepoPath',
      repo,
      '-WorkspaceRoot',
      workspace,
      ...args,
    ],
    {
      env,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
}

function invokePrepare(repo: string, workspace: string, extraArgs: string[] = []) {
  return invokePrepareCommand(repo, workspace, ['-CheckOnly', ...extraArgs]);
}

function fakeTreehouse(
  repo: string,
  statusBody: string[] = ['exit 0'],
  getBody: string[] = ['[Console]::Out.WriteLine($env:TREEHOUSE_LEASE)', 'exit 0'],
  startRef = 'HEAD',
): {
  env: Record<string, string | undefined>;
  calls: string;
  cwdLog: string;
  lease: string;
} {
  const root = mkdtempSync(join(tmpdir(), 'prepare-harness-treehouse-'));
  const bin = join(root, 'bin');
  const lease = join(root, 'leased worktree');
  const calls = join(root, 'treehouse-calls.txt');
  const cwdLog = join(root, 'treehouse-cwd.txt');
  mkdirSync(bin, { recursive: true });
  run(['git', 'worktree', 'add', '--detach', lease, startRef], repo);
  writeFileSync(
    join(bin, 'treehouse.ps1'),
    [
      '$command = $args[0]',
      '[System.IO.File]::AppendAllText($env:TREEHOUSE_CALLS, "$command`r`n")',
      '[System.IO.File]::AppendAllText($env:TREEHOUSE_CWD, "$($PWD.Path)`r`n")',
      'if ($command -eq "status") {',
      ...statusBody.map((line) => `  ${line}`),
      '}',
      'if ($command -eq "get") {',
      ...getBody.map((line) => `  ${line}`),
      '}',
      'if ($command -eq "return") { exit 0 }',
      'exit 2',
      '',
    ].join('\r\n'),
  );
  return {
    calls,
    cwdLog,
    lease,
    env: {
      ...process.env,
      PATH: `${bin};${process.env.PATH ?? ''}`,
      TREEHOUSE_CALLS: calls,
      TREEHOUSE_CWD: cwdLog,
      TREEHOUSE_LEASE: lease,
    },
  };
}

function fakeGnhf(): { env: Record<string, string | undefined>; marker: string } {
  const root = mkdtempSync(join(tmpdir(), 'prepare-harness-no-runner-'));
  const bin = join(root, 'bin');
  const home = join(root, 'home');
  const marker = join(root, 'runner-called.txt');
  mkdirSync(bin, { recursive: true });
  mkdirSync(home, { recursive: true });
  writeFileSync(join(bin, 'gnhf.cmd'), '@echo off\r\necho called>>"%GNHF_MARKER%"\r\n');
  return {
    marker,
    env: {
      ...process.env,
      PATH: `${bin};${process.env.PATH ?? ''}`,
      HOME: home,
      USERPROFILE: home,
      GNHF_MARKER: marker,
    },
  };
}

function withoutTreehouseEnv(): Record<string, string | undefined> {
  const treehouse = Bun.which('treehouse');
  if (!treehouse) return process.env;
  const treehouseDir = resolve(dirname(treehouse)).toLowerCase();
  const path = (process.env.PATH ?? '')
    .split(delimiter)
    .filter((entry) => resolve(entry).toLowerCase() !== treehouseDir)
    .join(delimiter);
  return { ...process.env, PATH: path };
}

describe('prepare-harness-run CLI', () => {
  test('clean feature branch returns one machine-readable READY result', () => {
    const { workspace, repo } = createFeatureRepo();

    const result = invokePrepare(repo, workspace);

    expect(result.exitCode).toBe(0);
    const stdout = result.stdout.toString().trim();
    expect(stdout.split(/\r?\n/)).toHaveLength(1);
    const readiness = JSON.parse(stdout);
    expect(readiness).toMatchObject({
      status: 'READY',
      repoPath: repo,
      branch: 'feature/readiness',
      runBranch: 'feature/readiness',
      defaultBranch: 'main',
      dirtyPaths: [],
      layoutValid: true,
      isolationRequired: false,
      isolationPrepared: false,
      runPath: repo,
      errors: [],
    });
  });

  test('dirty tree fails with exact paths and creates no commit', () => {
    const { workspace, repo } = createFeatureRepo();
    const commitsBefore = run(['git', 'rev-list', '--count', 'HEAD'], repo);
    writeFileSync(join(repo, 'dirty file.txt'), 'uncommitted\n');

    const result = invokePrepare(repo, workspace);

    expect(result.exitCode).not.toBe(0);
    const stdout = result.stdout.toString().trim();
    expect(stdout.split(/\r?\n/)).toHaveLength(1);
    const readiness = JSON.parse(stdout);
    expect(readiness.status).toBe('NOT_READY');
    expect(readiness.dirtyPaths).toEqual(['dirty file.txt']);
    expect(readiness.errors.join(' ')).toContain('Working tree is dirty');
    expect(run(['git', 'rev-list', '--count', 'HEAD'], repo)).toBe(commitsBefore);
  });

  test('default branch and detached HEAD fail with branch remediation', () => {
    const defaultFixture = createFeatureRepo();
    run(['git', 'switch', 'main'], defaultFixture.repo);
    const defaultResult = invokePrepare(defaultFixture.repo, defaultFixture.workspace);
    const defaultReadiness = JSON.parse(defaultResult.stdout.toString());
    expect(defaultResult.exitCode).not.toBe(0);
    expect(defaultReadiness.errors.join(' ')).toContain("Default branch 'main'");

    const detachedFixture = createFeatureRepo();
    run(['git', 'switch', '--detach', 'HEAD'], detachedFixture.repo);
    const detachedResult = invokePrepare(detachedFixture.repo, detachedFixture.workspace);
    const detachedReadiness = JSON.parse(detachedResult.stdout.toString());
    expect(detachedResult.exitCode).not.toBe(0);
    expect(detachedReadiness.errors.join(' ')).toContain('Detached HEAD');
  });

  test('non-repo, workspace root, and pipelines parent fail explicitly', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'prepare-harness-roots-'));
    const pipelines = join(workspace, 'pipelines');
    const nonRepo = join(workspace, 'not-a-repo');
    mkdirSync(pipelines, { recursive: true });
    mkdirSync(nonRepo, { recursive: true });

    const nonRepoResult = invokePrepare(nonRepo, workspace);
    expect(nonRepoResult.exitCode).not.toBe(0);
    expect(JSON.parse(nonRepoResult.stdout.toString()).errors.join(' ')).toContain('not inside a git repository');

    const workspaceResult = invokePrepare(workspace, workspace);
    expect(workspaceResult.exitCode).not.toBe(0);
    expect(JSON.parse(workspaceResult.stdout.toString()).errors.join(' ').toLowerCase()).toContain('workspace root');

    const pipelinesResult = invokePrepare(pipelines, workspace);
    expect(pipelinesResult.exitCode).not.toBe(0);
    expect(JSON.parse(pipelinesResult.stdout.toString()).errors.join(' ')).toContain('pipelines parent');
  });

  test('requires exactly one operation mode', () => {
    const { workspace, repo } = createFeatureRepo();

    const result = invokePrepareCommand(repo, workspace, []);

    expect(result.exitCode).not.toBe(0);
    const readiness = JSON.parse(result.stdout.toString());
    expect(readiness.errors.join(' ')).toContain('exactly one');
  });

  test('unknown default branch fails closed unless explicitly supplied', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'prepare-harness-defaults-'));
    const trunkRepo = join(workspace, 'trunk repo');
    mkdirSync(trunkRepo, { recursive: true });
    run(['git', 'init', '-b', 'trunk'], trunkRepo);
    run(['git', 'config', 'user.name', 'Harness Test'], trunkRepo);
    run(['git', 'config', 'user.email', 'harness-test@example.invalid'], trunkRepo);
    writeFileSync(join(trunkRepo, 'README.md'), '# trunk\n');
    run(['git', 'add', 'README.md'], trunkRepo);
    run(['git', 'commit', '-m', 'fixture'], trunkRepo);
    run(['git', 'switch', '-c', 'feature/readiness'], trunkRepo);

    const unknownResult = invokePrepare(trunkRepo, workspace);
    expect(unknownResult.exitCode).not.toBe(0);
    expect(JSON.parse(unknownResult.stdout.toString()).errors.join(' ')).toContain('default branch');

    const explicitResult = invokePrepare(trunkRepo, workspace, ['-DefaultBranch', 'trunk']);
    expect(explicitResult.exitCode).toBe(0);
    expect(JSON.parse(explicitResult.stdout.toString()).defaultBranch).toBe('trunk');
  });

  test('unborn HEAD fails closed', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'prepare-harness-unborn-'));
    const unbornRepo = join(workspace, 'unborn repo');
    mkdirSync(unbornRepo, { recursive: true });
    run(['git', 'init', '-b', 'main'], unbornRepo);

    const result = invokePrepare(unbornRepo, workspace);

    expect(result.exitCode).not.toBe(0);
    expect(JSON.parse(result.stdout.toString()).errors.join(' ')).toContain('committed HEAD');
  });

  test('unrelated WorkspaceRoot cannot bypass root and layout gates', () => {
    const repo = createRootRepo();
    mkdirSync(join(repo, 'pipelines', 'rogue-copy'), { recursive: true });
    writeFileSync(join(repo, 'pipelines', 'rogue-copy', 'README.md'), 'rogue\n');
    run(['git', 'add', 'pipelines/rogue-copy/README.md'], repo);
    run(['git', 'commit', '-m', 'add rogue layout'], repo);
    const unrelated = mkdtempSync(join(tmpdir(), 'prepare-harness-unrelated-'));

    const result = invokePrepare(repo, unrelated);

    expect(result.exitCode).not.toBe(0);
    expect(JSON.parse(result.stdout.toString()).errors.join(' ')).toContain('inside WorkspaceRoot');
  });

  test('reparse-point pipeline targets are rejected before canonical classification', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'prepare-harness-reparse-'));
    const external = mkdtempSync(join(tmpdir(), 'prepare-harness-external-'));
    const pipelines = join(workspace, 'pipelines');
    const target = join(pipelines, 'content');
    mkdirSync(pipelines, { recursive: true });
    writeFileSync(join(workspace, '.gitignore'), '!pipelines/content/\n');
    symlinkSync(external, target, 'junction');

    const result = invokePrepare(target, workspace);

    expect(result.exitCode).not.toBe(0);
    expect(JSON.parse(result.stdout.toString()).errors.join(' ').toLowerCase()).toContain('reparse');
  });

  test('reparse-point WorkspaceRoot is rejected before trusting aliased descendants', () => {
    const { workspace, repo } = createFeatureRepo();
    const aliasParent = mkdtempSync(join(tmpdir(), 'prepare-harness-root-alias-'));
    const workspaceAlias = join(aliasParent, 'workspace alias');
    const aliasedRepo = join(workspaceAlias, repo.slice(workspace.length + 1));
    symlinkSync(workspace, workspaceAlias, 'junction');

    const result = invokePrepare(aliasedRepo, workspaceAlias);

    expect(result.exitCode).not.toBe(0);
    const readiness = JSON.parse(result.stdout.toString());
    expect(readiness.errorCodes).toContain('workspace_reparse');
    expect(readiness.errors.join(' ').toLowerCase()).toContain('reparse');
  });

  test('pipeline layout precheck fails closed when pipelines is not a directory', () => {
    const { workspace, repo } = createFeatureRepo();
    writeFileSync(join(workspace, 'pipelines'), 'not a directory\n');

    const result = invokePrepare(repo, workspace);

    expect(result.exitCode).not.toBe(0);
    expect(JSON.parse(result.stdout.toString()).errors.join(' ')).toContain('not a directory');
  });

  test('CheckOnly disables repository fsmonitor execution', () => {
    const { workspace, repo } = createFeatureRepo();
    const hookRoot = mkdtempSync(join(tmpdir(), 'prepare-harness-fsmonitor-'));
    const marker = join(hookRoot, 'fsmonitor-called.txt');
    const hook = join(hookRoot, 'fsmonitor.cmd');
    writeFileSync(hook, `@echo off\r\necho called>>"${marker}"\r\nexit /b 0\r\n`);
    run(['git', 'config', 'core.fsmonitor', hook], repo);

    const result = invokePrepare(repo, workspace);

    expect(result.exitCode).toBe(0);
    expect(existsSync(marker)).toBe(false);
  });

  test('parallel CheckOnly verifies treehouse but refuses an unprepared run path', () => {
    const { workspace, repo } = createFeatureRepo();
    const treehouse = fakeTreehouse(repo);

    const result = invokePrepareCommand(repo, workspace, ['-CheckOnly', '-Parallel'], treehouse.env);

    expect(result.exitCode).not.toBe(0);
    const readiness = JSON.parse(result.stdout.toString());
    expect(readiness).toMatchObject({
      status: 'NOT_READY',
      readyForRun: false,
      isolationRequired: true,
      isolationPrepared: false,
      treehouseAvailable: true,
      runPath: null,
    });
    expect(readFileSync(treehouse.calls, 'utf8')).toContain('status');
    expect(readFileSync(treehouse.calls, 'utf8')).not.toContain('get');
    expect(readFileSync(treehouse.cwdLog, 'utf8').trim()).toBe(repo);
  });

  test('treehouse output beyond the cap fails closed without echoing the flood', () => {
    const { workspace, repo } = createFeatureRepo();
    const treehouse = fakeTreehouse(repo, [
      '$bytes = [System.Array]::CreateInstance([byte], 8388608)',
      '[Console]::OpenStandardOutput().Write($bytes, 0, $bytes.Length)',
      "[System.IO.File]::WriteAllText($env:TREEHOUSE_FLOOD_COMPLETED, 'completed')",
      'exit 0',
    ]);
    const floodCompleted = join(dirname(treehouse.calls), 'flood-completed.txt');
    treehouse.env.TREEHOUSE_FLOOD_COMPLETED = floodCompleted;

    const result = invokePrepareCommand(repo, workspace, ['-CheckOnly', '-Parallel'], treehouse.env);

    expect(result.exitCode).not.toBe(0);
    expect(existsSync(floodCompleted)).toBe(false);
    const stdout = result.stdout.toString().trim();
    expect(stdout.split(/\r?\n/)).toHaveLength(1);
    expect(stdout.length).toBeLessThan(4096);
    expect(stdout).not.toContain('\0'.repeat(128));
    const readiness = JSON.parse(stdout);
    expect(readiness.errorCodes).toContain('treehouse_not_ready');
    expect(readiness.errors.join(' ').toLowerCase()).toContain('output exceeded');
  });

  test('malformed successful lease output returns the identifiable lease', () => {
    const { workspace, repo } = createFeatureRepo();
    const treehouse = fakeTreehouse(repo, ['exit 0'], [
      '[Console]::Out.WriteLine($env:TREEHOUSE_LEASE)',
      '[Console]::Out.WriteLine("unexpected banner")',
      'exit 0',
    ]);

    const result = invokePrepareCommand(repo, workspace, ['-PrepareIsolation', '-Parallel'], treehouse.env);

    expect(result.exitCode).not.toBe(0);
    const readiness = JSON.parse(result.stdout.toString());
    expect(readiness.errorCodes).toContain('invalid_treehouse_output');
    expect(readiness.errors.join(' ')).toContain('Lease was returned');
    expect(readFileSync(treehouse.calls, 'utf8').trim().split(/\r?\n/)).toEqual(['get', 'return']);
  });

  test('CheckOnly cannot be combined with isolation preparation', () => {
    const { workspace, repo } = createFeatureRepo();
    const treehouse = fakeTreehouse(repo);

    const result = invokePrepareCommand(
      repo,
      workspace,
      ['-CheckOnly', '-PrepareIsolation', '-Parallel'],
      treehouse.env,
    );

    expect(result.exitCode).not.toBe(0);
    const readiness = JSON.parse(result.stdout.toString());
    expect(readiness.errors.join(' ')).toContain('cannot be combined');
    expect(existsSync(treehouse.calls)).toBe(false);
  });

  test('required isolation reports exact remediation when treehouse is unavailable', () => {
    const { workspace, repo } = createFeatureRepo();

    const result = invokePrepareCommand(repo, workspace, ['-CheckOnly', '-Parallel'], withoutTreehouseEnv());

    expect(result.exitCode).not.toBe(0);
    const readiness = JSON.parse(result.stdout.toString());
    expect(readiness.treehouseAvailable).toBe(false);
    expect(readiness.errors.join(' ')).toContain('Treehouse is required');
    expect(readiness.errors.join(' ')).toContain('Install treehouse');
  });

  test('invalid pipeline layout fails before treehouse preparation', () => {
    const { workspace, repo } = createFeatureRepo();
    mkdirSync(join(workspace, 'pipelines', 'rogue-copy'), { recursive: true });
    const treehouse = fakeTreehouse(repo);

    const result = invokePrepareCommand(repo, workspace, ['-PrepareIsolation', '-Parallel'], treehouse.env);

    expect(result.exitCode).not.toBe(0);
    const readiness = JSON.parse(result.stdout.toString());
    expect(readiness.layoutValid).toBe(false);
    expect(readiness.errors.join(' ')).toContain('Pipeline layout invalid');
    expect(existsSync(treehouse.calls)).toBe(false);
  });

  test('explicit isolation preparation creates and reports a derived branch at source HEAD', () => {
    const { workspace, repo } = createFeatureRepo();
    writeFileSync(join(repo, 'feature.txt'), 'feature commit\n');
    run(['git', 'add', 'feature.txt'], repo);
    run(['git', 'commit', '-m', 'feature fixture'], repo);
    const sourceBranch = run(['git', 'branch', '--show-current'], repo);
    const sourceHead = run(['git', 'rev-parse', 'HEAD'], repo);
    const treehouse = fakeTreehouse(repo, ['exit 0'], undefined, 'main');
    expect(run(['git', 'rev-parse', 'HEAD'], treehouse.lease)).not.toBe(sourceHead);

    const result = invokePrepareCommand(repo, workspace, ['-PrepareIsolation', '-Parallel'], treehouse.env);

    expect(result.exitCode).toBe(0);
    const readiness = JSON.parse(result.stdout.toString());
    expect(readiness).toMatchObject({
      status: 'READY',
      readyForRun: true,
      branch: sourceBranch,
      checkedHead: sourceHead,
      isolationRequired: true,
      isolationPrepared: true,
      treehouseAvailable: true,
      leasePath: treehouse.lease,
      leaseHolder: 'harness-readiness',
      runPath: treehouse.lease,
    });
    expect(readiness.runBranch).toMatch(/^harness\/harness-readiness\/feature-readiness-[0-9a-f]{12}-[0-9a-f]{8}$/);
    expect(run(['git', 'branch', '--show-current'], treehouse.lease)).toBe(readiness.runBranch);
    expect(run(['git', 'rev-parse', 'HEAD'], treehouse.lease)).toBe(sourceHead);
    expect(run(['git', 'branch', '--show-current'], repo)).toBe(sourceBranch);
    expect(run(['git', 'rev-parse', 'HEAD'], repo)).toBe(sourceHead);
    expect(readiness.returnCommand).toContain(treehouse.lease);
    expect(readFileSync(treehouse.calls, 'utf8')).toContain('get');
    expect(readFileSync(treehouse.cwdLog, 'utf8').trim()).toBe(repo);
  });

  test('derived branch creation failure returns the acquired lease', () => {
    const { workspace, repo } = createFeatureRepo();
    run(['git', 'branch', 'harness'], repo);
    const treehouse = fakeTreehouse(repo);

    const result = invokePrepareCommand(repo, workspace, ['-PrepareIsolation', '-Parallel'], treehouse.env);

    expect(result.exitCode).not.toBe(0);
    const readiness = JSON.parse(result.stdout.toString());
    expect(readiness.errorCodes).toContain('invalid_lease');
    expect(readiness.runBranch).toBeNull();
    expect(readiness.errors.join(' ')).toContain('Unable to create derived run branch');
    expect(readiness.errors.join(' ')).toContain('Lease was returned');
    expect(readFileSync(treehouse.calls, 'utf8').trim().split(/\r?\n/)).toEqual(['get', 'return']);
  });

  test('canonical monorepo pipeline requires isolation and maps prepared run path', () => {
    const { workspace, pipeline } = createCanonicalPipeline();
    const treehouse = fakeTreehouse(workspace);
    const leasedPipeline = join(treehouse.lease, 'pipelines', 'content');

    const checkResult = invokePrepareCommand(pipeline, workspace, ['-CheckOnly'], treehouse.env);
    expect(checkResult.exitCode).not.toBe(0);
    const checked = JSON.parse(checkResult.stdout.toString());
    expect(checked).toMatchObject({
      status: 'NOT_READY',
      readyForRun: false,
      isolationRequired: true,
      isolationPrepared: false,
      runPath: null,
    });
    expect(readFileSync(treehouse.calls, 'utf8')).toContain('status');

    const prepareResult = invokePrepareCommand(pipeline, workspace, ['-PrepareIsolation'], treehouse.env);
    expect(prepareResult.exitCode).toBe(0);
    const prepared = JSON.parse(prepareResult.stdout.toString());
    expect(prepared).toMatchObject({
      status: 'READY',
      readyForRun: true,
      isolationRequired: true,
      isolationPrepared: true,
      leasePath: treehouse.lease,
      runPath: leasedPipeline,
    });
    expect(prepared.runBranch).toMatch(/^harness\/harness-readiness\/feature-readiness-[0-9a-f]{12}-[0-9a-f]{8}$/);
    expect(run(['git', 'branch', '--show-current'], treehouse.lease)).toBe(prepared.runBranch);
    expect(readFileSync(treehouse.calls, 'utf8')).toContain('get');
    expect(readFileSync(treehouse.cwdLog, 'utf8').trim().split(/\r?\n/)).toEqual([workspace, workspace]);
  }, 10_000);

  test('compatibility launcher reports current-branch readiness and never invokes a runner', () => {
    const { workspace, repo } = createFeatureRepo();
    const runner = fakeGnhf();

    const result = Bun.spawnSync(
      [
        POWERSHELL,
        '-NoProfile',
        '-File',
        LAUNCHER,
        '-Objective',
        'legacy objective',
        '-StopWhen',
        'legacy stop',
        '-RepoPath',
        repo,
        '-WorkspaceRoot',
        workspace,
        '-CurrentBranch',
      ],
      { env: runner.env, stdout: 'pipe', stderr: 'pipe' },
    );

    expect(result.exitCode).toBe(0);
    const stdout = result.stdout.toString().trim();
    expect(stdout.split(/\r?\n/)).toHaveLength(1);
    const readiness = JSON.parse(stdout);
    expect(readiness).toMatchObject({
      status: 'READY',
      branch: 'feature/readiness',
      branchMode: 'current',
      repoPath: repo,
    });
    expect(existsSync(runner.marker)).toBe(false);
  });

  test('compatibility launcher forwards DefaultBranch for a trunk fixture without invoking a runner', () => {
    const { workspace, repo } = createFeatureRepo('trunk');
    const runner = fakeGnhf();

    const result = Bun.spawnSync(
      [
        POWERSHELL,
        '-NoProfile',
        '-File',
        LAUNCHER,
        '-Objective',
        'legacy objective',
        '-StopWhen',
        'legacy stop',
        '-RepoPath',
        repo,
        '-WorkspaceRoot',
        workspace,
        '-CurrentBranch',
        '-DefaultBranch',
        'trunk',
      ],
      { env: runner.env, stdout: 'pipe', stderr: 'pipe' },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr.toString()).toBe('');
    const stdout = result.stdout.toString().trim();
    expect(stdout.split(/\r?\n/)).toHaveLength(1);
    expect(JSON.parse(stdout)).toMatchObject({
      status: 'READY',
      mode: 'CHECK_ONLY',
      branch: 'feature/readiness',
      branchMode: 'current',
      defaultBranch: 'trunk',
      repoPath: repo,
    });
    expect(existsSync(runner.marker)).toBe(false);
  });
});
