import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LifecycleCommandError,
  lifecycleFailure,
  lifecycleSuccess,
  type LifecycleContext,
  type LifecycleResult,
} from './contracts';
import { writeRunManifest, type RunManifestV1 } from './manifest';
import { runProcess, type ProcessResult } from './process';
import { decodeTaskDetail, type TaskRecord } from './tasks-axi';
import {
  assertNoReparsePath,
  resolveRepository,
  runGit,
  samePath,
  verifyManagedWorktree,
} from './repository';

export const TASKS_AXI_VERSION = '0.1.1';
export const TREEHOUSE_VERSION = 'v1.8.0';
export const PINNED_BATCH_GRILL_SHA256 = '92a426f9ed319ca6f54ecf8fabe8c57f82e42dd71e7e5a2d11415fb6f903557f';

export interface StartLifecycleInput {
  repo: string;
  taskId: string;
  title: string;
}

interface ReadinessResult {
  status?: unknown;
  readyForRun?: unknown;
  checkedHead?: unknown;
  poolRoot?: unknown;
  leasePath?: unknown;
  leaseHolder?: unknown;
  runBranch?: unknown;
  runPath?: unknown;
  errorCodes?: unknown;
  errors?: unknown;
}

const PREPARE_SCRIPT = fileURLToPath(new URL('../prepare-harness-run.ps1', import.meta.url));
const TREEHOUSE_VERSION_PROBE = [
  '$command = Get-Command treehouse -CommandType Application,ExternalScript -ErrorAction SilentlyContinue | Select-Object -First 1',
  'if (-not $command -or -not $command.Source) { exit 127 }',
  '& $command.Source --version',
  'exit $LASTEXITCODE',
].join('; ');

function dependencyFailure(name: string, detail: string): LifecycleCommandError {
  return new LifecycleCommandError(
    'DEPENDENCY_SETUP_REQUIRED',
    `${name} is not the required lifecycle dependency: ${detail}`,
    ['Run the supported setup/onboarding flow, verify dependencies, then retry lifecycle start.'],
    { dependency: name },
  );
}

function processSucceeded(result: ProcessResult): boolean {
  return !result.timedOut && !result.outputLimitExceeded && result.exitCode === 0;
}

async function doctorDependencies(repositoryRoot: string): Promise<void> {
  let tasks: ProcessResult;
  try {
    tasks = await runProcess('tasks-axi', ['--version'], { cwd: repositoryRoot, timeoutMs: 10_000 });
  } catch (error) {
    throw dependencyFailure('tasks-axi', error instanceof Error ? error.message : 'launcher failed');
  }
  if (!processSucceeded(tasks) || tasks.stdout.trim() !== TASKS_AXI_VERSION) {
    throw dependencyFailure('tasks-axi', (tasks.stderr || tasks.stdout).trim() || `expected ${TASKS_AXI_VERSION}`);
  }

  const treehouse = await runProcess(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-Command', TREEHOUSE_VERSION_PROBE],
    { cwd: repositoryRoot, timeoutMs: 10_000 },
  );
  if (!processSucceeded(treehouse) || treehouse.stdout.trim() !== TREEHOUSE_VERSION) {
    throw dependencyFailure('Treehouse', (treehouse.stderr || treehouse.stdout).trim() || `expected ${TREEHOUSE_VERSION}`);
  }

  const userHome = process.env.USERPROFILE || process.env.HOME;
  if (!userHome) throw dependencyFailure('batch-grill-me', 'the supported user skill directory is unavailable');
  const grillPath = join(userHome, '.claude', 'skills', 'batch-grill-me', 'SKILL.md');
  try {
    if (lstatSync(grillPath).isSymbolicLink()) throw new Error('the installed skill is a reparse point');
    const hash = createHash('sha256').update(readFileSync(grillPath)).digest('hex');
    if (hash !== PINNED_BATCH_GRILL_SHA256) throw new Error('the installed skill has drifted from the pinned source');
  } catch (error) {
    throw dependencyFailure('batch-grill-me', error instanceof Error ? error.message : 'skill verification failed');
  }
}

async function inspectTask(repositoryRoot: string, taskId: string): Promise<TaskRecord | undefined> {
  const result = await runProcess('tasks-axi', ['show', taskId, '--full'], { cwd: repositoryRoot });
  if (!processSucceeded(result)) {
    const detail = `${result.stderr}\n${result.stdout}`;
    if (/\bNOT_FOUND\b/.test(detail)) return undefined;
    throw new LifecycleCommandError(
      'TASK_REGISTRATION_FAILED',
      `Unable to inspect tasks-axi identity ${taskId}: ${detail.trim() || 'command failed'}`,
      ['Repair the project-local tasks-axi backlog, then retry lifecycle start.'],
    );
  }
  let task: TaskRecord;
  try {
    task = decodeTaskDetail(result.stdout);
  } catch {
    throw new LifecycleCommandError('TASK_REGISTRATION_FAILED', 'tasks-axi returned a malformed or mismatched task record.');
  }
  if (task.id !== taskId) {
    throw new LifecycleCommandError('TASK_REGISTRATION_FAILED', 'tasks-axi returned a malformed or mismatched task record.');
  }
  return task;
}

function assertCompatibleTask(task: TaskRecord, title: string): void {
  if (task.title !== title || (task.state !== 'queued' && task.state !== 'in_flight')) {
    throw new LifecycleCommandError(
      'TASK_STATE_CONFLICT',
      `Task ${task.id} is not a compatible queued or active task with the requested title.`,
      ['Choose the matching durable task identity or resolve its conflicting state before retrying.'],
      { taskId: task.id, taskTitle: task.title, taskState: task.state },
    );
  }
}

async function registerAndStartTask(repositoryRoot: string, taskId: string, title: string): Promise<void> {
  let task = await inspectTask(repositoryRoot, taskId);
  if (!task) {
    const added = await runProcess('tasks-axi', ['add', taskId, title], { cwd: repositoryRoot });
    if (!processSucceeded(added)) {
      throw new LifecycleCommandError('TASK_REGISTRATION_FAILED', `tasks-axi add failed: ${(added.stderr || added.stdout).trim()}`);
    }
    const started = await runProcess('tasks-axi', ['start', taskId], { cwd: repositoryRoot });
    if (!processSucceeded(started)) {
      throw new LifecycleCommandError('TASK_REGISTRATION_FAILED', `tasks-axi start failed: ${(started.stderr || started.stdout).trim()}`);
    }
    task = await inspectTask(repositoryRoot, taskId);
  } else {
    assertCompatibleTask(task, title);
    if (task.state === 'queued') {
      const started = await runProcess('tasks-axi', ['start', taskId], { cwd: repositoryRoot });
      if (!processSucceeded(started)) {
        throw new LifecycleCommandError('TASK_REGISTRATION_FAILED', `tasks-axi start failed: ${(started.stderr || started.stdout).trim()}`);
      }
      task = await inspectTask(repositoryRoot, taskId);
    }
  }
  if (!task) throw new LifecycleCommandError('TASK_REGISTRATION_FAILED', 'tasks-axi did not persist the requested task.');
  assertCompatibleTask(task, title);
  if (task.state !== 'in_flight') {
    throw new LifecycleCommandError('TASK_REGISTRATION_FAILED', `Task ${taskId} did not reach the active state.`);
  }
}

async function validateTreehouseConfiguration(repositoryRoot: string): Promise<string> {
  const poolRoot = resolve(repositoryRoot, '.worktrees');
  const configPath = join(repositoryRoot, 'treehouse.toml');
  try {
    if (lstatSync(configPath).isSymbolicLink()) throw new Error('treehouse.toml is a reparse point');
    const config = readFileSync(configPath, 'utf8');
    const roots = [...config.matchAll(/^\s*root\s*=\s*"([^"]+)"\s*(?:#.*)?$/gm)].map((match) => match[1]);
    if (roots.length !== 1) throw new Error('treehouse.toml must contain exactly one quoted root');
    if (!samePath(resolve(repositoryRoot, roots[0]), poolRoot)) throw new Error('Treehouse root is not .worktrees/');
    if (!samePath(realpathSync.native(poolRoot), poolRoot)) throw new Error('the canonical pool resolves elsewhere');
    assertNoReparsePath(repositoryRoot, poolRoot);
  } catch (error) {
    throw new LifecycleCommandError(
      'TREEHOUSE_CONFIG_UNSAFE',
      `Repository Treehouse configuration is unsafe: ${error instanceof Error ? error.message : 'verification failed'}`,
      ['Run supported setup to configure and ignore the repository-local .worktrees/ pool.'],
    );
  }
  const ignored = await runGit(['check-ignore', '--quiet', '--no-index', '--', '.worktrees/__goal-lifecycle-probe__'], repositoryRoot);
  if (!processSucceeded(ignored)) {
    throw new LifecycleCommandError(
      'TREEHOUSE_CONFIG_UNSAFE',
      '.worktrees/ is not ignored by this repository.',
      ['Run supported setup to add the canonical .worktrees/ ignore rule.'],
    );
  }
  return realpathSync.native(poolRoot);
}

function parseReadiness(result: ProcessResult): ReadinessResult {
  const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length !== 1) {
    throw new LifecycleCommandError('TREEHOUSE_LEASE_FAILED', 'Readiness did not emit exactly one JSON result.');
  }
  try {
    const parsed = JSON.parse(lines[0]);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('expected an object');
    return parsed as ReadinessResult;
  } catch (error) {
    throw new LifecycleCommandError(
      'TREEHOUSE_LEASE_FAILED',
      `Readiness emitted malformed JSON: ${error instanceof Error ? error.message : 'parse failed'}`,
    );
  }
}

function readinessFailure(readiness: ReadinessResult, processResult: ProcessResult): LifecycleCommandError {
  const codes = Array.isArray(readiness.errorCodes) ? readiness.errorCodes.filter((value): value is string => typeof value === 'string') : [];
  const errors = Array.isArray(readiness.errors) ? readiness.errors.filter((value): value is string => typeof value === 'string') : [];
  const detail = errors.join(' ') || processResult.stderr.trim() || 'Treehouse readiness failed.';
  if (codes.includes('lease_outside_pool') || /reparse point/i.test(detail)) {
    return new LifecycleCommandError('LEASE_OUTSIDE_REPOSITORY', detail);
  }
  if (codes.includes('invalid_lease') && /different repository|Git identity|common/i.test(detail)) {
    return new LifecycleCommandError('LEASE_IDENTITY_MISMATCH', detail);
  }
  if (codes.includes('invalid_treehouse_output') || codes.includes('treehouse_lease_failed')) {
    return new LifecycleCommandError('TREEHOUSE_LEASE_FAILED', detail);
  }
  return new LifecycleCommandError('REPOSITORY_NOT_READY', detail, ['Resolve the readiness errors and retry lifecycle start.']);
}

async function acquireLease(
  repositoryRoot: string,
  taskId: string,
  poolRoot: string,
): Promise<{ readiness: ReadinessResult; processResult: ProcessResult }> {
  const branch = `wt/${taskId}`;
  const processResult = await runProcess(
    'powershell',
    [
      '-NoProfile',
      '-NonInteractive',
      '-File',
      PREPARE_SCRIPT,
      '-RepoPath',
      repositoryRoot,
      '-WorkspaceRoot',
      dirname(repositoryRoot),
      '-PrepareIsolation',
      '-LeaseHolder',
      taskId,
      '-RunBranch',
      branch,
      '-RequiredPoolRoot',
      poolRoot,
    ],
    { cwd: repositoryRoot, timeoutMs: 120_000, outputLimitBytes: 5_242_880 },
  );
  const readiness = parseReadiness(processResult);
  if (!processSucceeded(processResult) || readiness.status !== 'READY' || readiness.readyForRun !== true) {
    throw readinessFailure(readiness, processResult);
  }
  return { readiness, processResult };
}

function requireReadinessString(readiness: ReadinessResult, field: keyof ReadinessResult): string {
  const value = readiness[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new LifecycleCommandError('LEASE_IDENTITY_MISMATCH', `Readiness omitted required field ${field}.`);
  }
  return value;
}

async function startLifecycleUnsafe(input: StartLifecycleInput, context: LifecycleContext): Promise<LifecycleResult> {
  const repository = await resolveRepository(input.repo, context.cwd);
  await doctorDependencies(repository.root);
  await registerAndStartTask(repository.root, input.taskId, input.title);
  const poolRoot = await validateTreehouseConfiguration(repository.root);
  const { readiness } = await acquireLease(repository.root, input.taskId, poolRoot);
  const expectedBranch = `wt/${input.taskId}`;

  if (requireReadinessString(readiness, 'leaseHolder') !== input.taskId) {
    throw new LifecycleCommandError('LEASE_IDENTITY_MISMATCH', 'Readiness returned the wrong lease holder.');
  }
  if (requireReadinessString(readiness, 'runBranch') !== expectedBranch) {
    throw new LifecycleCommandError('BRANCH_IDENTITY_MISMATCH', 'Readiness returned the wrong task branch.');
  }
  if (!samePath(requireReadinessString(readiness, 'poolRoot'), poolRoot)) {
    throw new LifecycleCommandError('LEASE_OUTSIDE_REPOSITORY', 'Readiness returned the wrong Treehouse pool.');
  }
  if (requireReadinessString(readiness, 'checkedHead') !== repository.sourceHead) {
    throw new LifecycleCommandError('LEASE_IDENTITY_MISMATCH', 'Readiness checked a different source commit.');
  }
  const leasePath = requireReadinessString(readiness, 'leasePath');
  const runPath = requireReadinessString(readiness, 'runPath');
  if (!samePath(leasePath, runPath)) {
    throw new LifecycleCommandError('LEASE_IDENTITY_MISMATCH', 'Standalone repository runPath must equal its leased worktree.');
  }
  const worktree = await verifyManagedWorktree(repository, leasePath, poolRoot, expectedBranch);
  const runDirectory = join(worktree.worktreePath, '.harness', 'goals', input.taskId);
  const manifestPath = join(runDirectory, 'RUN.json');
  const manifest: RunManifestV1 = {
    schemaVersion: 1,
    taskId: input.taskId,
    title: input.title,
    state: 'STARTED',
    repositoryRoot: repository.root,
    gitCommonDirectory: repository.gitCommonDirectory,
    worktreePath: worktree.worktreePath,
    poolRoot,
    leaseHolder: input.taskId,
    branch: expectedBranch,
    sourceHead: repository.sourceHead,
    runDirectory,
    grillReceiptPath: join(runDirectory, 'GRILL.json'),
  };
  writeRunManifest(manifestPath, manifest);
  return lifecycleSuccess('start', `Started managed lifecycle task ${input.taskId}.`, {
    taskId: input.taskId,
    repositoryRoot: repository.root,
    gitCommonDirectory: repository.gitCommonDirectory,
    worktreePath: worktree.worktreePath,
    poolRoot,
    leaseHolder: input.taskId,
    branch: expectedBranch,
    sourceHead: repository.sourceHead,
    runDirectory,
    manifestPath,
  });
}

export async function startLifecycle(
  input: StartLifecycleInput,
  context: LifecycleContext = {},
): Promise<LifecycleResult> {
  try {
    return await startLifecycleUnsafe(input, context);
  } catch (error) {
    if (error instanceof LifecycleCommandError) {
      return lifecycleFailure('start', error.code, error.message, error.remediation, error.data);
    }
    return lifecycleFailure(
      'start',
      'INTERNAL_ERROR',
      'Lifecycle start could not complete safely.',
      ['Review the repository and dependency diagnostics before retrying.'],
    );
  }
}
