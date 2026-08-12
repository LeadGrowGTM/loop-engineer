import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { basename, dirname, isAbsolute, join } from 'node:path';
import {
  LifecycleCommandError,
  lifecycleFailure,
  lifecycleSuccess,
  type LifecycleContext,
  type LifecycleResult,
} from './contracts';
import { readRunManifest, writeJsonAtomic, type RunManifestV1 } from './manifest';
import { processSucceeded, runProcess } from './process';
import { assertNoReparsePath, pathInside, resolveRepository, runGit, samePath } from './repository';
import { decodeTaskDetail } from './tasks-axi';

const OPERATION = 'finish';
const TREEHOUSE_PROBE = [
  '$command = Get-Command treehouse -CommandType Application,ExternalScript -ErrorAction SilentlyContinue | Select-Object -First 1',
  'if (-not $command -or -not $command.Source) { exit 127 }',
  '& $command.Source status',
  'exit $LASTEXITCODE',
].join('; ');
const TREEHOUSE_RETURN = [
  '$command = Get-Command treehouse -CommandType Application,ExternalScript -ErrorAction SilentlyContinue | Select-Object -First 1',
  'if (-not $command -or -not $command.Source) { exit 127 }',
  '& $command.Source return $env:GOAL_LIFECYCLE_LEASE',
  'exit $LASTEXITCODE',
].join('; ');

export interface FinishLifecycleInput {
  runPath: string;
  outcome: 'success' | 'blocked' | 'failed';
  pr?: string;
}

interface CompletionRecord {
  schemaVersion: 1;
  taskId: string;
  branch: string;
  worktreePath: string;
  repositoryRoot: string;
  gitCommonDirectory: string;
  runDirectory: string;
  leaseHolder: string;
  outcome: 'success' | 'blocked' | 'failed';
  pr?: string;
  phase: 'RETURN_PENDING';
}

function finishError(code: string, message: string): LifecycleCommandError {
  return new LifecycleCommandError(code, message, ['Resolve the recorded lifecycle safety condition, then retry goal-lifecycle finish.']);
}

function completionPath(run: RunManifestV1): string {
  return join(run.runDirectory, 'COMPLETION.json');
}

function recoveryPath(run: RunManifestV1): string {
  return join(run.runDirectory, 'RECOVERY.json');
}

function assertRunPath(runPath: string, run: RunManifestV1): void {
  if (!isAbsolute(runPath) || !samePath(runPath, join(run.runDirectory, 'RUN.json'))) {
    throw finishError('CONTEXT_RESTART_INVALID', 'finish requires the persisted absolute RUN.json path.');
  }
  if (!pathInside(run.worktreePath, run.runDirectory) || run.branch !== 'wt/' + run.taskId) {
    throw finishError('LEASE_IDENTITY_MISMATCH', 'The persisted run does not have its canonical worktree identity.');
  }
  assertNoReparsePath(run.worktreePath, run.runDirectory);
}

async function assertActiveTask(run: RunManifestV1): Promise<void> {
  const result = await runProcess('tasks-axi', ['show', run.taskId, '--full'], { cwd: run.repositoryRoot });
  if (!processSucceeded(result)) throw finishError('CONTEXT_RESTART_INVALID', 'The durable lifecycle task is unavailable.');
  let task;
  try { task = decodeTaskDetail(result.stdout); } catch { throw finishError('CONTEXT_RESTART_INVALID', 'The durable lifecycle task is malformed.'); }
  if (task.id !== run.taskId || task.title !== run.title || task.state !== 'in_flight') {
    throw finishError('TASK_STATE_CONFLICT', 'The durable lifecycle task is not active for this finish.');
  }
}

async function assertCleanCommittedDescendant(run: RunManifestV1): Promise<void> {
  const repository = await resolveRepository(run.repositoryRoot, run.repositoryRoot);
  if (!samePath(repository.gitCommonDirectory, run.gitCommonDirectory)) {
    throw finishError('LEASE_IDENTITY_MISMATCH', 'The repository common-directory identity changed.');
  }
  const status = await runGit(['status', '--porcelain=v1', '--untracked-files=all'], run.worktreePath);
  if (!processSucceeded(status) || status.stdout.trim().length > 0) {
    throw finishError('FINISH_PRECONDITION_FAILED', 'The managed worktree is not clean.');
  }
  const head = await runGit(['rev-parse', '--verify', 'HEAD^{commit}'], run.worktreePath);
  const ancestor = await runGit(['merge-base', '--is-ancestor', run.sourceHead, 'HEAD'], run.worktreePath);
  if (!processSucceeded(head) || !processSucceeded(ancestor) || head.stdout.trim() === run.sourceHead) {
    throw finishError('FINISH_PRECONDITION_FAILED', 'The task branch has no committed descendant of the recorded source commit.');
  }
  if (!existsSync(join(run.runDirectory, 'HANDOFF.md'))) {
    throw finishError('HANDOFF_MISSING', 'The required runDirectory HANDOFF.md is missing.');
  }
  assertNoReparsePath(run.runDirectory, join(run.runDirectory, 'HANDOFF.md'));
}

type LeaseState = 'exact_holder' | 'absent' | 'conflicting_holder';

async function leaseState(run: Pick<RunManifestV1, 'repositoryRoot' | 'worktreePath' | 'leaseHolder'>): Promise<LeaseState> {
  const result = await runProcess('powershell', ['-NoProfile', '-NonInteractive', '-Command', TREEHOUSE_PROBE], { cwd: run.repositoryRoot });
  if (!processSucceeded(result)) throw finishError('LEASE_IDENTITY_MISMATCH', 'Treehouse status could not verify the recorded lease.');
  let state: LeaseState = 'absent';
  for (const line of result.stdout.split(/\r?\n/).filter(Boolean)) {
    const match = /^\s*\d+\s+leased\s+(.+?)\s+\(held by ([^)]+)\)\s*$/.exec(line);
    if (!match) {
      if (/\bleased\b/i.test(line)) throw finishError('LEASE_IDENTITY_MISMATCH', 'Treehouse status is malformed.');
      continue;
    }
    if (samePath(match[1], run.worktreePath)) state = match[2] === run.leaseHolder ? 'exact_holder' : 'conflicting_holder';
  }
  return state;
}

async function commitIntent(run: RunManifestV1, record: CompletionRecord): Promise<void> {
  const path = completionPath(run);
  writeJsonAtomic(path, record);
  const relative = '.harness/goals/' + run.taskId + '/COMPLETION.json';
  const add = await runGit(['add', '--', relative], run.worktreePath);
  const commit = await runGit(['commit', '-m', 'goal-lifecycle completion intent ' + run.taskId], run.worktreePath);
  if (processSucceeded(add) && processSucceeded(commit)) return;
  const shown = await runGit(['show', 'HEAD:' + relative], run.worktreePath);
  if (processSucceeded(shown) && shown.stdout.trim() === JSON.stringify(record, null, 2)) return;
  await runGit(['restore', '--staged', '--', relative], run.worktreePath);
  if (existsSync(path)) unlinkSync(path);
  const status = await runGit(['status', '--porcelain=v1', '--untracked-files=all'], run.worktreePath);
  if (!processSucceeded(status) || status.stdout.trim().length > 0) {
    throw finishError('FINISH_PRECONDITION_FAILED', 'Completion intent failed and its exact cleanup could not restore the prior clean state.');
  }
  throw finishError('FINISH_PRECONDITION_FAILED', 'The deterministic completion intent could not be committed.');
}

async function returnExactLease(run: RunManifestV1): Promise<void> {
  if (await leaseState(run) !== 'exact_holder') throw finishError('LEASE_IDENTITY_MISMATCH', 'Treehouse does not report the exact recorded lease and holder.');
  const returned = await runProcess(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-Command', TREEHOUSE_RETURN],
    { cwd: run.repositoryRoot, env: { ...process.env, GOAL_LIFECYCLE_LEASE: run.worktreePath } },
  );
  if (!processSucceeded(returned)) throw finishError('TREEHOUSE_RETURN_FAILED', 'Treehouse could not return the exact recorded lease.');
}

async function completeTask(run: Pick<RunManifestV1, 'taskId' | 'repositoryRoot'>, pr?: string): Promise<void> {
  const args = ['done', run.taskId];
  if (pr) args.push('--pr', pr);
  const result = await runProcess('tasks-axi', args, { cwd: run.repositoryRoot });
  if (!processSucceeded(result)) {
    throw finishError('TASK_COMPLETION_PENDING', 'The lease was returned but tasks-axi completion is pending reconciliation.');
  }
}

async function reconcileCompletion(input: FinishLifecycleInput, context: LifecycleContext): Promise<LifecycleResult | undefined> {
  const taskId = basename(dirname(input.runPath));
  if (basename(input.runPath) !== 'RUN.json' || !/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/.test(taskId)) return undefined;
  const repository = await resolveRepository('.', context.cwd);
  const branch = 'wt/' + taskId;
  const shown = await runGit(['show', branch + ':.harness/goals/' + taskId + '/COMPLETION.json'], repository.root);
  if (shown.exitCode !== 0) return undefined;
  let record: CompletionRecord;
  try { record = JSON.parse(shown.stdout) as CompletionRecord; } catch {
    throw finishError('FINISH_PRECONDITION_FAILED', 'The committed completion intent is malformed.');
  }
  const requiredStringFields = ['taskId', 'branch', 'worktreePath', 'repositoryRoot', 'gitCommonDirectory', 'runDirectory', 'leaseHolder', 'outcome'] as const;
  for (const field of requiredStringFields) {
    if (typeof record[field] !== 'string' || record[field].length === 0) {
      throw finishError('FINISH_PRECONDITION_FAILED', `The committed completion intent is missing required field: ${field}.`);
    }
  }
  if (record.schemaVersion !== 1 || record.taskId !== taskId || record.branch !== branch || record.outcome !== 'success') {
    throw finishError('FINISH_PRECONDITION_FAILED', 'The completion intent does not match the persisted run identity.');
  }
  if (!samePath(record.repositoryRoot, repository.root)) {
    throw finishError('LEASE_IDENTITY_MISMATCH', 'The completion intent does not match the current repository identity.');
  }
  if ((input.pr && !record.pr) || (input.pr && record.pr && input.pr !== record.pr)) {
    throw finishError('TASK_COMPLETION_PENDING', 'The finish retry conflicts with the recorded pull-request identity.');
  }
  const task = await runProcess('tasks-axi', ['show', taskId, '--full'], { cwd: repository.root });
  if (!processSucceeded(task)) throw finishError('TASK_COMPLETION_PENDING', 'The durable task cannot be reconciled safely.');
  let detail;
  try { detail = decodeTaskDetail(task.stdout); } catch { throw finishError('TASK_COMPLETION_PENDING', 'The durable task state is malformed.'); }
  if (detail.id !== taskId) throw finishError('TASK_COMPLETION_PENDING', 'The durable task identity changed.');
  if (detail.state === 'done') return lifecycleSuccess(OPERATION, 'Lifecycle run ' + taskId + ' is already complete.', { taskId, pr: record.pr ?? null });
  if (detail.state !== 'in_flight') throw finishError('TASK_STATE_CONFLICT', 'The durable lifecycle task is not active for reconciliation.');
  const reconstructed = { taskId, title: detail.title, repositoryRoot: repository.root, worktreePath: record.worktreePath, leaseHolder: record.leaseHolder };
  const state = await leaseState(reconstructed);
  if (state === 'conflicting_holder') throw finishError('LEASE_IDENTITY_MISMATCH', 'The recorded lease is now held by a different owner.');
  if (state === 'exact_holder') {
    let run: RunManifestV1;
    try {
      run = readRunManifest(input.runPath);
    } catch {
      throw finishError('LEASE_IDENTITY_MISMATCH', 'The still-held worktree manifest is missing or corrupt; the committed completion identity is authoritative.');
    }
    assertRunPath(input.runPath, run);
    if (
      run.taskId !== record.taskId || run.branch !== record.branch ||
      !samePath(run.repositoryRoot, record.repositoryRoot) ||
      !samePath(run.gitCommonDirectory, record.gitCommonDirectory) ||
      !samePath(run.worktreePath, record.worktreePath) ||
      !samePath(run.runDirectory, record.runDirectory) ||
      run.leaseHolder !== record.leaseHolder
    ) throw finishError('LEASE_IDENTITY_MISMATCH', 'The still-held run manifest does not match the committed completion identity.');
    await assertActiveTask(run);
    await assertCleanCommittedDescendant(run);
    await returnExactLease(run);
  }
  await completeTask(reconstructed, record.pr ?? input.pr);
  return lifecycleSuccess(OPERATION, 'Reconciled lifecycle completion for ' + taskId + '.', { taskId, pr: record.pr ?? null });
}

function writeRecovery(run: RunManifestV1, outcome: 'blocked' | 'failed'): void {
  writeJsonAtomic(recoveryPath(run), {
    schemaVersion: 1,
    taskId: run.taskId,
    outcome,
    leaseRetained: true,
  });
}

async function finishUnsafe(input: FinishLifecycleInput): Promise<LifecycleResult> {
  const run = readRunManifest(input.runPath);
  assertRunPath(input.runPath, run);
  if (input.outcome !== 'success') {
    writeRecovery(run, input.outcome);
    return lifecycleSuccess(OPERATION, 'Retained lease for ' + input.outcome + ' run ' + run.taskId + '.', {
      taskId: run.taskId,
      state: input.outcome,
      recoveryPath: recoveryPath(run),
    });
  }
  if (run.state !== 'VALIDATED') throw finishError('CONTEXT_RESTART_INVALID', 'finish requires a validated run.');
  await assertActiveTask(run);
  await assertCleanCommittedDescendant(run);
  if (await leaseState(run) !== 'exact_holder') throw finishError('LEASE_IDENTITY_MISMATCH', 'Treehouse does not report the exact recorded lease and holder.');
  const record: CompletionRecord = {
    schemaVersion: 1,
    taskId: run.taskId,
    branch: run.branch,
    worktreePath: run.worktreePath,
    repositoryRoot: run.repositoryRoot,
    gitCommonDirectory: run.gitCommonDirectory,
    runDirectory: run.runDirectory,
    leaseHolder: run.leaseHolder,
    outcome: 'success',
    phase: 'RETURN_PENDING',
    ...(input.pr ? { pr: input.pr } : {}),
  };
  await commitIntent(run, record);
  await returnExactLease(run);
  await completeTask(run, input.pr);
  return lifecycleSuccess(OPERATION, 'Finished lifecycle run ' + run.taskId + '.', { taskId: run.taskId, pr: input.pr ?? null });
}

export async function finishLifecycle(input: FinishLifecycleInput, _context: LifecycleContext = {}): Promise<LifecycleResult> {
  try {
    const reconciled = await reconcileCompletion(input, _context);
    if (reconciled) return reconciled;
    return await finishUnsafe(input);
  } catch (error) {
    if (error instanceof LifecycleCommandError) return lifecycleFailure(OPERATION, error.code, error.message, error.remediation, error.data);
    return lifecycleFailure(OPERATION, 'FINISH_PRECONDITION_FAILED', 'The lifecycle finish could not complete safely.', ['Resolve the recorded lifecycle safety condition, then retry goal-lifecycle finish.']);
  }
}
