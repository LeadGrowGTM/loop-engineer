import { lstatSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { LifecycleCommandError } from './contracts';
import { runProcess, type ProcessResult } from './process';

export interface RepositoryIdentity {
  root: string;
  gitCommonDirectory: string;
  sourceHead: string;
}

function comparable(path: string): string {
  const normalized = resolve(path).replace(/[\\/]+$/, '');
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

export function samePath(left: string, right: string): boolean {
  return comparable(left) === comparable(right);
}

export function pathInside(parent: string, child: string): boolean {
  const remainder = relative(resolve(parent), resolve(child));
  return remainder.length > 0 && remainder !== '..' && !remainder.startsWith(`..${sep}`) && !isAbsolute(remainder);
}

export function assertNoReparsePath(parent: string, child: string): void {
  if (!samePath(parent, child) && !pathInside(parent, child)) {
    throw new LifecycleCommandError('LEASE_OUTSIDE_REPOSITORY', `Path is outside its required parent: ${child}`);
  }
  const remainder = relative(resolve(parent), resolve(child));
  let current = resolve(parent);
  for (const segment of remainder.split(/[\\/]/).filter(Boolean)) {
    current = resolve(current, segment);
    if (lstatSync(current).isSymbolicLink()) {
      throw new LifecycleCommandError(
        'LEASE_OUTSIDE_REPOSITORY',
        `Managed worktree containment crosses a reparse point: ${current}`,
        ['Repair the repository-local Treehouse pool through the supported setup flow.'],
      );
    }
  }
}

export async function runGit(args: string[], cwd: string): Promise<ProcessResult> {
  return runProcess('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', ...args], {
    cwd,
    timeoutMs: 30_000,
  });
}

function requireGitOutput(result: ProcessResult, action: string): string {
  if (result.timedOut || result.outputLimitExceeded || result.exitCode !== 0 || result.stdout.trim().length === 0) {
    throw new LifecycleCommandError(
      'REPOSITORY_NOT_READY',
      `${action} failed: ${(result.stderr || result.stdout).trim() || 'Git returned no usable output.'}`,
      ['Resolve the repository error and retry lifecycle start.'],
    );
  }
  return result.stdout.trim();
}

function resolveGitPath(cwd: string, value: string): string {
  return realpathSync.native(isAbsolute(value) ? value : resolve(cwd, value));
}

export async function resolveRepository(input: string, cwd = process.cwd()): Promise<RepositoryIdentity> {
  let requested: string;
  try {
    requested = realpathSync.native(resolve(cwd, input));
  } catch {
    throw new LifecycleCommandError(
      'REPOSITORY_NOT_READY',
      `Repository path does not exist: ${resolve(cwd, input)}`,
      ['Choose an existing Git repository and retry lifecycle start.'],
    );
  }
  const rootText = requireGitOutput(await runGit(['rev-parse', '--show-toplevel'], requested), 'Git repository resolution');
  const root = realpathSync.native(rootText);
  const commonText = requireGitOutput(await runGit(['rev-parse', '--git-common-dir'], root), 'Git common-directory resolution');
  const sourceHead = requireGitOutput(await runGit(['rev-parse', '--verify', 'HEAD^{commit}'], root), 'Git source-commit resolution');
  return { root, gitCommonDirectory: resolveGitPath(root, commonText), sourceHead };
}

export interface VerifiedWorktree {
  worktreePath: string;
  gitCommonDirectory: string;
  head: string;
  branch: string;
}

export async function verifyManagedWorktree(
  repository: RepositoryIdentity,
  candidate: string,
  poolRoot: string,
  expectedBranch: string,
): Promise<VerifiedWorktree> {
  const lexicalCandidate = resolve(candidate);
  if (!pathInside(poolRoot, lexicalCandidate)) {
    throw new LifecycleCommandError(
      'LEASE_OUTSIDE_REPOSITORY',
      `Treehouse lease is outside the repository-local pool: ${lexicalCandidate}`,
      ['Repair Treehouse configuration through the supported setup flow, then retry start.'],
    );
  }
  assertNoReparsePath(poolRoot, lexicalCandidate);
  const physicalPool = realpathSync.native(poolRoot);
  const worktreePath = realpathSync.native(lexicalCandidate);
  if (!pathInside(physicalPool, worktreePath)) {
    throw new LifecycleCommandError(
      'LEASE_OUTSIDE_REPOSITORY',
      `Treehouse lease resolves outside the repository-local pool: ${lexicalCandidate}`,
      ['Repair the reparse-point escape through the supported setup flow.'],
    );
  }

  const topLevel = requireGitOutput(await runGit(['rev-parse', '--show-toplevel'], worktreePath), 'Lease Git toplevel verification');
  if (!samePath(realpathSync.native(topLevel), worktreePath)) {
    throw new LifecycleCommandError('LEASE_IDENTITY_MISMATCH', 'The returned lease is not its Git worktree toplevel.');
  }
  const commonText = requireGitOutput(await runGit(['rev-parse', '--git-common-dir'], worktreePath), 'Lease Git identity verification');
  const gitCommonDirectory = resolveGitPath(worktreePath, commonText);
  if (!samePath(gitCommonDirectory, repository.gitCommonDirectory)) {
    throw new LifecycleCommandError('LEASE_IDENTITY_MISMATCH', 'The returned lease belongs to a different Git repository.');
  }
  const head = requireGitOutput(await runGit(['rev-parse', '--verify', 'HEAD^{commit}'], worktreePath), 'Lease HEAD verification');
  if (head !== repository.sourceHead) {
    throw new LifecycleCommandError('LEASE_IDENTITY_MISMATCH', 'The returned lease HEAD does not match the checked source commit.');
  }
  const branch = requireGitOutput(await runGit(['symbolic-ref', '--quiet', '--short', 'HEAD'], worktreePath), 'Lease branch verification');
  if (branch !== expectedBranch) {
    throw new LifecycleCommandError('BRANCH_IDENTITY_MISMATCH', `Expected branch ${expectedBranch}, received ${branch}.`);
  }

  const registrations = requireGitOutput(await runGit(['worktree', 'list', '--porcelain'], repository.root), 'Git worktree registration verification');
  const registered = registrations
    .split(/\r?\n/)
    .filter((line) => line.startsWith('worktree '))
    .map((line) => line.slice('worktree '.length))
    .some((path) => {
      try {
        return samePath(realpathSync.native(path), worktreePath);
      } catch {
        return false;
      }
    });
  if (!registered) {
    throw new LifecycleCommandError('LEASE_IDENTITY_MISMATCH', 'The returned lease is not registered as a repository worktree.');
  }
  return { worktreePath, gitCommonDirectory, head, branch };
}
