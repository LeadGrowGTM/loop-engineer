import { describe, expect, test } from 'bun:test';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { delimiter, dirname, join, resolve } from 'path';

const SCRIPT = join(import.meta.dir, 'prepare-harness-run.ps1');
const LAUNCHER = join(import.meta.dir, 'launch-gnhf.ps1');
const README = join(import.meta.dir, '..', 'README.md');
const REPO_INSTRUCTIONS = join(import.meta.dir, '..', 'CLAUDE.md');
const CHECK_ONLY_OPERATOR_CONTRACT =
  'The `-CheckOnly` mode does not start task execution and does not mutate Git state.';
const PREPARE_ISOLATION_OPERATOR_CONTRACT =
  'The `-PrepareIsolation` mode acquires a Treehouse lease and creates a unique derived `runBranch` at the checked source `HEAD` before returning READY.';
const WINDOWS_POWERSHELL = process.platform === 'win32' ? Bun.which('powershell.exe') : undefined;
const STREAM_CLOSED_PROCESS_LAUNCHER = String.raw`
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

public static class HarnessTestStreamClosedProcess
{
    private const uint CREATE_NO_WINDOW = 0x08000000;
    private const int STARTF_USESTDHANDLES = 0x00000100;
    private const int STD_INPUT_HANDLE = -10;
    private const int STD_OUTPUT_HANDLE = -11;
    private const int STD_ERROR_HANDLE = -12;

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct STARTUPINFO
    {
        public int cb;
        public string lpReserved;
        public string lpDesktop;
        public string lpTitle;
        public int dwX;
        public int dwY;
        public int dwXSize;
        public int dwYSize;
        public int dwXCountChars;
        public int dwYCountChars;
        public int dwFillAttribute;
        public int dwFlags;
        public short wShowWindow;
        public short cbReserved2;
        public IntPtr lpReserved2;
        public IntPtr hStdInput;
        public IntPtr hStdOutput;
        public IntPtr hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct PROCESS_INFORMATION
    {
        public IntPtr hProcess;
        public IntPtr hThread;
        public int unusedProcessNumber;
        public int unusedThreadNumber;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CreateProcessW(
        string applicationName,
        StringBuilder commandLine,
        IntPtr processAttributes,
        IntPtr threadAttributes,
        bool inheritHandles,
        uint creationFlags,
        IntPtr environment,
        string currentDirectory,
        ref STARTUPINFO startupInfo,
        out PROCESS_INFORMATION processInformation);

    [DllImport("kernel32.dll")]
    private static extern IntPtr GetStdHandle(int standardHandle);

    [DllImport("kernel32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CloseHandle(IntPtr handle);

    public static void Start(string executable, string arguments)
    {
        Start(executable, arguments, false);
    }

    public static void StartWithInheritedStreams(string executable, string arguments)
    {
        Start(executable, arguments, true);
    }

    private static void Start(string executable, string arguments, bool inheritStreams)
    {
        var startupInfo = new STARTUPINFO();
        startupInfo.cb = Marshal.SizeOf(startupInfo);
        if (inheritStreams)
        {
            startupInfo.dwFlags = STARTF_USESTDHANDLES;
            startupInfo.hStdInput = GetStdHandle(STD_INPUT_HANDLE);
            startupInfo.hStdOutput = GetStdHandle(STD_OUTPUT_HANDLE);
            startupInfo.hStdError = GetStdHandle(STD_ERROR_HANDLE);
        }
        PROCESS_INFORMATION processInformation;
        var commandLine = new StringBuilder("\"" + executable + "\" " + arguments);
        if (!CreateProcessW(
            executable,
            commandLine,
            IntPtr.Zero,
            IntPtr.Zero,
            inheritStreams,
            CREATE_NO_WINDOW,
            IntPtr.Zero,
            null,
            ref startupInfo,
            out processInformation))
        {
            var error = Marshal.GetLastWin32Error();
            throw new Win32Exception(error);
        }
        CloseHandle(processInformation.hThread);
        CloseHandle(processInformation.hProcess);
    }
}
`;
const INHERITED_OUTPUT_GIT_SOURCE = String.raw`
using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public static class HarnessTestInheritedOutputGit
{
    private const uint CREATE_NO_WINDOW = 0x08000000;
    private const int STARTF_USESTDHANDLES = 0x00000100;
    private const int STD_INPUT_HANDLE = -10;
    private const int STD_OUTPUT_HANDLE = -11;
    private const int STD_ERROR_HANDLE = -12;
    private const uint INFINITE = 0xffffffff;

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct STARTUPINFO
    {
        public int cb;
        public string lpReserved;
        public string lpDesktop;
        public string lpTitle;
        public int dwX;
        public int dwY;
        public int dwXSize;
        public int dwYSize;
        public int dwXCountChars;
        public int dwYCountChars;
        public int dwFillAttribute;
        public int dwFlags;
        public short wShowWindow;
        public short cbReserved2;
        public IntPtr lpReserved2;
        public IntPtr hStdInput;
        public IntPtr hStdOutput;
        public IntPtr hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct PROCESS_INFORMATION
    {
        public IntPtr hProcess;
        public IntPtr hThread;
        public int unusedProcessNumber;
        public int unusedThreadNumber;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CreateProcessW(
        string applicationName,
        StringBuilder commandLine,
        IntPtr processAttributes,
        IntPtr threadAttributes,
        bool inheritHandles,
        uint creationFlags,
        IntPtr environment,
        string currentDirectory,
        ref STARTUPINFO startupInfo,
        out PROCESS_INFORMATION processInformation);

    [DllImport("kernel32.dll")]
    private static extern IntPtr GetStdHandle(int standardHandle);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool FlushFileBuffers(IntPtr handle);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetExitCodeProcess(IntPtr process, out uint exitCode);

    [DllImport("kernel32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CloseHandle(IntPtr handle);

    [DllImport("kernel32.dll")]
    private static extern void ExitProcess(uint exitCode);

    public static int Main(string[] arguments)
    {
        if (Array.IndexOf(arguments, "status") >= 0)
        {
            return EmitInheritedDirtyStatus();
        }
        return RunAndWait(Environment.GetEnvironmentVariable("HARNESS_REAL_GIT"), JoinArguments(arguments));
    }

    private static int EmitInheritedDirtyStatus()
    {
        var powershell = Environment.GetEnvironmentVariable("HARNESS_EVENT_POWERSHELL");
        var eventCommand = Environment.GetEnvironmentVariable("HARNESS_EVENT_COMMAND");
        var child = Start(powershell, "-NoProfile -NonInteractive -EncodedCommand " + eventCommand);
        CloseHandle(child.hProcess);

        var readyPath = Environment.GetEnvironmentVariable("HARNESS_EVENT_READY");
        var timer = Stopwatch.StartNew();
        while (!File.Exists(readyPath) && timer.ElapsedMilliseconds < 5000)
        {
            Thread.Sleep(10);
        }
        if (!File.Exists(readyPath))
        {
            Console.Error.Write("Inherited event child did not become ready.");
            return 9;
        }

        var encoding = new UTF8Encoding(false);
        var errorThread = new Thread(() =>
        {
            var standardError = Console.OpenStandardError();
            var errorBody = encoding.GetBytes(new string('e', 1536 * 1024));
            standardError.Write(errorBody, 0, errorBody.Length);
            var errorTail = encoding.GetBytes(Environment.GetEnvironmentVariable("HARNESS_STDERR_MARKER"));
            standardError.Write(errorTail, 0, errorTail.Length);
            standardError.Flush();
        });
        errorThread.Start();

        var output = Console.OpenStandardOutput();
        var body = encoding.GetBytes("?? " + new string('x', 2 * 1024 * 1024));
        output.Write(body, 0, body.Length);
        output.Flush();
        if (!FlushFileBuffers(GetStdHandle(STD_OUTPUT_HANDLE)))
        {
            throw new Win32Exception(Marshal.GetLastWin32Error());
        }
        var tail = encoding.GetBytes(new string('t', 16 * 1024) + Environment.GetEnvironmentVariable("HARNESS_DIRTY_TAIL") + "\0");
        output.Write(tail, 0, tail.Length);
        output.Flush();
        errorThread.Join();
        ExitProcess(0);
        return 0;
    }

    private static int RunAndWait(string executable, string arguments)
    {
        var child = Start(executable, arguments);
        var waitResult = WaitForSingleObject(child.hProcess, INFINITE);
        if (waitResult != 0)
        {
            CloseHandle(child.hProcess);
            throw new Win32Exception("WaitForSingleObject returned " + waitResult + ".");
        }
        uint exitCode;
        if (!GetExitCodeProcess(child.hProcess, out exitCode))
        {
            var error = Marshal.GetLastWin32Error();
            CloseHandle(child.hProcess);
            throw new Win32Exception(error);
        }
        CloseHandle(child.hProcess);
        return unchecked((int)exitCode);
    }

    private static PROCESS_INFORMATION Start(string executable, string arguments)
    {
        var startupInfo = new STARTUPINFO();
        startupInfo.cb = Marshal.SizeOf(startupInfo);
        startupInfo.dwFlags = STARTF_USESTDHANDLES;
        startupInfo.hStdInput = GetStdHandle(STD_INPUT_HANDLE);
        startupInfo.hStdOutput = GetStdHandle(STD_OUTPUT_HANDLE);
        startupInfo.hStdError = GetStdHandle(STD_ERROR_HANDLE);
        PROCESS_INFORMATION processInformation;
        var commandLine = new StringBuilder("\"" + executable + "\" " + arguments);
        if (!CreateProcessW(
            executable,
            commandLine,
            IntPtr.Zero,
            IntPtr.Zero,
            true,
            CREATE_NO_WINDOW,
            IntPtr.Zero,
            null,
            ref startupInfo,
            out processInformation))
        {
            var error = Marshal.GetLastWin32Error();
            throw new Win32Exception(error);
        }
        CloseHandle(processInformation.hThread);
        return processInformation;
    }

    private static string JoinArguments(string[] arguments)
    {
        var builder = new StringBuilder();
        foreach (var argument in arguments)
        {
            if (builder.Length > 0) builder.Append(' ');
            builder.Append(Quote(argument));
        }
        return builder.ToString();
    }

    private static string Quote(string value)
    {
        if (value.Length == 0) return "\"\"";
        if (value.IndexOfAny(new[] { ' ', '\t', '\"' }) < 0) return value;
        var builder = new StringBuilder();
        builder.Append('\"');
        var backslashes = 0;
        foreach (var character in value)
        {
            if (character == '\\')
            {
                backslashes++;
                continue;
            }
            if (character == '\"')
            {
                builder.Append('\\', (backslashes * 2) + 1);
                builder.Append('\"');
                backslashes = 0;
                continue;
            }
            builder.Append('\\', backslashes);
            backslashes = 0;
            builder.Append(character);
        }
        builder.Append('\\', backslashes * 2);
        builder.Append('\"');
        return builder.ToString();
    }
}
`;
const POWERSHELL = Bun.which('pwsh') ?? WINDOWS_POWERSHELL ?? Bun.which('powershell');
if (!POWERSHELL) throw new Error('PowerShell executable not found');
if (process.platform === 'win32' && !WINDOWS_POWERSHELL) {
  throw new Error('Documented powershell.exe executable not found');
}
const windowsTest = process.platform === 'win32' ? test : test.skip;

// Loaded Windows measurements: 846 ms fixture setup, 289 ms worktree setup,
// 340-1,054 ms PowerShell startup, 2,775 ms single readiness, and 6,707 ms for
// readiness plus a real worktree. Attempt 08 under 32-worker load reached Bun's
// 5-second ceiling on four named readiness seams at 5,047-5,188 ms. Attempt 09
// measured the full clean READY path at 11,812 ms. Attempt 11 measured the Job
// Object dirty-tree seam at 10,016 ms. Only those measured seams get explicit
// outer bounds; no global timeout is widened.
const CLEAN_READY_TEST_TIMEOUT_MS = 20_000;
const DIRTY_TREE_TEST_TIMEOUT_MS = 20_000;
const THREE_ROOT_VALIDATION_TEST_TIMEOUT_MS = 15_000;
const MODE_VALIDATION_TEST_TIMEOUT_MS = 10_000;
const TREEHOUSE_STATUS_TEST_TIMEOUT_MS = 10_000;
// Unknown-default plus explicit-default readiness measured 15,344 ms, so this
// two-call seam gets its own bound without weakening other readiness tests.
const DEFAULT_BRANCH_PAIR_TEST_TIMEOUT_MS = 20_000;
// Readiness-suite replay measured isolation preparation at 22,094 ms after the
// process-cleanup tests, including one in-wrapper interop compile per command.
const ISOLATION_PREPARATION_TEST_TIMEOUT_MS = 30_000;
// Full-suite replay measured the two-call canonical worktree path at 29,344 ms.
// Keep a bounded margin without weakening unrelated readiness tests.
const CANONICAL_ISOLATION_TEST_TIMEOUT_MS = 40_000;
// The two-call default-branch and default/detached seams measured 15,344 ms and
// 16,360 ms under load, so both share the measured double-readiness bound.
const DOUBLE_READINESS_TEST_TIMEOUT_MS = 25_000;
// Timeout cleanup measured 8,407 ms under load with the prior 2,500 ms process
// timeout and a 5,000 ms cleanup deadline. The control connection adds a second
// bounded setup pipe, so failure fixtures allow 3,000 ms within the same prompt bound.
const INTERNAL_TREEHOUSE_TIMEOUT_ARGUMENT = '-InternalTreehouseStatusTimeoutMilliseconds';
const FAILURE_INNER_TIMEOUT_MS = 3_000;
// Readiness-suite replay needed more than 5 seconds for the inherited-stream
// grandchild to report normal status under accumulated process load.
const FLOOD_FALLBACK_TIMEOUT_MS = 7_500;
// The exiting-broker flood reached the 5-second inner bound after control-pipe setup.
const BROKER_FLOOD_FALLBACK_TIMEOUT_MS = 7_500;
// Full-suite replay hit the 15,016 ms outer deadline during named-event release;
// the command invocation remained below its existing 14-second prompt bound.
const TIMEOUT_PROMPT_LIMIT_MS = 14_000;
const TIMEOUT_CLEANUP_TEST_TIMEOUT_MS = 20_000;
// Readiness-suite replay measured inherited-stream grandchild settlement at
// 13,547 ms. Keep bounded prompt and outer margins for that process family.
const DANGLING_PROMPT_LIMIT_MS = 18_000;
const DANGLING_CLEANUP_TEST_TIMEOUT_MS = 20_000;
const OUTPUT_LIMIT_PROMPT_LIMIT_MS = 12_000;
// Attempt 11 measured the 3.5 MiB inherited-output stress seam at 12,845 ms.
const INHERITED_OUTPUT_PROMPT_LIMIT_MS = 20_000;
// Attempt 13 measured normal-success stream-closed settlement at 12,359 ms.
const NORMAL_SUCCESS_DAEMON_PROMPT_LIMIT_MS = 20_000;
const OUTPUT_LIMIT_CLEANUP_TEST_TIMEOUT_MS = 15_000;
const INHERITED_OUTPUT_TEST_TIMEOUT_MS = 25_000;
const NORMAL_SUCCESS_DAEMON_TEST_TIMEOUT_MS = 25_000;

const GIT_NON_MUTATION_CLAIM =
  /[^.!?]{0,240}\b(?:never|without|does not)\b[^.!?]{0,160}\b(?:mutat(?:e|es|ing)|chang(?:e|es|ing))\s+git state\b/gi;

function renderHelp(script: string): string {
  const result = Bun.spawnSync(
    [POWERSHELL, '-NoProfile', '-Command', 'Get-Help -Full $env:HARNESS_HELP_SCRIPT | Out-String -Width 4096'],
    {
      env: { ...process.env, HARNESS_HELP_SCRIPT: script },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  if (result.exitCode !== 0) {
    throw new Error(
      `Get-Help failed (${result.exitCode}) for ${script}\nstdout: ${result.stdout.toString()}\nstderr: ${result.stderr.toString()}`,
    );
  }
  return result.stdout.toString().replace(/\s+/g, ' ').trim();
}

function expectNoBlanketGitNonMutation(contract: string): void {
  const claims = contract.match(GIT_NON_MUTATION_CLAIM) ?? [];
  expect(claims.length).toBeGreaterThan(0);
  for (const claim of claims) expect(claim).toMatch(/\bCheckOnly\b/i);
}

function namedEventExists(name: string): boolean {
  const result = Bun.spawnSync(
    [
      WINDOWS_POWERSHELL!,
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'try { $event = [System.Threading.EventWaitHandle]::OpenExisting($env:HARNESS_TEST_EVENT_NAME); $event.Dispose(); exit 0 } catch [System.Threading.WaitHandleCannotBeOpenedException] { exit 1 }',
    ],
    {
      env: { ...process.env, HARNESS_TEST_EVENT_NAME: name },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  if (result.exitCode === 0) return true;
  if (result.exitCode === 1) return false;
  throw new Error(`Named event probe failed: ${result.stderr.toString()}`);
}

function releaseNamedEvent(name: string): void {
  const signal = Bun.spawnSync(
    [
      WINDOWS_POWERSHELL!,
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'try { $event = [System.Threading.EventWaitHandle]::OpenExisting($env:HARNESS_TEST_EVENT_NAME); [void]$event.Set(); $event.Dispose() } catch [System.Threading.WaitHandleCannotBeOpenedException] {}; exit 0',
    ],
    {
      env: { ...process.env, HARNESS_TEST_EVENT_NAME: name },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  if (signal.exitCode !== 0) throw new Error(`Named event signal failed: ${signal.stderr.toString()}`);

  const wait = Bun.spawnSync(
    [
      WINDOWS_POWERSHELL!,
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '$timer = [System.Diagnostics.Stopwatch]::StartNew(); while ($timer.ElapsedMilliseconds -lt 5000) { try { $event = [System.Threading.EventWaitHandle]::OpenExisting($env:HARNESS_TEST_EVENT_NAME); $event.Dispose() } catch [System.Threading.WaitHandleCannotBeOpenedException] { exit 0 }; Start-Sleep -Milliseconds 20 }; exit 1',
    ],
    {
      env: { ...process.env, HARNESS_TEST_EVENT_NAME: name },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  expect(wait.exitCode).toBe(0);
}

function buildInheritedOutputGit(): { bin: string; executable: string; realGit: string } {
  const realGit = Bun.which('git');
  if (!realGit) throw new Error('Git executable not found');
  const root = mkdtempSync(join(tmpdir(), 'prepare-harness-inherited-git-'));
  const bin = join(root, 'bin');
  const executable = join(bin, 'git.exe');
  mkdirSync(bin, { recursive: true });
  const result = Bun.spawnSync(
    [
      WINDOWS_POWERSHELL!,
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Add-Type -TypeDefinition $env:HARNESS_GIT_SOURCE -OutputAssembly $env:HARNESS_GIT_EXE -OutputType ConsoleApplication',
    ],
    {
      env: {
        ...process.env,
        HARNESS_GIT_SOURCE: INHERITED_OUTPUT_GIT_SOURCE,
        HARNESS_GIT_EXE: executable,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  if (result.exitCode !== 0) {
    throw new Error(`Inherited-output Git fixture failed to compile: ${result.stderr.toString()}`);
  }
  return { bin, executable, realGit };
}

function treehouseTimeoutArgs(timeoutMilliseconds: number): string[] {
  return [INTERNAL_TREEHOUSE_TIMEOUT_ARGUMENT, String(timeoutMilliseconds)];
}

function run(command: string[], cwd?: string): string {
  const result = Bun.spawnSync(command, {
    cwd,
    env: process.env,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  if (result.exitCode !== 0) {
    throw new Error(
      `Command failed (${result.exitCode}): ${command.join(' ')}\nstdout: ${result.stdout.toString()}\nstderr: ${result.stderr.toString()}`,
    );
  }
  return result.stdout.toString().trim();
}

function createFeatureRepo(defaultBranch = 'main'): { workspace: string; repo: string } {
  const workspace = mkdtempSync(join(tmpdir(), 'prepare-harness-run-'));
  const repo = join(workspace, 'repos', 'repo with spaces & chars');
  mkdirSync(repo, { recursive: true });
  run(['git', 'init', '-b', defaultBranch], repo);
  run(['git', 'config', 'user.name', 'Harness Test'], repo);
  run(['git', 'config', 'user.email', 'harness-test@example.invalid'], repo);
  writeFileSync(join(repo, 'README.md'), '# fixture\n');
  run(['git', 'add', 'README.md'], repo);
  run(['git', 'commit', '-m', 'fixture'], repo);
  run(['git', 'switch', '-c', 'feature/readiness'], repo);
  return { workspace, repo };
}

function createCanonicalPipeline(): { workspace: string; pipeline: string } {
  const workspace = mkdtempSync(join(tmpdir(), 'prepare-harness-canonical-'));
  const pipeline = join(workspace, 'pipelines', 'content');
  mkdirSync(pipeline, { recursive: true });
  run(['git', 'init', '-b', 'main'], workspace);
  run(['git', 'config', 'user.name', 'Harness Test'], workspace);
  run(['git', 'config', 'user.email', 'harness-test@example.invalid'], workspace);
  writeFileSync(join(workspace, '.gitignore'), '!pipelines/content/\n');
  writeFileSync(join(pipeline, 'README.md'), '# canonical fixture\n');
  run(['git', 'add', '.gitignore', 'pipelines/content/README.md'], workspace);
  run(['git', 'commit', '-m', 'fixture'], workspace);
  run(['git', 'switch', '-c', 'feature/readiness'], workspace);
  return { workspace, pipeline };
}

function createRootRepo(defaultBranch = 'main', createFeature = true): string {
  const repo = mkdtempSync(join(tmpdir(), 'prepare-harness-root-'));
  run(['git', 'init', '-b', defaultBranch], repo);
  run(['git', 'config', 'user.name', 'Harness Test'], repo);
  run(['git', 'config', 'user.email', 'harness-test@example.invalid'], repo);
  writeFileSync(join(repo, 'README.md'), '# root fixture\n');
  run(['git', 'add', 'README.md'], repo);
  run(['git', 'commit', '-m', 'fixture'], repo);
  if (createFeature) run(['git', 'switch', '-c', 'feature/readiness'], repo);
  return repo;
}

function invokePrepareCommand(
  repo: string,
  workspace: string,
  args: string[],
  env: Record<string, string | undefined> = process.env,
  powershell = POWERSHELL,
) {
  return Bun.spawnSync(
    [
      powershell,
      '-NoProfile',
      '-File',
      SCRIPT,
      '-RepoPath',
      repo,
      '-WorkspaceRoot',
      workspace,
      ...args,
    ],
    {
      env,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
}

function invokePrepare(repo: string, workspace: string, extraArgs: string[] = []) {
  return invokePrepareCommand(repo, workspace, ['-CheckOnly', ...extraArgs]);
}

function fakeTreehouse(
  repo: string,
  statusBody: string[] = ['exit 0'],
  getBody: string[] = ['[Console]::Out.WriteLine($env:TREEHOUSE_LEASE)', 'exit 0'],
  startRef = 'HEAD',
): {
  env: Record<string, string | undefined>;
  calls: string;
  cwdLog: string;
  lease: string;
} {
  const root = mkdtempSync(join(tmpdir(), 'prepare-harness-treehouse-'));
  const bin = join(root, 'bin');
  const lease = join(root, 'leased worktree');
  const calls = join(root, 'treehouse-calls.txt');
  const cwdLog = join(root, 'treehouse-cwd.txt');
  mkdirSync(bin, { recursive: true });
  run(['git', 'worktree', 'add', '--detach', lease, startRef], repo);
  writeFileSync(
    join(bin, 'treehouse.ps1'),
    [
      '$command = $args[0]',
      '[System.IO.File]::AppendAllText($env:TREEHOUSE_CALLS, "$command`r`n")',
      '[System.IO.File]::AppendAllText($env:TREEHOUSE_CWD, "$($PWD.Path)`r`n")',
      'if ($command -eq "status") {',
      ...statusBody.map((line) => `  ${line}`),
      '}',
      'if ($command -eq "get") {',
      ...getBody.map((line) => `  ${line}`),
      '}',
      'if ($command -eq "return") { exit 0 }',
      'exit 2',
      '',
    ].join('\r\n'),
  );
  return {
    calls,
    cwdLog,
    lease,
    env: {
      ...process.env,
      PATH: `${bin};${process.env.PATH ?? ''}`,
      TREEHOUSE_CALLS: calls,
      TREEHOUSE_CWD: cwdLog,
      TREEHOUSE_LEASE: lease,
    },
  };
}

function fakeGnhf(): { env: Record<string, string | undefined>; marker: string } {
  const root = mkdtempSync(join(tmpdir(), 'prepare-harness-no-runner-'));
  const bin = join(root, 'bin');
  const home = join(root, 'home');
  const marker = join(root, 'runner-called.txt');
  mkdirSync(bin, { recursive: true });
  mkdirSync(home, { recursive: true });
  writeFileSync(join(bin, 'gnhf.cmd'), '@echo off\r\necho called>>"%GNHF_MARKER%"\r\n');
  return {
    marker,
    env: {
      ...process.env,
      PATH: `${bin};${process.env.PATH ?? ''}`,
      HOME: home,
      USERPROFILE: home,
      GNHF_MARKER: marker,
    },
  };
}

function withoutTreehouseEnv(): Record<string, string | undefined> {
  const treehouse = Bun.which('treehouse');
  if (!treehouse) return process.env;
  const treehouseDir = resolve(dirname(treehouse)).toLowerCase();
  const path = (process.env.PATH ?? '')
    .split(delimiter)
    .filter((entry) => resolve(entry).toLowerCase() !== treehouseDir)
    .join(delimiter);
  return { ...process.env, PATH: path };
}

describe('prepare-harness-run CLI', () => {
  test('readiness help gives each mode its own Git-state contract', () => {
    const help = renderHelp(SCRIPT);

    expect(help).toContain('-CheckOnly does not mutate Git state.');
    expect(help).toContain(
      '-PrepareIsolation acquires a Treehouse lease and creates a unique derived Git branch at the checked source HEAD before returning READY.',
    );
    expectNoBlanketGitNonMutation(help);
  });

  test('compatibility help scopes non-mutation to check-only mode', () => {
    const help = renderHelp(LAUNCHER);

    expect(help).toContain(
      'Without -Parallel or -PrepareIsolation, it delegates to -CheckOnly, which does not mutate Git state.',
    );
    expect(help).toContain(
      'With -Parallel or -PrepareIsolation, it acquires a Treehouse lease and creates a unique derived Git branch at the checked source HEAD before returning READY.',
    );
    expectNoBlanketGitNonMutation(help);
  });

  test('operator guidance repeats the mode-specific contract', () => {
    for (const guidancePath of [README, REPO_INSTRUCTIONS]) {
      const guidance = readFileSync(guidancePath, 'utf8').replace(/\s+/g, ' ');

      expect(guidance).toContain(CHECK_ONLY_OPERATOR_CONTRACT);
      expect(guidance).toContain(PREPARE_ISOLATION_OPERATOR_CONTRACT);
      expectNoBlanketGitNonMutation(guidance);
    }
  });

  test('clean feature branch with -NoIsolation returns one machine-readable READY result', () => {
    const { workspace, repo } = createFeatureRepo();

    const result = invokePrepare(repo, workspace, ['-NoIsolation']);

    expect(result.exitCode).toBe(0);
    const stdout = result.stdout.toString().trim();
    expect(stdout.split(/\r?\n/)).toHaveLength(1);
    const readiness = JSON.parse(stdout);
    expect(readiness).toMatchObject({
      status: 'READY',
      repoPath: repo,
      branch: 'feature/readiness',
      runBranch: 'feature/readiness',
      defaultBranch: 'main',
      dirtyPaths: [],
      layoutValid: true,
      isolationRequired: false,
      isolationPrepared: false,
      runPath: repo,
      errors: [],
    });
  }, CLEAN_READY_TEST_TIMEOUT_MS);

  test('isolation is the default: a plain CheckOnly requires isolation and is not READY', () => {
    const { workspace, repo } = createFeatureRepo();
    const treehouse = fakeTreehouse(repo);

    const result = invokePrepareCommand(repo, workspace, ['-CheckOnly'], treehouse.env);

    expect(result.exitCode).not.toBe(0);
    const readiness = JSON.parse(result.stdout.toString());
    expect(readiness).toMatchObject({
      status: 'NOT_READY',
      isolationRequired: true,
      isolationPrepared: false,
      treehouseAvailable: true,
      runPath: null,
    });
    expect(readiness.errorCodes).toContain('isolation_not_prepared');
  }, CLEAN_READY_TEST_TIMEOUT_MS);

  test('default isolation without treehouse fails and points at the -NoIsolation opt-out', () => {
    const { workspace, repo } = createFeatureRepo();

    const result = invokePrepareCommand(repo, workspace, ['-CheckOnly'], withoutTreehouseEnv());

    expect(result.exitCode).not.toBe(0);
    const readiness = JSON.parse(result.stdout.toString());
    expect(readiness.isolationRequired).toBe(true);
    expect(readiness.treehouseAvailable).toBe(false);
    expect(readiness.errorCodes).toContain('missing_treehouse');
    expect(readiness.errors.join(' ')).toContain('-NoIsolation');
  }, CLEAN_READY_TEST_TIMEOUT_MS);

  test('-NoIsolation cannot be combined with -PrepareIsolation or -Parallel', () => {
    const { workspace, repo } = createFeatureRepo();

    const withPrepare = invokePrepareCommand(repo, workspace, ['-PrepareIsolation', '-NoIsolation']);
    expect(withPrepare.exitCode).not.toBe(0);
    expect(JSON.parse(withPrepare.stdout.toString()).errorCodes).toContain('invalid_mode');

    const withParallel = invokePrepareCommand(repo, workspace, ['-CheckOnly', '-Parallel', '-NoIsolation']);
    expect(withParallel.exitCode).not.toBe(0);
    expect(JSON.parse(withParallel.stdout.toString()).errorCodes).toContain('invalid_mode');
  }, CLEAN_READY_TEST_TIMEOUT_MS);

  windowsTest('Windows PowerShell preserves a large Git status tail from an inherited daemon', () => {
    const { workspace, repo } = createFeatureRepo();
    const git = buildInheritedOutputGit();
    const eventName = `prepare-harness-${randomUUID()}`;
    const eventReady = join(dirname(git.executable), 'git-event-ready.txt');
    const dirtyTail = `-${randomUUID()}.txt`;
    const dirtyPath = `${'x'.repeat(2 * 1024 * 1024)}${'t'.repeat(16 * 1024)}${dirtyTail}`;
    const stderrMarker = `stderr-${randomUUID()}`;
    const eventCommand = Buffer.from(
      '$created = $false; $event = [System.Threading.EventWaitHandle]::new($false, [System.Threading.EventResetMode]::ManualReset, $env:HARNESS_TEST_EVENT_NAME, [ref]$created); try { [System.IO.File]::WriteAllText($env:HARNESS_EVENT_READY, [string]$created); [void]$event.WaitOne(30000) } finally { $event.Dispose() }',
      'utf16le',
    ).toString('base64');
    const env = {
      ...process.env,
      PATH: `${git.bin}${delimiter}${process.env.PATH ?? ''}`,
      HARNESS_REAL_GIT: git.realGit,
      HARNESS_EVENT_POWERSHELL: WINDOWS_POWERSHELL!,
      HARNESS_EVENT_COMMAND: eventCommand,
      HARNESS_EVENT_READY: eventReady,
      HARNESS_TEST_EVENT_NAME: eventName,
      HARNESS_DIRTY_TAIL: dirtyTail,
      HARNESS_STDERR_MARKER: stderrMarker,
    };

    try {
      const started = performance.now();
      const result = invokePrepareCommand(repo, workspace, ['-CheckOnly'], env, WINDOWS_POWERSHELL!);
      const elapsed = performance.now() - started;

      expect(result.exitCode).not.toBe(0);
      expect(elapsed).toBeLessThan(INHERITED_OUTPUT_PROMPT_LIMIT_MS);
      const stdout = result.stdout.toString().trim();
      expect(stdout.split(/\r?\n/)).toHaveLength(1);
      const readiness = JSON.parse(stdout);
      expect(readiness.errorCodes).toContain('dirty_tree');
      expect(readiness.dirtyPathCount).toBe(1);
      expect(readiness.dirtyPathsTruncated).toBe(false);
      expect(readiness.dirtyPaths).toEqual([dirtyPath]);
      const errors = readiness.errors.join(' ').toLowerCase();
      expect(errors).not.toContain('timed out');
      expect(errors).not.toContain('output exceeded');
      expect(errors).not.toContain('cleanup failed');
      expect(existsSync(eventReady)).toBe(true);
      expect(readFileSync(eventReady, 'utf8')).toBe('True');
      expect(namedEventExists(eventName)).toBe(false);
    } finally {
      releaseNamedEvent(eventName);
    }
  }, INHERITED_OUTPUT_TEST_TIMEOUT_MS);

  test('dirty tree fails with exact paths and creates no commit', () => {
    const { workspace, repo } = createFeatureRepo();
    const commitsBefore = run(['git', 'rev-list', '--count', 'HEAD'], repo);
    writeFileSync(join(repo, 'dirty file.txt'), 'uncommitted\n');

    const result = invokePrepare(repo, workspace);

    expect(result.exitCode).not.toBe(0);
    const stdout = result.stdout.toString().trim();
    expect(stdout.split(/\r?\n/)).toHaveLength(1);
    const readiness = JSON.parse(stdout);
    expect(readiness.status).toBe('NOT_READY');
    expect(readiness.dirtyPaths).toEqual(['dirty file.txt']);
    expect(readiness.errors.join(' ')).toContain('Working tree is dirty');
    expect(run(['git', 'rev-list', '--count', 'HEAD'], repo)).toBe(commitsBefore);
  }, DIRTY_TREE_TEST_TIMEOUT_MS);

  test('default branch and detached HEAD fail with branch remediation', () => {
    const defaultFixture = createFeatureRepo();
    run(['git', 'switch', 'main'], defaultFixture.repo);
    const defaultResult = invokePrepare(defaultFixture.repo, defaultFixture.workspace);
    const defaultReadiness = JSON.parse(defaultResult.stdout.toString());
    expect(defaultResult.exitCode).not.toBe(0);
    expect(defaultReadiness.errors.join(' ')).toContain("Default branch 'main'");

    const detachedFixture = createFeatureRepo();
    run(['git', 'switch', '--detach', 'HEAD'], detachedFixture.repo);
    const detachedResult = invokePrepare(detachedFixture.repo, detachedFixture.workspace);
    const detachedReadiness = JSON.parse(detachedResult.stdout.toString());
    expect(detachedResult.exitCode).not.toBe(0);
    expect(detachedReadiness.errors.join(' ')).toContain('Detached HEAD');
  }, DOUBLE_READINESS_TEST_TIMEOUT_MS);

  test('non-repo, workspace root, and pipelines parent fail explicitly', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'prepare-harness-roots-'));
    const pipelines = join(workspace, 'pipelines');
    const nonRepo = join(workspace, 'not-a-repo');
    mkdirSync(pipelines, { recursive: true });
    mkdirSync(nonRepo, { recursive: true });

    const nonRepoResult = invokePrepare(nonRepo, workspace);
    expect(nonRepoResult.exitCode).not.toBe(0);
    expect(JSON.parse(nonRepoResult.stdout.toString()).errors.join(' ')).toContain('not inside a git repository');

    const workspaceResult = invokePrepare(workspace, workspace);
    expect(workspaceResult.exitCode).not.toBe(0);
    expect(JSON.parse(workspaceResult.stdout.toString()).errors.join(' ').toLowerCase()).toContain('workspace root');

    const pipelinesResult = invokePrepare(pipelines, workspace);
    expect(pipelinesResult.exitCode).not.toBe(0);
    expect(JSON.parse(pipelinesResult.stdout.toString()).errors.join(' ')).toContain('pipelines parent');
  }, THREE_ROOT_VALIDATION_TEST_TIMEOUT_MS);

  test('requires exactly one operation mode', () => {
    const { workspace, repo } = createFeatureRepo();

    const result = invokePrepareCommand(repo, workspace, []);

    expect(result.exitCode).not.toBe(0);
    const readiness = JSON.parse(result.stdout.toString());
    expect(readiness.errors.join(' ')).toContain('exactly one');
  }, MODE_VALIDATION_TEST_TIMEOUT_MS);

  test('unknown default branch fails closed unless explicitly supplied', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'prepare-harness-defaults-'));
    const trunkRepo = join(workspace, 'trunk repo');
    mkdirSync(trunkRepo, { recursive: true });
    run(['git', 'init', '-b', 'trunk'], trunkRepo);
    run(['git', 'config', 'user.name', 'Harness Test'], trunkRepo);
    run(['git', 'config', 'user.email', 'harness-test@example.invalid'], trunkRepo);
    writeFileSync(join(trunkRepo, 'README.md'), '# trunk\n');
    run(['git', 'add', 'README.md'], trunkRepo);
    run(['git', 'commit', '-m', 'fixture'], trunkRepo);
    run(['git', 'switch', '-c', 'feature/readiness'], trunkRepo);

    const unknownResult = invokePrepare(trunkRepo, workspace);
    expect(unknownResult.exitCode).not.toBe(0);
    expect(JSON.parse(unknownResult.stdout.toString()).errors.join(' ')).toContain('default branch');

    const explicitResult = invokePrepare(trunkRepo, workspace, ['-DefaultBranch', 'trunk', '-NoIsolation']);
    expect(explicitResult.exitCode).toBe(0);
    expect(JSON.parse(explicitResult.stdout.toString()).defaultBranch).toBe('trunk');
  }, DEFAULT_BRANCH_PAIR_TEST_TIMEOUT_MS);

  test('unborn HEAD fails closed', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'prepare-harness-unborn-'));
    const unbornRepo = join(workspace, 'unborn repo');
    mkdirSync(unbornRepo, { recursive: true });
    run(['git', 'init', '-b', 'main'], unbornRepo);

    const result = invokePrepare(unbornRepo, workspace);

    expect(result.exitCode).not.toBe(0);
    expect(JSON.parse(result.stdout.toString()).errors.join(' ')).toContain('committed HEAD');
  });

  test('unrelated WorkspaceRoot cannot bypass root and layout gates', () => {
    const repo = createRootRepo();
    mkdirSync(join(repo, 'pipelines', 'rogue-copy'), { recursive: true });
    writeFileSync(join(repo, 'pipelines', 'rogue-copy', 'README.md'), 'rogue\n');
    run(['git', 'add', 'pipelines/rogue-copy/README.md'], repo);
    run(['git', 'commit', '-m', 'add rogue layout'], repo);
    const unrelated = mkdtempSync(join(tmpdir(), 'prepare-harness-unrelated-'));

    const result = invokePrepare(repo, unrelated);

    expect(result.exitCode).not.toBe(0);
    expect(JSON.parse(result.stdout.toString()).errors.join(' ')).toContain('inside WorkspaceRoot');
  });

  test('reparse-point pipeline targets are rejected before canonical classification', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'prepare-harness-reparse-'));
    const external = mkdtempSync(join(tmpdir(), 'prepare-harness-external-'));
    const pipelines = join(workspace, 'pipelines');
    const target = join(pipelines, 'content');
    mkdirSync(pipelines, { recursive: true });
    writeFileSync(join(workspace, '.gitignore'), '!pipelines/content/\n');
    symlinkSync(external, target, 'junction');

    const result = invokePrepare(target, workspace);

    expect(result.exitCode).not.toBe(0);
    expect(JSON.parse(result.stdout.toString()).errors.join(' ').toLowerCase()).toContain('reparse');
  });

  test('reparse-point WorkspaceRoot is rejected before trusting aliased descendants', () => {
    const { workspace, repo } = createFeatureRepo();
    const aliasParent = mkdtempSync(join(tmpdir(), 'prepare-harness-root-alias-'));
    const workspaceAlias = join(aliasParent, 'workspace alias');
    const aliasedRepo = join(workspaceAlias, repo.slice(workspace.length + 1));
    symlinkSync(workspace, workspaceAlias, 'junction');

    const result = invokePrepare(aliasedRepo, workspaceAlias);

    expect(result.exitCode).not.toBe(0);
    const readiness = JSON.parse(result.stdout.toString());
    expect(readiness.errorCodes).toContain('workspace_reparse');
    expect(readiness.errors.join(' ').toLowerCase()).toContain('reparse');
  });

  test('pipeline layout precheck fails closed when pipelines is not a directory', () => {
    const { workspace, repo } = createFeatureRepo();
    writeFileSync(join(workspace, 'pipelines'), 'not a directory\n');

    const result = invokePrepare(repo, workspace);

    expect(result.exitCode).not.toBe(0);
    expect(JSON.parse(result.stdout.toString()).errors.join(' ')).toContain('not a directory');
  });

  test('CheckOnly disables repository fsmonitor execution', () => {
    const { workspace, repo } = createFeatureRepo();
    const hookRoot = mkdtempSync(join(tmpdir(), 'prepare-harness-fsmonitor-'));
    const marker = join(hookRoot, 'fsmonitor-called.txt');
    const hook = join(hookRoot, 'fsmonitor.cmd');
    writeFileSync(hook, `@echo off\r\necho called>>"${marker}"\r\nexit /b 0\r\n`);
    run(['git', 'config', 'core.fsmonitor', hook], repo);

    const result = invokePrepare(repo, workspace, ['-NoIsolation']);

    expect(result.exitCode).toBe(0);
    expect(existsSync(marker)).toBe(false);
  }, CLEAN_READY_TEST_TIMEOUT_MS);

  test('canonical pipeline rejects -NoIsolation and still requires isolation', () => {
    const { workspace, pipeline } = createCanonicalPipeline();

    const result = invokePrepareCommand(pipeline, workspace, ['-CheckOnly', '-NoIsolation']);

    expect(result.exitCode).not.toBe(0);
    const readiness = JSON.parse(result.stdout.toString());
    expect(readiness.isolationRequired).toBe(true);
    expect(readiness.errorCodes).toContain('noisolation_forbidden_canonical');
  }, CANONICAL_ISOLATION_TEST_TIMEOUT_MS);

  test('parallel CheckOnly verifies treehouse but refuses an unprepared run path', () => {
    const { workspace, repo } = createFeatureRepo();
    const treehouse = fakeTreehouse(repo);

    const result = invokePrepareCommand(repo, workspace, ['-CheckOnly', '-Parallel'], treehouse.env);

    expect(result.exitCode).not.toBe(0);
    const readiness = JSON.parse(result.stdout.toString());
    expect(readiness).toMatchObject({
      status: 'NOT_READY',
      readyForRun: false,
      isolationRequired: true,
      isolationPrepared: false,
      treehouseAvailable: true,
      runPath: null,
    });
    expect(readFileSync(treehouse.calls, 'utf8')).toContain('status');
    expect(readFileSync(treehouse.calls, 'utf8')).not.toContain('get');
    expect(readFileSync(treehouse.cwdLog, 'utf8').trim()).toBe(repo);
  }, TREEHOUSE_STATUS_TEST_TIMEOUT_MS);

  windowsTest('Windows PowerShell timeout retains target stderr written before cleanup', () => {
    expect(FAILURE_INNER_TIMEOUT_MS).toBeLessThan(TIMEOUT_PROMPT_LIMIT_MS);
    expect(TIMEOUT_PROMPT_LIMIT_MS).toBeLessThan(TIMEOUT_CLEANUP_TEST_TIMEOUT_MS);
    const { workspace, repo } = createFeatureRepo();
    const marker = `timeout-stderr-${randomUUID()}`;
    const treehouse = fakeTreehouse(repo, [
      '[Console]::Error.Write($env:TREEHOUSE_TIMEOUT_STDERR)',
      '[Console]::Error.Flush()',
      '$wait = New-Object System.Threading.ManualResetEvent($false)',
      '[void]$wait.WaitOne(30000)',
    ]);
    treehouse.env.TREEHOUSE_TIMEOUT_STDERR = marker;

    const started = performance.now();
    const result = invokePrepareCommand(
      repo,
      workspace,
      ['-CheckOnly', '-Parallel', ...treehouseTimeoutArgs(FAILURE_INNER_TIMEOUT_MS)],
      treehouse.env,
      WINDOWS_POWERSHELL!,
    );
    const elapsed = performance.now() - started;

    expect(result.exitCode).not.toBe(0);
    expect(elapsed).toBeLessThan(TIMEOUT_PROMPT_LIMIT_MS);
    const stdout = result.stdout.toString().trim();
    expect(stdout.split(/\r?\n/)).toHaveLength(1);
    const readiness = JSON.parse(stdout);
    expect(readiness.errorCodes).toContain('treehouse_not_ready');
    const errors = readiness.errors.join(' ');
    expect(errors).toContain(marker);
    expect(errors.toLowerCase()).toContain('timed out');
    expect(errors).not.toContain('Process-tree cleanup failed');
    expect(errors.toLowerCase()).not.toContain('output exceeded');
  }, TIMEOUT_CLEANUP_TEST_TIMEOUT_MS);

  windowsTest('Windows PowerShell timeout settles a stream-closed direct child before the outer limit', () => {
    expect(FAILURE_INNER_TIMEOUT_MS).toBeLessThan(TIMEOUT_PROMPT_LIMIT_MS);
    expect(TIMEOUT_PROMPT_LIMIT_MS).toBeLessThan(TIMEOUT_CLEANUP_TEST_TIMEOUT_MS);
    const { workspace, repo } = createFeatureRepo();
    const treehouse = fakeTreehouse(repo, [
      'Add-Type -TypeDefinition $env:TREEHOUSE_STREAM_CLOSED_LAUNCHER',
      "[HarnessTestStreamClosedProcess]::Start($env:TREEHOUSE_CHILD_EXECUTABLE, ('-NoProfile -NonInteractive -EncodedCommand ' + $env:TREEHOUSE_EVENT_CHILD_ENCODED))",
      '$timer = [System.Diagnostics.Stopwatch]::StartNew()',
      'while (-not (Test-Path -LiteralPath $env:TREEHOUSE_EVENT_READY) -and $timer.ElapsedMilliseconds -lt 5000) { Start-Sleep -Milliseconds 20 }',
      "if (-not (Test-Path -LiteralPath $env:TREEHOUSE_EVENT_READY)) { throw 'Child event was not ready.' }",
      '$wait = New-Object System.Threading.ManualResetEvent($false)',
      '[void]$wait.WaitOne(30000)',
    ]);
    const eventName = `prepare-harness-${randomUUID()}`;
    const eventReady = join(dirname(treehouse.calls), 'timeout-direct-event-ready.txt');
    treehouse.env.TREEHOUSE_EVENT_NAME = eventName;
    treehouse.env.TREEHOUSE_EVENT_READY = eventReady;
    treehouse.env.TREEHOUSE_STREAM_CLOSED_LAUNCHER = STREAM_CLOSED_PROCESS_LAUNCHER;
    treehouse.env.TREEHOUSE_EVENT_CHILD_ENCODED = Buffer.from(
      '$created = $false; $event = [System.Threading.EventWaitHandle]::new($false, [System.Threading.EventResetMode]::ManualReset, $env:TREEHOUSE_EVENT_NAME, [ref]$created); try { [System.IO.File]::WriteAllText($env:TREEHOUSE_EVENT_READY, [string]$created); [void]$event.WaitOne(30000) } finally { $event.Dispose() }',
      'utf16le',
    ).toString('base64');
    treehouse.env.TREEHOUSE_CHILD_EXECUTABLE = WINDOWS_POWERSHELL!;

    try {
      const started = performance.now();
      const result = invokePrepareCommand(
        repo,
        workspace,
        ['-CheckOnly', '-Parallel', ...treehouseTimeoutArgs(FAILURE_INNER_TIMEOUT_MS)],
        treehouse.env,
        WINDOWS_POWERSHELL!,
      );
      const elapsed = performance.now() - started;

      expect(result.exitCode).not.toBe(0);
      expect(elapsed).toBeLessThan(TIMEOUT_PROMPT_LIMIT_MS);
      const stdout = result.stdout.toString().trim();
      expect(stdout.split(/\r?\n/)).toHaveLength(1);
      const readiness = JSON.parse(stdout);
      expect(readiness.errorCodes).toContain('treehouse_not_ready');
      expect(readiness.errors.join(' ')).not.toContain('Process-tree cleanup failed');
      expect(existsSync(eventReady)).toBe(true);
      expect(readFileSync(eventReady, 'utf8')).toBe('True');
      expect(namedEventExists(eventName)).toBe(false);
    } finally {
      releaseNamedEvent(eventName);
    }
  }, TIMEOUT_CLEANUP_TEST_TIMEOUT_MS);

  windowsTest('Windows PowerShell timeout settles a stream-closed grandchild after its broker exits', () => {
    expect(FAILURE_INNER_TIMEOUT_MS).toBeLessThan(DANGLING_PROMPT_LIMIT_MS);
    expect(DANGLING_PROMPT_LIMIT_MS).toBeLessThan(DANGLING_CLEANUP_TEST_TIMEOUT_MS);
    const { workspace, repo } = createFeatureRepo();
    const treehouse = fakeTreehouse(repo, [
      "$brokerCode = 'Add-Type -TypeDefinition $env:TREEHOUSE_STREAM_CLOSED_LAUNCHER; [HarnessTestStreamClosedProcess]::Start($env:TREEHOUSE_CHILD_EXECUTABLE, (''-NoProfile -NonInteractive -EncodedCommand '' + $env:TREEHOUSE_EVENT_CHILD_ENCODED)); [Environment]::Exit(0)'",
      '& $env:TREEHOUSE_CHILD_EXECUTABLE -NoProfile -NonInteractive -Command $brokerCode',
      '$wait = New-Object System.Threading.ManualResetEvent($false)',
      '[void]$wait.WaitOne(30000)',
    ]);
    const eventName = `prepare-harness-${randomUUID()}`;
    const eventReady = join(dirname(treehouse.calls), 'orphan-event-ready.txt');
    treehouse.env.TREEHOUSE_EVENT_NAME = eventName;
    treehouse.env.TREEHOUSE_EVENT_READY = eventReady;
    treehouse.env.TREEHOUSE_STREAM_CLOSED_LAUNCHER = STREAM_CLOSED_PROCESS_LAUNCHER;
    treehouse.env.TREEHOUSE_EVENT_CHILD_ENCODED = Buffer.from(
      '$created = $false; $event = [System.Threading.EventWaitHandle]::new($false, [System.Threading.EventResetMode]::ManualReset, $env:TREEHOUSE_EVENT_NAME, [ref]$created); try { [System.IO.File]::WriteAllText($env:TREEHOUSE_EVENT_READY, [string]$created); [void]$event.WaitOne(30000) } finally { $event.Dispose() }',
      'utf16le',
    ).toString('base64');
    treehouse.env.TREEHOUSE_CHILD_EXECUTABLE = WINDOWS_POWERSHELL!;

    try {
      const started = performance.now();
      const result = invokePrepareCommand(
        repo,
        workspace,
        ['-CheckOnly', '-Parallel', ...treehouseTimeoutArgs(FAILURE_INNER_TIMEOUT_MS)],
        treehouse.env,
        WINDOWS_POWERSHELL!,
      );
      const elapsed = performance.now() - started;

      expect(result.exitCode).not.toBe(0);
      expect(elapsed).toBeLessThan(DANGLING_PROMPT_LIMIT_MS);
      const stdout = result.stdout.toString().trim();
      expect(stdout.split(/\r?\n/)).toHaveLength(1);
      const readiness = JSON.parse(stdout);
      expect(readiness.errorCodes).toContain('treehouse_not_ready');
      expect(readiness.errors.join(' ')).not.toContain('Process-tree cleanup failed');
      expect(existsSync(eventReady)).toBe(true);
      expect(readFileSync(eventReady, 'utf8')).toBe('True');
      expect(namedEventExists(eventName)).toBe(false);
    } finally {
      releaseNamedEvent(eventName);
    }
  }, DANGLING_CLEANUP_TEST_TIMEOUT_MS);

  windowsTest('Windows PowerShell settles a stream-closed grandchild after normal status success', () => {
    const { workspace, repo } = createFeatureRepo();
    const treehouse = fakeTreehouse(repo, [
      "$brokerCode = 'Add-Type -TypeDefinition $env:TREEHOUSE_STREAM_CLOSED_LAUNCHER; [HarnessTestStreamClosedProcess]::Start($env:TREEHOUSE_CHILD_EXECUTABLE, (''-NoProfile -NonInteractive -EncodedCommand '' + $env:TREEHOUSE_EVENT_CHILD_ENCODED)); [Environment]::Exit(0)'",
      '& $env:TREEHOUSE_CHILD_EXECUTABLE -NoProfile -NonInteractive -Command $brokerCode',
      '$timer = [System.Diagnostics.Stopwatch]::StartNew()',
      'while (-not (Test-Path -LiteralPath $env:TREEHOUSE_EVENT_READY) -and $timer.ElapsedMilliseconds -lt 5000) { Start-Sleep -Milliseconds 20 }',
      "if (-not (Test-Path -LiteralPath $env:TREEHOUSE_EVENT_READY)) { throw 'Grandchild event was not ready.' }",
      '[Environment]::Exit(0)',
    ]);
    const eventName = `prepare-harness-${randomUUID()}`;
    const eventReady = join(dirname(treehouse.calls), 'normal-event-ready.txt');
    treehouse.env.TREEHOUSE_EVENT_NAME = eventName;
    treehouse.env.TREEHOUSE_EVENT_READY = eventReady;
    treehouse.env.TREEHOUSE_STREAM_CLOSED_LAUNCHER = STREAM_CLOSED_PROCESS_LAUNCHER;
    treehouse.env.TREEHOUSE_EVENT_CHILD_ENCODED = Buffer.from(
      '$created = $false; $event = [System.Threading.EventWaitHandle]::new($false, [System.Threading.EventResetMode]::ManualReset, $env:TREEHOUSE_EVENT_NAME, [ref]$created); try { [System.IO.File]::WriteAllText($env:TREEHOUSE_EVENT_READY, [string]$created); [void]$event.WaitOne(30000) } finally { $event.Dispose() }',
      'utf16le',
    ).toString('base64');
    treehouse.env.TREEHOUSE_CHILD_EXECUTABLE = WINDOWS_POWERSHELL!;

    try {
      const started = performance.now();
      const result = invokePrepareCommand(
        repo,
        workspace,
        ['-CheckOnly', '-Parallel'],
        treehouse.env,
        WINDOWS_POWERSHELL!,
      );
      const elapsed = performance.now() - started;

      expect(result.exitCode).not.toBe(0);
      expect(elapsed).toBeLessThan(NORMAL_SUCCESS_DAEMON_PROMPT_LIMIT_MS);
      const stdout = result.stdout.toString().trim();
      expect(stdout.split(/\r?\n/)).toHaveLength(1);
      const readiness = JSON.parse(stdout);
      expect(readiness.errorCodes).toContain('isolation_not_prepared');
      expect(readiness.errorCodes).not.toContain('treehouse_not_ready');
      expect(readiness.errors.join(' ')).not.toContain('Process-tree cleanup failed');
      expect(existsSync(eventReady)).toBe(true);
      expect(readFileSync(eventReady, 'utf8')).toBe('True');
      expect(namedEventExists(eventName)).toBe(false);
    } finally {
      releaseNamedEvent(eventName);
    }
  }, NORMAL_SUCCESS_DAEMON_TEST_TIMEOUT_MS);

  windowsTest('Windows PowerShell normal status settles a grandchild with inherited output streams', () => {
    expect(FLOOD_FALLBACK_TIMEOUT_MS).toBeLessThan(DANGLING_PROMPT_LIMIT_MS);
    expect(DANGLING_PROMPT_LIMIT_MS).toBeLessThan(DANGLING_CLEANUP_TEST_TIMEOUT_MS);
    const { workspace, repo } = createFeatureRepo();
    const treehouse = fakeTreehouse(repo, [
      'Add-Type -TypeDefinition $env:TREEHOUSE_STREAM_CLOSED_LAUNCHER',
      "[HarnessTestStreamClosedProcess]::StartWithInheritedStreams($env:TREEHOUSE_CHILD_EXECUTABLE, ('-NoProfile -NonInteractive -EncodedCommand ' + $env:TREEHOUSE_BROKER_ENCODED))",
      '$timer = [System.Diagnostics.Stopwatch]::StartNew()',
      'while (-not (Test-Path -LiteralPath $env:TREEHOUSE_EVENT_READY) -and $timer.ElapsedMilliseconds -lt 5000) { Start-Sleep -Milliseconds 20 }',
      "if (-not (Test-Path -LiteralPath $env:TREEHOUSE_EVENT_READY)) { throw 'Inherited-stream grandchild event was not ready.' }",
      '[Environment]::Exit(0)',
    ]);
    const eventName = `prepare-harness-${randomUUID()}`;
    const eventReady = join(dirname(treehouse.calls), 'inherited-stream-event-ready.txt');
    treehouse.env.TREEHOUSE_EVENT_NAME = eventName;
    treehouse.env.TREEHOUSE_EVENT_READY = eventReady;
    treehouse.env.TREEHOUSE_STREAM_CLOSED_LAUNCHER = STREAM_CLOSED_PROCESS_LAUNCHER;
    treehouse.env.TREEHOUSE_BROKER_ENCODED = Buffer.from(
      'Add-Type -TypeDefinition $env:TREEHOUSE_STREAM_CLOSED_LAUNCHER; [HarnessTestStreamClosedProcess]::StartWithInheritedStreams($env:TREEHOUSE_CHILD_EXECUTABLE, ("-NoProfile -NonInteractive -EncodedCommand " + $env:TREEHOUSE_EVENT_CHILD_ENCODED)); [Environment]::Exit(0)',
      'utf16le',
    ).toString('base64');
    treehouse.env.TREEHOUSE_EVENT_CHILD_ENCODED = Buffer.from(
      '$created = $false; $event = [System.Threading.EventWaitHandle]::new($false, [System.Threading.EventResetMode]::ManualReset, $env:TREEHOUSE_EVENT_NAME, [ref]$created); try { [System.IO.File]::WriteAllText($env:TREEHOUSE_EVENT_READY, [string]$created); [void]$event.WaitOne(30000) } finally { $event.Dispose() }',
      'utf16le',
    ).toString('base64');
    treehouse.env.TREEHOUSE_CHILD_EXECUTABLE = WINDOWS_POWERSHELL!;

    try {
      const started = performance.now();
      const result = invokePrepareCommand(
        repo,
        workspace,
        ['-CheckOnly', '-Parallel', ...treehouseTimeoutArgs(FLOOD_FALLBACK_TIMEOUT_MS)],
        treehouse.env,
        WINDOWS_POWERSHELL!,
      );
      const elapsed = performance.now() - started;

      expect(result.exitCode).not.toBe(0);
      expect(elapsed).toBeLessThan(DANGLING_PROMPT_LIMIT_MS);
      const stdout = result.stdout.toString().trim();
      expect(stdout.split(/\r?\n/)).toHaveLength(1);
      const readiness = JSON.parse(stdout);
      expect(readiness.errorCodes).toContain('isolation_not_prepared');
      expect(readiness.errorCodes).not.toContain('treehouse_not_ready');
      const errors = readiness.errors.join(' ').toLowerCase();
      expect(errors).not.toContain('timed out');
      expect(errors).not.toContain('output exceeded');
      expect(errors).not.toContain('cleanup failed');
      expect(existsSync(eventReady)).toBe(true);
      expect(readFileSync(eventReady, 'utf8')).toBe('True');
      expect(namedEventExists(eventName)).toBe(false);
    } finally {
      releaseNamedEvent(eventName);
    }
  }, DANGLING_CLEANUP_TEST_TIMEOUT_MS);

  windowsTest('Windows PowerShell output flood clears output and settles a stream-closed child', () => {
    expect(FLOOD_FALLBACK_TIMEOUT_MS).toBeLessThan(OUTPUT_LIMIT_PROMPT_LIMIT_MS);
    expect(OUTPUT_LIMIT_PROMPT_LIMIT_MS).toBeLessThan(OUTPUT_LIMIT_CLEANUP_TEST_TIMEOUT_MS);
    const { workspace, repo } = createFeatureRepo();
    const treehouse = fakeTreehouse(repo, [
      'Add-Type -TypeDefinition $env:TREEHOUSE_STREAM_CLOSED_LAUNCHER',
      "[HarnessTestStreamClosedProcess]::Start($env:TREEHOUSE_CHILD_EXECUTABLE, ('-NoProfile -NonInteractive -EncodedCommand ' + $env:TREEHOUSE_EVENT_CHILD_ENCODED))",
      '$timer = [System.Diagnostics.Stopwatch]::StartNew()',
      'while (-not (Test-Path -LiteralPath $env:TREEHOUSE_EVENT_READY) -and $timer.ElapsedMilliseconds -lt 5000) { Start-Sleep -Milliseconds 20 }',
      "if (-not (Test-Path -LiteralPath $env:TREEHOUSE_EVENT_READY)) { throw 'Child event was not ready.' }",
      '$bytes = [System.Array]::CreateInstance([byte], 8388608)',
      '[Console]::OpenStandardOutput().Write($bytes, 0, $bytes.Length)',
      "[System.IO.File]::WriteAllText($env:TREEHOUSE_FLOOD_COMPLETED, 'completed')",
      'exit 0',
    ]);
    const eventName = `prepare-harness-${randomUUID()}`;
    const eventReady = join(dirname(treehouse.calls), 'flood-event-ready.txt');
    const floodCompleted = join(dirname(treehouse.calls), 'flood-completed.txt');
    treehouse.env.TREEHOUSE_EVENT_NAME = eventName;
    treehouse.env.TREEHOUSE_EVENT_READY = eventReady;
    treehouse.env.TREEHOUSE_STREAM_CLOSED_LAUNCHER = STREAM_CLOSED_PROCESS_LAUNCHER;
    treehouse.env.TREEHOUSE_EVENT_CHILD_ENCODED = Buffer.from(
      '$created = $false; $event = [System.Threading.EventWaitHandle]::new($false, [System.Threading.EventResetMode]::ManualReset, $env:TREEHOUSE_EVENT_NAME, [ref]$created); try { [System.IO.File]::WriteAllText($env:TREEHOUSE_EVENT_READY, [string]$created); [void]$event.WaitOne(30000) } finally { $event.Dispose() }',
      'utf16le',
    ).toString('base64');
    treehouse.env.TREEHOUSE_FLOOD_COMPLETED = floodCompleted;
    treehouse.env.TREEHOUSE_CHILD_EXECUTABLE = WINDOWS_POWERSHELL!;

    try {
      const started = performance.now();
      const result = invokePrepareCommand(
        repo,
        workspace,
        ['-CheckOnly', '-Parallel', ...treehouseTimeoutArgs(FLOOD_FALLBACK_TIMEOUT_MS)],
        treehouse.env,
        WINDOWS_POWERSHELL!,
      );
      const elapsed = performance.now() - started;

      expect(result.exitCode).not.toBe(0);
      expect(elapsed).toBeLessThan(OUTPUT_LIMIT_PROMPT_LIMIT_MS);
      expect(existsSync(eventReady)).toBe(true);
      expect(readFileSync(eventReady, 'utf8')).toBe('True');
      expect(existsSync(floodCompleted)).toBe(false);
      expect(namedEventExists(eventName)).toBe(false);
      const stdout = result.stdout.toString().trim();
      expect(stdout.split(/\r?\n/)).toHaveLength(1);
      expect(stdout.length).toBeLessThan(4096);
      expect(stdout).not.toContain('\0'.repeat(128));
      const readiness = JSON.parse(stdout);
      expect(readiness.errorCodes).toContain('treehouse_not_ready');
      expect(readiness.errors.join(' ').toLowerCase()).toContain('output exceeded');
      expect(readiness.errors.join(' ')).toContain('4194304 character safety limit');
      expect(readiness.errors.join(' ')).not.toContain('Process-tree cleanup failed');
    } finally {
      releaseNamedEvent(eventName);
    }
  }, OUTPUT_LIMIT_CLEANUP_TEST_TIMEOUT_MS);

  windowsTest('Windows PowerShell output flood settles a stream-closed grandchild after broker exit', () => {
    expect(BROKER_FLOOD_FALLBACK_TIMEOUT_MS).toBeLessThan(OUTPUT_LIMIT_PROMPT_LIMIT_MS);
    expect(OUTPUT_LIMIT_PROMPT_LIMIT_MS).toBeLessThan(OUTPUT_LIMIT_CLEANUP_TEST_TIMEOUT_MS);
    const { workspace, repo } = createFeatureRepo();
    const treehouse = fakeTreehouse(repo, [
      "$brokerCode = 'Add-Type -TypeDefinition $env:TREEHOUSE_STREAM_CLOSED_LAUNCHER; [HarnessTestStreamClosedProcess]::Start($env:TREEHOUSE_CHILD_EXECUTABLE, (''-NoProfile -NonInteractive -EncodedCommand '' + $env:TREEHOUSE_EVENT_CHILD_ENCODED)); [Environment]::Exit(0)'",
      '& $env:TREEHOUSE_CHILD_EXECUTABLE -NoProfile -NonInteractive -Command $brokerCode',
      '$timer = [System.Diagnostics.Stopwatch]::StartNew()',
      'while (-not (Test-Path -LiteralPath $env:TREEHOUSE_EVENT_READY) -and $timer.ElapsedMilliseconds -lt 5000) { Start-Sleep -Milliseconds 20 }',
      "if (-not (Test-Path -LiteralPath $env:TREEHOUSE_EVENT_READY)) { throw 'Grandchild event was not ready.' }",
      '$bytes = [System.Array]::CreateInstance([byte], 8388608)',
      '[Console]::OpenStandardOutput().Write($bytes, 0, $bytes.Length)',
      "[System.IO.File]::WriteAllText($env:TREEHOUSE_FLOOD_COMPLETED, 'completed')",
      'exit 0',
    ]);
    const eventName = `prepare-harness-${randomUUID()}`;
    const eventReady = join(dirname(treehouse.calls), 'flood-grandchild-event-ready.txt');
    const floodCompleted = join(dirname(treehouse.calls), 'flood-grandchild-completed.txt');
    treehouse.env.TREEHOUSE_EVENT_NAME = eventName;
    treehouse.env.TREEHOUSE_EVENT_READY = eventReady;
    treehouse.env.TREEHOUSE_STREAM_CLOSED_LAUNCHER = STREAM_CLOSED_PROCESS_LAUNCHER;
    treehouse.env.TREEHOUSE_EVENT_CHILD_ENCODED = Buffer.from(
      '$created = $false; $event = [System.Threading.EventWaitHandle]::new($false, [System.Threading.EventResetMode]::ManualReset, $env:TREEHOUSE_EVENT_NAME, [ref]$created); try { [System.IO.File]::WriteAllText($env:TREEHOUSE_EVENT_READY, [string]$created); [void]$event.WaitOne(30000) } finally { $event.Dispose() }',
      'utf16le',
    ).toString('base64');
    treehouse.env.TREEHOUSE_FLOOD_COMPLETED = floodCompleted;
    treehouse.env.TREEHOUSE_CHILD_EXECUTABLE = WINDOWS_POWERSHELL!;

    try {
      const started = performance.now();
      const result = invokePrepareCommand(
        repo,
        workspace,
        ['-CheckOnly', '-Parallel', ...treehouseTimeoutArgs(BROKER_FLOOD_FALLBACK_TIMEOUT_MS)],
        treehouse.env,
        WINDOWS_POWERSHELL!,
      );
      const elapsed = performance.now() - started;

      expect(result.exitCode).not.toBe(0);
      expect(elapsed).toBeLessThan(OUTPUT_LIMIT_PROMPT_LIMIT_MS);
      expect(existsSync(eventReady)).toBe(true);
      expect(readFileSync(eventReady, 'utf8')).toBe('True');
      expect(existsSync(floodCompleted)).toBe(false);
      expect(namedEventExists(eventName)).toBe(false);
      const stdout = result.stdout.toString().trim();
      expect(stdout.split(/\r?\n/)).toHaveLength(1);
      expect(stdout.length).toBeLessThan(4096);
      expect(stdout).not.toContain('\0'.repeat(128));
      const readiness = JSON.parse(stdout);
      expect(readiness.errorCodes).toContain('treehouse_not_ready');
      expect(readiness.errors.join(' ').toLowerCase()).toContain('output exceeded');
      expect(readiness.errors.join(' ')).toContain('4194304 character safety limit');
      expect(readiness.errors.join(' ')).not.toContain('Process-tree cleanup failed');
    } finally {
      releaseNamedEvent(eventName);
    }
  }, OUTPUT_LIMIT_CLEANUP_TEST_TIMEOUT_MS);

  test('malformed successful lease output returns the identifiable lease', () => {
    const { workspace, repo } = createFeatureRepo();
    const treehouse = fakeTreehouse(repo, ['exit 0'], [
      '[Console]::Out.WriteLine($env:TREEHOUSE_LEASE)',
      '[Console]::Out.WriteLine("unexpected banner")',
      'exit 0',
    ]);

    const result = invokePrepareCommand(repo, workspace, ['-PrepareIsolation', '-Parallel'], treehouse.env);

    expect(result.exitCode).not.toBe(0);
    const readiness = JSON.parse(result.stdout.toString());
    expect(readiness.errorCodes).toContain('invalid_treehouse_output');
    expect(readiness.errors.join(' ')).toContain('Lease was returned');
    expect(readFileSync(treehouse.calls, 'utf8').trim().split(/\r?\n/)).toEqual(['get', 'return']);
  }, ISOLATION_PREPARATION_TEST_TIMEOUT_MS);

  test('CheckOnly cannot be combined with isolation preparation', () => {
    const { workspace, repo } = createFeatureRepo();
    const treehouse = fakeTreehouse(repo);

    const result = invokePrepareCommand(
      repo,
      workspace,
      ['-CheckOnly', '-PrepareIsolation', '-Parallel'],
      treehouse.env,
    );

    expect(result.exitCode).not.toBe(0);
    const readiness = JSON.parse(result.stdout.toString());
    expect(readiness.errors.join(' ')).toContain('cannot be combined');
    expect(existsSync(treehouse.calls)).toBe(false);
  });

  test('required isolation reports exact remediation when treehouse is unavailable', () => {
    const { workspace, repo } = createFeatureRepo();

    const result = invokePrepareCommand(repo, workspace, ['-CheckOnly', '-Parallel'], withoutTreehouseEnv());

    expect(result.exitCode).not.toBe(0);
    const readiness = JSON.parse(result.stdout.toString());
    expect(readiness.treehouseAvailable).toBe(false);
    expect(readiness.errors.join(' ')).toContain('Treehouse is required');
    expect(readiness.errors.join(' ')).toContain('Install treehouse');
  }, TREEHOUSE_STATUS_TEST_TIMEOUT_MS);

  test('invalid pipeline layout fails before treehouse preparation', () => {
    const { workspace, repo } = createFeatureRepo();
    mkdirSync(join(workspace, 'pipelines', 'rogue-copy'), { recursive: true });
    const treehouse = fakeTreehouse(repo);

    const result = invokePrepareCommand(repo, workspace, ['-PrepareIsolation', '-Parallel'], treehouse.env);

    expect(result.exitCode).not.toBe(0);
    const readiness = JSON.parse(result.stdout.toString());
    expect(readiness.layoutValid).toBe(false);
    expect(readiness.errors.join(' ')).toContain('Pipeline layout invalid');
    expect(existsSync(treehouse.calls)).toBe(false);
  });

  test('explicit isolation preparation creates and reports a derived branch at source HEAD', () => {
    const { workspace, repo } = createFeatureRepo();
    writeFileSync(join(repo, 'feature.txt'), 'feature commit\n');
    run(['git', 'add', 'feature.txt'], repo);
    run(['git', 'commit', '-m', 'feature fixture'], repo);
    const sourceBranch = run(['git', 'branch', '--show-current'], repo);
    const sourceHead = run(['git', 'rev-parse', 'HEAD'], repo);
    const treehouse = fakeTreehouse(repo, ['exit 0'], undefined, 'main');
    expect(run(['git', 'rev-parse', 'HEAD'], treehouse.lease)).not.toBe(sourceHead);

    const result = invokePrepareCommand(repo, workspace, ['-PrepareIsolation', '-Parallel'], treehouse.env);

    expect(result.exitCode).toBe(0);
    const readiness = JSON.parse(result.stdout.toString());
    expect(readiness).toMatchObject({
      status: 'READY',
      readyForRun: true,
      branch: sourceBranch,
      checkedHead: sourceHead,
      isolationRequired: true,
      isolationPrepared: true,
      treehouseAvailable: true,
      leasePath: treehouse.lease,
      leaseHolder: 'harness-readiness',
      runPath: treehouse.lease,
    });
    expect(readiness.runBranch).toMatch(/^harness\/harness-readiness\/feature-readiness-[0-9a-f]{12}-[0-9a-f]{8}$/);
    expect(run(['git', 'branch', '--show-current'], treehouse.lease)).toBe(readiness.runBranch);
    expect(run(['git', 'rev-parse', 'HEAD'], treehouse.lease)).toBe(sourceHead);
    expect(run(['git', 'branch', '--show-current'], repo)).toBe(sourceBranch);
    expect(run(['git', 'rev-parse', 'HEAD'], repo)).toBe(sourceHead);
    expect(readiness.returnCommand).toContain(treehouse.lease);
    expect(readFileSync(treehouse.calls, 'utf8')).toContain('get');
    expect(readFileSync(treehouse.cwdLog, 'utf8').trim()).toBe(repo);
  }, ISOLATION_PREPARATION_TEST_TIMEOUT_MS);

  test('derived branch creation failure returns the acquired lease', () => {
    const { workspace, repo } = createFeatureRepo();
    run(['git', 'branch', 'harness'], repo);
    const treehouse = fakeTreehouse(repo);

    const result = invokePrepareCommand(repo, workspace, ['-PrepareIsolation', '-Parallel'], treehouse.env);

    expect(result.exitCode).not.toBe(0);
    const readiness = JSON.parse(result.stdout.toString());
    expect(readiness.errorCodes).toContain('invalid_lease');
    expect(readiness.runBranch).toBeNull();
    expect(readiness.errors.join(' ')).toContain('Unable to create derived run branch');
    expect(readiness.errors.join(' ')).toContain('Lease was returned');
    expect(readFileSync(treehouse.calls, 'utf8').trim().split(/\r?\n/)).toEqual(['get', 'return']);
  }, ISOLATION_PREPARATION_TEST_TIMEOUT_MS);

  test('canonical monorepo pipeline requires isolation and maps prepared run path', () => {
    const { workspace, pipeline } = createCanonicalPipeline();
    const treehouse = fakeTreehouse(workspace);
    const leasedPipeline = join(treehouse.lease, 'pipelines', 'content');

    const checkResult = invokePrepareCommand(pipeline, workspace, ['-CheckOnly'], treehouse.env);
    expect(checkResult.exitCode).not.toBe(0);
    const checked = JSON.parse(checkResult.stdout.toString());
    expect(checked).toMatchObject({
      status: 'NOT_READY',
      readyForRun: false,
      isolationRequired: true,
      isolationPrepared: false,
      runPath: null,
    });
    expect(readFileSync(treehouse.calls, 'utf8')).toContain('status');

    const prepareResult = invokePrepareCommand(pipeline, workspace, ['-PrepareIsolation'], treehouse.env);
    expect(prepareResult.exitCode).toBe(0);
    const prepared = JSON.parse(prepareResult.stdout.toString());
    expect(prepared).toMatchObject({
      status: 'READY',
      readyForRun: true,
      isolationRequired: true,
      isolationPrepared: true,
      leasePath: treehouse.lease,
      runPath: leasedPipeline,
    });
    expect(prepared.runBranch).toMatch(/^harness\/harness-readiness\/feature-readiness-[0-9a-f]{12}-[0-9a-f]{8}$/);
    expect(run(['git', 'branch', '--show-current'], treehouse.lease)).toBe(prepared.runBranch);
    expect(readFileSync(treehouse.calls, 'utf8')).toContain('get');
    expect(readFileSync(treehouse.cwdLog, 'utf8').trim().split(/\r?\n/)).toEqual([workspace, workspace]);
  }, CANONICAL_ISOLATION_TEST_TIMEOUT_MS);

  test('compatibility launcher reports current-branch readiness and never invokes a runner', () => {
    const { workspace, repo } = createFeatureRepo();
    const runner = fakeGnhf();

    const result = Bun.spawnSync(
      [
        POWERSHELL,
        '-NoProfile',
        '-File',
        LAUNCHER,
        '-Objective',
        'legacy objective',
        '-StopWhen',
        'legacy stop',
        '-RepoPath',
        repo,
        '-WorkspaceRoot',
        workspace,
        '-CurrentBranch',
      ],
      { env: runner.env, stdout: 'pipe', stderr: 'pipe' },
    );

    expect(result.exitCode).toBe(0);
    const stdout = result.stdout.toString().trim();
    expect(stdout.split(/\r?\n/)).toHaveLength(1);
    const readiness = JSON.parse(stdout);
    expect(readiness).toMatchObject({
      status: 'READY',
      branch: 'feature/readiness',
      branchMode: 'current',
      repoPath: repo,
    });
    expect(existsSync(runner.marker)).toBe(false);
  }, CLEAN_READY_TEST_TIMEOUT_MS);

  test('compatibility launcher forwards DefaultBranch for a trunk fixture without invoking a runner', () => {
    const { workspace, repo } = createFeatureRepo('trunk');
    const runner = fakeGnhf();

    const result = Bun.spawnSync(
      [
        POWERSHELL,
        '-NoProfile',
        '-File',
        LAUNCHER,
        '-Objective',
        'legacy objective',
        '-StopWhen',
        'legacy stop',
        '-RepoPath',
        repo,
        '-WorkspaceRoot',
        workspace,
        '-CurrentBranch',
        '-DefaultBranch',
        'trunk',
      ],
      { env: runner.env, stdout: 'pipe', stderr: 'pipe' },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr.toString()).toBe('');
    const stdout = result.stdout.toString().trim();
    expect(stdout.split(/\r?\n/)).toHaveLength(1);
    expect(JSON.parse(stdout)).toMatchObject({
      status: 'READY',
      mode: 'CHECK_ONLY',
      branch: 'feature/readiness',
      branchMode: 'current',
      defaultBranch: 'trunk',
      repoPath: repo,
    });
    expect(existsSync(runner.marker)).toBe(false);
  }, CLEAN_READY_TEST_TIMEOUT_MS);
});
