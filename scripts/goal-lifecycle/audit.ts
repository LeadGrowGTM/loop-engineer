import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  LifecycleCommandError,
  lifecycleFailure,
  lifecycleSuccess,
  type LifecycleContext,
  type LifecycleResult,
} from './contracts';
import { pathInside, resolveRepository, runGit, samePath } from './repository';
import { runProcess, type ProcessResult } from './process';

const OPERATION = 'audit';
const TREEHOUSE_STATUS = [
  '$command = Get-Command treehouse -CommandType Application,ExternalScript -ErrorAction SilentlyContinue | Select-Object -First 1',
  'if (-not $command -or -not $command.Source) { exit 127 }',
  '& $command.Source status',
  'exit $LASTEXITCODE',
].join('; ');

export interface AuditLifecycleInput { repo: string; }
export interface AuditRow {
  path: string;
  branch: string | null;
  head: string;
  dirty: boolean;
  reachable: boolean;
  manager: 'primary' | 'treehouse' | 'external';
  classification: 'primary' | 'managed' | 'MISPLACED_WORKTREE';
  suggestedCommand: string;
}

function processSucceeded(result: ProcessResult): boolean {
  return !result.timedOut && !result.outputLimitExceeded && result.exitCode === 0;
}

interface WorktreeEntry { path: string; head: string; branch: string | null; }

function parseWorktrees(output: string): WorktreeEntry[] {
  const entries: WorktreeEntry[] = [];
  for (const block of output.trim().split(/\r?\n\r?\n/).filter(Boolean)) {
    const fields = new Map<string, string>();
    for (const line of block.split(/\r?\n/)) {
      const index = line.indexOf(' ');
      if (index > 0) fields.set(line.slice(0, index), line.slice(index + 1));
    }
    const path = fields.get('worktree');
    const head = fields.get('HEAD');
    if (path && head) entries.push({ path: resolve(path), head, branch: fields.get('branch')?.replace(/^refs\/heads\//, '') ?? null });
  }
  return entries;
}

function auditError(message: string): LifecycleCommandError {
  return new LifecycleCommandError('AUDIT_FAILED', message, ['Resolve the repository inspection error, then retry goal-lifecycle audit.']);
}

async function treehouseLeases(repositoryRoot: string): Promise<Set<string>> {
  const result = await runProcess('powershell', ['-NoProfile', '-NonInteractive', '-Command', TREEHOUSE_STATUS], { cwd: repositoryRoot });
  if (!processSucceeded(result)) throw auditError('Treehouse status could not be read without mutation.');
  const leases = new Set<string>();
  for (const line of result.stdout.split(/\r?\n/)) {
    const match = /^\s*\d+\s+leased\s+(.+?)\s+\(held by [^)]+\)\s*$/.exec(line);
    if (match) leases.add(resolve(match[1]).toLowerCase());
  }
  return leases;
}

function quotePowerShell(path: string): string {
  const quote = String.fromCharCode(39);
  return quote + path.replaceAll(quote, quote + quote) + quote;
}

async function collectRow(entry: WorktreeEntry, repoRoot: string, poolRoot: string, leases: Set<string>): Promise<AuditRow> {
  const status = await runGit(['status', '--porcelain=v1', '--untracked-files=all'], entry.path);
  const ancestor = await runGit(['merge-base', '--is-ancestor', entry.head, 'HEAD'], repoRoot);
  if (!processSucceeded(status) || (ancestor.exitCode !== 0 && ancestor.exitCode !== 1)) {
    throw auditError('Git could not inspect a registered worktree without mutation.');
  }
  const primary = samePath(entry.path, repoRoot);
  const managed = !primary && pathInside(poolRoot, entry.path) && leases.has(resolve(entry.path).toLowerCase());
  const dirty = status.stdout.trim().length > 0;
  const reachable = ancestor.exitCode === 0;
  const classification: AuditRow['classification'] = primary
    ? 'primary'
    : managed
      ? 'managed'
      : 'MISPLACED_WORKTREE';
  const manager: AuditRow['manager'] = primary ? 'primary' : managed ? 'treehouse' : 'external';
  return {
    path: entry.path,
    branch: entry.branch,
    head: entry.head,
    dirty,
    reachable,
    manager,
    classification,
    suggestedCommand: primary || managed
      ? ''
      : 'git -C ' + quotePowerShell(repoRoot) + ' worktree remove ' + quotePowerShell(entry.path),
  };
}

async function auditUnsafe(input: AuditLifecycleInput, context: LifecycleContext): Promise<LifecycleResult> {
  const repository = await resolveRepository(input.repo, context.cwd);
  const listed = await runGit(['worktree', 'list', '--porcelain'], repository.root);
  if (!processSucceeded(listed)) throw auditError('Git could not list registered worktrees.');
  const leases = await treehouseLeases(repository.root);
  const rows: AuditRow[] = [];
  for (const entry of parseWorktrees(listed.stdout)) {
    if (!existsSync(entry.path)) throw auditError('A registered worktree path is unavailable for read-only audit.');
    rows.push(await collectRow(entry, repository.root, resolve(repository.root, '.worktrees'), leases));
  }
  return lifecycleSuccess(OPERATION, 'Audited ' + rows.length + ' registered worktrees without mutation.', { rows });
}

export async function auditLifecycle(input: AuditLifecycleInput, context: LifecycleContext = {}): Promise<LifecycleResult> {
  try {
    return await auditUnsafe(input, context);
  } catch (error) {
    if (error instanceof LifecycleCommandError) return lifecycleFailure(OPERATION, error.code, error.message, error.remediation, error.data);
    return lifecycleFailure(OPERATION, 'AUDIT_FAILED', 'The read-only worktree audit could not complete safely.', ['Resolve the repository inspection error, then retry goal-lifecycle audit.']);
  }
}
