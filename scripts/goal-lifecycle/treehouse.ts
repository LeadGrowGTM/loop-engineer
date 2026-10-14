import { processSucceeded, runProcess } from './process';

const TREEHOUSE_STATUS_PROBE = [
  '$command = Get-Command treehouse -CommandType Application,ExternalScript -ErrorAction SilentlyContinue | Select-Object -First 1',
  'if (-not $command -or -not $command.Source) { exit 127 }',
  '& $command.Source status --json',
  'exit $LASTEXITCODE',
].join('; ');

export interface TreehouseLease {
  path: string;
  holder: string | null;
}

export function parseTreehouseLeases(stdout: string): TreehouseLease[] {
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
    if (record.lease_holder !== null && record.lease_holder !== undefined && typeof record.lease_holder !== 'string') {
      throw new Error('Treehouse status --json reported a leased entry without an exact holder.');
    }
    leases.push({ path: record.path, holder: typeof record.lease_holder === 'string' ? record.lease_holder : null });
  }
  return leases;
}

export async function readTreehouseLeases(cwd: string, timeoutMs?: number): Promise<TreehouseLease[]> {
  const result = await runProcess(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-Command', TREEHOUSE_STATUS_PROBE],
    timeoutMs === undefined ? { cwd } : { cwd, timeoutMs },
  );
  if (!processSucceeded(result)) throw new Error('Treehouse status could not be read without mutation.');
  return parseTreehouseLeases(result.stdout);
}
