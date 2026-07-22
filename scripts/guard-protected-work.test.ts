import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const GUARD_PATH = join(import.meta.dir, 'guard-protected-work.ts');

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function run(command: string[], cwd?: string, stdin?: string): CommandResult {
  const result = Bun.spawnSync(command, {
    cwd,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
    stdin: stdin === undefined ? undefined : Buffer.from(stdin),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

function git(repo: string, args: string[]): string {
  const result = run(['git', '-C', repo, ...args]);
  if (result.exitCode !== 0) {
    throw new Error(`git ${args.join(' ')} failed (${result.exitCode})\n${result.stderr}`);
  }
  return result.stdout;
}

function applyCachedPatch(repo: string, patch: string): void {
  const result = run(['git', '-C', repo, 'apply', '--cached', '--unidiff-zero', '-'], undefined, patch);
  if (result.exitCode !== 0) {
    throw new Error(`git apply --cached failed (${result.exitCode})\n${result.stderr}`);
  }
}

function writeRepoFile(repo: string, relativePath: string, content: string): void {
  const path = join(repo, ...relativePath.split('/'));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function createRepo(name = 'repo'): string {
  const parent = mkdtempSync(join(tmpdir(), 'protected-work-guard-'));
  const repo = join(parent, name);
  mkdirSync(repo, { recursive: true });
  git(repo, ['init', '-b', 'guard-test']);
  git(repo, ['config', 'user.name', 'Guard Test']);
  git(repo, ['config', 'user.email', 'guard@example.test']);

  const files = {
    '.claude/agent-context/snapshot.md': 'snapshot baseline\n',
    'approved.txt': 'one\ntwo\nthree\nfour\nfive\nsix\nseven\neight\n',
    'scripts/launch-gnhf.ps1': 'Write-Output "baseline"\n',
    'unexpected.txt': 'unexpected baseline\n',
  };
  for (const [path, content] of Object.entries(files)) writeRepoFile(repo, path, content);
  git(repo, ['add', '--', ...Object.keys(files)]);
  git(repo, ['commit', '-m', 'fixture']);
  return repo;
}

function guard(args: string[]): CommandResult {
  return run([process.execPath, GUARD_PATH, ...args]);
}

function parseJson(result: CommandResult): Record<string, unknown> {
  if (!result.stdout.trim()) {
    throw new Error(`Guard returned no JSON. stderr: ${result.stderr}`);
  }
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

function saveBaseline(repo: string, result: CommandResult, name = 'baseline.json'): string {
  const path = join(dirname(repo), name);
  writeFileSync(path, result.stdout);
  return path;
}

function blockerCodes(result: CommandResult): string[] {
  const report = parseJson(result) as { blockers: Array<{ code: string }> };
  return report.blockers.map((blocker) => blocker.code);
}

function repositoryFingerprint(repo: string): Record<string, unknown> {
  const watchedPaths = [
    '.claude/agent-context/snapshot.md',
    'approved.txt',
    'scripts/launch-gnhf.ps1',
    'unexpected.txt',
  ];
  return {
    branch: git(repo, ['rev-parse', '--abbrev-ref', 'HEAD']),
    head: git(repo, ['rev-parse', 'HEAD']),
    status: git(repo, ['status', '--short', '-z', '--untracked-files=all']),
    indexEntries: git(repo, ['ls-files', '--stage', '-z']),
    stagedDiff: git(repo, ['diff', '--cached', '--binary', '--no-ext-diff']),
    worktreeDiff: git(repo, ['diff', '--binary', '--no-ext-diff']),
    indexSha256: createHash('sha256').update(readFileSync(join(repo, '.git', 'index'))).digest('hex'),
    contents: Object.fromEntries(watchedPaths.map((path) => [
      path,
      readFileSync(join(repo, ...path.split('/'))).toString('base64'),
    ])),
  };
}

describe('guard-protected-work CLI', () => {
  test('captures and validates a clean repository', () => {
    const repo = createRepo();
    const captured = guard([
      'capture',
      '--repo', repo,
      '--active-id', 'C24',
      '--allowed-path', 'approved.txt',
    ]);

    expect(captured.exitCode).toBe(0);
    const baseline = parseJson(captured);
    expect(baseline).toMatchObject({
      schemaVersion: 1,
      operation: 'capture',
      outcome: 'PASS',
      activeId: 'C24',
      branch: 'guard-test',
      shortStatus: [],
      stagedPaths: [],
    });

    const baselinePath = join(dirname(repo), 'baseline.json');
    writeFileSync(baselinePath, captured.stdout);
    const validated = guard([
      'validate',
      '--repo', repo,
      '--active-id', 'C24',
      '--baseline', baselinePath,
    ]);

    expect(validated.exitCode).toBe(0);
    expect(parseJson(validated)).toMatchObject({
      schemaVersion: 1,
      operation: 'validate',
      outcome: 'PASS',
      activeId: 'C24',
      stagedPaths: [],
      blockers: [],
    });
  });

  test('captures hashes for protected dirty work without changing it', () => {
    const repo = createRepo();
    writeRepoFile(repo, 'scripts/launch-gnhf.ps1', 'Write-Output "user work"\n');

    const captured = guard([
      'capture',
      '--repo', repo,
      '--active-id', 'C24',
      '--allowed-path', 'approved.txt',
    ]);

    expect(captured.exitCode).toBe(0);
    const report = parseJson(captured) as {
      shortStatus: string[];
      protectedDiffHashes: Record<string, { unstagedSha256: string }>;
    };
    expect(report.shortStatus).toContain(' M scripts/launch-gnhf.ps1');
    expect(report.protectedDiffHashes['scripts/launch-gnhf.ps1'].unstagedSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(report.protectedDiffHashes['scripts/launch-gnhf.ps1'].unstagedSha256).not.toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(git(repo, ['diff', '--', 'scripts/launch-gnhf.ps1'])).toContain('user work');
  });

  test('blocks an unexpected staged path outside the exact active ID boundary', () => {
    const repo = createRepo();
    const captured = guard([
      'capture',
      '--repo', repo,
      '--active-id', 'C24',
      '--allowed-path', 'approved.txt',
    ]);
    expect(captured.exitCode).toBe(0);
    const baselinePath = saveBaseline(repo, captured);

    writeRepoFile(repo, 'unexpected.txt', 'unexpected task edit\n');
    git(repo, ['add', '--', 'unexpected.txt']);
    const validated = guard([
      'validate',
      '--repo', repo,
      '--active-id', 'C24',
      '--baseline', baselinePath,
    ]);

    expect(validated.exitCode).toBe(2);
    expect(parseJson(validated)).toMatchObject({
      outcome: 'BLOCKED',
      unexpectedStagedPaths: ['unexpected.txt'],
    });
    expect(blockerCodes(validated)).toContain('UNEXPECTED_STAGED_PATHS');
  });

  test('blocks the volatile snapshot even when it appears in the allowed boundary', () => {
    const repo = createRepo();
    const captured = guard([
      'capture',
      '--repo', repo,
      '--active-id', 'C24',
      '--allowed-path', '.claude/agent-context/snapshot.md',
    ]);
    expect(captured.exitCode).toBe(0);
    const baselinePath = saveBaseline(repo, captured);

    writeRepoFile(repo, '.claude/agent-context/snapshot.md', 'volatile update\n');
    git(repo, ['add', '--', '.claude/agent-context/snapshot.md']);
    const validated = guard([
      'validate',
      '--repo', repo,
      '--active-id', 'C24',
      '--baseline', baselinePath,
    ]);

    expect(validated.exitCode).toBe(2);
    expect(parseJson(validated)).toMatchObject({
      outcome: 'BLOCKED',
      volatileSnapshotStaged: true,
      unexpectedStagedPaths: [],
    });
    expect(blockerCodes(validated)).toContain('VOLATILE_SNAPSHOT_STAGED');
  });

  test('passes when every staged path belongs to the active ID boundary', () => {
    const repo = createRepo();
    const captured = guard([
      'capture',
      '--repo', repo,
      '--active-id', 'C24',
      '--allowed-path', 'approved.txt',
    ]);
    expect(captured.exitCode).toBe(0);
    const baselinePath = saveBaseline(repo, captured);

    writeRepoFile(repo, 'approved.txt', 'approved task edit\n');
    git(repo, ['add', '--', 'approved.txt']);
    const validated = guard([
      'validate',
      '--repo', repo,
      '--active-id', 'C24',
      '--baseline', baselinePath,
    ]);

    expect(validated.exitCode).toBe(0);
    expect(parseJson(validated)).toMatchObject({
      outcome: 'PASS',
      stagedPaths: ['approved.txt'],
      unexpectedStagedPaths: [],
      volatileSnapshotStaged: false,
      blockers: [],
    });
  });

  test('requires an exact active ID match rather than a prefix match', () => {
    const repo = createRepo();
    const captured = guard([
      'capture',
      '--repo', repo,
      '--active-id', 'C2',
      '--allowed-path', 'approved.txt',
    ]);
    expect(captured.exitCode).toBe(0);
    const baselinePath = saveBaseline(repo, captured);

    const validated = guard([
      'validate',
      '--repo', repo,
      '--active-id', 'C24',
      '--baseline', baselinePath,
    ]);

    expect(validated.exitCode).toBe(2);
    expect(blockerCodes(validated)).toContain('ACTIVE_ID_MISMATCH');
  });

  test('emits task-only evidence for a non-overlapping staged hunk on a pre-dirty approved file', () => {
    const repo = createRepo();
    const userDirtyContent = 'one\ntwo user\nthree\nfour\nfive\nsix\nseven\neight\n';
    writeRepoFile(repo, 'approved.txt', userDirtyContent);
    const captured = guard([
      'capture',
      '--repo', repo,
      '--active-id', 'C24',
      '--allowed-path', 'approved.txt',
    ]);
    expect(captured.exitCode).toBe(0);
    const baselinePath = saveBaseline(repo, captured);

    writeRepoFile(repo, 'approved.txt', userDirtyContent.replace('seven', 'seven task'));
    applyCachedPatch(repo, [
      'diff --git a/approved.txt b/approved.txt',
      '--- a/approved.txt',
      '+++ b/approved.txt',
      '@@ -7 +7 @@',
      '-seven',
      '+seven task',
      '',
    ].join('\n'));
    const validated = guard([
      'validate',
      '--repo', repo,
      '--active-id', 'C24',
      '--baseline', baselinePath,
    ]);

    expect(validated.exitCode).toBe(0);
    expect(parseJson(validated)).toMatchObject({
      outcome: 'PASS',
      taskOnlyEvidence: [{
        path: 'approved.txt',
        overlap: false,
        decision: 'NON_OVERLAPPING',
        baselineHunks: [{ oldStart: 2, oldLines: 1 }],
        stagedHunks: [{ oldStart: 7, oldLines: 1 }],
      }],
      blockers: [],
    });
  });

  test('returns BLOCKED when task-only staging no longer preserves the pre-dirty hunk', () => {
    const repo = createRepo();
    writeRepoFile(repo, 'approved.txt', 'one\ntwo user\nthree\nfour\nfive\nsix\nseven\neight\n');
    const captured = guard([
      'capture',
      '--repo', repo,
      '--active-id', 'C24',
      '--allowed-path', 'approved.txt',
    ]);
    expect(captured.exitCode).toBe(0);
    const baselinePath = saveBaseline(repo, captured);

    writeRepoFile(repo, 'approved.txt', 'one\ntwo\nthree\nfour\nfive\nsix\nseven task\neight\n');
    applyCachedPatch(repo, [
      'diff --git a/approved.txt b/approved.txt',
      '--- a/approved.txt',
      '+++ b/approved.txt',
      '@@ -7 +7 @@',
      '-seven',
      '+seven task',
      '',
    ].join('\n'));
    const validated = guard([
      'validate',
      '--repo', repo,
      '--active-id', 'C24',
      '--baseline', baselinePath,
    ]);

    expect(validated.exitCode).toBe(2);
    expect(blockerCodes(validated)).toContain('PRE_DIRTY_WORK_NOT_PRESERVED');
  });

  test('returns BLOCKED when a staged task hunk overlaps pre-dirty approved work', () => {
    const repo = createRepo();
    writeRepoFile(repo, 'approved.txt', 'one\ntwo user\nthree\nfour\nfive\nsix\nseven\neight\n');
    const captured = guard([
      'capture',
      '--repo', repo,
      '--active-id', 'C24',
      '--allowed-path', 'approved.txt',
    ]);
    expect(captured.exitCode).toBe(0);
    const baselinePath = saveBaseline(repo, captured);

    writeRepoFile(repo, 'approved.txt', 'one\ntwo task\nthree\nfour\nfive\nsix\nseven\neight\n');
    applyCachedPatch(repo, [
      'diff --git a/approved.txt b/approved.txt',
      '--- a/approved.txt',
      '+++ b/approved.txt',
      '@@ -2 +2 @@',
      '-two',
      '+two task',
      '',
    ].join('\n'));
    const validated = guard([
      'validate',
      '--repo', repo,
      '--active-id', 'C24',
      '--baseline', baselinePath,
    ]);

    expect(validated.exitCode).toBe(2);
    expect(parseJson(validated)).toMatchObject({
      outcome: 'BLOCKED',
      taskOnlyEvidence: [{
        path: 'approved.txt',
        overlap: true,
        decision: 'OVERLAPPING',
      }],
    });
    expect(blockerCodes(validated)).toContain('OVERLAPPING_HUNKS');
  });

  test('returns BLOCKED when pre-dirty approved work has no isolatable hunks', () => {
    const repo = createRepo();
    writeRepoFile(repo, 'new-approved.txt', 'user content without a tracked base\n');
    const captured = guard([
      'capture',
      '--repo', repo,
      '--active-id', 'C24',
      '--allowed-path', 'new-approved.txt',
    ]);
    expect(captured.exitCode).toBe(0);
    const baselinePath = saveBaseline(repo, captured);

    git(repo, ['add', '--', 'new-approved.txt']);
    const validated = guard([
      'validate',
      '--repo', repo,
      '--active-id', 'C24',
      '--baseline', baselinePath,
    ]);

    expect(validated.exitCode).toBe(2);
    expect(parseJson(validated)).toMatchObject({
      outcome: 'BLOCKED',
      taskOnlyEvidence: [{
        path: 'new-approved.txt',
        decision: 'UNISOLATABLE',
      }],
    });
    expect(blockerCodes(validated)).toContain('UNISOLATABLE_PRE_DIRTY_PATH');
  });

  test('supports a nested canonical pipeline root and paths with spaces', () => {
    const gitRoot = createRepo('workspace with spaces');
    const projectRoot = join(gitRoot, 'pipelines', 'content');
    const projectRelativePath = 'src/task file.txt';
    const gitRelativePath = 'pipelines/content/src/task file.txt';
    writeRepoFile(projectRoot, projectRelativePath, 'nested baseline\n');
    git(gitRoot, ['add', '--', gitRelativePath]);
    git(gitRoot, ['commit', '-m', 'add nested pipeline file']);

    const captured = guard([
      'capture',
      '--repo', projectRoot,
      '--active-id', 'C24',
      '--allowed-path', projectRelativePath,
    ]);

    expect(captured.exitCode).toBe(0);
    const report = parseJson(captured) as {
      repoRoot: string;
      gitRoot: string;
      allowedPaths: string[];
      protectedDiffHashes: Record<string, unknown>;
    };
    expect(report.repoRoot).toBe(resolve(projectRoot).replaceAll('\\', '/'));
    expect(report.gitRoot).toBe(resolve(gitRoot).replaceAll('\\', '/'));
    expect(report.allowedPaths).toEqual([gitRelativePath]);
    expect(Object.keys(report.protectedDiffHashes)).toEqual([
      'pipelines/content/.claude/agent-context/snapshot.md',
      'pipelines/content/scripts/launch-gnhf.ps1',
    ]);
    const baselinePath = saveBaseline(gitRoot, captured);

    writeRepoFile(projectRoot, projectRelativePath, 'nested task edit\n');
    git(gitRoot, ['add', '--', gitRelativePath]);
    const validated = guard([
      'validate',
      '--repo', projectRoot,
      '--active-id', 'C24',
      '--baseline', baselinePath,
    ]);

    expect(validated.exitCode).toBe(0);
    expect(parseJson(validated)).toMatchObject({
      outcome: 'PASS',
      repoRoot: resolve(projectRoot).replaceAll('\\', '/'),
      gitRoot: resolve(gitRoot).replaceAll('\\', '/'),
      allowedPaths: [gitRelativePath],
      stagedPaths: [gitRelativePath],
      blockers: [],
    });
  });

  test('blocks an overwrite of an existing untracked explicitly protected file', () => {
    const repo = createRepo();
    const protectedPath = 'protected existing.txt';
    const originalContent = 'protected user content\n';
    writeRepoFile(repo, protectedPath, originalContent);

    const captured = guard([
      'capture',
      '--repo', repo,
      '--active-id', 'C24',
      '--allowed-path', 'approved.txt',
      '--protected-path', protectedPath,
    ]);

    expect(captured.exitCode).toBe(0);
    const report = parseJson(captured) as {
      protectedDiffHashes: Record<string, {
        status: string | null;
        filesystem: {
          type: string;
          contentSha256: string | null;
          executable: boolean | null;
        };
      }>;
    };
    expect(report.protectedDiffHashes[protectedPath]).toMatchObject({
      status: '??',
      filesystem: {
        type: 'regular-file',
        contentSha256: createHash('sha256').update(originalContent).digest('hex'),
      },
    });
    const baselinePath = saveBaseline(repo, captured);

    writeRepoFile(repo, protectedPath, 'overwritten protected content\n');
    writeRepoFile(repo, 'approved.txt', 'approved task edit\n');
    git(repo, ['add', '--', 'approved.txt']);
    const validated = guard([
      'validate',
      '--repo', repo,
      '--active-id', 'C24',
      '--baseline', baselinePath,
    ]);

    expect(validated.exitCode).toBe(2);
    expect(parseJson(validated)).toMatchObject({
      outcome: 'BLOCKED',
      stagedPaths: ['approved.txt'],
      unexpectedStagedPaths: [],
    });
    expect(blockerCodes(validated)).toContain('PROTECTED_PATH_CHANGED');
  });

  test('handles repository and allowed file paths with spaces as normalized repo-relative paths', () => {
    const repo = createRepo('repo with spaces');
    const relativePath = 'dir with spaces/file name.txt';
    writeRepoFile(repo, relativePath, 'space baseline\n');
    git(repo, ['add', '--', relativePath]);
    git(repo, ['commit', '-m', 'add spaced path']);

    const captured = guard([
      'capture',
      '--repo', repo,
      '--active-id', 'C24',
      '--allowed-path', join(repo, 'dir with spaces', 'file name.txt'),
    ]);
    expect(captured.exitCode).toBe(0);
    expect(parseJson(captured)).toMatchObject({
      repoRoot: resolve(repo).replaceAll('\\', '/'),
      allowedPaths: [relativePath],
    });
    const baselinePath = saveBaseline(repo, captured);

    writeRepoFile(repo, relativePath, 'space task edit\n');
    git(repo, ['add', '--', relativePath]);
    const validated = guard([
      'validate',
      '--repo', repo,
      '--active-id', 'C24',
      '--baseline', baselinePath,
    ]);

    expect(validated.exitCode).toBe(0);
    expect(parseJson(validated)).toMatchObject({
      outcome: 'PASS',
      stagedPaths: [relativePath],
      blockers: [],
    });
  });

  test('capture and validate leave HEAD, index, and worktree bytes unchanged', () => {
    const repo = createRepo();
    writeRepoFile(repo, 'scripts/launch-gnhf.ps1', 'Write-Output "pre-existing user work"\n');

    const beforeCapture = repositoryFingerprint(repo);
    const captured = guard([
      'capture',
      '--repo', repo,
      '--active-id', 'C24',
      '--allowed-path', 'approved.txt',
    ]);
    expect(captured.exitCode).toBe(0);
    expect(repositoryFingerprint(repo)).toEqual(beforeCapture);
    const baselinePath = saveBaseline(repo, captured);

    writeRepoFile(repo, 'approved.txt', 'approved staged task edit\n');
    git(repo, ['add', '--', 'approved.txt']);
    const beforeValidate = repositoryFingerprint(repo);
    const validated = guard([
      'validate',
      '--repo', repo,
      '--active-id', 'C24',
      '--baseline', baselinePath,
    ]);

    expect(validated.exitCode).toBe(0);
    expect(repositoryFingerprint(repo)).toEqual(beforeValidate);
  });
});
