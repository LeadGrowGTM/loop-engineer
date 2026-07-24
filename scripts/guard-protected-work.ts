#!/usr/bin/env bun

import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

const SCHEMA_VERSION = 1 as const;
const VOLATILE_SNAPSHOT_PATH = '.claude/agent-context/snapshot.md';
const DEFAULT_PROTECTED_PATHS = [
  VOLATILE_SNAPSHOT_PATH,
  'scripts/launch-gnhf.ps1',
] as const;

interface CliOptions {
  operation: 'capture' | 'validate';
  repo: string;
  activeId: string;
  allowedPaths: string[];
  protectedPaths: string[];
  baselinePath?: string;
}

interface StatusEntry {
  status: string;
  path: string;
  originalPath?: string;
}

interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  changeSha256: string;
}

interface FileSystemEvidence {
  type: 'missing' | 'regular-file' | 'symbolic-link';
  contentSha256: string | null;
  executable: boolean | null;
}

interface DiffHashes {
  status: string | null;
  unstagedSha256: string;
  stagedSha256: string;
  headToWorktreeSha256: string;
  filesystem: FileSystemEvidence;
}

interface PreDirtyPath {
  path: string;
  status: string;
  unstagedSha256: string;
  unstagedHunks: DiffHunk[];
  unstagedBinary: boolean;
  untracked: boolean;
}

interface CaptureReport {
  schemaVersion: typeof SCHEMA_VERSION;
  operation: 'capture';
  outcome: 'PASS';
  repoRoot: string;
  gitRoot: string;
  activeId: string;
  allowedPaths: string[];
  branch: string;
  head: string;
  shortStatus: string[];
  stagedPaths: string[];
  protectedDiffHashes: Record<string, DiffHashes>;
  preDirtyPaths: PreDirtyPath[];
}

interface Blocker {
  code: string;
  message: string;
  paths?: string[];
}

interface ValidationReport {
  schemaVersion: typeof SCHEMA_VERSION;
  operation: 'validate';
  outcome: 'PASS' | 'BLOCKED';
  repoRoot: string;
  gitRoot: string;
  activeId: string;
  allowedPaths: string[];
  branch: string;
  head: string;
  shortStatus: string[];
  stagedPaths: string[];
  protectedDiffHashes: Record<string, DiffHashes>;
  unexpectedStagedPaths: string[];
  volatileSnapshotStaged: boolean;
  taskOnlyEvidence: TaskOnlyEvidence[];
  blockers: Blocker[];
}

interface TaskOnlyEvidence {
  path: string;
  baselineUnstagedSha256: string;
  stagedSha256: string;
  baselineHunks: DiffHunk[];
  stagedHunks: DiffHunk[];
  overlap: boolean;
  decision: 'NON_OVERLAPPING' | 'OVERLAPPING' | 'UNISOLATABLE';
}

interface RepositoryRoots {
  projectRoot: string;
  gitRoot: string;
}

interface RepositoryState {
  gitRoot: string;
  branch: string;
  head: string;
  statusEntries: StatusEntry[];
  shortStatus: string[];
  stagedPaths: string[];
  protectedDiffHashes: Record<string, DiffHashes>;
}

function usage(): string {
  return [
    'Usage:',
    '  bun scripts/guard-protected-work.ts capture --repo <path> --active-id <id> [--allowed-path <path>]... [--protected-path <path>]...',
    '  bun scripts/guard-protected-work.ts validate --repo <path> --active-id <id> --baseline <capture.json>',
    '',
    'capture prints a versioned JSON baseline. validate reads that baseline and prints PASS or BLOCKED JSON.',
  ].join('\n');
}

function parseArgs(argv: string[]): CliOptions | 'help' {
  if (argv.includes('--help') || argv.includes('-h')) return 'help';
  const operation = argv[0];
  if (operation !== 'capture' && operation !== 'validate') {
    throw new Error('First argument must be capture or validate');
  }

  let repo = '';
  let activeId = '';
  let baselinePath: string | undefined;
  const allowedPaths: string[] = [];
  const protectedPaths: string[] = [];

  for (let index = 1; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
    if (flag === '--repo') repo = value;
    else if (flag === '--active-id') activeId = value;
    else if (flag === '--allowed-path') allowedPaths.push(value);
    else if (flag === '--protected-path') protectedPaths.push(value);
    else if (flag === '--baseline') baselinePath = value;
    else throw new Error(`Unknown argument: ${flag}`);
    index += 1;
  }

  if (!repo) throw new Error('--repo is required');
  if (!activeId) throw new Error('--active-id is required');
  if (operation === 'capture' && baselinePath) throw new Error('--baseline is valid only for validate');
  if (operation === 'validate' && !baselinePath) throw new Error('--baseline is required for validate');
  if (operation === 'validate' && (allowedPaths.length || protectedPaths.length)) {
    throw new Error('validate uses the boundary and protected paths captured in the baseline');
  }

  return { operation, repo, activeId, allowedPaths, protectedPaths, baselinePath };
}

function runGit(repo: string, args: string[]): Uint8Array {
  const command = ['git', '--no-optional-locks', '-C', repo, ...args];
  const result = Bun.spawnSync(command, {
    env: { ...process.env, GIT_LITERAL_PATHSPECS: '1', GIT_OPTIONAL_LOCKS: '0' },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString().trim();
    throw new Error(`${command.join(' ')} failed (${result.exitCode})${stderr ? `: ${stderr}` : ''}`);
  }
  return result.stdout;
}

function gitText(repo: string, args: string[]): string {
  return Buffer.from(runGit(repo, args)).toString('utf8');
}

function normalizedAbsolutePath(path: string): string {
  return resolve(path).replaceAll('\\', '/');
}

function isOutsideRoot(rootRelative: string): boolean {
  return rootRelative === '..' || rootRelative.startsWith(`..${sep}`) || isAbsolute(rootRelative);
}

function resolveRepositoryRoots(repo: string): RepositoryRoots {
  const projectRoot = resolve(repo);
  const gitRoot = resolve(gitText(projectRoot, ['rev-parse', '--show-toplevel']).trim());
  const projectFromGitRoot = relative(gitRoot, projectRoot);
  if (isOutsideRoot(projectFromGitRoot)) {
    throw new Error(`Project root must be inside the Git repository: ${repo}`);
  }
  return { projectRoot, gitRoot };
}

function resolvePathInside(root: string, input: string): string {
  if (!input || input.includes('\0')) throw new Error('Repository path must be non-empty and contain no NUL');
  const portableInput = input.replaceAll('\\', '/');
  const platformInput = portableInput.split('/').join(sep);
  const absolute = isAbsolute(platformInput)
    ? resolve(platformInput)
    : resolve(root, platformInput);
  const rootRelative = relative(root, absolute);
  if (!rootRelative || isOutsideRoot(rootRelative)) {
    throw new Error(`Path must name a file inside the repository: ${input}`);
  }
  return absolute;
}

function toGitRelativePath(gitRoot: string, absolute: string, input: string): string {
  const gitRelative = relative(gitRoot, absolute);
  if (!gitRelative || isOutsideRoot(gitRelative)) {
    throw new Error(`Path must name a file inside the repository: ${input}`);
  }
  return gitRelative.replaceAll('\\', '/');
}

function normalizeProjectPath(roots: RepositoryRoots, input: string): string {
  return toGitRelativePath(roots.gitRoot, resolvePathInside(roots.projectRoot, input), input);
}

function normalizeGitRootPath(gitRoot: string, input: string): string {
  return toGitRelativePath(gitRoot, resolvePathInside(gitRoot, input), input);
}

function normalizeGitPath(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\.\/+/, '');
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function parseStatus(output: string): StatusEntry[] {
  const records = output.split('\0');
  const entries: StatusEntry[] = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;
    if (record.length < 4 || record[2] !== ' ') {
      throw new Error(`Unexpected git status --short record: ${JSON.stringify(record)}`);
    }
    const status = record.slice(0, 2);
    const path = normalizeGitPath(record.slice(3));
    const entry: StatusEntry = { status, path };
    if (/[RC]/.test(status)) {
      const originalPath = records[index + 1];
      if (!originalPath) throw new Error(`Missing original path for renamed/copied path: ${path}`);
      entry.originalPath = normalizeGitPath(originalPath);
      index += 1;
    }
    entries.push(entry);
  }
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

function statusLines(entries: StatusEntry[]): string[] {
  return entries.map((entry) => {
    const path = entry.originalPath ? `${entry.originalPath} -> ${entry.path}` : entry.path;
    return `${entry.status} ${path}`;
  });
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === code;
}

function fileSystemEvidence(gitRoot: string, path: string): FileSystemEvidence {
  const absolute = resolve(gitRoot, path.split('/').join(sep));
  let stats: ReturnType<typeof lstatSync>;
  try {
    stats = lstatSync(absolute);
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) {
      return { type: 'missing', contentSha256: null, executable: null };
    }
    throw error;
  }

  if (stats.isFile()) {
    return {
      type: 'regular-file',
      contentSha256: sha256(readFileSync(absolute)),
      executable: (stats.mode & 0o111) !== 0,
    };
  }
  if (stats.isSymbolicLink()) {
    return {
      type: 'symbolic-link',
      contentSha256: sha256(Buffer.from(readlinkSync(absolute), 'utf8')),
      executable: null,
    };
  }
  throw new Error(`Protected path must be missing, a regular file, or a symbolic link: ${path}`);
}

function diffBytes(repoRoot: string, path: string, mode: 'unstaged' | 'staged' | 'head'): Uint8Array {
  const args = ['diff', '--binary', '--full-index', '--no-color', '--no-ext-diff', '--no-textconv'];
  if (mode === 'staged') args.push('--cached');
  if (mode === 'head') args.push('HEAD');
  args.push('--', path);
  return runGit(repoRoot, args);
}

function diffText(repoRoot: string, path: string, mode: 'unstaged' | 'staged'): string {
  const args = ['diff', '--unified=0', '--no-color', '--no-ext-diff', '--no-textconv'];
  if (mode === 'staged') args.push('--cached');
  args.push('--', path);
  return gitText(repoRoot, args);
}

function parseHunks(patch: string): DiffHunk[] {
  const pattern = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@[^\r\n]*(?:\r?\n|$)/gm;
  const matches = [...patch.matchAll(pattern)];
  return matches.map((match, index) => {
    const bodyStart = (match.index ?? 0) + match[0].length;
    const bodyEnd = matches[index + 1]?.index ?? patch.length;
    const changedLines = patch
      .slice(bodyStart, bodyEnd)
      .split(/\r?\n/)
      .filter((line) => (
        (line.startsWith('+') && !line.startsWith('+++'))
        || (line.startsWith('-') && !line.startsWith('---'))
      ));
    return {
      oldStart: Number(match[1]),
      oldLines: match[2] === undefined ? 1 : Number(match[2]),
      newStart: Number(match[3]),
      newLines: match[4] === undefined ? 1 : Number(match[4]),
      changeSha256: sha256(Buffer.from(changedLines.join('\n'))),
    };
  });
}

function hunkInterval(hunk: DiffHunk): [number, number] {
  const width = Math.max(hunk.oldLines, 1);
  return [hunk.oldStart, hunk.oldStart + width - 1];
}

function hunksOverlap(left: DiffHunk[], right: DiffHunk[]): boolean {
  return left.some((leftHunk) => {
    const [leftStart, leftEnd] = hunkInterval(leftHunk);
    return right.some((rightHunk) => {
      const [rightStart, rightEnd] = hunkInterval(rightHunk);
      return Math.max(leftStart, rightStart) <= Math.min(leftEnd, rightEnd);
    });
  });
}

function preservesHunkChanges(baseline: DiffHunk[], current: DiffHunk[]): boolean {
  const available = new Map<string, number>();
  for (const hunk of current) {
    available.set(hunk.changeSha256, (available.get(hunk.changeSha256) ?? 0) + 1);
  }
  for (const hunk of baseline) {
    const count = available.get(hunk.changeSha256) ?? 0;
    if (count === 0) return false;
    available.set(hunk.changeSha256, count - 1);
  }
  return true;
}

function isBinaryPatch(patch: string): boolean {
  return patch.includes('GIT binary patch') || patch.includes('Binary files ');
}

function hasStagedBaseline(status: string): boolean {
  return status[0] !== ' ' && status[0] !== '?';
}

function statusForPath(entries: StatusEntry[], path: string): string | null {
  return entries.find((entry) => entry.path === path)?.status ?? null;
}

function protectedHashes(
  gitRoot: string,
  paths: string[],
  statusEntries: StatusEntry[],
): Record<string, DiffHashes> {
  return Object.fromEntries(paths.map((path) => [
    path,
    {
      status: statusForPath(statusEntries, path),
      unstagedSha256: sha256(diffBytes(gitRoot, path, 'unstaged')),
      stagedSha256: sha256(diffBytes(gitRoot, path, 'staged')),
      headToWorktreeSha256: sha256(diffBytes(gitRoot, path, 'head')),
      filesystem: fileSystemEvidence(gitRoot, path),
    },
  ]));
}

function repositoryState(gitRoot: string, protectedPaths: string[]): RepositoryState {
  const statusEntries = parseStatus(gitText(gitRoot, ['status', '--short', '-z', '--untracked-files=all']));
  const stagedPaths = uniqueSorted(
    gitText(gitRoot, ['diff', '--cached', '--name-only', '--no-renames', '-z'])
      .split('\0')
      .filter(Boolean)
      .map(normalizeGitPath),
  );
  return {
    gitRoot: normalizedAbsolutePath(gitRoot),
    branch: gitText(gitRoot, ['rev-parse', '--abbrev-ref', 'HEAD']).trim(),
    head: gitText(gitRoot, ['rev-parse', 'HEAD']).trim(),
    statusEntries,
    shortStatus: statusLines(statusEntries),
    stagedPaths,
    protectedDiffHashes: protectedHashes(gitRoot, protectedPaths, statusEntries),
  };
}

function capturePreDirtyPaths(repoRoot: string, entries: StatusEntry[]): PreDirtyPath[] {
  return entries.map((entry) => {
    const untracked = entry.status === '??';
    const unstagedPatch = untracked ? '' : diffText(repoRoot, entry.path, 'unstaged');
    return {
      path: entry.path,
      status: entry.status,
      unstagedSha256: sha256(Buffer.from(unstagedPatch)),
      unstagedHunks: parseHunks(unstagedPatch),
      unstagedBinary: isBinaryPatch(unstagedPatch),
      untracked,
    };
  });
}

function capture(options: CliOptions): CaptureReport {
  const roots = resolveRepositoryRoots(options.repo);
  const allowedPaths = uniqueSorted(options.allowedPaths.map((path) => normalizeProjectPath(roots, path)));
  const protectedPaths = uniqueSorted([
    ...DEFAULT_PROTECTED_PATHS.map((path) => normalizeProjectPath(roots, path)),
    ...options.protectedPaths.map((path) => normalizeProjectPath(roots, path)),
  ]);
  // The volatile snapshot path is hard-blocked from staging unconditionally
  // (VOLATILE_SNAPSHOT_STAGED, independent of the allowed boundary), so allowing
  // it does not weaken guarding. Any other protected path passed as an allowed
  // path would otherwise be silently exempted from PROTECTED_PATH_CHANGED.
  const volatileSnapshotPath = normalizeProjectPath(roots, VOLATILE_SNAPSHOT_PATH);
  const allowedProtectedOverlap = protectedPaths.filter(
    (path) => path !== volatileSnapshotPath && allowedPaths.includes(path),
  );
  if (allowedProtectedOverlap.length) {
    throw new Error(`Protected paths cannot also be allowed paths: ${allowedProtectedOverlap.join(', ')}`);
  }
  const state = repositoryState(roots.gitRoot, protectedPaths);
  return {
    schemaVersion: SCHEMA_VERSION,
    operation: 'capture',
    outcome: 'PASS',
    repoRoot: normalizedAbsolutePath(roots.projectRoot),
    gitRoot: state.gitRoot,
    activeId: options.activeId,
    allowedPaths,
    branch: state.branch,
    head: state.head,
    shortStatus: state.shortStatus,
    stagedPaths: state.stagedPaths,
    protectedDiffHashes: state.protectedDiffHashes,
    preDirtyPaths: capturePreDirtyPaths(roots.gitRoot, state.statusEntries),
  };
}

function parseBaseline(path: string): CaptureReport {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<CaptureReport>;
  if (parsed.schemaVersion !== SCHEMA_VERSION || parsed.operation !== 'capture' || parsed.outcome !== 'PASS') {
    throw new Error(`Baseline must be a schemaVersion ${SCHEMA_VERSION} capture report`);
  }
  if (
    typeof parsed.repoRoot !== 'string'
    || typeof parsed.gitRoot !== 'string'
    || typeof parsed.activeId !== 'string'
    || typeof parsed.branch !== 'string'
    || typeof parsed.head !== 'string'
    || !Array.isArray(parsed.allowedPaths)
    || !Array.isArray(parsed.preDirtyPaths)
    || !parsed.protectedDiffHashes
  ) {
    throw new Error('Baseline capture report is missing required fields');
  }
  return parsed as CaptureReport;
}

function addBlocker(blockers: Blocker[], code: string, message: string, paths?: string[]): void {
  blockers.push({ code, message, ...(paths?.length ? { paths } : {}) });
}

function validate(options: CliOptions): ValidationReport {
  const baseline = parseBaseline(options.baselinePath!);
  const roots = resolveRepositoryRoots(options.repo);
  const normalizedRepoRoot = normalizedAbsolutePath(roots.projectRoot);
  const normalizedGitRoot = normalizedAbsolutePath(roots.gitRoot);
  const baselineProtectedDiffHashes: Record<string, DiffHashes> = Object.fromEntries(
    Object.entries(baseline.protectedDiffHashes).map(([path, hashes]) => [
      normalizeGitRootPath(roots.gitRoot, path),
      hashes,
    ]),
  );
  const protectedPaths = uniqueSorted(Object.keys(baselineProtectedDiffHashes));
  const state = repositoryState(roots.gitRoot, protectedPaths);
  const allowedPaths = uniqueSorted(
    baseline.allowedPaths.map((path) => normalizeGitRootPath(roots.gitRoot, path)),
  );
  const preDirtyPaths = baseline.preDirtyPaths.map((entry) => ({
    ...entry,
    path: normalizeGitRootPath(roots.gitRoot, entry.path),
  }));
  const volatileSnapshotPath = normalizeProjectPath(roots, VOLATILE_SNAPSHOT_PATH);
  const allowed = new Set(allowedPaths);
  const blockers: Blocker[] = [];
  const taskOnlyEvidence: TaskOnlyEvidence[] = [];

  if (normalizedRepoRoot !== baseline.repoRoot || normalizedGitRoot !== baseline.gitRoot) {
    addBlocker(blockers, 'REPO_MISMATCH', 'Validation project and Git roots must match the captured repository');
  }
  if (options.activeId !== baseline.activeId) {
    addBlocker(blockers, 'ACTIVE_ID_MISMATCH', 'Active ID must exactly match the captured boundary');
  }
  if (state.branch !== baseline.branch) {
    addBlocker(blockers, 'BRANCH_CHANGED', 'Branch changed after capture');
  }
  if (state.head !== baseline.head) {
    addBlocker(blockers, 'HEAD_CHANGED', 'HEAD changed after capture');
  }

  const unexpectedStagedPaths = state.stagedPaths.filter((path) => !allowed.has(path));
  if (unexpectedStagedPaths.length) {
    addBlocker(
      blockers,
      'UNEXPECTED_STAGED_PATHS',
      'Staged paths must be an exact subset of the active ID boundary',
      unexpectedStagedPaths,
    );
  }

  const volatileSnapshotStaged = state.stagedPaths.includes(volatileSnapshotPath);
  if (volatileSnapshotStaged) {
    addBlocker(
      blockers,
      'VOLATILE_SNAPSHOT_STAGED',
      'The volatile snapshot path is never allowed in the index',
      [volatileSnapshotPath],
    );
  }

  const preDirtyByPath = new Map(preDirtyPaths.map((entry) => [entry.path, entry]));
  for (const preDirty of preDirtyPaths) {
    const path = preDirty.path;
    if (
      path === volatileSnapshotPath
      || preDirty.untracked
      || preDirty.unstagedBinary
      || preDirty.unstagedHunks.length === 0
    ) continue;
    const currentHunks = parseHunks(diffText(roots.gitRoot, path, 'unstaged'));
    if (!preservesHunkChanges(preDirty.unstagedHunks, currentHunks)) {
      addBlocker(
        blockers,
        'PRE_DIRTY_WORK_NOT_PRESERVED',
        'Work that was dirty before capture is no longer present as an unstaged hunk',
        [path],
      );
    }
  }

  for (const path of state.stagedPaths) {
    if (!allowed.has(path)) continue;
    const preDirty = preDirtyByPath.get(path);
    if (!preDirty) continue;

    const stagedPatch = diffText(roots.gitRoot, path, 'staged');
    const stagedHunks = parseHunks(stagedPatch);
    const overlap = hunksOverlap(preDirty.unstagedHunks, stagedHunks);
    const unisolatable = preDirty.untracked
      || hasStagedBaseline(preDirty.status)
      || preDirty.unstagedBinary
      || isBinaryPatch(stagedPatch)
      || preDirty.unstagedHunks.length === 0
      || stagedHunks.length === 0;
    const decision = unisolatable
      ? 'UNISOLATABLE'
      : overlap
        ? 'OVERLAPPING'
        : 'NON_OVERLAPPING';

    taskOnlyEvidence.push({
      path,
      baselineUnstagedSha256: preDirty.unstagedSha256,
      stagedSha256: sha256(Buffer.from(stagedPatch)),
      baselineHunks: preDirty.unstagedHunks,
      stagedHunks,
      overlap,
      decision,
    });

    if (unisolatable) {
      addBlocker(
        blockers,
        'UNISOLATABLE_PRE_DIRTY_PATH',
        'Task-only staging evidence cannot isolate this pre-dirty approved path',
        [path],
      );
    } else if (overlap) {
      addBlocker(
        blockers,
        'OVERLAPPING_HUNKS',
        'The staged task hunk overlaps work that was dirty before capture',
        [path],
      );
    }
  }

  for (const path of protectedPaths) {
    if (path === volatileSnapshotPath || allowed.has(path)) continue;
    const before = baselineProtectedDiffHashes[path];
    const after = state.protectedDiffHashes[path];
    if (before && after && JSON.stringify(before) !== JSON.stringify(after)) {
      addBlocker(blockers, 'PROTECTED_PATH_CHANGED', 'A protected path outside the active boundary changed after capture', [path]);
    }
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    operation: 'validate',
    outcome: blockers.length ? 'BLOCKED' : 'PASS',
    repoRoot: normalizedRepoRoot,
    gitRoot: state.gitRoot,
    activeId: options.activeId,
    allowedPaths,
    branch: state.branch,
    head: state.head,
    shortStatus: state.shortStatus,
    stagedPaths: state.stagedPaths,
    protectedDiffHashes: state.protectedDiffHashes,
    unexpectedStagedPaths,
    volatileSnapshotStaged,
    taskOnlyEvidence,
    blockers,
  };
}

function main(): void {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options === 'help') {
      console.log(usage());
      return;
    }
    const report = options.operation === 'capture' ? capture(options) : validate(options);
    console.log(JSON.stringify(report, null, 2));
    if (report.outcome === 'BLOCKED') process.exitCode = 2;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`guard-protected-work: ${message}`);
    process.exitCode = 1;
  }
}

if (import.meta.main) main();
