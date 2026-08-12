import { existsSync, realpathSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import {
  LifecycleCommandError,
  lifecycleFailure,
  lifecycleSuccess,
  type LifecycleContext,
  type LifecycleResult,
} from './contracts';
import { validateCanonicalGrillReceipt } from './grill';
import { readRunManifest, writeRunManifest, type RunManifestV1 } from './manifest';
import { processSucceeded, runProcess } from './process';
import { assertNoReparsePath, pathInside, resolveRepository, samePath, verifyManagedWorktree } from './repository';
import { decodeTaskDetail } from './tasks-axi';

const OPERATION = 'validate';
const TREEHOUSE_STATUS_PROBE = [
  '$command = Get-Command treehouse -CommandType Application,ExternalScript -ErrorAction SilentlyContinue | Select-Object -First 1',
  'if (-not $command -or -not $command.Source) { exit 127 }',
  '& $command.Source status',
  'exit $LASTEXITCODE',
].join('; ');

export interface ValidateLifecycleInput {
  runPath: string;
}

function restartInvalid(message: string): LifecycleCommandError {
  return new LifecycleCommandError(
    'CONTEXT_RESTART_INVALID',
    message,
    ['Restart from the persisted RUN.json in its recorded worktree and retry goal-lifecycle validate.'],
  );
}

function validationRemediation(remediation: string[]): string[] {
  const normalized = remediation.map((step) => step.replace(/retry (?:lifecycle )?start/gi, 'retry goal-lifecycle validate'));
  return normalized.length > 0 ? normalized : [
    'Resolve the reported restart invariant and retry goal-lifecycle validate from the persisted worktree.',
  ];
}

function assertPersistedPaths(runPath: string, run: RunManifestV1): void {
  if (!isAbsolute(runPath)) throw restartInvalid('validate requires an absolute RUN.json path.');
  if (![run.repositoryRoot, run.gitCommonDirectory, run.worktreePath, run.poolRoot, run.runDirectory, run.grillReceiptPath].every(isAbsolute)) {
    throw restartInvalid('RUN.json must contain absolute repository, worktree, artifact, and receipt paths.');
  }
  if (!samePath(runPath, join(run.runDirectory, 'RUN.json'))) {
    throw restartInvalid('The supplied RUN.json path does not match the persisted run directory.');
  }
  if (!samePath(run.grillReceiptPath, join(run.runDirectory, 'GRILL.json'))) {
    throw restartInvalid('The persisted grill receipt path does not match the run directory.');
  }
  if (!existsSync(run.grillReceiptPath)) {
    throw new LifecycleCommandError('GRILL_RECEIPT_MISSING', 'The persisted canonical grill receipt is missing.');
  }
  if (!pathInside(run.worktreePath, run.runDirectory)) {
    throw restartInvalid('The persisted run directory is not contained by its worktree.');
  }
  assertNoReparsePath(run.worktreePath, run.runDirectory);
  assertNoReparsePath(run.runDirectory, run.grillReceiptPath);
  if (run.leaseHolder !== run.taskId) throw restartInvalid('The persisted lease holder does not match the durable task ID.');
  if (run.branch !== `wt/${run.taskId}`) {
    throw new LifecycleCommandError('BRANCH_IDENTITY_MISMATCH', 'RUN.json does not contain the canonical task branch.');
  }
  if (run.state !== 'GRILL_COMPLETE' && run.state !== 'VALIDATED') {
    throw restartInvalid(`Run ${run.taskId} is not ready for validation from state ${run.state}.`);
  }
}

function assertCurrentWorktree(context: LifecycleContext, run: RunManifestV1): void {
  const cwd = context.cwd ?? process.cwd();
  try {
    if (!samePath(realpathSync.native(cwd), realpathSync.native(run.worktreePath))) {
      throw restartInvalid('validate must run with the persisted worktree as its current directory.');
    }
  } catch (error) {
    if (error instanceof LifecycleCommandError) throw error;
    throw restartInvalid('The persisted worktree is unavailable for restart validation.');
  }
}

async function assertActiveTask(run: RunManifestV1): Promise<void> {
  const result = await runProcess('tasks-axi', ['show', run.taskId, '--full'], { cwd: run.worktreePath });
  if (!processSucceeded(result)) {
    throw restartInvalid(`The durable task ${run.taskId} is not available as an active lifecycle task.`);
  }
  try {
    const task = decodeTaskDetail(result.stdout);
    if (task.id !== run.taskId || task.title !== run.title || task.state !== 'in_flight') {
      throw restartInvalid(`The durable task ${run.taskId} is not the active persisted lifecycle task.`);
    }
  } catch (error) {
    if (error instanceof LifecycleCommandError) throw error;
    throw restartInvalid(`The durable task ${run.taskId} returned malformed persisted state.`);
  }
}

async function assertRepositoryAndWorktree(run: RunManifestV1): Promise<void> {
  const repository = await resolveRepository(run.repositoryRoot, run.repositoryRoot);
  if (!samePath(repository.root, run.repositoryRoot) || !samePath(repository.gitCommonDirectory, run.gitCommonDirectory)) {
    throw new LifecycleCommandError('LEASE_IDENTITY_MISMATCH', 'The persisted repository identity no longer matches Git.');
  }
  if (repository.sourceHead !== run.sourceHead) {
    throw new LifecycleCommandError('LEASE_IDENTITY_MISMATCH', 'The persisted source commit no longer matches Git.');
  }
  await verifyManagedWorktree(repository, run.worktreePath, run.poolRoot, `wt/${run.taskId}`);
}

async function assertTreehouseLease(run: RunManifestV1): Promise<void> {
  const result = await runProcess(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-Command', TREEHOUSE_STATUS_PROBE],
    { cwd: run.worktreePath, timeoutMs: 10_000 },
  );
  if (!processSucceeded(result)) {
    throw new LifecycleCommandError('LEASE_IDENTITY_MISMATCH', 'Treehouse status could not verify the persisted lease holder.');
  }
  const expected = realpathSync.native(run.worktreePath);
  const matching = result.stdout.split(/\r?\n/).some((line) => {
    const match = /^\s*\d+\s+leased\s+(.+?)\s+\(held by ([^)]+)\)\s*$/.exec(line);
    if (!match || match[2] !== run.leaseHolder) return false;
    try {
      return samePath(realpathSync.native(match[1]), expected);
    } catch {
      return false;
    }
  });
  if (!matching) {
    throw new LifecycleCommandError('LEASE_IDENTITY_MISMATCH', 'Treehouse status does not report the persisted lease and exact holder.');
  }
}

async function validateLifecycleUnsafe(input: ValidateLifecycleInput, context: LifecycleContext): Promise<LifecycleResult> {
  const run = readRunManifest(input.runPath);
  assertPersistedPaths(input.runPath, run);
  assertCurrentWorktree(context, run);
  const receipt = validateCanonicalGrillReceipt(run.grillReceiptPath);
  if (receipt.taskId !== run.taskId) {
    throw new LifecycleCommandError('GRILL_RECEIPT_INVALID', 'The persisted grill receipt belongs to a different task.');
  }
  await assertActiveTask(run);
  await assertRepositoryAndWorktree(run);
  await assertTreehouseLease(run);
  if (run.state !== 'VALIDATED') writeRunManifest(input.runPath, { ...run, state: 'VALIDATED' });
  return lifecycleSuccess(OPERATION, `Validated restart context for ${run.taskId}.`, {
    taskId: run.taskId,
    worktreePath: run.worktreePath,
    runDirectory: run.runDirectory,
    state: 'VALIDATED',
  });
}

export async function validateLifecycle(
  input: ValidateLifecycleInput,
  context: LifecycleContext = {},
): Promise<LifecycleResult> {
  try {
    return await validateLifecycleUnsafe(input, context);
  } catch (error) {
    if (error instanceof LifecycleCommandError) {
      return lifecycleFailure(OPERATION, error.code, error.message, validationRemediation(error.remediation), error.data);
    }
    return lifecycleFailure(
      OPERATION,
      'CONTEXT_RESTART_INVALID',
      'The persisted restart context could not be verified safely.',
      ['Restart from the persisted RUN.json in its recorded worktree and retry goal-lifecycle validate.'],
    );
  }
}
