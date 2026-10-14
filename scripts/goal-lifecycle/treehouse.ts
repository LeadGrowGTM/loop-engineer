import { TREEHOUSE_STATUS_CONTRACTS, normalizeDependencyVersion } from '../lifecycle-dependencies';
import { processSucceeded, runProcess } from './process';

export type TreehouseStatusContract = (typeof TREEHOUSE_STATUS_CONTRACTS)[keyof typeof TREEHOUSE_STATUS_CONTRACTS];

export interface TreehouseLease {
  path: string;
  holder: string;
}

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

function parseJsonLeases(stdout: string): TreehouseLease[] {
  const lines = stdout.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trimStart().startsWith('['));
  if (start < 0) throw new Error('Treehouse status --json did not emit a JSON array.');
  const entries: unknown = JSON.parse(lines.slice(start).join('\n'));
  if (!Array.isArray(entries)) throw new Error('Treehouse status --json did not emit a JSON array.');
  const leases: TreehouseLease[] = [];
  for (const entry of entries) {
    const record = entry as { path?: unknown; status?: unknown; lease_holder?: unknown };
    if (typeof record?.path !== 'string' || record.path.length === 0 || typeof record?.status !== 'string') {
      throw new Error('Treehouse status --json contained an entry without an exact path and status.');
    }
    if (record.status !== 'leased') continue;
    if (typeof record.lease_holder !== 'string' || record.lease_holder.trim().length === 0) {
      throw new Error('Treehouse status --json reported a leased entry without an exact holder.');
    }
    leases.push({ path: record.path, holder: record.lease_holder.trim() });
  }
  return leases;
}

function parseTextLeases(stdout: string): TreehouseLease[] {
  const leases: TreehouseLease[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    if (!/\bleased\b/.test(line)) continue;
    const match = /^\s*\d+\s+leased\s+(\S.*?)\s+\(held by ([^)]+)\)\s*$/.exec(line);
    const holder = match?.[2].trim();
    if (!match || !holder) throw new Error('Treehouse status reported a leased entry without an exact path and holder.');
    leases.push({ path: match[1], holder });
  }
  return leases;
}

export function parseTreehouseLeases(stdout: string, contract: TreehouseStatusContract): TreehouseLease[] {
  return contract === 'json' ? parseJsonLeases(stdout) : parseTextLeases(stdout);
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
  return parseTreehouseLeases(status.stdout, contract);
}
