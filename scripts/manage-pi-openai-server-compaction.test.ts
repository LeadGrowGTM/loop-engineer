import { describe, expect, test } from 'bun:test';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

const CLI_PATH = join(import.meta.dir, 'manage-pi-openai-server-compaction.ts');
const SETUP_HARNESS_PATH = join(import.meta.dir, 'setup-harness.ts');
const PREPARE_HARNESS_PATH = join(import.meta.dir, 'prepare-harness-run.ps1');
const POWERSHELL = Bun.which('pwsh')
  ?? Bun.which('powershell.exe')
  ?? Bun.which('powershell');
const powershellTest = POWERSHELL ? test : test.skip;
const SYMLINKS_AVAILABLE = (() => {
  try {
    const root = mkdtempSync(join(tmpdir(), 'pi-compaction-symlink-capability-'));
    const target = join(root, 'target');
    mkdirSync(target);
    symlinkSync(target, join(root, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
    return true;
  } catch {
    return false;
  }
})();
const symlinkTest = SYMLINKS_AVAILABLE ? test : test.skip;
const VERSION_OUTPUT_LIMIT_BYTES = 4_096;
const PINNED_COMMIT = 'c6d593087709e9481223dc6c6c2269b371b5e055';
const EXTENSION_SPEC = `git:github.com/algal/pi-openai-server-compaction@${PINNED_COMMIT}`;
const PACKAGE_NAME = 'pi-openai-server-compaction';
const SETTINGS_BACKUP_NAME = 'settings.json.pi-openai-server-compaction.backup';
const ENABLED_CONFIG_BACKUP_NAME = 'openai-server-compaction.enabled.backup.json';
const PERSISTENCE_CANARIES = [
  'harmless-credential-canary-7d2f45',
  'harmless-prompt-canary-a81c09',
  'harmless-conversation-canary-2be734',
  'harmless-model-secret-canary-c9126a',
  '{"kind":"harmless-opaque-jsonl-canary","value":"6e10bd"}',
] as const;
const CANARY_ENV = {
  HARNESS_CREDENTIAL_CANARY: PERSISTENCE_CANARIES[0],
  HARNESS_PROMPT_CANARY: PERSISTENCE_CANARIES[1],
  HARNESS_CONVERSATION_CANARY: PERSISTENCE_CANARIES[2],
  HARNESS_MODEL_SECRET_CANARY: PERSISTENCE_CANARIES[3],
  HARNESS_OPAQUE_JSONL_CANARY: PERSISTENCE_CANARIES[4],
};
const CANARY_STDIN = `${PERSISTENCE_CANARIES.join('\n')}\n`;
const FORBIDDEN_COMMANDS = [
  'node',
  'pi',
  'git',
  'npm',
  'npx',
  'pnpm',
  'yarn',
  'bun',
  'bunx',
  'curl',
  'wget',
  'ssh',
  'gh',
  'rm',
  'rmdir',
  'del',
  'erase',
  'unlink',
  'powershell',
  'pwsh',
] as const;

interface DirectoryFingerprint {
  entries: string[];
  modifiedAt: number;
  changedAt: number;
}

function directoryFingerprint(path: string): DirectoryFingerprint {
  const stats = statSync(path);
  return {
    entries: readdirSync(path).sort(),
    modifiedAt: stats.mtimeMs,
    changedAt: stats.ctimeMs,
  };
}

function createProcessTraps(
  parent: string,
  excludedCommands: readonly string[] = [],
): { bin: string; hits: string } {
  const bin = join(parent, 'process-traps');
  const hits = join(parent, 'process-hits');
  mkdirSync(bin);
  mkdirSync(hits);

  for (const command of FORBIDDEN_COMMANDS) {
    if (excludedCommands.includes(command)) continue;
    if (process.platform === 'win32') {
      writeFileSync(
        join(bin, `${command}.cmd`),
        `@echo off\r\ntype nul > "%PROCESS_TRAP_HITS%\\${command}"\r\nexit /b 97\r\n`,
      );
      continue;
    }

    const trapPath = join(bin, command);
    writeFileSync(
      trapPath,
      `#!/bin/sh\n: > "$PROCESS_TRAP_HITS/${command}"\nexit 97\n`,
    );
    chmodSync(trapPath, 0o755);
  }

  return { bin, hits };
}

function stdoutLines(stdout: string): string[] {
  return stdout.replace(/\r?\n$/, '').split(/\r?\n/);
}

interface CliRun {
  exitCode: number;
  stdout: string;
  stderr: string;
  projectRoot: string;
  before: DirectoryFingerprint;
  hits: string;
}

function runSetup(flags: string[]): CliRun {
  const parent = mkdtempSync(join(tmpdir(), 'pi-compaction-setup-'));
  const projectRoot = join(parent, 'project');
  mkdirSync(projectRoot);
  const traps = createProcessTraps(parent);
  const before = directoryFingerprint(projectRoot);
  const result = Bun.spawnSync(
    [process.execPath, CLI_PATH, 'setup', projectRoot, ...flags],
    {
      env: {
        ...process.env,
        PATH: `${traps.bin}${delimiter}${process.env.PATH ?? ''}`,
        PROCESS_TRAP_HITS: traps.hits,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );

  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    projectRoot,
    before,
    hits: traps.hits,
  };
}

function parseSingleLineJson(stdout: string): Record<string, unknown> {
  const lines = stdoutLines(stdout);
  expect(lines).toHaveLength(1);
  return JSON.parse(lines[0]) as Record<string, unknown>;
}

function expectNoSetupEffects(run: CliRun): void {
  expect(directoryFingerprint(run.projectRoot)).toEqual(run.before);
  expect(readdirSync(run.hits)).toEqual([]);
}

interface FakeExecutable {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}

interface VersionSetupFixture {
  node?: FakeExecutable;
  pi?: FakeExecutable;
}

interface VersionCliRun extends CliRun {
  argv: string[];
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function batchOutputCommands(output: string | undefined, stderr = false): string[] {
  if (!output) return [];
  const lines = output.replaceAll('\r', '').split('\n');
  if (lines.at(-1) === '') lines.pop();
  const redirect = stderr ? '>&2 ' : '';
  return lines.map((line) => `${redirect}echo(${line}`);
}

function writeFakeExecutable(
  bin: string,
  name: 'node' | 'pi' | 'git',
  executable: FakeExecutable,
): void {
  const exitCode = executable.exitCode ?? 0;
  if (process.platform === 'win32') {
    writeFileSync(
      join(bin, `${name}.cmd`),
      [
        '@echo off',
        'setlocal EnableDelayedExpansion',
        `set "argv=${name}"`,
        ':collect-argv',
        'if "%~1"=="" goto argv-collected',
        'set "argv=!argv!\t%~1"',
        'shift',
        'goto collect-argv',
        ':argv-collected',
        '>>"%VERSION_ARGV_LOG%" echo(!argv!',
        ...batchOutputCommands(executable.stdout),
        ...batchOutputCommands(executable.stderr, true),
        `exit /b ${exitCode}`,
        '',
      ].join('\r\n'),
    );
    return;
  }

  const executablePath = join(bin, name);
  writeFileSync(
    executablePath,
    [
      '#!/bin/sh',
      `printf '%s' '${name}' >> "$VERSION_ARGV_LOG"`,
      'for arg in "$@"; do',
      '  printf \'\\t%s\' "$arg" >> "$VERSION_ARGV_LOG"',
      'done',
      'printf \'\\n\' >> "$VERSION_ARGV_LOG"',
      executable.stdout ? `printf '%s' ${shellQuote(executable.stdout)}` : '',
      executable.stderr ? `printf '%s' ${shellQuote(executable.stderr)} >&2` : '',
      `exit ${exitCode}`,
      '',
    ].join('\n'),
  );
  chmodSync(executablePath, 0o755);
}

function writeAttackerExecutable(
  bin: string,
  name: 'node' | 'pi' | 'git',
  marker: string,
): void {
  const output = name === 'node'
    ? 'v22.0.0'
    : name === 'pi'
      ? '0.80.9'
      : PINNED_COMMIT;
  if (process.platform === 'win32') {
    writeFileSync(
      join(bin, `${name}.cmd`),
      `@echo off\r\ntype nul > "${marker}"\r\necho ${output}\r\nexit /b 0\r\n`,
    );
    return;
  }
  const executablePath = join(bin, name);
  writeFileSync(
    executablePath,
    `#!/bin/sh\n: > ${shellQuote(marker)}\nprintf '%s\\n' ${shellQuote(output)}\n`,
  );
  chmodSync(executablePath, 0o755);
}

function runVersionSetup(fixture: VersionSetupFixture): VersionCliRun {
  const parent = mkdtempSync(join(tmpdir(), 'pi-compaction-versions-'));
  const projectRoot = join(parent, 'project');
  mkdirSync(projectRoot);
  const traps = createProcessTraps(parent, ['node', 'pi']);
  const argvLog = join(parent, 'version-argv.log');
  writeFileSync(argvLog, '');
  if (fixture.node) writeFakeExecutable(traps.bin, 'node', fixture.node);
  if (fixture.pi) writeFakeExecutable(traps.bin, 'pi', fixture.pi);
  const before = directoryFingerprint(projectRoot);

  const result = Bun.spawnSync(
    [
      process.execPath,
      CLI_PATH,
      'setup',
      projectRoot,
      '--enable',
      '--acknowledge-openai-retention',
    ],
    {
      env: {
        ...process.env,
        PATH: traps.bin,
        PROCESS_TRAP_HITS: traps.hits,
        VERSION_ARGV_LOG: argvLog,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  const argvText = readFileSync(argvLog, 'utf8').trimEnd();

  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    projectRoot,
    before,
    hits: traps.hits,
    argv: argvText ? argvText.split(/\r?\n/) : [],
  };
}

function expectVersionResult(
  run: VersionCliRun,
  code: string,
  argv: string[],
): void {
  expect(run.exitCode).toBe(2);
  expect(parseSingleLineJson(run.stdout)).toMatchObject({
    status: 'NOT_READY',
    code,
  });
  expect(run.stderr).toBe('');
  expect(run.argv).toEqual(argv);
  expectNoSetupEffects(run);
}

interface HappySetupPaths {
  pi: string;
  settings: string;
  backup: string;
  clone: string;
  packageJson: string;
  lock: string;
  config: string;
  updateSettingsSnapshot: string;
}

interface HappySetupRun extends CliRun {
  argv: string[];
  originalSettings: string;
  paths: HappySetupPaths;
  attackerMarker?: string;
  outsideManagedRoot?: string;
  replacementMarker?: string;
}

type PackageFixture = 'valid' | 'missing' | 'malformed' | 'wrong-name' | 'empty-extensions';

interface CliInputs {
  env?: Record<string, string>;
  stdin?: string;
}

interface SetupScenario {
  piVersion?: string;
  updateExitCode?: number;
  updateOutputBytes?: number;
  createClone?: boolean;
  gitHead?: string;
  gitExitCode?: number;
  gitOutputBytes?: number;
  packageFixture?: PackageFixture;
  obstructTarget?: 'lock' | 'config';
  projectName?: string;
  conflictingEntry?: boolean;
  backupCollision?: string;
  inputs?: CliInputs;
  hijackExecutable?: 'node' | 'pi' | 'git';
  nodeExecutableShape?: 'directory';
  symlinkExecutableDirectory?: boolean;
  omitGitExecutable?: boolean;
  managedPathSwap?: 'pi' | 'clone-parent' | 'package';
  swapPiAfterNode?: boolean;
  swapGitAfterUpdate?: boolean;
  gitSwapPaths?: { candidate: string; replacement: string; marker: string };
}

function writeHappyPiExecutable(
  bin: string,
  parent: string,
  projectRoot: string,
  argvLog: string,
  originalSettings: string,
  scenario: SetupScenario,
): string {
  const fakeSourcePath = join(parent, 'fake-pi.ts');
  const settingsPath = join(projectRoot, '.pi', 'settings.json');
  const backupPath = join(projectRoot, '.pi', SETTINGS_BACKUP_NAME);
  const clonePath = join(
    projectRoot,
    '.pi',
    'git',
    'github.com',
    'algal',
    'pi-openai-server-compaction',
  );
  const updateSettingsSnapshot = join(parent, 'settings-at-update.json');
  const outsideManagedRoot = join(parent, 'outside-managed');
  const originalBase64 = Buffer.from(originalSettings).toString('base64');
  const packageFixture = scenario.packageFixture ?? 'valid';
  const packageContents = packageFixture === 'missing'
    ? null
    : packageFixture === 'malformed'
      ? '{not-json\n'
      : `${JSON.stringify({
        name: packageFixture === 'wrong-name' ? 'wrong-package' : PACKAGE_NAME,
        pi: { extensions: packageFixture === 'empty-extensions' ? [] : ['./src/index.ts'] },
      }, null, 2)}\n`;
  const packageWrite = packageContents === null
    ? ''
    : `writeFileSync(join(clonePath, 'package.json'), ${JSON.stringify(packageContents)});`;
  const symlinkType = process.platform === 'win32' ? 'junction' : 'dir';
  const piDirectory = join(projectRoot, '.pi');
  const cloneParent = join(clonePath, '..');
  const packagePath = join(clonePath, 'package.json');
  const managedSwapCode = scenario.managedPathSwap === 'pi'
    ? `mkdirSync(${JSON.stringify(outsideManagedRoot)}, { recursive: true });\nrenameSync(${JSON.stringify(piDirectory)}, ${JSON.stringify(`${piDirectory}.fixture-aside`)});\nsymlinkSync(${JSON.stringify(outsideManagedRoot)}, ${JSON.stringify(piDirectory)}, ${JSON.stringify(symlinkType)});`
    : scenario.managedPathSwap === 'clone-parent'
      ? `mkdirSync(${JSON.stringify(outsideManagedRoot)}, { recursive: true });\nrenameSync(${JSON.stringify(cloneParent)}, ${JSON.stringify(`${cloneParent}.fixture-aside`)});\nsymlinkSync(${JSON.stringify(outsideManagedRoot)}, ${JSON.stringify(cloneParent)}, ${JSON.stringify(symlinkType)});`
      : scenario.managedPathSwap === 'package'
        ? `mkdirSync(${JSON.stringify(outsideManagedRoot)}, { recursive: true });\nrenameSync(${JSON.stringify(packagePath)}, ${JSON.stringify(`${packagePath}.fixture-aside`)});\nsymlinkSync(${JSON.stringify(outsideManagedRoot)}, ${JSON.stringify(packagePath)}, ${JSON.stringify(symlinkType)});`
        : '';
  const gitSwapCode = scenario.gitSwapPaths
    ? `renameSync(${JSON.stringify(scenario.gitSwapPaths.candidate)}, ${JSON.stringify(`${scenario.gitSwapPaths.candidate}.fixture-aside`)});\nrenameSync(${JSON.stringify(scenario.gitSwapPaths.replacement)}, ${JSON.stringify(scenario.gitSwapPaths.candidate)});`
    : '';
  writeFileSync(
    fakeSourcePath,
    `import { appendFileSync, mkdirSync, readFileSync, renameSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
appendFileSync(${JSON.stringify(argvLog)}, ['pi', ...argv].join('\\t') + '\\n');
if (argv.length === 1 && argv[0] === '--version') {
  console.log(${JSON.stringify(scenario.piVersion ?? '0.80.9')});
  process.exit(0);
}
const expectedUpdate = ['update', '--extension', ${JSON.stringify(EXTENSION_SPEC)}, '--approve'];
if (JSON.stringify(argv) !== JSON.stringify(expectedUpdate)) process.exit(91);
if (process.cwd() !== ${JSON.stringify(projectRoot)}) process.exit(92);
const backup = readFileSync(${JSON.stringify(backupPath)});
if (backup.toString('base64') !== ${JSON.stringify(originalBase64)}) process.exit(93);
const settingsBytes = readFileSync(${JSON.stringify(settingsPath)});
writeFileSync(${JSON.stringify(updateSettingsSnapshot)}, settingsBytes);
const settings = JSON.parse(settingsBytes.toString('utf8')) as {
  packages?: Array<{ source?: string; autoload?: boolean }>;
};
const packageEntry = settings.packages?.find((entry) => entry.source === ${JSON.stringify(EXTENSION_SPEC)});
if (!packageEntry || packageEntry.autoload !== false) process.exit(94);
if (${scenario.updateOutputBytes ?? 0} > 0) {
  process.stdout.write('x'.repeat(${scenario.updateOutputBytes ?? 0}));
  process.exit(0);
}
if (${scenario.updateExitCode ?? 0} !== 0) process.exit(${scenario.updateExitCode ?? 0});
if (${scenario.createClone === false ? 'true' : 'false'}) process.exit(0);
const clonePath = ${JSON.stringify(clonePath)};
mkdirSync(clonePath, { recursive: true });
${packageWrite}
${managedSwapCode}
${gitSwapCode}
process.exit(0);
`,
  );

  if (process.platform === 'win32') {
    writeFileSync(
      join(bin, 'pi.cmd'),
      `@echo off\r\n"${process.execPath}" "${fakeSourcePath}" %*\r\nexit /b %errorlevel%\r\n`,
    );
  } else {
    const executablePath = join(bin, 'pi');
    writeFileSync(
      executablePath,
      `#!/bin/sh\nexec ${shellQuote(process.execPath)} ${shellQuote(fakeSourcePath)} "$@"\n`,
    );
    chmodSync(executablePath, 0o755);
  }

  return updateSettingsSnapshot;
}

function runSetupScenario(scenario: SetupScenario = {}): HappySetupRun {
  const parent = mkdtempSync(join(tmpdir(), 'pi-compaction-happy-'));
  const projectRoot = join(parent, scenario.projectName ?? 'project');
  const pi = join(projectRoot, '.pi');
  mkdirSync(pi, { recursive: true });
  const settings = join(pi, 'settings.json');
  const packages: Array<Record<string, unknown>> = [
    { source: 'git:github.com/example/existing@abc', autoload: true },
  ];
  if (scenario.conflictingEntry) {
    packages.push({ source: EXTENSION_SPEC, autoload: true, owner: 'preexisting' });
  }
  const originalSettings = `${JSON.stringify({
    theme: 'solarized',
    unrelated: { keep: true, order: [3, 1, 2] },
    packages,
  }, null, 2)}\n`;
  writeFileSync(settings, originalSettings);

  const lock = join(pi, 'openai-server-compaction.lock.json');
  const config = join(pi, 'openai-server-compaction.json');
  if (scenario.obstructTarget === 'lock') mkdirSync(lock);
  if (scenario.obstructTarget === 'config') mkdirSync(config);
  if (scenario.backupCollision !== undefined) {
    writeFileSync(join(pi, SETTINGS_BACKUP_NAME), scenario.backupCollision);
  }

  let attackerBin: string | undefined;
  let attackerMarker: string | undefined;
  if (scenario.hijackExecutable) {
    attackerBin = join(projectRoot, 'attacker-bin');
    attackerMarker = join(projectRoot, 'attacker-ran.txt');
    mkdirSync(attackerBin);
    writeAttackerExecutable(attackerBin, scenario.hijackExecutable, attackerMarker);
  }

  const traps = createProcessTraps(parent, ['node', 'pi', 'git']);
  let replacementMarker: string | undefined;
  if (scenario.swapGitAfterUpdate) {
    const replacementBin = join(parent, 'git-replacement-bin');
    mkdirSync(replacementBin);
    replacementMarker = join(parent, 'git-replacement-ran.txt');
    writeAttackerExecutable(replacementBin, 'git', replacementMarker);
    scenario.gitSwapPaths = {
      candidate: join(traps.bin, process.platform === 'win32' ? 'git.cmd' : 'git'),
      replacement: join(replacementBin, process.platform === 'win32' ? 'git.cmd' : 'git'),
      marker: replacementMarker,
    };
  }
  const argvLog = join(parent, 'setup-argv.log');
  writeFileSync(argvLog, '');
  if (scenario.nodeExecutableShape === 'directory') {
    mkdirSync(join(traps.bin, process.platform === 'win32' ? 'node.cmd' : 'node'));
  } else {
    writeFakeExecutable(traps.bin, 'node', { stdout: 'v22.0.0\n' });
  }
  if (!scenario.omitGitExecutable) {
    writeFakeExecutable(traps.bin, 'git', {
      stdout: scenario.gitOutputBytes
        ? 'x'.repeat(scenario.gitOutputBytes)
        : `${scenario.gitHead ?? PINNED_COMMIT}\n`,
      exitCode: scenario.gitExitCode,
    });
  }
  const updateSettingsSnapshot = writeHappyPiExecutable(
    traps.bin,
    parent,
    projectRoot,
    argvLog,
    originalSettings,
    scenario,
  );
  if (scenario.swapPiAfterNode) {
    const replacementBin = join(parent, 'pi-replacement-bin');
    mkdirSync(replacementBin);
    replacementMarker = join(parent, 'pi-replacement-ran.txt');
    writeAttackerExecutable(replacementBin, 'pi', replacementMarker);
    const piCandidate = join(traps.bin, process.platform === 'win32' ? 'pi.cmd' : 'pi');
    const piReplacement = join(replacementBin, process.platform === 'win32' ? 'pi.cmd' : 'pi');
    const nodeSource = join(parent, 'swapping-node.ts');
    writeFileSync(
      nodeSource,
      `import { appendFileSync, renameSync } from 'node:fs';
const argv = process.argv.slice(2);
appendFileSync(${JSON.stringify(argvLog)}, ['node', ...argv].join('\\t') + '\\n');
renameSync(${JSON.stringify(piCandidate)}, ${JSON.stringify(`${piCandidate}.fixture-aside`)});
renameSync(${JSON.stringify(piReplacement)}, ${JSON.stringify(piCandidate)});
console.log('v22.0.0');
`,
    );
    writeBunBackedExecutable(traps.bin, 'node', nodeSource);
  }
  let executableBin = traps.bin;
  if (scenario.symlinkExecutableDirectory) {
    executableBin = join(parent, 'linked-executable-bin');
    symlinkSync(
      traps.bin,
      executableBin,
      process.platform === 'win32' ? 'junction' : 'dir',
    );
  }
  const before = directoryFingerprint(projectRoot);

  const result = Bun.spawnSync(
    [
      process.execPath,
      CLI_PATH,
      'setup',
      projectRoot,
      '--enable',
      '--acknowledge-openai-retention',
    ],
    {
      env: {
        ...process.env,
        PATH: attackerBin
          ? `${attackerBin}${delimiter}${executableBin}`
          : executableBin,
        PROCESS_TRAP_HITS: traps.hits,
        VERSION_ARGV_LOG: argvLog,
        ...scenario.inputs?.env,
      },
      stdin: scenario.inputs?.stdin === undefined
        ? undefined
        : Buffer.from(scenario.inputs.stdin),
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  const argvText = readFileSync(argvLog, 'utf8').trimEnd();
  const clone = join(pi, 'git', 'github.com', 'algal', 'pi-openai-server-compaction');

  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    projectRoot,
    before,
    hits: traps.hits,
    argv: argvText ? argvText.split(/\r?\n/) : [],
    originalSettings,
    attackerMarker,
    outsideManagedRoot: scenario.managedPathSwap
      ? join(parent, 'outside-managed')
      : undefined,
    replacementMarker,
    paths: {
      pi,
      settings,
      backup: join(pi, SETTINGS_BACKUP_NAME),
      clone,
      packageJson: join(clone, 'package.json'),
      lock,
      config,
      updateSettingsSnapshot,
    },
  };
}

function runHappySetup(piVersion = '0.80.9'): HappySetupRun {
  return runSetupScenario({ piVersion });
}

function expectedHappyArgv(run: HappySetupRun): string[] {
  return [
    'node\t--version',
    'pi\t--version',
    `pi\tupdate\t--extension\t${EXTENSION_SPEC}\t--approve`,
    `git\t-C\t${run.paths.clone}\trev-parse\tHEAD`,
  ];
}

function expectReadySetup(run: HappySetupRun): void {
  expect(run.exitCode).toBe(0);
  expect(parseSingleLineJson(run.stdout)).toEqual({ status: 'READY' });
  expect(run.stderr).toBe('');
  expect(run.argv).toEqual(expectedHappyArgv(run));
  expect(readdirSync(run.hits)).toEqual([]);
}

function listTree(root: string, prefix = ''): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (!entry.isDirectory()) return [relativePath];
    return [relativePath, ...listTree(join(root, entry.name), relativePath)];
  });
}

function pathExists(path: string): boolean {
  try {
    statSync(path);
    return true;
  } catch (error) {
    return !(
      typeof error === 'object'
      && error !== null
      && 'code' in error
      && error.code === 'ENOENT'
    );
  }
}

type FailureStage = 'versions' | 'update' | 'git';

function expectedFailureArgv(run: HappySetupRun, stage: FailureStage): string[] {
  const argv = ['node\t--version', 'pi\t--version'];
  if (stage === 'versions') return argv;
  argv.push(`pi\tupdate\t--extension\t${EXTENSION_SPEC}\t--approve`);
  if (stage === 'git') {
    argv.push(`git\t-C\t${run.paths.clone}\trev-parse\tHEAD`);
  }
  return argv;
}

function expectRetainedSetupFailure(
  run: HappySetupRun,
  code: string,
  stage: FailureStage,
  staged: boolean,
): void {
  expect(run.exitCode).toBe(2);
  expect(parseSingleLineJson(run.stdout)).toMatchObject({
    status: 'NOT_READY',
    code,
    retainedState: staged ? 'INERT' : 'UNCHANGED',
  });
  expect(run.stderr).toBe('');
  expect(run.argv).toEqual(expectedFailureArgv(run, stage));
  expect(readdirSync(run.hits)).toEqual([]);
  expect(listTree(run.paths.pi).filter((path) => path.includes('.tmp'))).toEqual([]);

  const original = JSON.parse(run.originalSettings) as {
    theme: string;
    unrelated: Record<string, unknown>;
    packages: Array<Record<string, unknown>>;
  };
  const settings = JSON.parse(readFileSync(run.paths.settings, 'utf8')) as {
    theme: string;
    unrelated: Record<string, unknown>;
    packages: Array<Record<string, unknown>>;
  };
  expect(settings.theme).toBe(original.theme);
  expect(settings.unrelated).toEqual(original.unrelated);
  expect(settings.packages).toContainEqual({
    source: 'git:github.com/example/existing@abc',
    autoload: true,
  });

  if (staged) {
    expect(readFileSync(run.paths.backup)).toEqual(Buffer.from(run.originalSettings));
    expect(settings.packages.filter((entry) => entry.source === EXTENSION_SPEC)).toEqual([{
      source: EXTENSION_SPEC,
      autoload: false,
    }]);
  } else {
    expect(readFileSync(run.paths.settings, 'utf8')).toBe(run.originalSettings);
  }

  const activeConfig = pathExists(run.paths.config) && statSync(run.paths.config).isFile()
    ? (JSON.parse(readFileSync(run.paths.config, 'utf8')) as { enabled?: unknown }).enabled === true
    : false;
  const activePackage = settings.packages.some(
    (entry) => entry.source === EXTENSION_SPEC && entry.autoload === true,
  );
  expect(activeConfig && activePackage).toBe(false);
}

function treeSnapshot(root: string): Record<string, string> {
  return Object.fromEntries(listTree(root).map((relativePath) => {
    const absolutePath = join(root, ...relativePath.split('/'));
    const stats = statSync(absolutePath);
    return [
      relativePath,
      stats.isDirectory() ? 'directory' : readFileSync(absolutePath).toString('base64'),
    ];
  }));
}

interface CheckRun {
  exitCode: number;
  stdout: string;
  stderr: string;
  hits: string;
  before: Record<string, string>;
  after: Record<string, string>;
}

function runConfiguredCheck(projectRoot: string): CheckRun {
  const parent = mkdtempSync(join(tmpdir(), 'pi-compaction-check-state-'));
  const traps = createProcessTraps(parent);
  const before = treeSnapshot(projectRoot);
  const result = Bun.spawnSync([process.execPath, CLI_PATH, 'check', projectRoot], {
    env: {
      ...process.env,
      PATH: traps.bin,
      PROCESS_TRAP_HITS: traps.hits,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  });

  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    hits: traps.hits,
    before,
    after: treeSnapshot(projectRoot),
  };
}

function expectCheckResult(
  run: CheckRun,
  status: 'READY' | 'DISABLED' | 'NOT_READY',
  code?: string,
): void {
  expect(run.exitCode).toBe(status === 'NOT_READY' ? 2 : 0);
  expect(parseSingleLineJson(run.stdout)).toMatchObject({
    status,
    ...(code ? { code } : {}),
  });
  expect(run.stderr).toBe('');
  expect(readdirSync(run.hits)).toEqual([]);
  expect(run.after).toEqual(run.before);
}

interface DisableRun {
  exitCode: number;
  stdout: string;
  stderr: string;
  hits: string;
  before: Record<string, string>;
  after: Record<string, string>;
}

function runDisable(
  projectRoot: string,
  extraArgs: string[] = [],
  inputs: CliInputs = {},
): DisableRun {
  const parent = mkdtempSync(join(tmpdir(), 'pi-compaction-disable-'));
  const traps = createProcessTraps(parent);
  const before = treeSnapshot(projectRoot);
  const result = Bun.spawnSync(
    [process.execPath, CLI_PATH, 'disable', projectRoot, ...extraArgs],
    {
      env: {
        ...process.env,
        PATH: traps.bin,
        PROCESS_TRAP_HITS: traps.hits,
        ...inputs.env,
      },
      stdin: inputs.stdin === undefined ? undefined : Buffer.from(inputs.stdin),
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );

  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    hits: traps.hits,
    before,
    after: treeSnapshot(projectRoot),
  };
}

interface ControlledDisableRun {
  exitCode: number;
  stdout: string;
  stderr: string;
  hits: string;
  obstruction: string;
}

async function runDisableWithTempObstruction(
  projectRoot: string,
  targetPath: string,
  atomicWrite: 1 | 2,
): Promise<ControlledDisableRun> {
  const parent = mkdtempSync(join(tmpdir(), 'pi-compaction-controlled-disable-'));
  const traps = createProcessTraps(parent);
  const ready = join(parent, 'disable.ready');
  const release = join(parent, 'disable.release');
  const preload = join(parent, 'wait-before-disable.ts');
  writeFileSync(
    preload,
    `import { existsSync, writeFileSync } from 'node:fs';
writeFileSync(${JSON.stringify(ready)}, 'ready');
while (!existsSync(${JSON.stringify(release)})) await Bun.sleep(2);
`,
  );
  const subprocess = Bun.spawn(
    [process.execPath, '--preload', preload, CLI_PATH, 'disable', projectRoot],
    {
      env: {
        ...process.env,
        PATH: traps.bin,
        PROCESS_TRAP_HITS: traps.hits,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  const stdoutPromise = new Response(subprocess.stdout).text();
  const stderrPromise = new Response(subprocess.stderr).text();
  const deadline = Date.now() + 10_000;
  while (!pathExists(ready) && Date.now() < deadline) await Bun.sleep(2);
  if (!pathExists(ready)) {
    writeFileSync(release, 'release');
    await subprocess.exited;
    throw new Error('Timed out waiting for controlled disable preload');
  }
  const obstruction = `${targetPath}.tmp-${subprocess.pid}-${atomicWrite}`;
  mkdirSync(obstruction);
  writeFileSync(release, 'release');

  return {
    exitCode: await subprocess.exited,
    stdout: await stdoutPromise,
    stderr: await stderrPromise,
    hits: traps.hits,
    obstruction,
  };
}

function expectDisableResult(
  run: DisableRun,
  status: 'DISABLED' | 'NOT_READY' | 'ERROR',
  code?: string,
): void {
  const expectedExitCode = status === 'DISABLED' ? 0 : status === 'NOT_READY' ? 2 : 1;
  expect(run.exitCode).toBe(expectedExitCode);
  expect(parseSingleLineJson(run.stdout)).toMatchObject({
    status,
    ...(code ? { code } : {}),
  });
  expect(run.stderr).toBe('');
  expect(readdirSync(run.hits)).toEqual([]);
}

function recursiveFileText(root: string): string {
  return listTree(root)
    .map((relativePath) => join(root, ...relativePath.split('/')))
    .filter((path) => statSync(path).isFile())
    .map((path) => readFileSync(path).toString('utf8'))
    .join('\n');
}

function expectNoCanaryPersistence(projectRoot: string, captured: string[]): void {
  const scanned = [recursiveFileText(projectRoot), ...captured].join('\n');
  for (const canary of PERSISTENCE_CANARIES) expect(scanned).not.toContain(canary);
}

function runReadySetupAgain(projectRoot: string, inputs: CliInputs = {}): DisableRun {
  const parent = mkdtempSync(join(tmpdir(), 'pi-compaction-setup-again-'));
  const traps = createProcessTraps(parent);
  const before = treeSnapshot(projectRoot);
  const result = Bun.spawnSync(
    [
      process.execPath,
      CLI_PATH,
      'setup',
      projectRoot,
      '--enable',
      '--acknowledge-openai-retention',
    ],
    {
      env: {
        ...process.env,
        PATH: traps.bin,
        PROCESS_TRAP_HITS: traps.hits,
        ...inputs.env,
      },
      stdin: inputs.stdin === undefined ? undefined : Buffer.from(inputs.stdin),
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );

  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    hits: traps.hits,
    before,
    after: treeSnapshot(projectRoot),
  };
}

interface ReenableRun extends DisableRun {
  argv: string[];
}

function runSetupOnExisting(projectRoot: string): ReenableRun {
  const parent = mkdtempSync(join(tmpdir(), 'pi-compaction-reenable-'));
  const traps = createProcessTraps(parent, ['node', 'pi', 'git']);
  const argvLog = join(parent, 'reenable-argv.log');
  writeFileSync(argvLog, '');
  writeFakeExecutable(traps.bin, 'node', { stdout: 'v22.0.0\n' });
  writeFakeExecutable(traps.bin, 'pi', { stdout: '0.80.9\n' });
  writeFakeExecutable(traps.bin, 'git', { stdout: `${PINNED_COMMIT}\n` });
  const before = treeSnapshot(projectRoot);
  const result = Bun.spawnSync(
    [
      process.execPath,
      CLI_PATH,
      'setup',
      projectRoot,
      '--enable',
      '--acknowledge-openai-retention',
    ],
    {
      env: {
        ...process.env,
        PATH: traps.bin,
        PROCESS_TRAP_HITS: traps.hits,
        VERSION_ARGV_LOG: argvLog,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  const argvText = readFileSync(argvLog, 'utf8').trimEnd();
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    hits: traps.hits,
    before,
    after: treeSnapshot(projectRoot),
    argv: argvText ? argvText.split(/\r?\n/) : [],
  };
}

interface WaitingGitFixture {
  bin: string;
  hits: string;
  argvLog: string;
  ready: string;
  release: string;
}

function prepareWaitingGitFixture(): WaitingGitFixture {
  const parent = mkdtempSync(join(tmpdir(), 'pi-compaction-waiting-git-'));
  const traps = createProcessTraps(parent, ['node', 'pi', 'git']);
  const argvLog = join(parent, 'waiting-git-argv.log');
  const ready = join(parent, 'git.ready');
  const release = join(parent, 'git.release');
  writeFileSync(argvLog, '');
  writeFakeExecutable(traps.bin, 'node', { stdout: 'v22.0.0\n' });
  writeFakeExecutable(traps.bin, 'pi', { stdout: '0.80.9\n' });
  const gitSource = join(parent, 'waiting-git.ts');
  writeFileSync(
    gitSource,
    `import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
const argv = process.argv.slice(2);
appendFileSync(${JSON.stringify(argvLog)}, ['git', ...argv].join('\\t') + '\\n');
writeFileSync(${JSON.stringify(ready)}, 'ready');
while (!existsSync(${JSON.stringify(release)})) await Bun.sleep(2);
console.log(${JSON.stringify(PINNED_COMMIT)});
`,
  );
  writeBunBackedExecutable(traps.bin, 'git', gitSource);
  return { bin: traps.bin, hits: traps.hits, argvLog, ready, release };
}

interface ControlledSetupFixture {
  projectRoot: string;
  settingsPath: string;
  bin: string;
  hits: string;
  argvLog: string;
  ready: string;
  release: string;
}

function writeBunBackedExecutable(
  bin: string,
  name: 'pi' | 'git' | 'node',
  sourcePath: string,
): void {
  if (process.platform === 'win32') {
    writeFileSync(
      join(bin, `${name}.cmd`),
      `@echo off\r\n"${process.execPath}" "${sourcePath}" %*\r\nexit /b %errorlevel%\r\n`,
    );
    return;
  }
  const executablePath = join(bin, name);
  writeFileSync(
    executablePath,
    `#!/bin/sh\nexec ${shellQuote(process.execPath)} ${shellQuote(sourcePath)} "$@"\n`,
  );
  chmodSync(executablePath, 0o755);
}

function prepareControlledSetup(waitOn: 'pi-version' | 'git'): ControlledSetupFixture {
  const parent = mkdtempSync(join(tmpdir(), 'pi-compaction-controlled-setup-'));
  const projectRoot = join(parent, 'project');
  const piDirectory = join(projectRoot, '.pi');
  mkdirSync(piDirectory, { recursive: true });
  const settingsPath = join(piDirectory, 'settings.json');
  writeFileSync(settingsPath, `${JSON.stringify({
    unrelated: { keep: true },
    packages: [],
  }, null, 2)}\n`);

  const traps = createProcessTraps(parent, ['node', 'pi', 'git']);
  const argvLog = join(parent, 'controlled-argv.log');
  const ready = join(parent, 'controlled.ready');
  const release = join(parent, 'controlled.release');
  writeFileSync(argvLog, '');
  writeFakeExecutable(traps.bin, 'node', { stdout: 'v22.0.0\n' });

  const piSource = join(parent, 'controlled-pi.ts');
  const clonePath = join(
    piDirectory,
    'git',
    'github.com',
    'algal',
    'pi-openai-server-compaction',
  );
  writeFileSync(
    piSource,
    `import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const argv = process.argv.slice(2);
appendFileSync(${JSON.stringify(argvLog)}, ['pi', ...argv].join('\\t') + '\\n');
if (argv[0] === '--version') {
  if (${JSON.stringify(waitOn)} === 'pi-version') {
    writeFileSync(${JSON.stringify(ready)}, 'ready');
    while (!existsSync(${JSON.stringify(release)})) await Bun.sleep(2);
  }
  console.log('0.80.9');
  process.exit(0);
}
mkdirSync(${JSON.stringify(clonePath)}, { recursive: true });
writeFileSync(join(${JSON.stringify(clonePath)}, 'package.json'), ${JSON.stringify(`${JSON.stringify({
      name: PACKAGE_NAME,
      pi: { extensions: ['./src/index.ts'] },
    }, null, 2)}\n`)});
`,
  );
  writeBunBackedExecutable(traps.bin, 'pi', piSource);

  const gitSource = join(parent, 'controlled-git.ts');
  writeFileSync(
    gitSource,
    `import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
const argv = process.argv.slice(2);
appendFileSync(${JSON.stringify(argvLog)}, ['git', ...argv].join('\\t') + '\\n');
if (${JSON.stringify(waitOn)} === 'git') {
  writeFileSync(${JSON.stringify(ready)}, 'ready');
  while (!existsSync(${JSON.stringify(release)})) await Bun.sleep(2);
}
console.log(${JSON.stringify(PINNED_COMMIT)});
`,
  );
  writeBunBackedExecutable(traps.bin, 'git', gitSource);

  return {
    projectRoot,
    settingsPath,
    bin: traps.bin,
    hits: traps.hits,
    argvLog,
    ready,
    release,
  };
}

function writeReadinessGit(
  bin: string,
  parent: string,
  repo: string,
  argvLog: string,
): void {
  const sourcePath = join(parent, 'fake-readiness-git.ts');
  writeFileSync(
    sourcePath,
    `import { appendFileSync } from 'node:fs';

const argv = process.argv.slice(2);
appendFileSync(${JSON.stringify(argvLog)}, ['git', ...argv].join('\\t') + '\\n');
const commands = new Set(['rev-parse', 'symbolic-ref', 'show-ref', 'ls-files', 'status']);
const commandIndex = argv.findIndex((value) => commands.has(value));
const args = commandIndex === -1 ? [] : argv.slice(commandIndex);
if (args[0] === 'rev-parse' && args.includes('--short')) {
  console.log('abc123');
  process.exit(0);
}
if (args[0] === 'rev-parse' && args.includes('--show-toplevel')) {
  console.log(${JSON.stringify(repo)});
  process.exit(0);
}
if (args[0] === 'rev-parse' && args.includes('--git-common-dir')) {
  console.log('.git');
  process.exit(0);
}
if (args[0] === 'rev-parse' && args.includes('--verify')) {
  console.log('1111111111111111111111111111111111111111');
  process.exit(0);
}
if (args[0] === 'symbolic-ref' && args.at(-1) === 'HEAD') {
  console.log('feature/readiness');
  process.exit(0);
}
if (args[0] === 'show-ref' && args.at(-1) === 'refs/heads/main') process.exit(0);
if (args[0] === 'ls-files' || args[0] === 'status') process.exit(0);
process.exit(1);
`,
  );

  if (process.platform === 'win32') {
    writeFileSync(
      join(bin, 'git.cmd'),
      `@echo off\r\n"${process.execPath}" "${sourcePath}" %*\r\nexit /b %errorlevel%\r\n`,
    );
  } else {
    const executablePath = join(bin, 'git');
    writeFileSync(
      executablePath,
      `#!/bin/sh\nexec ${shellQuote(process.execPath)} ${shellQuote(sourcePath)} "$@"\n`,
    );
    chmodSync(executablePath, 0o755);
  }
}

function expectZeroPiProof(
  roots: string[],
  captured: string[],
  hits: string,
): void {
  const paths = roots.flatMap((root) => listTree(root));
  expect(paths.filter((path) => /(^|\/)\.pi(?:\/|$)/.test(path))).toEqual([]);
  expect(readdirSync(hits)).toEqual([]);
  const scanned = [
    ...roots.map(recursiveFileText),
    ...captured,
  ].join('\n').toLowerCase();
  for (const term of [
    'manage-pi-openai-server-compaction',
    'pi-openai-server-compaction',
    'openai-server-compaction',
  ]) expect(scanned).not.toContain(term);
}

interface RawCliRun {
  exitCode: number;
  stdout: string;
  stderr: string;
  hits: string;
}

function runRawCli(args: string[]): RawCliRun {
  const parent = mkdtempSync(join(tmpdir(), 'pi-compaction-raw-cli-'));
  const traps = createProcessTraps(parent);
  const result = Bun.spawnSync([process.execPath, CLI_PATH, ...args], {
    env: {
      ...process.env,
      PATH: traps.bin,
      PROCESS_TRAP_HITS: traps.hits,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    hits: traps.hits,
  };
}

function expectRawError(run: RawCliRun, code: string): void {
  expect(run.exitCode).toBe(1);
  expect(parseSingleLineJson(run.stdout)).toMatchObject({ status: 'ERROR', code });
  expect(run.stderr).toBe('');
  expect(readdirSync(run.hits)).toEqual([]);
}

describe('manage-pi-openai-server-compaction CLI', () => {
  test('check reports DISABLED without touching an empty project or launching dependencies', () => {
    const parent = mkdtempSync(join(tmpdir(), 'pi-compaction-check-'));
    const projectRoot = join(parent, 'project');
    mkdirSync(projectRoot);
    const traps = createProcessTraps(parent);
    const before = directoryFingerprint(projectRoot);
    expect(before.entries).toEqual([]);

    const result = Bun.spawnSync(
      [process.execPath, CLI_PATH, 'check', projectRoot],
      {
        env: {
          ...process.env,
          PATH: `${traps.bin}${delimiter}${process.env.PATH ?? ''}`,
          PROCESS_TRAP_HITS: traps.hits,
        },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr.toString()).toBe('');
    const lines = stdoutLines(result.stdout.toString());
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({ status: 'DISABLED' });
    expect(directoryFingerprint(projectRoot)).toEqual(before);
    expect(readdirSync(traps.hits)).toEqual([]);
  });

  for (const command of ['check', 'setup', 'disable'] as const) {
    test(`${command} rejects a missing project argument`, () => {
      expectRawError(runRawCli([command]), 'INVALID_ARGUMENTS');
    });
  }

  test('check, setup, and disable reject extra arguments without mutation', () => {
    const parent = mkdtempSync(join(tmpdir(), 'pi-compaction-extra-args-'));
    const projectRoot = join(parent, 'project');
    mkdirSync(projectRoot);
    const before = treeSnapshot(projectRoot);
    const runs = [
      runRawCli(['check', projectRoot, '--extra']),
      runRawCli([
        'setup',
        projectRoot,
        '--enable',
        '--acknowledge-openai-retention',
        '--extra',
      ]),
      runRawCli(['disable', projectRoot, '--extra']),
    ];

    for (const run of runs) expectRawError(run, 'INVALID_ARGUMENTS');
    expect(treeSnapshot(projectRoot)).toEqual(before);
  });

  for (const command of ['check', 'setup', 'disable'] as const) {
    test(`${command} returns INVALID_PROJECT_ROOT for a missing root`, () => {
      const missingRoot = join(
        mkdtempSync(join(tmpdir(), 'pi-compaction-missing-root-')),
        'does-not-exist',
      );
      const args = command === 'setup'
        ? [command, missingRoot, '--enable', '--acknowledge-openai-retention']
        : [command, missingRoot];
      expectRawError(runRawCli(args), 'INVALID_PROJECT_ROOT');
    });
  }

  test('unsupported commands fail before project access or child processes', () => {
    expectRawError(runRawCli(['unsupported-command', 'ignored-project']), 'UNSUPPORTED_COMMAND');
  });

  test('setup rejects a final symlink root before reads, writes, or child processes', () => {
    const parent = mkdtempSync(join(tmpdir(), 'pi-compaction-final-link-'));
    const realRoot = join(parent, 'real-project');
    const linkedRoot = join(parent, 'linked-project');
    mkdirSync(realRoot);
    symlinkSync(realRoot, linkedRoot, process.platform === 'win32' ? 'junction' : 'dir');
    const before = treeSnapshot(realRoot);

    const run = runRawCli([
      'setup',
      linkedRoot,
      '--enable',
      '--acknowledge-openai-retention',
    ]);
    expectRawError(run, 'INVALID_PROJECT_ROOT');
    expect(treeSnapshot(realRoot)).toEqual(before);
  });

  test('setup rejects a parent-component symlink root before reads, writes, or child processes', () => {
    const parent = mkdtempSync(join(tmpdir(), 'pi-compaction-parent-link-'));
    const realParent = join(parent, 'real-parent');
    const project = join(realParent, 'project');
    const linkedParent = join(parent, 'linked-parent');
    mkdirSync(project, { recursive: true });
    symlinkSync(realParent, linkedParent, process.platform === 'win32' ? 'junction' : 'dir');
    const callerRoot = join(linkedParent, 'project');
    const before = treeSnapshot(project);

    const run = runRawCli([
      'setup',
      callerRoot,
      '--enable',
      '--acknowledge-openai-retention',
    ]);
    expectRawError(run, 'INVALID_PROJECT_ROOT');
    expect(treeSnapshot(project)).toEqual(before);
  });

  test('Windows root trust accepts canonical case-only path differences', () => {
    if (process.platform !== 'win32') return;
    const projectRoot = join(
      mkdtempSync(join(tmpdir(), 'pi-compaction-case-root-')),
      'MixedCaseProject',
    );
    mkdirSync(projectRoot);
    const run = runRawCli(['check', projectRoot.toUpperCase()]);

    expect(run.exitCode).toBe(0);
    expect(parseSingleLineJson(run.stdout)).toEqual({ status: 'DISABLED' });
    expect(readdirSync(run.hits)).toEqual([]);
  });

  for (const executable of ['node', 'pi', 'git'] as const) {
    test(`setup rejects a project-local ${executable} PATH hijack without executing it`, () => {
      const run = runSetupScenario({ hijackExecutable: executable });

      expect(run.exitCode).toBe(2);
      expect(parseSingleLineJson(run.stdout)).toMatchObject({
        status: 'NOT_READY',
        code: `${executable.toUpperCase()}_EXECUTABLE_UNTRUSTED`,
        retainedState: 'UNCHANGED',
      });
      expect(run.argv).toEqual([]);
      expect(run.attackerMarker).toBeDefined();
      expect(pathExists(run.attackerMarker!)).toBe(false);
      expect(pathExists(run.paths.backup)).toBe(false);
    });
  }

  test('setup rejects executables reached through a symlinked directory', () => {
    const run = runSetupScenario({ symlinkExecutableDirectory: true });

    expect(run.exitCode).toBe(2);
    expect(parseSingleLineJson(run.stdout)).toMatchObject({
      status: 'NOT_READY',
      code: 'NODE_EXECUTABLE_UNTRUSTED',
    });
    expect(run.argv).toEqual([]);
    expect(pathExists(run.paths.backup)).toBe(false);
  });

  test('setup rejects a non-file Node executable candidate', () => {
    const run = runSetupScenario({ nodeExecutableShape: 'directory' });

    expect(run.exitCode).toBe(2);
    expect(parseSingleLineJson(run.stdout)).toMatchObject({
      status: 'NOT_READY',
      code: 'NODE_EXECUTABLE_UNTRUSTED',
    });
    expect(run.argv).toEqual([]);
    expect(pathExists(run.paths.backup)).toBe(false);
  });

  test('setup rejects a missing Git executable before spawning any dependency', () => {
    const run = runSetupScenario({ omitGitExecutable: true });

    expect(run.exitCode).toBe(2);
    expect(parseSingleLineJson(run.stdout)).toMatchObject({
      status: 'NOT_READY',
      code: 'GIT_EXECUTABLE_UNTRUSTED',
      retainedState: 'UNCHANGED',
    });
    expect(run.argv).toEqual([]);
    expect(pathExists(run.paths.backup)).toBe(false);
  });

  symlinkTest('setup rejects a symlinked .pi directory before dependency processes', () => {
    const parent = mkdtempSync(join(tmpdir(), 'pi-managed-pi-link-'));
    const projectRoot = join(parent, 'project');
    const outsidePi = join(parent, 'outside-pi');
    mkdirSync(projectRoot);
    mkdirSync(outsidePi);
    writeFileSync(join(outsidePi, 'settings.json'), '{"packages":[]}\n');
    symlinkSync(outsidePi, join(projectRoot, '.pi'), process.platform === 'win32' ? 'junction' : 'dir');

    const run = runRawCli([
      'setup',
      projectRoot,
      '--enable',
      '--acknowledge-openai-retention',
    ]);
    expect(run.exitCode).toBe(2);
    expect(parseSingleLineJson(run.stdout)).toMatchObject({
      status: 'NOT_READY',
      code: 'MANAGED_PATH_UNTRUSTED',
      retainedState: 'UNCHANGED',
    });
    expect(readdirSync(run.hits)).toEqual([]);
  });

  symlinkTest('setup rejects a symlinked settings path before dependency processes', () => {
    const parent = mkdtempSync(join(tmpdir(), 'pi-managed-settings-link-'));
    const projectRoot = join(parent, 'project');
    const piDirectory = join(projectRoot, '.pi');
    const outsideSettings = join(parent, 'outside-settings-directory');
    mkdirSync(piDirectory, { recursive: true });
    mkdirSync(outsideSettings);
    symlinkSync(
      outsideSettings,
      join(piDirectory, 'settings.json'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );

    const run = runRawCli([
      'setup',
      projectRoot,
      '--enable',
      '--acknowledge-openai-retention',
    ]);
    expect(run.exitCode).toBe(2);
    expect(parseSingleLineJson(run.stdout)).toMatchObject({
      status: 'NOT_READY',
      code: 'MANAGED_PATH_UNTRUSTED',
      retainedState: 'UNCHANGED',
    });
    expect(readdirSync(run.hits)).toEqual([]);
  });

  symlinkTest('setup rejects a symlinked clone parent before dependency processes', () => {
    const parent = mkdtempSync(join(tmpdir(), 'pi-managed-clone-parent-link-'));
    const projectRoot = join(parent, 'project');
    const piDirectory = join(projectRoot, '.pi');
    const outsideCloneParent = join(parent, 'outside-clone-parent');
    mkdirSync(piDirectory, { recursive: true });
    mkdirSync(outsideCloneParent);
    writeFileSync(join(piDirectory, 'settings.json'), '{"packages":[]}\n');
    symlinkSync(
      outsideCloneParent,
      join(piDirectory, 'git'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );

    const run = runRawCli([
      'setup',
      projectRoot,
      '--enable',
      '--acknowledge-openai-retention',
    ]);
    expect(run.exitCode).toBe(2);
    expect(parseSingleLineJson(run.stdout)).toMatchObject({
      status: 'NOT_READY',
      code: 'MANAGED_PATH_UNTRUSTED',
      retainedState: 'UNCHANGED',
    });
    expect(readdirSync(run.hits)).toEqual([]);
    expect(readdirSync(outsideCloneParent)).toEqual([]);
  });

  test('setup rejects an intermediate file in the clone path before dependency processes', () => {
    const parent = mkdtempSync(join(tmpdir(), 'pi-managed-clone-file-'));
    const projectRoot = join(parent, 'project');
    const piDirectory = join(projectRoot, '.pi');
    const cloneIntermediate = join(piDirectory, 'git');
    mkdirSync(piDirectory, { recursive: true });
    writeFileSync(join(piDirectory, 'settings.json'), '{"packages":[]}\n');
    writeFileSync(cloneIntermediate, 'operator-owned file\n');

    const run = runRawCli([
      'setup',
      projectRoot,
      '--enable',
      '--acknowledge-openai-retention',
    ]);
    expect(run.exitCode).toBe(2);
    expect(parseSingleLineJson(run.stdout)).toMatchObject({
      status: 'NOT_READY',
      code: 'MANAGED_PATH_UNTRUSTED',
      retainedState: 'UNCHANGED',
    });
    expect(readdirSync(run.hits)).toEqual([]);
    expect(readFileSync(cloneIntermediate, 'utf8')).toBe('operator-owned file\n');
  });

  for (const managedPathSwap of ['pi', 'clone-parent', 'package'] as const) {
    symlinkTest(`setup rejects a Pi-created ${managedPathSwap} symlink before Git or writes`, () => {
      const run = runSetupScenario({ managedPathSwap });

      expect(run.exitCode).toBe(2);
      expect(parseSingleLineJson(run.stdout)).toMatchObject({
        status: 'NOT_READY',
        code: 'MANAGED_PATH_UNTRUSTED',
        retainedState: 'INERT',
      });
      expect(run.argv).toEqual([
        'node\t--version',
        'pi\t--version',
        `pi\tupdate\t--extension\t${EXTENSION_SPEC}\t--approve`,
      ]);
      expect(run.outsideManagedRoot).toBeDefined();
      expect(listTree(run.outsideManagedRoot!).some(
        (path) => path.endsWith('openai-server-compaction.lock.json')
          || path.endsWith('openai-server-compaction.json'),
      )).toBe(false);
    });
  }

  test('setup detects a Pi executable identity swap after Node exits', () => {
    const run = runSetupScenario({ swapPiAfterNode: true });

    expect(run.exitCode).toBe(2);
    expect(parseSingleLineJson(run.stdout)).toMatchObject({
      status: 'NOT_READY',
      code: 'PI_EXECUTABLE_UNTRUSTED',
      retainedState: 'UNCHANGED',
    });
    expect(run.argv).toEqual(['node\t--version']);
    expect(run.replacementMarker).toBeDefined();
    expect(pathExists(run.replacementMarker!)).toBe(false);
    expect(pathExists(run.paths.backup)).toBe(false);
  });

  test('setup detects a Git executable identity swap after Pi update', () => {
    const run = runSetupScenario({ swapGitAfterUpdate: true });

    expect(run.exitCode).toBe(2);
    expect(parseSingleLineJson(run.stdout)).toMatchObject({
      status: 'NOT_READY',
      code: 'GIT_EXECUTABLE_UNTRUSTED',
      retainedState: 'INERT',
    });
    expect(run.argv).toEqual([
      'node\t--version',
      'pi\t--version',
      `pi\tupdate\t--extension\t${EXTENSION_SPEC}\t--approve`,
    ]);
    expect(run.replacementMarker).toBeDefined();
    expect(pathExists(run.replacementMarker!)).toBe(false);
    const settings = JSON.parse(readFileSync(run.paths.settings, 'utf8')) as {
      packages: Array<Record<string, unknown>>;
    };
    expect(settings.packages).toContainEqual({ source: EXTENSION_SPEC, autoload: false });
  });

  const invalidSetupCases = [
    {
      name: 'setup rejects missing consent flags',
      flags: [],
      code: 'CONSENT_REQUIRED',
    },
    {
      name: 'setup rejects --enable without retention acknowledgment',
      flags: ['--enable'],
      code: 'CONSENT_REQUIRED',
    },
    {
      name: 'setup rejects retention acknowledgment without --enable',
      flags: ['--acknowledge-openai-retention'],
      code: 'CONSENT_REQUIRED',
    },
    {
      name: 'setup rejects a duplicate --enable flag',
      flags: ['--enable', '--enable', '--acknowledge-openai-retention'],
      code: 'INVALID_ARGUMENTS',
    },
    {
      name: 'setup rejects a duplicate retention acknowledgment flag',
      flags: ['--enable', '--acknowledge-openai-retention', '--acknowledge-openai-retention'],
      code: 'INVALID_ARGUMENTS',
    },
    {
      name: 'setup rejects an unknown flag',
      flags: ['--enable', '--acknowledge-openai-retention', '--unexpected'],
      code: 'INVALID_ARGUMENTS',
    },
    {
      name: 'setup rejects a caller-supplied ref',
      flags: ['--enable', '--acknowledge-openai-retention', '--ref', 'main'],
      code: 'INVALID_ARGUMENTS',
    },
    {
      name: 'setup rejects a caller-supplied package',
      flags: ['--enable', '--acknowledge-openai-retention', '--package', 'different-package'],
      code: 'INVALID_ARGUMENTS',
    },
  ] as const;

  for (const setupCase of invalidSetupCases) {
    test(setupCase.name, () => {
      const run = runSetup([...setupCase.flags]);

      expect(run.exitCode).not.toBe(0);
      expect(parseSingleLineJson(run.stdout)).toMatchObject({
        status: 'ERROR',
        code: setupCase.code,
      });
      expect(run.stderr).toBe('');
      expectNoSetupEffects(run);
    });
  }

  const compatibleNode = { stdout: 'v22.0.0\n' };
  const compatiblePi = { stdout: '0.80.9\n' };
  const bothVersionArgv = ['node\t--version', 'pi\t--version'];

  test('setup with both consent flags and compatible versions becomes ready', () => {
    const run = runHappySetup();

    expectReadySetup(run);
  });

  test('setup installs the pinned extension and activates only after verification', () => {
    const run = runHappySetup();

    expectReadySetup(run);
    expect(readFileSync(run.paths.backup)).toEqual(Buffer.from(run.originalSettings));

    const originalSettings = JSON.parse(run.originalSettings) as Record<string, unknown>;
    const settingsAtUpdate = JSON.parse(
      readFileSync(run.paths.updateSettingsSnapshot, 'utf8'),
    ) as {
      theme: string;
      unrelated: Record<string, unknown>;
      packages: Array<Record<string, unknown>>;
    };
    expect(settingsAtUpdate.theme).toBe(originalSettings.theme);
    expect(settingsAtUpdate.unrelated).toEqual(originalSettings.unrelated);
    expect(settingsAtUpdate.packages).toContainEqual({
      source: 'git:github.com/example/existing@abc',
      autoload: true,
    });
    expect(settingsAtUpdate.packages).toContainEqual({
      source: EXTENSION_SPEC,
      autoload: false,
    });

    const finalSettings = JSON.parse(readFileSync(run.paths.settings, 'utf8')) as {
      theme: string;
      unrelated: Record<string, unknown>;
      packages: Array<Record<string, unknown>>;
    };
    expect(finalSettings.theme).toBe(originalSettings.theme);
    expect(finalSettings.unrelated).toEqual(originalSettings.unrelated);
    expect(finalSettings.packages).toContainEqual({
      source: 'git:github.com/example/existing@abc',
      autoload: true,
    });
    expect(finalSettings.packages.filter((entry) => entry.source === EXTENSION_SPEC)).toEqual([{
      source: EXTENSION_SPEC,
      autoload: true,
    }]);

    const packageJson = JSON.parse(readFileSync(run.paths.packageJson, 'utf8')) as {
      name: string;
      pi?: { extensions?: unknown[] };
    };
    expect(packageJson.name).toBe(PACKAGE_NAME);
    expect(packageJson.pi?.extensions?.length).toBeGreaterThan(0);
    expect(packageJson.pi?.extensions?.every(
      (extension) => typeof extension === 'string' && extension.length > 0,
    )).toBe(true);

    expect(JSON.parse(readFileSync(run.paths.lock, 'utf8'))).toEqual({
      schemaVersion: 1,
      packageName: PACKAGE_NAME,
      source: EXTENSION_SPEC,
      commit: PINNED_COMMIT,
      clonePath: '.pi/git/github.com/algal/pi-openai-server-compaction',
    });
    expect(JSON.parse(readFileSync(run.paths.config, 'utf8'))).toEqual({
      schemaVersion: 1,
      enabled: true,
      store: true,
    });
    expect(listTree(run.paths.pi).filter((path) => path.includes('.tmp'))).toEqual([]);
  });

  const retainedFailureCases: Array<{
    name: string;
    scenario: SetupScenario;
    code: string;
    stage: FailureStage;
  }> = [
    {
      name: 'setup retains inert state when Pi update exits nonzero',
      scenario: { updateExitCode: 42 },
      code: 'PI_UPDATE_FAILED',
      stage: 'update',
    },
    {
      name: 'setup retains inert state when Pi update output exceeds the limit',
      scenario: { updateOutputBytes: VERSION_OUTPUT_LIMIT_BYTES * 4 },
      code: 'PI_UPDATE_OUTPUT_LIMIT_EXCEEDED',
      stage: 'update',
    },
    {
      name: 'setup retains inert state when the clone is missing',
      scenario: { createClone: false },
      code: 'CLONE_MISSING',
      stage: 'update',
    },
    {
      name: 'setup retains inert state when Git HEAD is malformed',
      scenario: { gitHead: 'not-a-sha' },
      code: 'GIT_HEAD_MALFORMED',
      stage: 'git',
    },
    {
      name: 'setup retains inert state when Git HEAD is wrong',
      scenario: { gitHead: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      code: 'GIT_HEAD_MISMATCH',
      stage: 'git',
    },
    {
      name: 'setup retains inert state when Git exits nonzero',
      scenario: { gitExitCode: 42 },
      code: 'GIT_COMMAND_FAILED',
      stage: 'git',
    },
    {
      name: 'setup retains inert state when Git output exceeds the limit',
      scenario: { gitOutputBytes: VERSION_OUTPUT_LIMIT_BYTES * 4 },
      code: 'GIT_OUTPUT_LIMIT_EXCEEDED',
      stage: 'git',
    },
    {
      name: 'setup retains inert state when package.json is missing',
      scenario: { packageFixture: 'missing' },
      code: 'PACKAGE_JSON_MISSING',
      stage: 'git',
    },
    {
      name: 'setup retains inert state when package.json is malformed',
      scenario: { packageFixture: 'malformed' },
      code: 'PACKAGE_JSON_MALFORMED',
      stage: 'git',
    },
    {
      name: 'setup retains inert state when the package name is wrong',
      scenario: { packageFixture: 'wrong-name' },
      code: 'PACKAGE_NAME_MISMATCH',
      stage: 'git',
    },
    {
      name: 'setup retains inert state when pi.extensions is empty',
      scenario: { packageFixture: 'empty-extensions' },
      code: 'PACKAGE_EXTENSIONS_MISSING',
      stage: 'git',
    },
    {
      name: 'setup retains inert state when the lock target is obstructed',
      scenario: { obstructTarget: 'lock' },
      code: 'LOCK_TARGET_OBSTRUCTED',
      stage: 'git',
    },
    {
      name: 'setup retains inert state when the config target is obstructed',
      scenario: { obstructTarget: 'config' },
      code: 'CONFIG_TARGET_OBSTRUCTED',
      stage: 'git',
    },
  ];

  for (const failureCase of retainedFailureCases) {
    test(failureCase.name, () => {
      const run = runSetupScenario(failureCase.scenario);

      expectRetainedSetupFailure(run, failureCase.code, failureCase.stage, true);
    });
  }

  test('setup rejects a preexisting conflicting pinned package without mutation', () => {
    const run = runSetupScenario({ conflictingEntry: true });

    expectRetainedSetupFailure(run, 'PINNED_ENTRY_CONFLICT', 'versions', false);
    expect(pathExists(run.paths.backup)).toBe(false);
  });

  test('setup rejects an exclusive backup collision without overwriting it', () => {
    const collisionBytes = 'operator-owned backup\n';
    const run = runSetupScenario({ backupCollision: collisionBytes });

    expectRetainedSetupFailure(run, 'BACKUP_ALREADY_EXISTS', 'versions', false);
    expect(readFileSync(run.paths.backup, 'utf8')).toBe(collisionBytes);
  });

  test('setup treats spaces, quotes, and metacharacters as literal path characters', () => {
    const run = runSetupScenario({ projectName: "project space 'quote' & meta" });

    expectReadySetup(run);
    expect(run.argv).toEqual(expectedHappyArgv(run));
  });

  test('check reports READY from a validated successful setup without processes or mutation', () => {
    const setupRun = runHappySetup();
    expectReadySetup(setupRun);

    const checkRun = runConfiguredCheck(setupRun.projectRoot);
    expectCheckResult(checkRun, 'READY');
  });

  test('check reports NOT_READY for retained inert state without processes or mutation', () => {
    const parent = mkdtempSync(join(tmpdir(), 'pi-compaction-inert-check-'));
    const projectRoot = join(parent, 'project');
    const pi = join(projectRoot, '.pi');
    mkdirSync(pi, { recursive: true });
    const settings = {
      unrelated: { keep: true },
      packages: [{ source: EXTENSION_SPEC, autoload: false }],
    };
    const settingsBytes = `${JSON.stringify(settings, null, 2)}\n`;
    writeFileSync(join(pi, 'settings.json'), settingsBytes);
    writeFileSync(join(pi, SETTINGS_BACKUP_NAME), settingsBytes);

    const checkRun = runConfiguredCheck(projectRoot);
    expectCheckResult(checkRun, 'NOT_READY', 'INERT_OR_PARTIAL_STATE');
  });

  test('check reports DISABLED when config is explicitly disabled', () => {
    const parent = mkdtempSync(join(tmpdir(), 'pi-compaction-disabled-check-'));
    const projectRoot = join(parent, 'project');
    const pi = join(projectRoot, '.pi');
    mkdirSync(pi, { recursive: true });
    writeFileSync(join(pi, 'settings.json'), `${JSON.stringify({
      packages: [{ source: EXTENSION_SPEC, autoload: true }],
    }, null, 2)}\n`);
    writeFileSync(join(pi, 'openai-server-compaction.json'), `${JSON.stringify({
      schemaVersion: 1,
      enabled: false,
      store: true,
    }, null, 2)}\n`);

    const checkRun = runConfiguredCheck(projectRoot);
    expectCheckResult(checkRun, 'DISABLED');
  });

  test('disable requires exactly one project root argument', () => {
    const parent = mkdtempSync(join(tmpdir(), 'pi-compaction-disable-args-'));
    const traps = createProcessTraps(parent);
    const result = Bun.spawnSync([process.execPath, CLI_PATH, 'disable'], {
      env: {
        ...process.env,
        PATH: traps.bin,
        PROCESS_TRAP_HITS: traps.hits,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    });

    expect(result.exitCode).toBe(1);
    expect(parseSingleLineJson(result.stdout.toString())).toMatchObject({
      status: 'ERROR',
      code: 'INVALID_ARGUMENTS',
    });
    expect(result.stderr.toString()).toBe('');
    expect(readdirSync(traps.hits)).toEqual([]);
  });

  test('disable rejects extra arguments without changing a ready project', () => {
    const setupRun = runHappySetup();
    const run = runDisable(setupRun.projectRoot, ['--unexpected']);

    expectDisableResult(run, 'ERROR', 'INVALID_ARGUMENTS');
    expect(run.after).toEqual(run.before);
  });

  test('disable makes a ready setup inert while retaining every managed path', () => {
    const setupRun = runHappySetup();
    expectReadySetup(setupRun);
    const enabledConfigBytes = readFileSync(setupRun.paths.config);
    const run = runDisable(setupRun.projectRoot);

    expectDisableResult(run, 'DISABLED');
    const enabledBackupPath = join(setupRun.paths.pi, ENABLED_CONFIG_BACKUP_NAME);
    const enabledBackupRelative = `.pi/${ENABLED_CONFIG_BACKUP_NAME}`;
    expect(Object.keys(run.after).sort()).toEqual([
      ...Object.keys(run.before),
      enabledBackupRelative,
    ].sort());
    expect(readFileSync(enabledBackupPath)).toEqual(enabledConfigBytes);

    for (const [path, bytes] of Object.entries(run.before)) {
      if (path === '.pi/settings.json' || path === '.pi/openai-server-compaction.json') continue;
      expect(run.after[path]).toBe(bytes);
    }

    expect(JSON.parse(readFileSync(setupRun.paths.config, 'utf8'))).toEqual({
      schemaVersion: 1,
      enabled: false,
      store: true,
    });
    const settings = JSON.parse(readFileSync(setupRun.paths.settings, 'utf8')) as {
      theme: string;
      unrelated: Record<string, unknown>;
      packages: Array<Record<string, unknown>>;
    };
    const originalSettings = JSON.parse(setupRun.originalSettings) as {
      theme: string;
      unrelated: Record<string, unknown>;
    };
    expect(settings.theme).toBe(originalSettings.theme);
    expect(settings.unrelated).toEqual(originalSettings.unrelated);
    expect(settings.packages).toContainEqual({
      source: 'git:github.com/example/existing@abc',
      autoload: true,
    });
    expect(settings.packages.filter((entry) => entry.source === EXTENSION_SPEC)).toEqual([{
      source: EXTENSION_SPEC,
      autoload: false,
    }]);
    expect(listTree(setupRun.paths.pi).filter((path) => path.includes('.tmp'))).toEqual([]);

    const checkRun = runConfiguredCheck(setupRun.projectRoot);
    expectCheckResult(checkRun, 'DISABLED');
  });

  test('disable leaves an absent project unchanged and launches no process', () => {
    const parent = mkdtempSync(join(tmpdir(), 'pi-compaction-disable-absent-'));
    const projectRoot = join(parent, 'project');
    mkdirSync(projectRoot);

    const run = runDisable(projectRoot);
    expectDisableResult(run, 'DISABLED');
    expect(run.after).toEqual(run.before);
  });

  test('disable is idempotent when the managed config is already disabled', () => {
    const setupRun = runHappySetup();
    const firstRun = runDisable(setupRun.projectRoot);
    expectDisableResult(firstRun, 'DISABLED');

    const secondRun = runDisable(setupRun.projectRoot);
    expectDisableResult(secondRun, 'DISABLED');
    expect(secondRun.after).toEqual(secondRun.before);
  });

  test('fully consented setup re-enables exact retained disabled state without reinstalling', () => {
    const setupRun = runHappySetup();
    const disableRun = runDisable(setupRun.projectRoot);
    expectDisableResult(disableRun, 'DISABLED');
    const settingsBackup = readFileSync(setupRun.paths.backup);
    const enabledBackupPath = join(setupRun.paths.pi, ENABLED_CONFIG_BACKUP_NAME);
    const enabledBackup = readFileSync(enabledBackupPath);

    const run = runSetupOnExisting(setupRun.projectRoot);

    expect(run.exitCode).toBe(0);
    expect(parseSingleLineJson(run.stdout)).toEqual({ status: 'READY' });
    expect(run.stderr).toBe('');
    expect(run.argv).toEqual([
      'node\t--version',
      'pi\t--version',
      `git\t-C\t${setupRun.paths.clone}\trev-parse\tHEAD`,
    ]);
    expect(readdirSync(run.hits)).toEqual([]);
    expect(Object.keys(run.after).sort()).toEqual(Object.keys(run.before).sort());
    expect(readFileSync(setupRun.paths.backup)).toEqual(settingsBackup);
    expect(readFileSync(enabledBackupPath)).toEqual(enabledBackup);
    expect((JSON.parse(readFileSync(setupRun.paths.config, 'utf8')) as { enabled: boolean }).enabled).toBe(true);
    const settings = JSON.parse(readFileSync(setupRun.paths.settings, 'utf8')) as {
      packages: Array<Record<string, unknown>>;
    };
    expect(settings.packages).toContainEqual({ source: EXTENSION_SPEC, autoload: true });
  });

  test('re-enable reports REENABLE_CONFIG_WRITE_FAILED for a controlled config temp obstruction', async () => {
    const setupRun = runHappySetup();
    expectDisableResult(runDisable(setupRun.projectRoot), 'DISABLED');
    const fixture = prepareWaitingGitFixture();
    const subprocess = Bun.spawn(
      [process.execPath, CLI_PATH, 'setup', setupRun.projectRoot, '--enable', '--acknowledge-openai-retention'],
      {
        env: {
          ...process.env,
          PATH: fixture.bin,
          PROCESS_TRAP_HITS: fixture.hits,
          VERSION_ARGV_LOG: fixture.argvLog,
        },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    );
    const stdoutPromise = new Response(subprocess.stdout).text();
    const stderrPromise = new Response(subprocess.stderr).text();
    const deadline = Date.now() + 3_000;
    while (!pathExists(fixture.ready) && Date.now() < deadline) await Bun.sleep(2);
    const observed = pathExists(fixture.ready);
    if (observed) {
      mkdirSync(`${setupRun.paths.config}.tmp-${subprocess.pid}-1`);
      writeFileSync(fixture.release, 'release');
    }
    const exitCode = await subprocess.exited;
    const stdout = await stdoutPromise;
    const stderr = await stderrPromise;

    expect(observed).toBe(true);
    expect(exitCode).toBe(2);
    expect(parseSingleLineJson(stdout)).toMatchObject({
      status: 'NOT_READY',
      code: 'REENABLE_CONFIG_WRITE_FAILED',
      retainedState: 'INERT',
    });
    expect(stderr).toBe('');
    expect((JSON.parse(readFileSync(setupRun.paths.config, 'utf8')) as { enabled: boolean }).enabled).toBe(false);
    const settings = JSON.parse(readFileSync(setupRun.paths.settings, 'utf8')) as {
      packages: Array<Record<string, unknown>>;
    };
    expect(settings.packages).toContainEqual({ source: EXTENSION_SPEC, autoload: false });
  }, 30_000);

  test('re-enable reports REENABLE_SETTINGS_WRITE_FAILED after config activation', async () => {
    const setupRun = runHappySetup();
    expectDisableResult(runDisable(setupRun.projectRoot), 'DISABLED');
    const fixture = prepareWaitingGitFixture();
    const subprocess = Bun.spawn(
      [process.execPath, CLI_PATH, 'setup', setupRun.projectRoot, '--enable', '--acknowledge-openai-retention'],
      {
        env: {
          ...process.env,
          PATH: fixture.bin,
          PROCESS_TRAP_HITS: fixture.hits,
          VERSION_ARGV_LOG: fixture.argvLog,
        },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    );
    const stdoutPromise = new Response(subprocess.stdout).text();
    const stderrPromise = new Response(subprocess.stderr).text();
    const deadline = Date.now() + 3_000;
    while (!pathExists(fixture.ready) && Date.now() < deadline) await Bun.sleep(2);
    const observed = pathExists(fixture.ready);
    if (observed) {
      mkdirSync(`${setupRun.paths.settings}.tmp-${subprocess.pid}-2`);
      writeFileSync(fixture.release, 'release');
    }
    const exitCode = await subprocess.exited;
    const stdout = await stdoutPromise;
    const stderr = await stderrPromise;

    expect(observed).toBe(true);
    expect(exitCode).toBe(2);
    expect(parseSingleLineJson(stdout)).toMatchObject({
      status: 'NOT_READY',
      code: 'REENABLE_SETTINGS_WRITE_FAILED',
      retainedState: 'INERT',
    });
    expect(stderr).toBe('');
    expect((JSON.parse(readFileSync(setupRun.paths.config, 'utf8')) as { enabled: boolean }).enabled).toBe(true);
    const settings = JSON.parse(readFileSync(setupRun.paths.settings, 'utf8')) as {
      packages: Array<Record<string, unknown>>;
    };
    expect(settings.packages).toContainEqual({ source: EXTENSION_SPEC, autoload: false });
  }, 30_000);

  test('setup reports SETTINGS_STAGE_WRITE_FAILED for a controlled first settings temp obstruction', async () => {
    const fixture = prepareControlledSetup('pi-version');
    const subprocess = Bun.spawn(
      [
        process.execPath,
        CLI_PATH,
        'setup',
        fixture.projectRoot,
        '--enable',
        '--acknowledge-openai-retention',
      ],
      {
        env: {
          ...process.env,
          PATH: fixture.bin,
          PROCESS_TRAP_HITS: fixture.hits,
          VERSION_ARGV_LOG: fixture.argvLog,
        },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    );
    const stdoutPromise = new Response(subprocess.stdout).text();
    const stderrPromise = new Response(subprocess.stderr).text();
    const deadline = Date.now() + 10_000;
    while (!pathExists(fixture.ready) && Date.now() < deadline) await Bun.sleep(2);
    expect(pathExists(fixture.ready)).toBe(true);
    const obstruction = `${fixture.settingsPath}.tmp-${subprocess.pid}-1`;
    mkdirSync(obstruction);
    writeFileSync(fixture.release, 'release');

    const exitCode = await subprocess.exited;
    const stdout = await stdoutPromise;
    const stderr = await stderrPromise;
    expect(exitCode).toBe(2);
    expect(parseSingleLineJson(stdout)).toMatchObject({
      status: 'NOT_READY',
      code: 'SETTINGS_STAGE_WRITE_FAILED',
      retainedState: 'INERT',
    });
    expect(stderr).toBe('');
    expect(pathExists(join(fixture.projectRoot, '.pi', SETTINGS_BACKUP_NAME))).toBe(true);
    const settings = JSON.parse(readFileSync(fixture.settingsPath, 'utf8')) as {
      packages: Array<Record<string, unknown>>;
    };
    expect(settings.packages.filter((entry) => entry.source === EXTENSION_SPEC)).toEqual([]);
    expect(statSync(obstruction).isDirectory()).toBe(true);
  }, 30_000);

  test('setup reports SETTINGS_ACTIVATION_WRITE_FAILED for a controlled final settings temp obstruction', async () => {
    const fixture = prepareControlledSetup('git');
    const subprocess = Bun.spawn(
      [
        process.execPath,
        CLI_PATH,
        'setup',
        fixture.projectRoot,
        '--enable',
        '--acknowledge-openai-retention',
      ],
      {
        env: {
          ...process.env,
          PATH: fixture.bin,
          PROCESS_TRAP_HITS: fixture.hits,
          VERSION_ARGV_LOG: fixture.argvLog,
        },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    );
    const stdoutPromise = new Response(subprocess.stdout).text();
    const stderrPromise = new Response(subprocess.stderr).text();
    const deadline = Date.now() + 10_000;
    while (!pathExists(fixture.ready) && Date.now() < deadline) await Bun.sleep(2);
    expect(pathExists(fixture.ready)).toBe(true);
    const obstruction = `${fixture.settingsPath}.tmp-${subprocess.pid}-4`;
    mkdirSync(obstruction);
    writeFileSync(fixture.release, 'release');

    const exitCode = await subprocess.exited;
    const stdout = await stdoutPromise;
    const stderr = await stderrPromise;
    expect(exitCode).toBe(2);
    expect(parseSingleLineJson(stdout)).toMatchObject({
      status: 'NOT_READY',
      code: 'SETTINGS_ACTIVATION_WRITE_FAILED',
      retainedState: 'INERT',
    });
    expect(stderr).toBe('');
    const settings = JSON.parse(readFileSync(fixture.settingsPath, 'utf8')) as {
      packages: Array<Record<string, unknown>>;
    };
    expect(settings.packages).toContainEqual({ source: EXTENSION_SPEC, autoload: false });
    expect((JSON.parse(readFileSync(
      join(fixture.projectRoot, '.pi', 'openai-server-compaction.json'),
      'utf8',
    )) as { enabled: boolean }).enabled).toBe(true);
    expect(statSync(obstruction).isDirectory()).toBe(true);
  }, 30_000);

  test('disable fails closed on retained partial state without mutation', () => {
    const parent = mkdtempSync(join(tmpdir(), 'pi-compaction-disable-partial-'));
    const projectRoot = join(parent, 'project');
    const pi = join(projectRoot, '.pi');
    mkdirSync(pi, { recursive: true });
    const settingsBytes = `${JSON.stringify({
      unrelated: { keep: true },
      packages: [{ source: EXTENSION_SPEC, autoload: false }],
    }, null, 2)}\n`;
    writeFileSync(join(pi, 'settings.json'), settingsBytes);
    writeFileSync(join(pi, SETTINGS_BACKUP_NAME), settingsBytes);

    const run = runDisable(projectRoot);
    expectDisableResult(run, 'NOT_READY', 'INERT_OR_PARTIAL_STATE');
    expect(parseSingleLineJson(run.stdout)).toMatchObject({ retainedState: 'INERT' });
    expect(run.after).toEqual(run.before);
  });

  test('disable fails closed on malformed managed state without mutation', () => {
    const parent = mkdtempSync(join(tmpdir(), 'pi-compaction-disable-malformed-'));
    const projectRoot = join(parent, 'project');
    const pi = join(projectRoot, '.pi');
    mkdirSync(pi, { recursive: true });
    writeFileSync(join(pi, 'settings.json'), `${JSON.stringify({
      packages: [{ source: EXTENSION_SPEC, autoload: true }],
    }, null, 2)}\n`);
    writeFileSync(join(pi, 'openai-server-compaction.json'), '{not-json\n');

    const run = runDisable(projectRoot);
    expectDisableResult(run, 'NOT_READY', 'INERT_OR_PARTIAL_STATE');
    expect(run.after).toEqual(run.before);
  });

  test('disable fails unchanged when the enabled-config backup already exists', () => {
    const setupRun = runHappySetup();
    const enabledBackupPath = join(setupRun.paths.pi, ENABLED_CONFIG_BACKUP_NAME);
    const collisionBytes = 'operator-owned enabled backup\n';
    writeFileSync(enabledBackupPath, collisionBytes);

    const run = runDisable(setupRun.projectRoot);
    expectDisableResult(run, 'NOT_READY', 'ENABLED_CONFIG_BACKUP_ALREADY_EXISTS');
    expect(parseSingleLineJson(run.stdout)).toMatchObject({ retainedState: 'UNCHANGED' });
    expect(run.after).toEqual(run.before);
    expect(readFileSync(enabledBackupPath, 'utf8')).toBe(collisionBytes);
  });

  test('disable reports retained inert state when the settings write is obstructed after config disable', async () => {
    const setupRun = runHappySetup();
    const enabledConfigBytes = readFileSync(setupRun.paths.config);
    const run = await runDisableWithTempObstruction(
      setupRun.projectRoot,
      setupRun.paths.settings,
      2,
    );

    expect(run.exitCode).toBe(2);
    expect(parseSingleLineJson(run.stdout)).toMatchObject({
      status: 'NOT_READY',
      code: 'DISABLE_SETTINGS_WRITE_FAILED',
      retainedState: 'INERT',
    });
    expect(run.stderr).toBe('');
    expect(readdirSync(run.hits)).toEqual([]);
    expect(statSync(run.obstruction).isDirectory()).toBe(true);
    expect(readFileSync(join(setupRun.paths.pi, ENABLED_CONFIG_BACKUP_NAME))).toEqual(
      enabledConfigBytes,
    );
    expect((JSON.parse(readFileSync(setupRun.paths.config, 'utf8')) as { enabled: boolean }).enabled).toBe(false);
    const retainedSettings = JSON.parse(readFileSync(setupRun.paths.settings, 'utf8')) as {
      packages: Array<Record<string, unknown>>;
    };
    expect(retainedSettings.packages).toContainEqual({
      source: EXTENSION_SPEC,
      autoload: true,
    });
    expect(pathExists(setupRun.paths.lock)).toBe(true);
    expect(pathExists(setupRun.paths.clone)).toBe(true);
  }, 30_000);

  test('disable reports retained inert state when config write is obstructed after backup', async () => {
    const setupRun = runHappySetup();
    const enabledConfigBytes = readFileSync(setupRun.paths.config);
    const enabledBackupPath = join(setupRun.paths.pi, ENABLED_CONFIG_BACKUP_NAME);
    const run = await runDisableWithTempObstruction(
      setupRun.projectRoot,
      setupRun.paths.config,
      1,
    );

    expect(run.exitCode).toBe(2);
    expect(parseSingleLineJson(run.stdout)).toMatchObject({
      status: 'NOT_READY',
      code: 'DISABLE_CONFIG_WRITE_FAILED',
      retainedState: 'INERT',
    });
    expect(run.stderr).toBe('');
    expect(readdirSync(run.hits)).toEqual([]);
    expect(statSync(run.obstruction).isDirectory()).toBe(true);
    expect(readFileSync(enabledBackupPath)).toEqual(enabledConfigBytes);
    expect(readFileSync(setupRun.paths.config)).toEqual(enabledConfigBytes);
    const retainedSettings = JSON.parse(readFileSync(setupRun.paths.settings, 'utf8')) as {
      packages: Array<Record<string, unknown>>;
    };
    expect(retainedSettings.packages).toContainEqual({
      source: EXTENSION_SPEC,
      autoload: true,
    });
    expect(pathExists(setupRun.paths.lock)).toBe(true);
    expect(pathExists(setupRun.paths.clone)).toBe(true);
  }, 30_000);

  test('successful setup does not persist credential, prompt, conversation, model, or opaque canaries', () => {
    const run = runSetupScenario({
      inputs: { env: CANARY_ENV, stdin: CANARY_STDIN },
    });

    expectReadySetup(run);
    expectNoCanaryPersistence(run.projectRoot, [
      run.stdout,
      run.stderr,
      run.argv.join('\n'),
    ]);
  });

  test('failed setup does not persist credential, prompt, conversation, model, or opaque canaries', () => {
    const run = runSetupScenario({
      updateExitCode: 42,
      inputs: { env: CANARY_ENV, stdin: CANARY_STDIN },
    });

    expectRetainedSetupFailure(run, 'PI_UPDATE_FAILED', 'update', true);
    expectNoCanaryPersistence(run.projectRoot, [
      run.stdout,
      run.stderr,
      run.argv.join('\n'),
    ]);
  });

  test('disable does not persist credential, prompt, conversation, model, or opaque canaries', () => {
    const setupRun = runHappySetup();
    const run = runDisable(
      setupRun.projectRoot,
      [],
      { env: CANARY_ENV, stdin: CANARY_STDIN },
    );

    expectDisableResult(run, 'DISABLED');
    expectNoCanaryPersistence(setupRun.projectRoot, [run.stdout, run.stderr]);
  });

  test('setup is byte-idempotent and process-free when the project is already READY', () => {
    const setupRun = runHappySetup();
    const originalBackup = readFileSync(setupRun.paths.backup);
    const run = runReadySetupAgain(setupRun.projectRoot);

    expect(run.exitCode).toBe(0);
    expect(parseSingleLineJson(run.stdout)).toEqual({ status: 'READY' });
    expect(run.stderr).toBe('');
    expect(readdirSync(run.hits)).toEqual([]);
    expect(run.after).toEqual(run.before);
    expect(readFileSync(setupRun.paths.backup)).toEqual(originalBackup);
  });

  test('ordinary setup-harness install has zero Pi compaction effects', () => {
    const root = mkdtempSync(join(tmpdir(), 'zero-pi-setup-harness-'));
    const target = join(root, 'target repo');
    const home = join(root, 'home');
    mkdirSync(target, { recursive: true });
    mkdirSync(home, { recursive: true });
    writeFileSync(join(target, 'CLAUDE.md'), '# Fixture\n');

    const trapRoot = mkdtempSync(join(tmpdir(), 'zero-pi-setup-traps-'));
    const traps = createProcessTraps(trapRoot, ['git']);
    const argvLog = join(trapRoot, 'git-argv.log');
    writeFileSync(argvLog, '');
    writeReadinessGit(traps.bin, trapRoot, target, argvLog);
    const result = Bun.spawnSync(
      [process.execPath, SETUP_HARNESS_PATH, 'install', target],
      {
        env: {
          ...process.env,
          HOME: home,
          USERPROFILE: home,
          PATH: `${traps.bin}${delimiter}${process.env.PATH ?? ''}`,
          PROCESS_TRAP_HITS: traps.hits,
          VERSION_ARGV_LOG: argvLog,
        },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    );

    expect(result.exitCode).toBe(0);
    expectZeroPiProof(
      [target, home],
      [result.stdout.toString(), result.stderr.toString(), readFileSync(argvLog, 'utf8')],
      traps.hits,
    );
  });

  powershellTest('ordinary readiness CheckOnly has zero Pi compaction effects', () => {
    const root = mkdtempSync(join(tmpdir(), 'zero-pi-readiness-'));
    const workspace = join(root, 'workspace');
    const repo = join(workspace, 'repos', 'feature repo');
    mkdirSync(join(repo, '.git'), { recursive: true });

    const trapRoot = mkdtempSync(join(tmpdir(), 'zero-pi-readiness-traps-'));
    const traps = createProcessTraps(trapRoot, ['git']);
    const argvLog = join(trapRoot, 'git-argv.log');
    writeFileSync(argvLog, '');
    writeReadinessGit(traps.bin, trapRoot, repo, argvLog);
    const result = Bun.spawnSync(
      [
        POWERSHELL!,
        '-NoProfile',
        '-File',
        PREPARE_HARNESS_PATH,
        '-RepoPath',
        repo,
        '-WorkspaceRoot',
        workspace,
        '-CheckOnly',
      ],
      {
        env: {
          ...process.env,
          PATH: `${traps.bin}${delimiter}${process.env.PATH ?? ''}`,
          PROCESS_TRAP_HITS: traps.hits,
          VERSION_ARGV_LOG: argvLog,
        },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    );

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout.toString())).toMatchObject({
      status: 'READY',
      mode: 'CHECK_ONLY',
      repoPath: repo,
    });
    expectZeroPiProof(
      [workspace],
      [result.stdout.toString(), result.stderr.toString(), readFileSync(argvLog, 'utf8')],
      traps.hits,
    );
  }, 30_000);

  test('setup rejects a missing Node executable before spawning dependencies', () => {
    const run = runVersionSetup({ pi: compatiblePi });

    expectVersionResult(run, 'NODE_EXECUTABLE_UNTRUSTED', []);
  });

  test('setup rejects a missing Pi executable before spawning dependencies', () => {
    const run = runVersionSetup({ node: compatibleNode });

    expectVersionResult(run, 'PI_EXECUTABLE_UNTRUSTED', []);
  });

  test('setup rejects malformed Node version output without trying Pi', () => {
    const run = runVersionSetup({
      node: { stdout: 'not-a-version\n' },
      pi: compatiblePi,
    });

    expectVersionResult(run, 'NODE_VERSION_INVALID', ['node\t--version']);
  });

  test('setup rejects malformed Pi version output', () => {
    const run = runVersionSetup({
      node: compatibleNode,
      pi: { stdout: 'not-a-version\n' },
    });

    expectVersionResult(run, 'PI_VERSION_INVALID', bothVersionArgv);
  });

  test('setup bounds Node version stdout', () => {
    const run = runVersionSetup({
      node: { stdout: 'x'.repeat(VERSION_OUTPUT_LIMIT_BYTES + 1) },
      pi: compatiblePi,
    });

    expectVersionResult(run, 'NODE_OUTPUT_LIMIT_EXCEEDED', ['node\t--version']);
  });

  test('setup bounds Pi version stderr', () => {
    const run = runVersionSetup({
      node: compatibleNode,
      pi: {
        stdout: '0.80.9\n',
        stderr: 'x'.repeat(VERSION_OUTPUT_LIMIT_BYTES + 1),
      },
    });

    expectVersionResult(run, 'PI_OUTPUT_LIMIT_EXCEEDED', bothVersionArgv);
  });

  test('setup rejects Node 21', () => {
    const run = runVersionSetup({
      node: { stdout: 'v21.99.99\n' },
      pi: compatiblePi,
    });

    expectVersionResult(run, 'NODE_VERSION_UNSUPPORTED', ['node\t--version']);
  });

  test('setup rejects Pi 0.80.8', () => {
    const run = runVersionSetup({
      node: compatibleNode,
      pi: { stdout: '0.80.8\n' },
    });

    expectVersionResult(run, 'PI_VERSION_UNSUPPORTED', bothVersionArgv);
  });

  test('setup accepts a high Pi 0.80 patch', () => {
    const run = runHappySetup('0.80.999');

    expectReadySetup(run);
  });

  test('setup rejects Pi 0.81.0', () => {
    const run = runVersionSetup({
      node: compatibleNode,
      pi: { stdout: '0.81.0\n' },
    });

    expectVersionResult(run, 'PI_VERSION_UNSUPPORTED', bothVersionArgv);
  });
});
