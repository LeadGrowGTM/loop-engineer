#!/usr/bin/env bun

import {
  lstatSync,
  readFileSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import {
  isAbsolute,
  join,
  parse,
  relative,
  resolve,
  sep,
} from 'node:path';

const ENABLE_FLAG = '--enable';
const RETENTION_FLAG = '--acknowledge-openai-retention';
const VERSION_OUTPUT_LIMIT_BYTES = 4_096;
const PINNED_COMMIT = 'c6d593087709e9481223dc6c6c2269b371b5e055';
const EXTENSION_SPEC = `git:github.com/algal/pi-openai-server-compaction@${PINNED_COMMIT}`;
const PACKAGE_NAME = 'pi-openai-server-compaction';
const CLONE_RELATIVE_PATH = '.pi/git/github.com/algal/pi-openai-server-compaction';
const SETTINGS_BACKUP_NAME = 'settings.json.pi-openai-server-compaction.backup';
const ENABLED_CONFIG_BACKUP_NAME = 'openai-server-compaction.enabled.backup.json';
// Non-sensitive rollback marker written in place of a verbatim settings.json copy.
// A full settings snapshot would duplicate operator secrets onto an un-ignored file;
// the only thing setup must record to undo itself is that it appended one pinned
// package entry, which is fully described by these constants.
const SETTINGS_BACKUP_METADATA = {
  schemaVersion: 1,
  packageName: PACKAGE_NAME,
  source: EXTENSION_SPEC,
  managedEntryAdded: true,
};

interface CheckOptions {
  command: 'check';
  projectRoot: string;
}

interface SetupOptions {
  command: 'setup';
  projectRoot: string;
}

interface DisableOptions {
  command: 'disable';
  projectRoot: string;
}

type CliOptions = CheckOptions | SetupOptions | DisableOptions;

interface DisabledReport {
  status: 'DISABLED';
}

type RetainedState = 'UNCHANGED' | 'INERT';

type NotReadyCode =
  | 'NODE_UNAVAILABLE'
  | 'PI_UNAVAILABLE'
  | 'NODE_EXECUTABLE_UNTRUSTED'
  | 'PI_EXECUTABLE_UNTRUSTED'
  | 'GIT_EXECUTABLE_UNTRUSTED'
  | 'NODE_OUTPUT_LIMIT_EXCEEDED'
  | 'PI_OUTPUT_LIMIT_EXCEEDED'
  | 'NODE_VERSION_INVALID'
  | 'PI_VERSION_INVALID'
  | 'NODE_VERSION_UNSUPPORTED'
  | 'PI_VERSION_UNSUPPORTED'
  | 'PI_UPDATE_FAILED'
  | 'PI_UPDATE_OUTPUT_LIMIT_EXCEEDED'
  | 'CLONE_MISSING'
  | 'CLONE_WORKTREE_DIRTY'
  | 'GIT_COMMAND_FAILED'
  | 'GIT_OUTPUT_LIMIT_EXCEEDED'
  | 'GIT_HEAD_MALFORMED'
  | 'GIT_HEAD_MISMATCH'
  | 'PACKAGE_JSON_MISSING'
  | 'PACKAGE_JSON_MALFORMED'
  | 'PACKAGE_NAME_MISMATCH'
  | 'PACKAGE_EXTENSIONS_MISSING'
  | 'LOCK_TARGET_OBSTRUCTED'
  | 'CONFIG_TARGET_OBSTRUCTED'
  | 'PINNED_ENTRY_CONFLICT'
  | 'BACKUP_ALREADY_EXISTS'
  | 'ENABLED_CONFIG_BACKUP_ALREADY_EXISTS'
  | 'DISABLE_CONFIG_WRITE_FAILED'
  | 'DISABLE_SETTINGS_WRITE_FAILED'
  | 'SETTINGS_INVALID'
  | 'SETTINGS_STAGE_WRITE_FAILED'
  | 'SETTINGS_ACTIVATION_WRITE_FAILED'
  | 'REENABLE_CONFIG_WRITE_FAILED'
  | 'REENABLE_SETTINGS_WRITE_FAILED'
  | 'MANAGED_PATH_UNTRUSTED'
  | 'INERT_OR_PARTIAL_STATE';

interface NotReadyReport {
  status: 'NOT_READY';
  code: NotReadyCode;
  retainedState: RetainedState;
}

interface ReadyReport {
  status: 'READY';
}

type SetupReport = NotReadyReport | ReadyReport;
type CheckReport = DisabledReport | NotReadyReport | ReadyReport;

interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
}

type CommandFailureReason = 'UNAVAILABLE' | 'NONZERO' | 'OUTPUT_LIMIT' | 'UNTRUSTED';

interface CommandSuccess {
  ok: true;
  stdout: string;
}

interface CommandFailure {
  ok: false;
  reason: CommandFailureReason;
}

type CommandResult = CommandSuccess | CommandFailure;

interface ErrorReport {
  status: 'ERROR';
  code: string;
  message: string;
}

class CliError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

class SetupFailure extends Error {
  constructor(
    readonly code: NotReadyCode,
    readonly retainedState: RetainedState,
    message: string,
  ) {
    super(message);
  }
}

function usage(): string {
  return [
    'Usage:',
    '  bun scripts/manage-pi-openai-server-compaction.ts check <project-root>',
    `  bun scripts/manage-pi-openai-server-compaction.ts setup <project-root> ${ENABLE_FLAG} ${RETENTION_FLAG}`,
    '  bun scripts/manage-pi-openai-server-compaction.ts disable <project-root>',
  ].join('\n');
}

function parseCheckArgs(args: string[]): CheckOptions {
  if (args.length !== 1 || !args[0]) throw new CliError('INVALID_ARGUMENTS', usage());
  return { command: 'check', projectRoot: args[0] };
}

function parseDisableArgs(args: string[]): DisableOptions {
  if (args.length !== 1 || !args[0] || args[0].startsWith('--')) {
    throw new CliError('INVALID_ARGUMENTS', usage());
  }
  return { command: 'disable', projectRoot: args[0] };
}

function parseSetupArgs(args: string[]): SetupOptions {
  const projectRoot = args[0];
  if (!projectRoot || projectRoot.startsWith('--')) {
    throw new CliError('INVALID_ARGUMENTS', usage());
  }

  const flags = new Set<string>();
  for (const flag of args.slice(1)) {
    if (flag !== ENABLE_FLAG && flag !== RETENTION_FLAG) {
      throw new CliError('INVALID_ARGUMENTS', `Unknown setup argument: ${flag}`);
    }
    if (flags.has(flag)) {
      throw new CliError('INVALID_ARGUMENTS', `Duplicate setup argument: ${flag}`);
    }
    flags.add(flag);
  }

  if (!flags.has(ENABLE_FLAG) || !flags.has(RETENTION_FLAG)) {
    throw new CliError(
      'CONSENT_REQUIRED',
      `setup requires both ${ENABLE_FLAG} and ${RETENTION_FLAG}`,
    );
  }

  return { command: 'setup', projectRoot };
}

function parseArgs(argv: string[]): CliOptions {
  const [command, ...args] = argv;
  if (command === 'check') return parseCheckArgs(args);
  if (command === 'setup') return parseSetupArgs(args);
  if (command === 'disable') return parseDisableArgs(args);
  if (command === undefined) throw new CliError('INVALID_ARGUMENTS', usage());
  throw new CliError('UNSUPPORTED_COMMAND', `Unsupported command: ${command}`);
}

function pathsEqual(left: string, right: string): boolean {
  return process.platform === 'win32'
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
}

function pathIsInside(root: string, candidate: string): boolean {
  const rootRelative = relative(root, candidate);
  return rootRelative === ''
    || (
      rootRelative !== '..'
      && !rootRelative.startsWith(`..${sep}`)
      && !isAbsolute(rootRelative)
    );
}

function trustedProjectRoot(projectRoot: string): string {
  const absolute = resolve(projectRoot);
  try {
    const root = parse(absolute).root;
    let cursor = root;
    for (const component of absolute.slice(root.length).split(/[\\/]/).filter(Boolean)) {
      cursor = join(cursor, component);
      if (lstatSync(cursor).isSymbolicLink()) {
        throw new CliError('INVALID_PROJECT_ROOT', `Project root crosses a symlink: ${projectRoot}`);
      }
    }
    if (!lstatSync(absolute).isDirectory()) {
      throw new CliError('INVALID_PROJECT_ROOT', `Project root is not a directory: ${projectRoot}`);
    }
    const canonical = realpathSync.native(absolute);
    if (!pathsEqual(canonical, absolute)) {
      throw new CliError('INVALID_PROJECT_ROOT', `Project root is not canonical: ${projectRoot}`);
    }
    return canonical;
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError('INVALID_PROJECT_ROOT', `Project root is invalid: ${projectRoot}`);
  }
}

type PathKind = 'missing' | 'file' | 'directory' | 'other';

function pathKind(path: string): PathKind {
  try {
    const stats = lstatSync(path);
    if (stats.isFile()) return 'file';
    if (stats.isDirectory()) return 'directory';
    return 'other';
  } catch (error) {
    if (
      typeof error === 'object'
      && error !== null
      && 'code' in error
      && error.code === 'ENOENT'
    ) return 'missing';
    return 'other';
  }
}

function managedPathIsTrusted(
  projectRoot: string,
  path: string,
  expected: 'file' | 'directory' | 'missing',
): boolean {
  const absolute = resolve(path);
  if (!pathIsInside(projectRoot, absolute) || pathsEqual(projectRoot, absolute)) return false;
  const components = relative(projectRoot, absolute).split(/[\\/]/).filter(Boolean);
  let cursor = projectRoot;
  try {
    for (const [index, component] of components.entries()) {
      const candidate = join(cursor, component);
      if (pathKind(candidate) === 'missing') {
        const canonicalParent = realpathSync.native(cursor);
        return expected === 'missing'
          && pathsEqual(canonicalParent, cursor)
          && pathIsInside(projectRoot, canonicalParent);
      }
      cursor = candidate;
      const stats = lstatSync(cursor);
      if (
        stats.isSymbolicLink()
        || (index < components.length - 1 && !stats.isDirectory())
      ) return false;
    }
    const stats = lstatSync(absolute);
    if (expected === 'missing') return false;
    if (expected === 'file' && !stats.isFile()) return false;
    if (expected === 'directory' && !stats.isDirectory()) return false;
    const canonical = realpathSync.native(absolute);
    return pathsEqual(canonical, absolute) && pathIsInside(projectRoot, canonical);
  } catch {
    return false;
  }
}

function managedPathIsTrustedWhenAbsent(
  projectRoot: string,
  path: string,
  expected: 'file' | 'directory',
): boolean {
  return managedPathIsTrusted(
    projectRoot,
    path,
    pathKind(path) === 'missing' ? 'missing' : expected,
  );
}

function managedCreateTargetIsTrusted(projectRoot: string, path: string): boolean {
  const kind = pathKind(path);
  return kind !== 'other' && managedPathIsTrusted(projectRoot, path, kind);
}

type ExecutableName = 'node' | 'pi' | 'git';

interface ExecutableFingerprint {
  dev: number;
  ino: number;
  mode: number;
  size: number;
  mtimeMs: number;
}

interface TrustedExecutable {
  command: ExecutableName;
  path: string;
  fingerprint: ExecutableFingerprint;
}

function inspectExecutable(command: ExecutableName, projectRoot: string): TrustedExecutable | null {
  const found = Bun.which(command);
  if (!found) return null;
  const absolute = resolve(found);
  try {
    const stats = lstatSync(absolute);
    if (!stats.isFile() || stats.isSymbolicLink()) return null;
    const canonical = realpathSync.native(absolute);
    if (!pathsEqual(canonical, absolute) || pathIsInside(projectRoot, canonical)) return null;
    return {
      command,
      path: canonical,
      fingerprint: {
        dev: stats.dev,
        ino: stats.ino,
        mode: stats.mode,
        size: stats.size,
        mtimeMs: stats.mtimeMs,
      },
    };
  } catch {
    return null;
  }
}

function executableIsUnchanged(executable: TrustedExecutable, projectRoot: string): boolean {
  const current = inspectExecutable(executable.command, projectRoot);
  return current !== null
    && pathsEqual(current.path, executable.path)
    && JSON.stringify(current.fingerprint) === JSON.stringify(executable.fingerprint);
}

function notReady(
  code: NotReadyCode,
  retainedState: RetainedState = 'UNCHANGED',
): NotReadyReport {
  return { status: 'NOT_READY', code, retainedState };
}

function runCommand(command: string[], cwd?: string): CommandResult {
  try {
    const result = Bun.spawnSync(command, {
      cwd,
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'pipe',
      maxBuffer: VERSION_OUTPUT_LIMIT_BYTES,
    });
    if (result.exitedDueToMaxBuffer) return { ok: false, reason: 'OUTPUT_LIMIT' };
    if (result.exitCode !== 0) return { ok: false, reason: 'NONZERO' };
    return { ok: true, stdout: result.stdout.toString() };
  } catch {
    return { ok: false, reason: 'UNAVAILABLE' };
  }
}

function runTrustedCommand(
  executable: TrustedExecutable,
  args: string[],
  projectRoot: string,
  cwd?: string,
): CommandResult {
  if (!executableIsUnchanged(executable, projectRoot)) {
    return { ok: false, reason: 'UNTRUSTED' };
  }
  return runCommand([executable.path, ...args], cwd);
}

function runVersionCommand(
  command: 'node' | 'pi',
  executable: TrustedExecutable,
  projectRoot: string,
): CommandSuccess | { ok: false; report: NotReadyReport } {
  const result = runTrustedCommand(executable, ['--version'], projectRoot);
  if (result.ok) return result;
  if (command === 'node') {
    return {
      ok: false,
      report: notReady(
        result.reason === 'UNTRUSTED'
          ? 'NODE_EXECUTABLE_UNTRUSTED'
          : result.reason === 'OUTPUT_LIMIT'
            ? 'NODE_OUTPUT_LIMIT_EXCEEDED'
            : 'NODE_UNAVAILABLE',
      ),
    };
  }
  return {
    ok: false,
    report: notReady(
      result.reason === 'UNTRUSTED'
        ? 'PI_EXECUTABLE_UNTRUSTED'
        : result.reason === 'OUTPUT_LIMIT'
          ? 'PI_OUTPUT_LIMIT_EXCEEDED'
          : 'PI_UNAVAILABLE',
    ),
  };
}

function parseVersion(output: string): SemanticVersion | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(output.trim());
  if (!match) return null;
  const values = match.slice(1).map(Number);
  if (!values.every(Number.isSafeInteger)) return null;
  return { major: values[0], minor: values[1], patch: values[2] };
}

function parseJsonObject(bytes: Uint8Array): Record<string, unknown> | null {
  try {
    const value = JSON.parse(Buffer.from(bytes).toString('utf8')) as unknown;
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readJsonObject(path: string): Record<string, unknown> | null {
  if (pathKind(path) !== 'file') return null;
  try {
    return parseJsonObject(readFileSync(path));
  } catch {
    return null;
  }
}

function pinnedPackageEntries(settings: Record<string, unknown> | null): Record<string, unknown>[] {
  if (!settings || !Array.isArray(settings.packages)) return [];
  return settings.packages.filter((entry): entry is Record<string, unknown> => (
    typeof entry === 'object'
    && entry !== null
    && !Array.isArray(entry)
    && (entry as Record<string, unknown>).source === EXTENSION_SPEC
  ));
}

let atomicWriteCounter = 0;

function serializeJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function writeTextAtomic(path: string, content: string): void {
  atomicWriteCounter += 1;
  const temporaryPath = `${path}.tmp-${process.pid}-${atomicWriteCounter}`;
  writeFileSync(temporaryPath, content, { flag: 'wx' });
  renameSync(temporaryPath, path);
}

function writeJsonAtomic(path: string, value: unknown): void {
  writeTextAtomic(path, serializeJson(value));
}

function writeJsonAtomicCreate(
  projectRoot: string,
  path: string,
  value: unknown,
  obstructionCode: 'LOCK_TARGET_OBSTRUCTED' | 'CONFIG_TARGET_OBSTRUCTED',
): void {
  const kind = pathKind(path);
  if (kind !== 'missing') {
    if (!managedCreateTargetIsTrusted(projectRoot, path)) {
      throw new SetupFailure('MANAGED_PATH_UNTRUSTED', 'INERT', `Managed target is untrusted: ${path}`);
    }
    throw new SetupFailure(obstructionCode, 'INERT', `Managed target is obstructed: ${path}`);
  }
  if (!managedPathIsTrusted(projectRoot, path, 'missing')) {
    throw new SetupFailure('MANAGED_PATH_UNTRUSTED', 'INERT', `Managed target is untrusted: ${path}`);
  }
  try {
    writeJsonAtomic(path, value);
  } catch {
    throw new SetupFailure(obstructionCode, 'INERT', `Could not create managed target: ${path}`);
  }
}

function verifyPackageManifest(path: string): NotReadyCode | null {
  if (pathKind(path) !== 'file') return 'PACKAGE_JSON_MISSING';
  const manifest = readJsonObject(path);
  if (!manifest) return 'PACKAGE_JSON_MALFORMED';
  if (manifest.name !== PACKAGE_NAME) return 'PACKAGE_NAME_MISMATCH';
  const pi = manifest.pi;
  if (typeof pi !== 'object' || pi === null || Array.isArray(pi)) {
    return 'PACKAGE_EXTENSIONS_MISSING';
  }
  const extensions = (pi as Record<string, unknown>).extensions;
  if (
    !Array.isArray(extensions)
    || extensions.length === 0
    || !extensions.every((extension) => typeof extension === 'string' && extension.length > 0)
  ) return 'PACKAGE_EXTENSIONS_MISSING';
  return null;
}

function check(projectRoot: string): CheckReport {
  projectRoot = trustedProjectRoot(projectRoot);
  const piDirectory = join(projectRoot, '.pi');
  const settingsPath = join(piDirectory, 'settings.json');
  const backupPath = join(piDirectory, SETTINGS_BACKUP_NAME);
  const enabledBackupPath = join(piDirectory, ENABLED_CONFIG_BACKUP_NAME);
  const lockPath = join(piDirectory, 'openai-server-compaction.lock.json');
  const configPath = join(piDirectory, 'openai-server-compaction.json');
  const clonePath = join(projectRoot, ...CLONE_RELATIVE_PATH.split('/'));
  const packagePath = join(clonePath, 'package.json');

  if (pathKind(piDirectory) === 'missing') return { status: 'DISABLED' };
  if (!managedPathIsTrusted(projectRoot, piDirectory, 'directory')) {
    return notReady('MANAGED_PATH_UNTRUSTED');
  }
  for (const [path, expected] of [
    [settingsPath, 'file'],
    [backupPath, 'file'],
    [clonePath, 'directory'],
    [packagePath, 'file'],
  ] as const) {
    if (!managedPathIsTrustedWhenAbsent(projectRoot, path, expected)) {
      return notReady('MANAGED_PATH_UNTRUSTED');
    }
  }
  for (const path of [enabledBackupPath, lockPath, configPath]) {
    if (!managedCreateTargetIsTrusted(projectRoot, path)) {
      return notReady('MANAGED_PATH_UNTRUSTED');
    }
  }

  const config = readJsonObject(configPath);
  if (config?.enabled === false) return { status: 'DISABLED' };

  const settings = readJsonObject(settingsPath);
  const pinnedEntries = pinnedPackageEntries(settings);
  const hasManagedState = pinnedEntries.length > 0
    || pathKind(backupPath) !== 'missing'
    || pathKind(lockPath) !== 'missing'
    || pathKind(configPath) !== 'missing'
    || pathKind(clonePath) !== 'missing';
  if (!hasManagedState) return { status: 'DISABLED' };

  if (
    !config
    || config.schemaVersion !== 1
    || config.enabled !== true
    || config.store !== true
    || pinnedEntries.length !== 1
    || pinnedEntries[0].autoload !== true
    || pathKind(backupPath) !== 'file'
  ) return notReady('INERT_OR_PARTIAL_STATE', 'INERT');

  const lock = readJsonObject(lockPath);
  if (
    !lock
    || lock.schemaVersion !== 1
    || lock.packageName !== PACKAGE_NAME
    || lock.source !== EXTENSION_SPEC
    || lock.commit !== PINNED_COMMIT
    || lock.clonePath !== CLONE_RELATIVE_PATH
    || pathKind(clonePath) !== 'directory'
    || verifyPackageManifest(packagePath) !== null
  ) return notReady('INERT_OR_PARTIAL_STATE', 'INERT');

  return { status: 'READY' };
}

interface RetainedDisabledState {
  piDirectory: string;
  settingsPath: string;
  configPath: string;
  clonePath: string;
  settings: Record<string, unknown>;
  config: Record<string, unknown>;
  pinnedEntry: Record<string, unknown>;
}

function retainedDisabledState(projectRoot: string): RetainedDisabledState | null {
  const piDirectory = join(projectRoot, '.pi');
  const settingsPath = join(piDirectory, 'settings.json');
  const configPath = join(piDirectory, 'openai-server-compaction.json');
  const lockPath = join(piDirectory, 'openai-server-compaction.lock.json');
  const clonePath = join(projectRoot, ...CLONE_RELATIVE_PATH.split('/'));
  const packagePath = join(clonePath, 'package.json');
  const requiredPaths = [
    [piDirectory, 'directory'],
    [settingsPath, 'file'],
    [configPath, 'file'],
    [lockPath, 'file'],
    [join(piDirectory, SETTINGS_BACKUP_NAME), 'file'],
    [join(piDirectory, ENABLED_CONFIG_BACKUP_NAME), 'file'],
    [clonePath, 'directory'],
    [packagePath, 'file'],
  ] as const;
  if (requiredPaths.some(([path, expected]) => (
    !managedPathIsTrusted(projectRoot, path, expected)
  ))) return null;

  const settings = readJsonObject(settingsPath);
  const config = readJsonObject(configPath);
  const lock = readJsonObject(lockPath);
  const pinnedEntries = pinnedPackageEntries(settings);
  if (
    !settings
    || !config
    || !lock
    || config.schemaVersion !== 1
    || config.enabled !== false
    || config.store !== true
    || pinnedEntries.length !== 1
    || pinnedEntries[0].autoload !== false
    || lock.schemaVersion !== 1
    || lock.packageName !== PACKAGE_NAME
    || lock.source !== EXTENSION_SPEC
    || lock.commit !== PINNED_COMMIT
    || lock.clonePath !== CLONE_RELATIVE_PATH
    || verifyPackageManifest(packagePath) !== null
  ) return null;
  return {
    piDirectory,
    settingsPath,
    configPath,
    clonePath,
    settings,
    config,
    pinnedEntry: pinnedEntries[0],
  };
}

function reenable(
  projectRoot: string,
  state: RetainedDisabledState,
  gitExecutable: TrustedExecutable,
): SetupReport {
  if (
    !managedPathIsTrusted(projectRoot, state.piDirectory, 'directory')
    || !managedPathIsTrusted(projectRoot, state.settingsPath, 'file')
    || !managedPathIsTrusted(projectRoot, state.configPath, 'file')
    || !managedPathIsTrusted(
      projectRoot,
      join(state.piDirectory, SETTINGS_BACKUP_NAME),
      'file',
    )
    || !managedPathIsTrusted(
      projectRoot,
      join(state.piDirectory, ENABLED_CONFIG_BACKUP_NAME),
      'file',
    )
    || !managedPathIsTrusted(
      projectRoot,
      join(state.piDirectory, 'openai-server-compaction.lock.json'),
      'file',
    )
    || !managedPathIsTrusted(projectRoot, state.clonePath, 'directory')
    || !managedPathIsTrusted(projectRoot, join(state.clonePath, 'package.json'), 'file')
  ) return notReady('MANAGED_PATH_UNTRUSTED', 'INERT');

  const gitResult = runTrustedCommand(
    gitExecutable,
    ['-C', state.clonePath, 'rev-parse', 'HEAD'],
    projectRoot,
  );
  if (!gitResult.ok) {
    return notReady(
      gitResult.reason === 'UNTRUSTED'
        ? 'GIT_EXECUTABLE_UNTRUSTED'
        : gitResult.reason === 'OUTPUT_LIMIT'
          ? 'GIT_OUTPUT_LIMIT_EXCEEDED'
          : 'GIT_COMMAND_FAILED',
      'INERT',
    );
  }
  const cloneHead = gitResult.stdout.trim();
  if (!/^[0-9a-f]{40}$/.test(cloneHead)) return notReady('GIT_HEAD_MALFORMED', 'INERT');
  if (cloneHead !== PINNED_COMMIT) return notReady('GIT_HEAD_MISMATCH', 'INERT');

  state.config.enabled = true;
  try {
    if (!managedPathIsTrusted(projectRoot, state.configPath, 'file')) throw new Error('untrusted');
    writeJsonAtomic(state.configPath, state.config);
  } catch {
    return notReady('REENABLE_CONFIG_WRITE_FAILED', 'INERT');
  }

  state.pinnedEntry.autoload = true;
  try {
    if (!managedPathIsTrusted(projectRoot, state.settingsPath, 'file')) throw new Error('untrusted');
    writeJsonAtomic(state.settingsPath, state.settings);
  } catch {
    return notReady('REENABLE_SETTINGS_WRITE_FAILED', 'INERT');
  }
  return { status: 'READY' };
}

// check() reports READY from the manager's own lockfile, which records the commit
// the clone was pinned to at install time. That declaration can drift: the clone's
// live HEAD can move or its worktree can be edited after install. setup is the
// authoritative install command, so before it affirms READY it re-verifies the live
// clone against the pin with a trusted git. (check() stays a zero-subprocess probe.)
function verifyReadyClone(
  projectRoot: string,
  gitExecutable: TrustedExecutable,
): SetupReport {
  const clonePath = join(projectRoot, ...CLONE_RELATIVE_PATH.split('/'));
  if (!managedPathIsTrusted(projectRoot, clonePath, 'directory')) {
    return notReady('MANAGED_PATH_UNTRUSTED');
  }

  const headResult = runTrustedCommand(
    gitExecutable,
    ['-C', clonePath, 'rev-parse', 'HEAD'],
    projectRoot,
  );
  if (!headResult.ok) {
    return notReady(
      headResult.reason === 'UNTRUSTED'
        ? 'GIT_EXECUTABLE_UNTRUSTED'
        : headResult.reason === 'OUTPUT_LIMIT'
          ? 'GIT_OUTPUT_LIMIT_EXCEEDED'
          : 'GIT_COMMAND_FAILED',
    );
  }
  const cloneHead = headResult.stdout.trim();
  if (!/^[0-9a-f]{40}$/.test(cloneHead)) return notReady('GIT_HEAD_MALFORMED');
  if (cloneHead !== PINNED_COMMIT) return notReady('GIT_HEAD_MISMATCH');

  const statusResult = runTrustedCommand(
    gitExecutable,
    ['-C', clonePath, 'status', '--porcelain'],
    projectRoot,
  );
  if (!statusResult.ok) {
    return notReady(
      statusResult.reason === 'UNTRUSTED'
        ? 'GIT_EXECUTABLE_UNTRUSTED'
        : statusResult.reason === 'OUTPUT_LIMIT'
          ? 'GIT_OUTPUT_LIMIT_EXCEEDED'
          : 'GIT_COMMAND_FAILED',
    );
  }
  if (statusResult.stdout.trim() !== '') return notReady('CLONE_WORKTREE_DIRTY');

  return { status: 'READY' };
}

function setup(projectRoot: string): SetupReport {
  projectRoot = trustedProjectRoot(projectRoot);
  const existingState = check(projectRoot);
  if (existingState.status === 'READY') {
    const gitExecutable = inspectExecutable('git', projectRoot);
    if (!gitExecutable) return notReady('GIT_EXECUTABLE_UNTRUSTED');
    return verifyReadyClone(projectRoot, gitExecutable);
  }
  if (
    existingState.status === 'NOT_READY'
    && existingState.code === 'MANAGED_PATH_UNTRUSTED'
  ) return existingState;

  const nodeExecutable = inspectExecutable('node', projectRoot);
  if (!nodeExecutable) return notReady('NODE_EXECUTABLE_UNTRUSTED');
  const piExecutable = inspectExecutable('pi', projectRoot);
  if (!piExecutable) return notReady('PI_EXECUTABLE_UNTRUSTED');
  const gitExecutable = inspectExecutable('git', projectRoot);
  if (!gitExecutable) return notReady('GIT_EXECUTABLE_UNTRUSTED');

  const nodeOutput = runVersionCommand('node', nodeExecutable, projectRoot);
  if (!nodeOutput.ok) return nodeOutput.report;
  const nodeVersion = parseVersion(nodeOutput.stdout);
  if (!nodeVersion) return notReady('NODE_VERSION_INVALID');
  if (nodeVersion.major < 22) return notReady('NODE_VERSION_UNSUPPORTED');

  const piOutput = runVersionCommand('pi', piExecutable, projectRoot);
  if (!piOutput.ok) return piOutput.report;
  const piVersion = parseVersion(piOutput.stdout);
  if (!piVersion) return notReady('PI_VERSION_INVALID');
  if (piVersion.major !== 0 || piVersion.minor !== 80 || piVersion.patch < 9) {
    return notReady('PI_VERSION_UNSUPPORTED');
  }

  const disabledState = retainedDisabledState(projectRoot);
  if (disabledState) return reenable(projectRoot, disabledState, gitExecutable);

  try {
    const piDirectory = join(projectRoot, '.pi');
    const settingsPath = join(piDirectory, 'settings.json');
    const backupPath = join(piDirectory, SETTINGS_BACKUP_NAME);
    const enabledBackupPath = join(piDirectory, ENABLED_CONFIG_BACKUP_NAME);
    const lockPath = join(piDirectory, 'openai-server-compaction.lock.json');
    const configPath = join(piDirectory, 'openai-server-compaction.json');
    const clonePath = join(projectRoot, ...CLONE_RELATIVE_PATH.split('/'));
    const packagePath = join(clonePath, 'package.json');
    if (
      !managedPathIsTrusted(projectRoot, piDirectory, 'directory')
      || !managedPathIsTrusted(projectRoot, settingsPath, 'file')
    ) {
      throw new SetupFailure('MANAGED_PATH_UNTRUSTED', 'UNCHANGED', 'Managed settings path is untrusted');
    }
    if (pathKind(settingsPath) !== 'file') {
      throw new SetupFailure('SETTINGS_INVALID', 'UNCHANGED', '.pi/settings.json is missing');
    }
    const settingsBytes = readFileSync(settingsPath);
    const settings = parseJsonObject(settingsBytes);
    if (!settings || (settings.packages !== undefined && !Array.isArray(settings.packages))) {
      throw new SetupFailure('SETTINGS_INVALID', 'UNCHANGED', '.pi/settings.json is invalid');
    }
    const packages = (settings.packages ?? []) as unknown[];
    const conflictingEntry = packages.some((entry) => (
      typeof entry === 'object'
      && entry !== null
      && !Array.isArray(entry)
      && (entry as Record<string, unknown>).source === EXTENSION_SPEC
    ));
    if (conflictingEntry) {
      throw new SetupFailure(
        'PINNED_ENTRY_CONFLICT',
        'UNCHANGED',
        'A pinned package entry already exists',
      );
    }

    const backupKind = pathKind(backupPath);
    if (backupKind !== 'missing') {
      if (!managedCreateTargetIsTrusted(projectRoot, backupPath)) {
        throw new SetupFailure('MANAGED_PATH_UNTRUSTED', 'UNCHANGED', 'Settings backup path is untrusted');
      }
      throw new SetupFailure('BACKUP_ALREADY_EXISTS', 'UNCHANGED', 'Settings backup already exists');
    }
    if (!managedPathIsTrusted(projectRoot, backupPath, 'missing')) {
      throw new SetupFailure('MANAGED_PATH_UNTRUSTED', 'UNCHANGED', 'Settings backup path is untrusted');
    }
    try {
      writeFileSync(backupPath, serializeJson(SETTINGS_BACKUP_METADATA), { flag: 'wx' });
    } catch {
      throw new SetupFailure('BACKUP_ALREADY_EXISTS', 'UNCHANGED', 'Settings backup already exists');
    }

    settings.packages = packages;
    const packageEntry = { source: EXTENSION_SPEC, autoload: false };
    packages.push(packageEntry);
    try {
      if (!managedPathIsTrusted(projectRoot, settingsPath, 'file')) {
        throw new SetupFailure('MANAGED_PATH_UNTRUSTED', 'INERT', 'Settings path changed before staging');
      }
      writeJsonAtomic(settingsPath, settings);
    } catch (error) {
      if (error instanceof SetupFailure) throw error;
      throw new SetupFailure('SETTINGS_STAGE_WRITE_FAILED', 'INERT', 'Could not stage settings');
    }

    if (
      !managedPathIsTrusted(projectRoot, piDirectory, 'directory')
      || !managedPathIsTrusted(projectRoot, settingsPath, 'file')
      || !managedPathIsTrusted(projectRoot, backupPath, 'file')
      || !managedCreateTargetIsTrusted(projectRoot, enabledBackupPath)
      || !managedCreateTargetIsTrusted(projectRoot, lockPath)
      || !managedCreateTargetIsTrusted(projectRoot, configPath)
      || !managedPathIsTrustedWhenAbsent(projectRoot, clonePath, 'directory')
      || !managedPathIsTrustedWhenAbsent(projectRoot, packagePath, 'file')
    ) {
      throw new SetupFailure('MANAGED_PATH_UNTRUSTED', 'INERT', 'Managed paths changed before Pi update');
    }
    const updateResult = runTrustedCommand(
      piExecutable,
      ['update', '--extension', EXTENSION_SPEC, '--approve'],
      projectRoot,
      projectRoot,
    );
    if (!updateResult.ok) {
      throw new SetupFailure(
        updateResult.reason === 'UNTRUSTED'
          ? 'PI_EXECUTABLE_UNTRUSTED'
          : updateResult.reason === 'OUTPUT_LIMIT'
            ? 'PI_UPDATE_OUTPUT_LIMIT_EXCEEDED'
            : 'PI_UPDATE_FAILED',
        'INERT',
        'Pi update failed',
      );
    }

    if (
      !managedPathIsTrusted(projectRoot, piDirectory, 'directory')
      || !managedPathIsTrusted(projectRoot, settingsPath, 'file')
      || !managedPathIsTrusted(projectRoot, backupPath, 'file')
      || !managedCreateTargetIsTrusted(projectRoot, enabledBackupPath)
      || !managedCreateTargetIsTrusted(projectRoot, lockPath)
      || !managedCreateTargetIsTrusted(projectRoot, configPath)
      || !managedPathIsTrustedWhenAbsent(projectRoot, clonePath, 'directory')
      || !managedPathIsTrustedWhenAbsent(projectRoot, packagePath, 'file')
    ) {
      throw new SetupFailure('MANAGED_PATH_UNTRUSTED', 'INERT', 'Managed paths changed after Pi update');
    }
    const cloneKind = pathKind(clonePath);
    if (cloneKind === 'missing') {
      if (!managedPathIsTrusted(projectRoot, clonePath, 'missing')) {
        throw new SetupFailure('MANAGED_PATH_UNTRUSTED', 'INERT', 'Clone parent is untrusted');
      }
      throw new SetupFailure('CLONE_MISSING', 'INERT', 'Extension clone is missing');
    }
    if (cloneKind !== 'directory' || !managedPathIsTrusted(projectRoot, clonePath, 'directory')) {
      throw new SetupFailure('MANAGED_PATH_UNTRUSTED', 'INERT', 'Clone path is untrusted');
    }
    if (pathKind(packagePath) !== 'missing' && !managedPathIsTrusted(projectRoot, packagePath, 'file')) {
      throw new SetupFailure('MANAGED_PATH_UNTRUSTED', 'INERT', 'Package path is untrusted');
    }

    const gitResult = runTrustedCommand(
      gitExecutable,
      ['-C', clonePath, 'rev-parse', 'HEAD'],
      projectRoot,
    );
    if (!gitResult.ok) {
      throw new SetupFailure(
        gitResult.reason === 'UNTRUSTED'
          ? 'GIT_EXECUTABLE_UNTRUSTED'
          : gitResult.reason === 'OUTPUT_LIMIT'
            ? 'GIT_OUTPUT_LIMIT_EXCEEDED'
            : 'GIT_COMMAND_FAILED',
        'INERT',
        'Could not verify extension clone HEAD',
      );
    }
    const cloneHead = gitResult.stdout.trim();
    if (!/^[0-9a-f]{40}$/.test(cloneHead)) {
      throw new SetupFailure('GIT_HEAD_MALFORMED', 'INERT', 'Extension clone HEAD is malformed');
    }
    if (cloneHead !== PINNED_COMMIT) {
      throw new SetupFailure('GIT_HEAD_MISMATCH', 'INERT', 'Extension clone HEAD is not pinned');
    }

    if (!managedPathIsTrustedWhenAbsent(projectRoot, packagePath, 'file')) {
      throw new SetupFailure('MANAGED_PATH_UNTRUSTED', 'INERT', 'Package path changed during verification');
    }
    const packageFailure = verifyPackageManifest(packagePath);
    if (packageFailure) {
      throw new SetupFailure(packageFailure, 'INERT', 'Extension package metadata is invalid');
    }

    writeJsonAtomicCreate(
      projectRoot,
      join(piDirectory, 'openai-server-compaction.lock.json'),
      {
        schemaVersion: 1,
        packageName: PACKAGE_NAME,
        source: EXTENSION_SPEC,
        commit: PINNED_COMMIT,
        clonePath: CLONE_RELATIVE_PATH,
      },
      'LOCK_TARGET_OBSTRUCTED',
    );
    writeJsonAtomicCreate(
      projectRoot,
      join(piDirectory, 'openai-server-compaction.json'),
      {
        schemaVersion: 1,
        enabled: true,
        store: true,
      },
      'CONFIG_TARGET_OBSTRUCTED',
    );

    packageEntry.autoload = true;
    try {
      if (!managedPathIsTrusted(projectRoot, settingsPath, 'file')) {
        throw new SetupFailure('MANAGED_PATH_UNTRUSTED', 'INERT', 'Settings path changed before activation');
      }
      writeJsonAtomic(settingsPath, settings);
    } catch (error) {
      if (error instanceof SetupFailure) throw error;
      throw new SetupFailure(
        'SETTINGS_ACTIVATION_WRITE_FAILED',
        'INERT',
        'Could not activate settings',
      );
    }
    return { status: 'READY' };
  } catch (error) {
    if (error instanceof SetupFailure) {
      return notReady(error.code, error.retainedState);
    }
    throw error;
  }
}

interface ActiveEnabledState {
  settingsPath: string;
  configPath: string;
  enabledBackupPath: string;
  settings: Record<string, unknown>;
  config: Record<string, unknown>;
  pinnedEntry: Record<string, unknown>;
}

// Observed "on" state, independent of the lock or clone: config.enabled and the
// pinned entry's autoload are the only two live switches disable must flip off.
// A missing or malformed lock does not make an actively enabled extension inert.
function activeEnabledState(projectRoot: string): ActiveEnabledState | null {
  const piDirectory = join(projectRoot, '.pi');
  const settingsPath = join(piDirectory, 'settings.json');
  const configPath = join(piDirectory, 'openai-server-compaction.json');
  const enabledBackupPath = join(piDirectory, ENABLED_CONFIG_BACKUP_NAME);
  if (
    !managedPathIsTrusted(projectRoot, piDirectory, 'directory')
    || !managedPathIsTrusted(projectRoot, settingsPath, 'file')
    || !managedPathIsTrusted(projectRoot, configPath, 'file')
    || !managedCreateTargetIsTrusted(projectRoot, enabledBackupPath)
  ) return null;

  const settings = readJsonObject(settingsPath);
  const config = readJsonObject(configPath);
  const pinnedEntries = pinnedPackageEntries(settings);
  if (
    !settings
    || !config
    || config.enabled !== true
    || pinnedEntries.length !== 1
    || pinnedEntries[0].autoload !== true
  ) return null;
  return {
    settingsPath,
    configPath,
    enabledBackupPath,
    settings,
    config,
    pinnedEntry: pinnedEntries[0],
  };
}

function disable(projectRoot: string): CheckReport {
  projectRoot = trustedProjectRoot(projectRoot);
  const active = activeEnabledState(projectRoot);
  if (!active) return check(projectRoot);

  const enabledConfigBytes = readFileSync(active.configPath);
  const enabledBackupKind = pathKind(active.enabledBackupPath);
  if (enabledBackupKind !== 'missing') {
    if (!managedCreateTargetIsTrusted(projectRoot, active.enabledBackupPath)) {
      return notReady('MANAGED_PATH_UNTRUSTED', 'UNCHANGED');
    }
    // Reuse an existing enabled-config backup whenever it is still a valid
    // manager-shaped enabled config. The backup is only a presence marker (it is
    // never restored from), so a stale-but-valid snapshot from an earlier disable
    // cycle - even one the extension mutated while enabled in between - must not
    // block. Only an operator-owned backup that is not a valid enabled config
    // (arbitrary/non-JSON content) is treated as a genuine conflict and blocks.
    const existingBackup = enabledBackupKind === 'file'
      ? parseJsonObject(readFileSync(active.enabledBackupPath))
      : null;
    const backupIsValidEnabledConfig = existingBackup !== null
      && existingBackup.schemaVersion === 1
      && existingBackup.enabled === true
      && existingBackup.store === true;
    if (!backupIsValidEnabledConfig) {
      return notReady('ENABLED_CONFIG_BACKUP_ALREADY_EXISTS', 'UNCHANGED');
    }
  } else {
    if (!managedPathIsTrusted(projectRoot, active.enabledBackupPath, 'missing')) {
      return notReady('MANAGED_PATH_UNTRUSTED', 'UNCHANGED');
    }
    try {
      writeFileSync(active.enabledBackupPath, enabledConfigBytes, { flag: 'wx' });
    } catch {
      return notReady('ENABLED_CONFIG_BACKUP_ALREADY_EXISTS', 'UNCHANGED');
    }
  }

  active.config.enabled = false;
  const disabledConfig = serializeJson(active.config);
  if (!managedPathIsTrusted(projectRoot, active.configPath, 'file')) {
    return notReady('DISABLE_CONFIG_WRITE_FAILED', 'INERT');
  }
  try {
    writeTextAtomic(active.configPath, disabledConfig);
  } catch {
    return notReady('DISABLE_CONFIG_WRITE_FAILED', 'INERT');
  }

  active.pinnedEntry.autoload = false;
  const disabledSettings = serializeJson(active.settings);
  if (!managedPathIsTrusted(projectRoot, active.settingsPath, 'file')) {
    return notReady('DISABLE_SETTINGS_WRITE_FAILED', 'INERT');
  }
  try {
    writeTextAtomic(active.settingsPath, disabledSettings);
  } catch {
    return notReady('DISABLE_SETTINGS_WRITE_FAILED', 'INERT');
  }
  return { status: 'DISABLED' };
}

function main(): void {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.command === 'check') {
      const report = check(options.projectRoot);
      console.log(JSON.stringify(report));
      if (report.status === 'NOT_READY') process.exitCode = 2;
      return;
    }
    if (options.command === 'disable') {
      const report = disable(options.projectRoot);
      console.log(JSON.stringify(report));
      if (report.status === 'NOT_READY') process.exitCode = 2;
      return;
    }
    const report = setup(options.projectRoot);
    console.log(JSON.stringify(report));
    if (report.status === 'NOT_READY') process.exitCode = 2;
  } catch (error) {
    const report: ErrorReport = {
      status: 'ERROR',
      code: error instanceof CliError ? error.code : 'UNEXPECTED_ERROR',
      message: error instanceof Error ? error.message : String(error),
    };
    console.log(JSON.stringify(report));
    process.exitCode = 1;
  }
}

if (import.meta.main) main();
