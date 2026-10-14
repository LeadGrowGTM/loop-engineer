import { TREEHOUSE_STATUS_CONTRACTS, normalizeDependencyVersion } from '../lifecycle-dependencies';
import { processSucceeded, runProcess } from './process';

export type TreehouseStatusContract = (typeof TREEHOUSE_STATUS_CONTRACTS)[keyof typeof TREEHOUSE_STATUS_CONTRACTS];

export interface TreehouseLease {
  path: string;
  holder: string;
}

export interface TreehouseStatusOutput {
  stdout: string;
  stderr: string;
}

const TREEHOUSE_POOL_STATUSES = [
  'available',
  'dirty',
  'in-use',
  'leased',
  "you're here",
  'damaged',
  'unverified',
] as const;

const TREEHOUSE_EMPTY_POOL_MESSAGE = 'No worktrees in pool.';

const TREEHOUSE_STATUS_ROW = new RegExp(`^\\s*\\d+\\s+(${TREEHOUSE_POOL_STATUSES.join('|')})\\s+(\\S.*)$`);

function probe(args: readonly string[]): string {
  return [
    '$command = Get-Command treehouse -CommandType Application,ExternalScript -ErrorAction SilentlyContinue | Select-Object -First 1',
    'if (-not $command -or -not $command.Source) { exit 127 }',
    `& $command.Source ${args.join(' ')}`,
    'exit $LASTEXITCODE',
  ].join('; ');
}

export function treehouseStatusContract(versionOutput: string): TreehouseStatusContract {
  const version = normalizeDependencyVersion('treehouse', versionOutput);
  const contract = (TREEHOUSE_STATUS_CONTRACTS as Record<string, TreehouseStatusContract | undefined>)[version];
  if (!contract) throw new Error(`Treehouse ${version || 'reported no version'} has no audited status contract.`);
  return contract;
}

export function treehouseStatusArgs(contract: TreehouseStatusContract): string[] {
  return contract === 'json' ? ['status', '--json'] : ['status'];
}

function auditedStatus(status: string): (typeof TREEHOUSE_POOL_STATUSES)[number] {
  const audited = TREEHOUSE_POOL_STATUSES.find((candidate) => candidate === status);
  if (!audited) throw new Error(`Treehouse status reported unaudited pool status "${status}".`);
  return audited;
}

function parseJsonLeases(stdout: string): TreehouseLease[] {
  let entries: unknown;
  try {
    entries = JSON.parse(stdout);
  } catch {
    throw new Error('Treehouse status --json did not emit a JSON array.');
  }
  if (!Array.isArray(entries)) throw new Error('Treehouse status --json did not emit a JSON array.');
  const leases: TreehouseLease[] = [];
  for (const entry of entries) {
    const record = entry as { path?: unknown; status?: unknown; lease_holder?: unknown };
    if (typeof record?.path !== 'string' || record.path.length === 0 || typeof record?.status !== 'string') {
      throw new Error('Treehouse status --json contained an entry without an exact path and status.');
    }
    if (auditedStatus(record.status) !== 'leased') continue;
    if (typeof record.lease_holder !== 'string' || record.lease_holder.trim().length === 0) {
      throw new Error('Treehouse status --json reported a leased entry without an exact holder.');
    }
    leases.push({ path: record.path, holder: record.lease_holder.trim() });
  }
  return leases;
}

function parseTextLeases(output: TreehouseStatusOutput): TreehouseLease[] {
  const rows = output.stdout.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (rows.length === 0) {
    if (!output.stderr.includes(TREEHOUSE_EMPTY_POOL_MESSAGE)) {
      throw new Error('Treehouse status reported no pool rows without the audited empty-pool message.');
    }
    return [];
  }
  const leases: TreehouseLease[] = [];
  let slotSeen = false;
  for (const row of rows) {
    const columns = TREEHOUSE_STATUS_ROW.exec(row);
    if (!columns) {
      if (!slotSeen || !/^\s{2,}\S/.test(row)) {
        throw new Error('Treehouse status reported a line that is neither an audited pool row nor indented slot detail.');
      }
      continue;
    }
    slotSeen = true;
    if (columns[1] !== 'leased') continue;
    const leased = /^(\S.*?)\s+\(held by ([^)]+)\)\s*$/.exec(columns[2]);
    const holder = leased?.[2].trim();
    if (!leased || !holder) throw new Error('Treehouse status reported a leased entry without an exact path and holder.');
    leases.push({ path: leased[1], holder });
  }
  return leases;
}

export function parseTreehouseLeases(output: TreehouseStatusOutput, contract: TreehouseStatusContract): TreehouseLease[] {
  return contract === 'json' ? parseJsonLeases(output.stdout) : parseTextLeases(output);
}

export async function readTreehouseLeases(cwd: string, timeoutMs?: number): Promise<TreehouseLease[]> {
  const options = timeoutMs === undefined ? { cwd } : { cwd, timeoutMs };
  const run = (args: readonly string[]) =>
    runProcess('powershell', ['-NoProfile', '-NonInteractive', '-Command', probe(args)], options);
  const version = await run(['--version']);
  if (!processSucceeded(version)) throw new Error('Treehouse version could not be read.');
  const contract = treehouseStatusContract(version.stdout);
  const status = await run(treehouseStatusArgs(contract));
  if (!processSucceeded(status)) throw new Error('Treehouse status could not be read without mutation.');
  return parseTreehouseLeases(status, contract);
}
