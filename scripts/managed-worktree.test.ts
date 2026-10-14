import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LifecycleCommandError } from './goal-lifecycle/contracts';
import { resolveRepository, verifyManagedWorktree } from './goal-lifecycle/repository';

function git(args: string[], cwd: string): string {
  const result = Bun.spawnSync(['git', ...args], { cwd, stdout: 'pipe', stderr: 'pipe' });
  if (result.exitCode !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr.toString()}`);
  return result.stdout.toString().trim();
}

function managedWorktreeFixture() {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'managed-worktree-')));
  const repo = join(root, 'repository');
  mkdirSync(repo, { recursive: true });
  git(['init', '-b', 'main'], repo);
  git(['config', 'user.name', 'Lifecycle Test'], repo);
  git(['config', 'user.email', 'lifecycle@example.invalid'], repo);
  writeFileSync(join(repo, 'README.md'), '# fixture\n');
  git(['add', 'README.md'], repo);
  git(['commit', '-m', 'fixture'], repo);
  const pool = join(repo, '.worktrees');
  const worktree = join(pool, 'slot-1', 'repository');
  mkdirSync(join(pool, 'slot-1'), { recursive: true });
  git(['worktree', 'add', '-b', 'wt/canonical-goal', worktree, 'HEAD'], repo);
  return { repo, pool, worktree };
}

function commitProgress(worktree: string): string {
  writeFileSync(join(worktree, 'progress.txt'), 'committed task progress\n');
  git(['add', 'progress.txt'], worktree);
  git(['commit', '-m', 'committed task progress'], worktree);
  return git(['rev-parse', 'HEAD'], worktree);
}

test('restart accepts a committed descendant of the recorded source commit', async () => {
  const { repo, pool, worktree } = managedWorktreeFixture();
  const repository = await resolveRepository(repo, repo);
  const progressHead = commitProgress(worktree);

  const verified = await verifyManagedWorktree(repository, worktree, pool, 'wt/canonical-goal', true);

  expect(verified.head).toBe(progressHead);
  expect(verified.branch).toBe('wt/canonical-goal');
});

test('acquisition still requires the exact recorded source commit', async () => {
  const { repo, pool, worktree } = managedWorktreeFixture();
  const repository = await resolveRepository(repo, repo);
  commitProgress(worktree);

  const rejected = await verifyManagedWorktree(repository, worktree, pool, 'wt/canonical-goal').catch((error) => error);

  expect(rejected).toBeInstanceOf(LifecycleCommandError);
  expect((rejected as LifecycleCommandError).code).toBe('LEASE_IDENTITY_MISMATCH');
});

test('restart rejects an unrelated task HEAD on the canonical branch', async () => {
  const { repo, pool, worktree } = managedWorktreeFixture();
  const repository = await resolveRepository(repo, repo);
  commitProgress(worktree);
  const unrelated = git(['commit-tree', git(['rev-parse', 'HEAD^{tree}'], worktree), '-m', 'unrelated identity'], worktree);
  git(['update-ref', 'refs/heads/wt/canonical-goal', unrelated], worktree);

  const rejected = await verifyManagedWorktree(repository, worktree, pool, 'wt/canonical-goal', true).catch((error) => error);

  expect(rejected).toBeInstanceOf(LifecycleCommandError);
  expect((rejected as LifecycleCommandError).code).toBe('LEASE_IDENTITY_MISMATCH');
});
