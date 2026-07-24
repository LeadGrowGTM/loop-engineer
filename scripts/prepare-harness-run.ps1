<#
.SYNOPSIS
  Checks whether a repository is ready for an approval-gated harness run.

.DESCRIPTION
  Performs repository, branch, dirty-tree, pipeline-layout, and isolation checks.
  Emits one JSON object to stdout. Neither mode starts task execution.
  -CheckOnly does not mutate Git state.
  -PrepareIsolation acquires a Treehouse lease and creates a unique derived Git branch at the checked source HEAD before returning READY.

.EXAMPLE
  powershell -NoProfile -File scripts/prepare-harness-run.ps1 `
    -RepoPath C:\path\to\repo -CheckOnly
#>
param(
  [string]$RepoPath = (Get-Location).Path,
  [string]$WorkspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")).Path,
  [switch]$CheckOnly,
  [switch]$PrepareIsolation,
  [switch]$Parallel,
  [switch]$NoIsolation,
  [switch]$CurrentBranch,
  [string]$LeaseHolder = "harness-readiness",
  [string]$DefaultBranch = "",
  [Parameter(DontShow)]
  [ValidateRange(100, 30000)]
  [int]$InternalTreehouseStatusTimeoutMilliseconds = 30000
)
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

$result = [ordered]@{
  status                 = "NOT_READY"
  readyForRun            = $false
  mode                   = $null
  repoPath               = $null
  branch                 = $null
  runBranch              = $null
  defaultBranch          = $null
  branchMode             = "current"
  checkedHead            = $null
  dirtyPaths             = @()
  dirtyPathCount         = 0
  dirtyPathsTruncated     = $false
  layoutValid            = $false
  isolationRequired      = $false
  isolationPrepared      = $false
  treehouseAvailable     = $false
  leasePath              = $null
  leaseHolder            = $null
  returnCommand          = $null
  runPath                = $null
  errorCodes             = @()
  errors                 = @()
}

function Complete-Readiness([int]$ExitCode) {
  [Console]::Out.WriteLine(($result | ConvertTo-Json -Depth 8 -Compress))
  exit $ExitCode
}

function Add-ReadinessError([string]$Code, [string]$Message) {
  $result.errorCodes = @($result.errorCodes) + $Code
  $result.errors = @($result.errors) + $Message
}

function Quote-NativeArgument([string]$Value) {
  if ($null -eq $Value -or $Value.Length -eq 0) { return '""' }
  if ($Value -notmatch '[\s"]') { return $Value }

  $builder = New-Object System.Text.StringBuilder
  [void]$builder.Append('"')
  $backslashes = 0
  foreach ($character in $Value.ToCharArray()) {
    if ($character -eq '\') {
      $backslashes++
      continue
    }
    if ($character -eq '"') {
      [void]$builder.Append(('\' * (($backslashes * 2) + 1)))
      [void]$builder.Append('"')
      $backslashes = 0
      continue
    }
    if ($backslashes -gt 0) {
      [void]$builder.Append(('\' * $backslashes))
      $backslashes = 0
    }
    [void]$builder.Append($character)
  }
  if ($backslashes -gt 0) { [void]$builder.Append(('\' * ($backslashes * 2))) }
  [void]$builder.Append('"')
  return $builder.ToString()
}

function New-CleanupDeadline([int]$TimeoutMilliseconds) {
  return [pscustomobject]@{
    Stopwatch          = [System.Diagnostics.Stopwatch]::StartNew()
    TimeoutMilliseconds = $TimeoutMilliseconds
  }
}

function Get-RemainingCleanupMilliseconds([pscustomobject]$Deadline) {
  $remaining = [int]$Deadline.TimeoutMilliseconds - [int]$Deadline.Stopwatch.ElapsedMilliseconds
  if ($remaining -le 0) { return 0 }
  return $remaining
}

function Initialize-WindowsJobInterop {
  if ($null -ne ('Harness.Readiness.JobObjectNative' -as [type])) { return }

  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

namespace Harness.Readiness
{
    public static class JobObjectNative
    {
        public const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000;
        public const int JobObjectBasicAccountingInformation = 1;
        public const int JobObjectExtendedLimitInformation = 9;

        [StructLayout(LayoutKind.Sequential)]
        public struct IO_COUNTERS
        {
            public ulong ReadOperationCount;
            public ulong WriteOperationCount;
            public ulong OtherOperationCount;
            public ulong ReadTransferCount;
            public ulong WriteTransferCount;
            public ulong OtherTransferCount;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct JOBOBJECT_BASIC_LIMIT_INFORMATION
        {
            public long PerProcessUserTimeLimit;
            public long PerJobUserTimeLimit;
            public uint LimitFlags;
            public UIntPtr MinimumWorkingSetSize;
            public UIntPtr MaximumWorkingSetSize;
            public uint ActiveProcessLimit;
            public IntPtr Affinity;
            public uint PriorityClass;
            public uint SchedulingClass;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION
        {
            public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
            public IO_COUNTERS IoInfo;
            public UIntPtr ProcessMemoryLimit;
            public UIntPtr JobMemoryLimit;
            public UIntPtr PeakProcessMemoryUsed;
            public UIntPtr PeakJobMemoryUsed;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct JOBOBJECT_BASIC_ACCOUNTING_INFORMATION
        {
            public long TotalUserTime;
            public long TotalKernelTime;
            public long ThisPeriodTotalUserTime;
            public long ThisPeriodTotalKernelTime;
            public uint TotalPageFaultCount;
            public uint TotalProcesses;
            public uint ActiveProcesses;
            public uint TotalTerminatedProcesses;
        }

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        public static extern SafeFileHandle CreateJobObjectW(IntPtr jobAttributes, string name);

        [DllImport("kernel32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool SetInformationJobObject(
            SafeFileHandle job,
            int informationClass,
            ref JOBOBJECT_EXTENDED_LIMIT_INFORMATION information,
            uint informationLength);

        [DllImport("kernel32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool AssignProcessToJobObject(SafeFileHandle job, IntPtr process);

        [DllImport("kernel32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool TerminateJobObject(SafeFileHandle job, uint exitCode);

        [DllImport("kernel32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool QueryInformationJobObject(
            SafeFileHandle job,
            int informationClass,
            out JOBOBJECT_BASIC_ACCOUNTING_INFORMATION information,
            uint informationLength,
            IntPtr returnLength);
    }
}
'@
}

function New-WindowsProcessJob {
  Initialize-WindowsJobInterop
  $job = [Harness.Readiness.JobObjectNative]::CreateJobObjectW([IntPtr]::Zero, $null)
  $errorCode = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
  if ($null -eq $job -or $job.IsInvalid) {
    if ($job) { $job.Dispose() }
    throw "CreateJobObjectW failed with Windows error $errorCode."
  }

  try {
    $basicLimits = New-Object 'Harness.Readiness.JobObjectNative+JOBOBJECT_BASIC_LIMIT_INFORMATION'
    $basicLimits.LimitFlags = [Harness.Readiness.JobObjectNative]::JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
    $limits = New-Object 'Harness.Readiness.JobObjectNative+JOBOBJECT_EXTENDED_LIMIT_INFORMATION'
    $limits.BasicLimitInformation = $basicLimits
    $size = [uint32][System.Runtime.InteropServices.Marshal]::SizeOf($limits)
    $configured = [Harness.Readiness.JobObjectNative]::SetInformationJobObject(
      $job,
      [Harness.Readiness.JobObjectNative]::JobObjectExtendedLimitInformation,
      [ref]$limits,
      $size
    )
    $errorCode = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
    if (-not $configured) { throw "SetInformationJobObject failed with Windows error $errorCode." }
    return $job
  }
  catch {
    $job.Dispose()
    throw
  }
}

$script:WindowsBoundedWrapperEncodedCommand = $null
function Get-WindowsBoundedWrapperEncodedCommand {
  if ($script:WindowsBoundedWrapperEncodedCommand) {
    return $script:WindowsBoundedWrapperEncodedCommand
  }

  $wrapper = @'
$ErrorActionPreference = 'Stop'
$nativeSource = @"
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

public static class HarnessBoundTargetNative
{
    private const uint CREATE_NO_WINDOW = 0x08000000;
    private const int STARTF_USESTDHANDLES = 0x00000100;
    private const int STD_INPUT_HANDLE = -10;
    private const int STD_OUTPUT_HANDLE = -11;
    private const int STD_ERROR_HANDLE = -12;
    private const uint INFINITE = 0xffffffff;
    private const uint WAIT_OBJECT_0 = 0x00000000;
    private const uint WAIT_FAILED = 0xffffffff;
    private const uint HANDLE_FLAG_INHERIT = 0x00000001;

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

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr GetStdHandle(int standardHandle);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetExitCodeProcess(IntPtr process, out uint exitCode);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetHandleInformation(IntPtr handle, uint mask, uint flags);

    [DllImport("kernel32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CloseHandle(IntPtr handle);

    public static void ClearInheritFlag(IntPtr handle)
    {
        var cleared = SetHandleInformation(handle, HANDLE_FLAG_INHERIT, 0);
        var error = Marshal.GetLastWin32Error();
        if (!cleared) throw new Win32Exception((int)error);
    }

    public static int Run(string executable, string arguments, string workingDirectory)
    {
        var startupInfo = new STARTUPINFO();
        startupInfo.cb = Marshal.SizeOf(startupInfo);
        startupInfo.dwFlags = STARTF_USESTDHANDLES;
        startupInfo.hStdInput = GetStdHandle(STD_INPUT_HANDLE);
        startupInfo.hStdOutput = GetStdHandle(STD_OUTPUT_HANDLE);
        startupInfo.hStdError = GetStdHandle(STD_ERROR_HANDLE);
        if (startupInfo.hStdOutput == IntPtr.Zero || startupInfo.hStdOutput == new IntPtr(-1))
        {
            throw new Win32Exception("Wrapper stdout handle is invalid.");
        }
        if (startupInfo.hStdError == IntPtr.Zero || startupInfo.hStdError == new IntPtr(-1))
        {
            throw new Win32Exception("Wrapper stderr handle is invalid.");
        }

        var commandLine = new StringBuilder("\"" + executable + "\"");
        if (!String.IsNullOrEmpty(arguments)) commandLine.Append(" ").Append(arguments);
        PROCESS_INFORMATION processInformation;
        var created = CreateProcessW(
            executable,
            commandLine,
            IntPtr.Zero,
            IntPtr.Zero,
            true,
            CREATE_NO_WINDOW,
            IntPtr.Zero,
            workingDirectory,
            ref startupInfo,
            out processInformation);
        var createError = Marshal.GetLastWin32Error();
        if (!created) throw new Win32Exception((int)createError);
        CloseHandle(processInformation.hThread);

        try
        {
            var waitResult = WaitForSingleObject(processInformation.hProcess, INFINITE);
            var waitError = Marshal.GetLastWin32Error();
            if (waitResult == WAIT_FAILED) throw new Win32Exception((int)waitError);
            if (waitResult != WAIT_OBJECT_0)
            {
                throw new InvalidOperationException("WaitForSingleObject returned " + waitResult + ".");
            }

            uint exitCode;
            var readExitCode = GetExitCodeProcess(processInformation.hProcess, out exitCode);
            var exitCodeError = Marshal.GetLastWin32Error();
            if (!readExitCode) throw new Win32Exception((int)exitCodeError);
            return unchecked((int)exitCode);
        }
        finally
        {
            CloseHandle(processInformation.hProcess);
        }
    }
}
"@
$pipe = $null
$reader = $null
$controlPipe = $null
$controlWriter = $null
try {
  $pipe = [System.IO.Pipes.NamedPipeClientStream]::new(
    '.',
    $env:HARNESS_BOUND_PIPE_NAME,
    [System.IO.Pipes.PipeDirection]::In,
    [System.IO.Pipes.PipeOptions]::Asynchronous
  )
  $pipe.Connect()
  $controlPipe = [System.IO.Pipes.NamedPipeClientStream]::new(
    '.',
    $env:HARNESS_BOUND_CONTROL_PIPE_NAME,
    [System.IO.Pipes.PipeDirection]::Out,
    [System.IO.Pipes.PipeOptions]::Asynchronous
  )
  $controlPipe.Connect()
  $reader = [System.IO.StreamReader]::new(
    $pipe,
    (New-Object System.Text.UTF8Encoding($false)),
    $true
  )
  $json = $reader.ReadToEnd()
  $payload = ConvertFrom-Json -InputObject $json
  $reader.Dispose()
  $reader = $null
  $pipe.Dispose()
  $pipe = $null

  Add-Type -TypeDefinition $nativeSource
  [HarnessBoundTargetNative]::ClearInheritFlag($controlPipe.SafePipeHandle.DangerousGetHandle())
  [Environment]::SetEnvironmentVariable('HARNESS_BOUND_PIPE_NAME', $null, [EnvironmentVariableTarget]::Process)
  [Environment]::SetEnvironmentVariable('HARNESS_BOUND_CONTROL_PIPE_NAME', $null, [EnvironmentVariableTarget]::Process)
  if ([bool]$payload.ScrubGitEnvironment) {
    $variables = [Environment]::GetEnvironmentVariables()
    foreach ($key in @($variables.Keys)) {
      if ([string]$key -like 'GIT_*') {
        [Environment]::SetEnvironmentVariable([string]$key, $null, [EnvironmentVariableTarget]::Process)
      }
    }
    [Environment]::SetEnvironmentVariable('GIT_OPTIONAL_LOCKS', '0', [EnvironmentVariableTarget]::Process)
    [Environment]::SetEnvironmentVariable('GIT_TERMINAL_PROMPT', '0', [EnvironmentVariableTarget]::Process)
    [Environment]::SetEnvironmentVariable('LC_ALL', 'C.UTF-8', [EnvironmentVariableTarget]::Process)
    [Environment]::SetEnvironmentVariable('LANG', 'C.UTF-8', [EnvironmentVariableTarget]::Process)
  }

  $targetExitCode = [HarnessBoundTargetNative]::Run(
    [string]$payload.FileName,
    [string]$payload.Arguments,
    [string]$payload.WorkingDirectory
  )
  $controlWriter = [System.IO.StreamWriter]::new(
    $controlPipe,
    (New-Object System.Text.UTF8Encoding($false)),
    1024,
    $false
  )
  $controlWriter.Write($targetExitCode.ToString([System.Globalization.CultureInfo]::InvariantCulture))
  $controlWriter.Flush()
  $controlWriter.Dispose()
  $controlWriter = $null
  $controlPipe = $null
  exit $targetExitCode
}
catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
finally {
  if ($controlWriter) { $controlWriter.Dispose() }
  if ($controlPipe) { $controlPipe.Dispose() }
  if ($reader) { $reader.Dispose() }
  if ($pipe) { $pipe.Dispose() }
}
'@
  $bytes = [System.Text.Encoding]::Unicode.GetBytes($wrapper)
  $script:WindowsBoundedWrapperEncodedCommand = [Convert]::ToBase64String($bytes)
  return $script:WindowsBoundedWrapperEncodedCommand
}

function Add-WindowsProcessToJob(
  [Microsoft.Win32.SafeHandles.SafeFileHandle]$Job,
  [IntPtr]$ProcessHandle
) {
  $assigned = [Harness.Readiness.JobObjectNative]::AssignProcessToJobObject($Job, $ProcessHandle)
  $errorCode = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
  if (-not $assigned) { throw "AssignProcessToJobObject failed with Windows error $errorCode." }
}

function Request-WindowsJobTermination([Microsoft.Win32.SafeHandles.SafeFileHandle]$Job) {
  $terminated = [Harness.Readiness.JobObjectNative]::TerminateJobObject($Job, 1)
  $errorCode = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
  return [pscustomobject]@{ Succeeded = $terminated; ErrorCode = $errorCode }
}

function Get-WindowsJobActiveProcessCount([Microsoft.Win32.SafeHandles.SafeFileHandle]$Job) {
  $accounting = New-Object 'Harness.Readiness.JobObjectNative+JOBOBJECT_BASIC_ACCOUNTING_INFORMATION'
  $size = [uint32][System.Runtime.InteropServices.Marshal]::SizeOf($accounting)
  $queried = [Harness.Readiness.JobObjectNative]::QueryInformationJobObject(
    $Job,
    [Harness.Readiness.JobObjectNative]::JobObjectBasicAccountingInformation,
    [ref]$accounting,
    $size,
    [IntPtr]::Zero
  )
  $errorCode = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
  if (-not $queried) { throw "QueryInformationJobObject failed with Windows error $errorCode." }
  return [int]$accounting.ActiveProcesses
}

function Stop-NonWindowsBoundedProcess(
  [System.Diagnostics.Process]$Process,
  [pscustomobject]$Deadline
) {
  try {
    if ($Process.HasExited) {
      return [pscustomobject]@{
        Succeeded = $false
        Error     = 'Root process exited before process-tree cleanup; descendant termination is unverifiable on this platform.'
      }
    }
    if ((Get-RemainingCleanupMilliseconds $Deadline) -le 0) {
      return [pscustomobject]@{ Succeeded = $false; Error = 'Process-tree cleanup deadline expired.' }
    }
    $Process.Kill($true)
    return [pscustomobject]@{ Succeeded = $true; Error = '' }
  }
  catch {
    $killError = $_.Exception.Message
    try {
      if ($Process.HasExited) {
        return [pscustomobject]@{
          Succeeded = $false
          Error     = "Root process exited before tree termination could be proved: $killError"
        }
      }
    }
    catch { }
    return [pscustomobject]@{ Succeeded = $false; Error = "Process tree kill failed: $killError" }
  }
}

function Invoke-BoundedProcess(
  [string]$Executable,
  [string[]]$Arguments,
  [string]$WorkingDirectory,
  [bool]$ScrubGitEnvironment = $false,
  [int]$TimeoutMilliseconds = 30000,
  [int]$MaxOutputCharacters = 4194304
) {
  $isWindows = [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT
  $actualExecutable = $Executable
  $actualArguments = @($Arguments)
  if ([System.IO.Path]::GetExtension($Executable) -ieq '.ps1') {
    $actualExecutable = (Get-Process -Id $PID).Path
    $actualArguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $Executable) + $actualArguments
  }
  $serializedArguments = (($actualArguments | ForEach-Object { Quote-NativeArgument "$_" }) -join ' ')

  $process = New-Object System.Diagnostics.Process
  $job = $null
  $pipe = $null
  $controlPipe = $null
  $controlReader = $null
  $controlTask = $null
  $targetExitCode = $null
  $targetExitCodeReceived = $false
  $controlSignalFailed = $false
  $controlSignalError = ''
  $processStarted = $false
  $setupFailed = $false
  $setupTimedOut = $false
  $setupError = ''
  $setupKillError = ''
  $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

  if ($isWindows) {
    try {
      $job = New-WindowsProcessJob
      $remainingMilliseconds = $TimeoutMilliseconds - [int]$stopwatch.ElapsedMilliseconds
      if ($remainingMilliseconds -le 0) {
        $setupTimedOut = $true
        throw 'Windows process setup reached the invocation timeout.'
      }

      $pipeName = "harness-bound-$PID-$([Guid]::NewGuid().ToString('N'))"
      $pipe = [System.IO.Pipes.NamedPipeServerStream]::new(
        $pipeName,
        [System.IO.Pipes.PipeDirection]::Out,
        1,
        [System.IO.Pipes.PipeTransmissionMode]::Byte,
        [System.IO.Pipes.PipeOptions]::Asynchronous
      )
      $controlPipeName = "harness-bound-control-$PID-$([Guid]::NewGuid().ToString('N'))"
      try {
        $controlPipe = [System.IO.Pipes.NamedPipeServerStream]::new(
          $controlPipeName,
          [System.IO.Pipes.PipeDirection]::In,
          1,
          [System.IO.Pipes.PipeTransmissionMode]::Byte,
          [System.IO.Pipes.PipeOptions]::Asynchronous
        )
      }
      catch {
        $controlSignalFailed = $true
        $controlSignalError = "Control pipe creation failed: $($_.Exception.Message)"
        throw
      }
      $wrapperInfo = New-Object System.Diagnostics.ProcessStartInfo
      $wrapperInfo.FileName = (Get-Process -Id $PID).Path
      $wrapperInfo.Arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand ' + (Get-WindowsBoundedWrapperEncodedCommand)
      $wrapperInfo.WorkingDirectory = $WorkingDirectory
      $wrapperInfo.UseShellExecute = $false
      $wrapperInfo.RedirectStandardOutput = $true
      $wrapperInfo.RedirectStandardError = $true
      $wrapperInfo.CreateNoWindow = $true
      $wrapperInfo.EnvironmentVariables['HARNESS_BOUND_PIPE_NAME'] = $pipeName
      $wrapperInfo.EnvironmentVariables['HARNESS_BOUND_CONTROL_PIPE_NAME'] = $controlPipeName
      try {
        $utf8 = New-Object System.Text.UTF8Encoding($false)
        $wrapperInfo.StandardOutputEncoding = $utf8
        $wrapperInfo.StandardErrorEncoding = $utf8
      }
      catch { }
      $process.StartInfo = $wrapperInfo
      if (-not $process.Start()) { throw 'Windows PowerShell wrapper failed to start.' }
      $processStarted = $true
      $wrapperHandle = $process.Handle
      Add-WindowsProcessToJob -Job $job -ProcessHandle $wrapperHandle

      $remainingMilliseconds = $TimeoutMilliseconds - [int]$stopwatch.ElapsedMilliseconds
      if ($remainingMilliseconds -le 0) {
        $setupTimedOut = $true
        throw 'Windows PowerShell wrapper reached the invocation timeout before pipe connection.'
      }
      $connection = $pipe.WaitForConnectionAsync()
      try { $controlConnection = $controlPipe.WaitForConnectionAsync() }
      catch {
        $controlSignalFailed = $true
        $controlSignalError = "Control pipe connection failed: $($_.Exception.Message)"
        throw
      }
      if (-not $connection.Wait($remainingMilliseconds)) {
        $setupTimedOut = $true
        throw 'Windows PowerShell wrapper pipe connection timed out.'
      }

      $remainingMilliseconds = $TimeoutMilliseconds - [int]$stopwatch.ElapsedMilliseconds
      if ($remainingMilliseconds -le 0) {
        $setupTimedOut = $true
        $controlSignalFailed = $true
        $controlSignalError = 'Control pipe connection reached the invocation timeout.'
        throw $controlSignalError
      }
      try {
        if (-not $controlConnection.Wait($remainingMilliseconds)) {
          $setupTimedOut = $true
          $controlSignalFailed = $true
          $controlSignalError = 'Windows PowerShell wrapper control pipe connection timed out.'
          throw $controlSignalError
        }
        $controlReader = [System.IO.StreamReader]::new(
          $controlPipe,
          (New-Object System.Text.UTF8Encoding($false)),
          $true
        )
        $controlTask = $controlReader.ReadToEndAsync()
      }
      catch {
        if (-not $controlSignalFailed) {
          $controlSignalFailed = $true
          $controlSignalError = "Control pipe setup failed: $($_.Exception.Message)"
        }
        throw
      }

      $payload = [ordered]@{
        FileName            = $actualExecutable
        Arguments           = $serializedArguments
        WorkingDirectory    = $WorkingDirectory
        ScrubGitEnvironment = $ScrubGitEnvironment
      } | ConvertTo-Json -Compress
      $payloadBytes = (New-Object System.Text.UTF8Encoding($false)).GetBytes($payload)
      $remainingMilliseconds = $TimeoutMilliseconds - [int]$stopwatch.ElapsedMilliseconds
      if ($remainingMilliseconds -le 0) {
        $setupTimedOut = $true
        throw 'Windows PowerShell wrapper reached the invocation timeout before payload release.'
      }
      $write = $pipe.WriteAsync($payloadBytes, 0, $payloadBytes.Length)
      if (-not $write.Wait($remainingMilliseconds)) {
        $setupTimedOut = $true
        throw 'Windows PowerShell wrapper payload release timed out.'
      }
      $pipe.Dispose()
      $pipe = $null
    }
    catch {
      $setupFailed = $true
      $setupError = $_.Exception.Message
      if ($processStarted) {
        try {
          if (-not $process.HasExited) { $process.Kill() }
        }
        catch { $setupKillError = $_.Exception.Message }
      }
    }
    finally {
      if ($pipe) {
        $pipe.Dispose()
        $pipe = $null
      }
      if ($setupFailed) {
        if ($controlReader) {
          $controlReader.Dispose()
          $controlReader = $null
        }
        if ($controlPipe) {
          $controlPipe.Dispose()
          $controlPipe = $null
        }
      }
    }
  }
  else {
    try {
      $startInfo = New-Object System.Diagnostics.ProcessStartInfo
      $startInfo.FileName = $actualExecutable
      $startInfo.Arguments = $serializedArguments
      $startInfo.WorkingDirectory = $WorkingDirectory
      $startInfo.UseShellExecute = $false
      $startInfo.RedirectStandardOutput = $true
      $startInfo.RedirectStandardError = $true
      $startInfo.CreateNoWindow = $true
      try {
        $utf8 = New-Object System.Text.UTF8Encoding($false)
        $startInfo.StandardOutputEncoding = $utf8
        $startInfo.StandardErrorEncoding = $utf8
      }
      catch { }
      if ($ScrubGitEnvironment) {
        foreach ($key in @($startInfo.EnvironmentVariables.Keys)) {
          if ($key -like 'GIT_*') { $startInfo.EnvironmentVariables.Remove($key) }
        }
        $startInfo.EnvironmentVariables['GIT_OPTIONAL_LOCKS'] = '0'
        $startInfo.EnvironmentVariables['GIT_TERMINAL_PROMPT'] = '0'
        $startInfo.EnvironmentVariables['LC_ALL'] = 'C.UTF-8'
        $startInfo.EnvironmentVariables['LANG'] = 'C.UTF-8'
      }
      $process.StartInfo = $startInfo
      if (-not $process.Start()) { throw 'Process failed to start.' }
      $processStarted = $true
    }
    catch {
      $setupFailed = $true
      $setupError = $_.Exception.Message
    }
  }

  if (-not $processStarted) {
    $stopwatch.Stop()
    $cleanupFailed = $controlSignalFailed
    $cleanupError = if ($controlSignalFailed) { $controlSignalError } else { '' }
    if ($job) {
      $cleanupDeadline = New-CleanupDeadline 5000
      try {
        $termination = Request-WindowsJobTermination $job
        $activeProcesses = Get-WindowsJobActiveProcessCount $job
        if (-not $termination.Succeeded -and $activeProcesses -ne 0) {
          $cleanupFailed = $true
          $cleanupError = "TerminateJobObject failed with Windows error $($termination.ErrorCode) while the job had $activeProcesses active processes."
        }
        elseif ($activeProcesses -ne 0) {
          $cleanupFailed = $true
          $cleanupError = "Windows job still had $activeProcesses active processes after failed startup."
        }
      }
      catch {
        $cleanupFailed = $true
        $cleanupError = $_.Exception.Message
      }
      $cleanupDeadline.Stopwatch.Stop()
    }
    if ($controlReader) { $controlReader.Dispose() }
    if ($controlPipe) { $controlPipe.Dispose() }
    $process.Dispose()
    if ($job) { $job.Dispose() }
    return [pscustomobject]@{
      ExitCode            = if ($cleanupFailed) { -4 } elseif ($setupTimedOut) { -2 } else { -1 }
      Stdout              = ''
      Stderr              = ((
        $setupError +
        $(if ($setupTimedOut) { " Process timed out after $TimeoutMilliseconds milliseconds." }) +
        $(if ($cleanupFailed) { " Process-tree cleanup failed: $cleanupError" })
      ).Trim())
      TimedOut            = $setupTimedOut
      OutputLimitExceeded = $false
      CleanupFailed       = $cleanupFailed
    }
  }

  $bufferCharacters = 32768
  $stdoutBuffer = New-Object char[] $bufferCharacters
  $stderrBuffer = New-Object char[] $bufferCharacters
  $stdoutBuilder = New-Object System.Text.StringBuilder
  $stderrBuilder = New-Object System.Text.StringBuilder
  $stdoutTask = $process.StandardOutput.ReadBlockAsync($stdoutBuffer, 0, $stdoutBuffer.Length)
  $stderrTask = $process.StandardError.ReadBlockAsync($stderrBuffer, 0, $stderrBuffer.Length)
  $stdoutComplete = $false
  $stderrComplete = $false
  $capturedCharacters = 0
  $timedOut = $setupTimedOut
  $outputLimitExceeded = $false

  while (-not $setupFailed) {
    if (-not $isWindows -and $stdoutComplete -and $stderrComplete -and $process.HasExited) { break }

    $madeProgress = $false
    if (-not $stdoutComplete -and $stdoutTask.IsCompleted) {
      $stdoutCount = [int]$stdoutTask.Result
      $madeProgress = $true
      if ($stdoutCount -eq 0) {
        $stdoutComplete = $true
      }
      elseif ($stdoutCount -gt ($MaxOutputCharacters - $capturedCharacters)) {
        $outputLimitExceeded = $true
      }
      else {
        [void]$stdoutBuilder.Append($stdoutBuffer, 0, $stdoutCount)
        $capturedCharacters += $stdoutCount
        $stdoutTask = $process.StandardOutput.ReadBlockAsync($stdoutBuffer, 0, $stdoutBuffer.Length)
      }
    }

    if (-not $outputLimitExceeded -and -not $stderrComplete -and $stderrTask.IsCompleted) {
      $stderrCount = [int]$stderrTask.Result
      $madeProgress = $true
      if ($stderrCount -eq 0) {
        $stderrComplete = $true
      }
      elseif ($stderrCount -gt ($MaxOutputCharacters - $capturedCharacters)) {
        $outputLimitExceeded = $true
      }
      else {
        [void]$stderrBuilder.Append($stderrBuffer, 0, $stderrCount)
        $capturedCharacters += $stderrCount
        $stderrTask = $process.StandardError.ReadBlockAsync($stderrBuffer, 0, $stderrBuffer.Length)
      }
    }

    if ($outputLimitExceeded) { break }
    if ($isWindows -and -not $targetExitCodeReceived -and -not $controlSignalFailed -and $controlTask.IsCompleted) {
      try {
        $controlText = [string]$controlTask.Result
        $parsedExitCode = 0
        if ($controlText -notmatch '^-?(0|[1-9][0-9]*)$' -or -not [int]::TryParse($controlText, [ref]$parsedExitCode)) {
          throw 'Target exit-code control signal was missing or malformed.'
        }
        $targetExitCode = $parsedExitCode
        $targetExitCodeReceived = $true
      }
      catch {
        $controlSignalFailed = $true
        $controlSignalError = "Target exit-code control signal failed: $($_.Exception.Message)"
      }
    }
    if ($targetExitCodeReceived -or $controlSignalFailed) { break }

    $remainingMilliseconds = $TimeoutMilliseconds - [int]$stopwatch.ElapsedMilliseconds
    if ($isWindows -and $process.HasExited) {
      if ($remainingMilliseconds -gt 0 -and -not $controlTask.IsCompleted) {
        try { [void]$controlTask.Wait([Math]::Min(50, $remainingMilliseconds)) }
        catch { }
      }
      if ($controlTask.IsCompleted) { continue }
      $controlSignalFailed = $true
      $controlSignalError = 'Windows PowerShell wrapper exited before sending a target exit-code control signal.'
      break
    }
    if ($remainingMilliseconds -le 0) {
      $timedOut = $true
      break
    }
    if ($madeProgress) { continue }

    $waitTasks = @()
    if (-not $stdoutComplete) { $waitTasks += $stdoutTask }
    if (-not $stderrComplete) { $waitTasks += $stderrTask }
    if ($isWindows -and -not $controlTask.IsCompleted) { $waitTasks += $controlTask }
    if ($waitTasks.Count -gt 0) {
      $waitMilliseconds = if ($isWindows) { [Math]::Min(50, $remainingMilliseconds) } else { $remainingMilliseconds }
      $null = [System.Threading.Tasks.Task]::WaitAny([System.Threading.Tasks.Task[]]$waitTasks, $waitMilliseconds)
    }
    else {
      [void]$process.WaitForExit($remainingMilliseconds)
    }
  }

  $stopwatch.Stop()
  $cleanupFailed = $controlSignalFailed
  $cleanupErrors = New-Object 'System.Collections.Generic.List[string]'
  if ($controlSignalFailed) { [void]$cleanupErrors.Add($controlSignalError) }
  if ($isWindows -or $timedOut -or $outputLimitExceeded) {
    $cleanupDeadline = New-CleanupDeadline 5000
    try {
      if ($isWindows) {
        if ($setupKillError) {
          $cleanupFailed = $true
          [void]$cleanupErrors.Add("Held wrapper termination failed: $setupKillError")
        }

        $termination = Request-WindowsJobTermination $job
        $jobReachedZero = $false
        $jobQueryFailed = $false
        $lastActiveProcesses = $null
        if (-not $termination.Succeeded) {
          try {
            $lastActiveProcesses = Get-WindowsJobActiveProcessCount $job
            if ($lastActiveProcesses -eq 0) {
              $jobReachedZero = $true
            }
            else {
              $cleanupFailed = $true
              [void]$cleanupErrors.Add(
                "TerminateJobObject failed with Windows error $($termination.ErrorCode) while the job had $lastActiveProcesses active processes."
              )
            }
          }
          catch {
            $cleanupFailed = $true
            $jobQueryFailed = $true
            [void]$cleanupErrors.Add($_.Exception.Message)
          }
        }
      }
      else {
        $cleanup = Stop-NonWindowsBoundedProcess -Process $process -Deadline $cleanupDeadline
        if (-not $cleanup.Succeeded) {
          $cleanupFailed = $true
          [void]$cleanupErrors.Add($cleanup.Error)
        }
      }

      $wrapperExited = $false
      try {
        if ($process.HasExited) {
          $wrapperExited = $true
        }
        else {
          $remainingCleanupMilliseconds = Get-RemainingCleanupMilliseconds $cleanupDeadline
          if ($remainingCleanupMilliseconds -gt 0) {
            $wrapperExited = $process.WaitForExit($remainingCleanupMilliseconds)
          }
        }
      }
      catch {
        $cleanupFailed = $true
        [void]$cleanupErrors.Add("Wrapper exit could not be verified: $($_.Exception.Message)")
      }
      if (-not $wrapperExited) {
        $cleanupFailed = $true
        [void]$cleanupErrors.Add('Wrapper process did not exit by the cleanup deadline.')
      }

      $streamsClosed = $stdoutComplete -and $stderrComplete
      try {
        while (-not $streamsClosed) {
          $remainingCleanupMilliseconds = Get-RemainingCleanupMilliseconds $cleanupDeadline
          if ($remainingCleanupMilliseconds -le 0) { break }

          $madeDrainProgress = $false
          if (-not $stdoutComplete -and $stdoutTask.IsCompleted) {
            $stdoutCount = [int]$stdoutTask.Result
            $madeDrainProgress = $true
            if ($stdoutCount -eq 0) {
              $stdoutComplete = $true
            }
            else {
              if (-not $outputLimitExceeded) {
                if ($stdoutCount -gt ($MaxOutputCharacters - $capturedCharacters)) {
                  $outputLimitExceeded = $true
                }
                else {
                  [void]$stdoutBuilder.Append($stdoutBuffer, 0, $stdoutCount)
                  $capturedCharacters += $stdoutCount
                }
              }
              $stdoutTask = $process.StandardOutput.ReadBlockAsync($stdoutBuffer, 0, $stdoutBuffer.Length)
            }
          }
          if (-not $stderrComplete -and $stderrTask.IsCompleted) {
            $stderrCount = [int]$stderrTask.Result
            $madeDrainProgress = $true
            if ($stderrCount -eq 0) {
              $stderrComplete = $true
            }
            else {
              if (-not $outputLimitExceeded) {
                if ($stderrCount -gt ($MaxOutputCharacters - $capturedCharacters)) {
                  $outputLimitExceeded = $true
                }
                else {
                  [void]$stderrBuilder.Append($stderrBuffer, 0, $stderrCount)
                  $capturedCharacters += $stderrCount
                }
              }
              $stderrTask = $process.StandardError.ReadBlockAsync($stderrBuffer, 0, $stderrBuffer.Length)
            }
          }

          $streamsClosed = $stdoutComplete -and $stderrComplete
          if ($streamsClosed -or $madeDrainProgress) { continue }

          $waitTasks = @()
          if (-not $stdoutComplete) { $waitTasks += $stdoutTask }
          if (-not $stderrComplete) { $waitTasks += $stderrTask }
          if ($waitTasks.Count -gt 0) {
            $null = [System.Threading.Tasks.Task]::WaitAny(
              [System.Threading.Tasks.Task[]]$waitTasks,
              [Math]::Min(100, $remainingCleanupMilliseconds)
            )
          }
        }
      }
      catch {
        $cleanupFailed = $true
        [void]$cleanupErrors.Add("Redirected process output could not be drained: $($_.Exception.Message)")
      }
      if (-not $streamsClosed) {
        $cleanupFailed = $true
        [void]$cleanupErrors.Add('Redirected process output did not reach EOF after cleanup.')
      }

      if ($isWindows -and -not $jobQueryFailed -and -not $jobReachedZero) {
        while ((Get-RemainingCleanupMilliseconds $cleanupDeadline) -gt 0) {
          try {
            $lastActiveProcesses = Get-WindowsJobActiveProcessCount $job
          }
          catch {
            $cleanupFailed = $true
            $jobQueryFailed = $true
            [void]$cleanupErrors.Add($_.Exception.Message)
            break
          }
          if ($lastActiveProcesses -eq 0) {
            $jobReachedZero = $true
            break
          }
          $remainingCleanupMilliseconds = Get-RemainingCleanupMilliseconds $cleanupDeadline
          if ($remainingCleanupMilliseconds -gt 0) {
            Start-Sleep -Milliseconds ([Math]::Min(20, $remainingCleanupMilliseconds))
          }
        }
        if (-not $jobReachedZero -and -not $jobQueryFailed) {
          $cleanupFailed = $true
          [void]$cleanupErrors.Add("Windows job still had $lastActiveProcesses active processes at the cleanup deadline.")
        }
      }
    }
    catch {
      $cleanupFailed = $true
      [void]$cleanupErrors.Add($_.Exception.Message)
    }
    $cleanupDeadline.Stopwatch.Stop()
  }

  $stdout = $stdoutBuilder.ToString()
  $stderr = $stderrBuilder.ToString()
  $diagnostics = New-Object 'System.Collections.Generic.List[string]'
  if ($setupFailed) {
    [void]$diagnostics.Add("Process setup failed: $setupError")
  }
  if ($timedOut) {
    [void]$diagnostics.Add("Process timed out after $TimeoutMilliseconds milliseconds.")
  }
  if ($outputLimitExceeded) {
    $stdout = ''
    $stderr = ''
    [void]$diagnostics.Add("Process output exceeded the $MaxOutputCharacters character safety limit.")
  }
  if ($cleanupFailed) {
    [void]$diagnostics.Add("Process-tree cleanup failed: $(($cleanupErrors | Select-Object -Unique) -join ' ')")
  }
  if ($diagnostics.Count -gt 0) {
    $stderr = (($stderr.TrimEnd() + ' ' + ($diagnostics -join ' ')).Trim())
  }

  $observedExitCode = $null
  try {
    if ($process.HasExited) { $observedExitCode = $process.ExitCode }
  }
  catch { }
  $exitCode = if ($cleanupFailed) {
    -4
  }
  elseif ($timedOut) {
    -2
  }
  elseif ($outputLimitExceeded) {
    -3
  }
  elseif ($isWindows -and $targetExitCodeReceived) {
    $targetExitCode
  }
  elseif ($setupFailed -or $null -eq $observedExitCode) {
    -1
  }
  else {
    $observedExitCode
  }

  if ($controlReader) { $controlReader.Dispose() }
  if ($controlPipe) { $controlPipe.Dispose() }
  $process.Dispose()
  if ($job) { $job.Dispose() }
  return [pscustomobject]@{
    ExitCode            = $exitCode
    Stdout              = $stdout
    Stderr              = $stderr
    TimedOut            = $timedOut
    OutputLimitExceeded = $outputLimitExceeded
    CleanupFailed       = $cleanupFailed
  }
}

function Test-PathInside([string]$Parent, [string]$Child) {
  $parentWithSeparator = $Parent.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
  return $Child.StartsWith($parentWithSeparator, [System.StringComparison]::OrdinalIgnoreCase)
}

function Get-ReparsePoint([string]$Parent, [string]$Child) {
  if (-not (Test-PathInside $Parent $Child)) { return $null }
  $relative = $Child.Substring($Parent.TrimEnd('\', '/').Length).TrimStart('\', '/')
  $current = $Parent
  foreach ($segment in ($relative -split '[\\/]')) {
    if (-not $segment) { continue }
    $current = Join-Path $current $segment
    $item = Get-Item -LiteralPath $current -Force -ErrorAction Stop
    if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
      return $current
    }
  }
  return $null
}

function Resolve-CommandPath([string]$Name, [string[]]$AllowedTypes, [string[]]$UntrustedRoots) {
  $types = @()
  foreach ($type in $AllowedTypes) { $types += [System.Management.Automation.CommandTypes]::$type }
  $command = Get-Command $Name -CommandType $types -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $command -or -not $command.Source) { return $null }
  $path = [System.IO.Path]::GetFullPath($command.Source)
  foreach ($root in $UntrustedRoots) {
    if ($root -and (($path -ieq $root) -or (Test-PathInside $root $path))) { return $null }
  }
  return $path
}

$script:GitExecutable = $null
function Invoke-Git([string[]]$Arguments, [string]$WorkingDirectory, [int]$TimeoutMilliseconds = 30000) {
  $safeArguments = @(
    '--no-optional-locks',
    '-c', 'core.fsmonitor=false',
    '-c', 'core.quotepath=false',
    '-c', 'submodule.recurse=false'
  ) + $Arguments
  return Invoke-BoundedProcess $script:GitExecutable $safeArguments $WorkingDirectory $true $TimeoutMilliseconds
}

function Get-OutputLines([string]$Text) {
  return @($Text -split '\r?\n' | Where-Object { $_ -ne '' })
}

function Resolve-GitPath([string]$WorkingDirectory, [string]$Value) {
  if ([System.IO.Path]::IsPathRooted($Value)) { return (Resolve-Path -LiteralPath $Value).Path }
  return (Resolve-Path -LiteralPath (Join-Path $WorkingDirectory $Value)).Path
}

function Get-DirtyState([string]$WorkingDirectory) {
  $status = Invoke-Git @('status', '--porcelain=v1', '--untracked-files=all', '--ignore-submodules=none', '-z') $WorkingDirectory 30000
  if ($status.TimedOut) { throw 'Git status timed out after 30 seconds.' }
  if ($status.OutputLimitExceeded) { throw 'Git status output exceeded the 4 MiB safety limit.' }
  if ($status.ExitCode -ne 0) { throw "Git status failed: $($status.Stderr.Trim())" }
  $paths = @($status.Stdout -split "`0" | Where-Object { $_ } | ForEach-Object {
    if ($_ -match '^[ MADRCU?!]{2} ') { $_.Substring(3) } else { $_ }
  })
  return [pscustomobject]@{ Paths = $paths; Count = $paths.Count }
}

function Confirm-SourceState([string]$WorkingDirectory, [string]$ExpectedHead, [string]$ExpectedBranch) {
  $head = Invoke-Git @('rev-parse', '--verify', 'HEAD^{commit}') $WorkingDirectory
  $branch = Invoke-Git @('symbolic-ref', '--quiet', '--short', 'HEAD') $WorkingDirectory
  if ($head.ExitCode -ne 0 -or $branch.ExitCode -ne 0) { return $false }
  if ($head.Stdout.Trim() -ne $ExpectedHead -or $branch.Stdout.Trim() -ne $ExpectedBranch) { return $false }
  $dirty = Get-DirtyState $WorkingDirectory
  return $dirty.Count -eq 0
}

try {
  if ($CheckOnly -and $PrepareIsolation) {
    Add-ReadinessError 'invalid_mode' 'CheckOnly cannot be combined with PrepareIsolation.'
    Complete-Readiness 1
  }
  if (-not $CheckOnly -and -not $PrepareIsolation) {
    Add-ReadinessError 'invalid_mode' 'Choose exactly one operation mode: CheckOnly or PrepareIsolation.'
    Complete-Readiness 1
  }
  if ($NoIsolation -and ($PrepareIsolation -or $Parallel)) {
    Add-ReadinessError 'invalid_mode' '-NoIsolation cannot be combined with -PrepareIsolation or -Parallel.'
    Complete-Readiness 1
  }
  $result.mode = if ($CheckOnly) { 'CHECK_ONLY' } else { 'PREPARE_ISOLATION' }

  if (-not (Test-Path -LiteralPath $RepoPath -PathType Container)) {
    Add-ReadinessError 'missing_repo' "Repository path does not exist: $RepoPath"
    Complete-Readiness 1
  }
  if (-not (Test-Path -LiteralPath $WorkspaceRoot -PathType Container)) {
    Add-ReadinessError 'missing_workspace' "Workspace root does not exist: $WorkspaceRoot"
    Complete-Readiness 1
  }
  $workspaceItem = Get-Item -LiteralPath $WorkspaceRoot -Force -ErrorAction Stop
  if (($workspaceItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
    Add-ReadinessError 'workspace_reparse' "WorkspaceRoot cannot be a reparse point: $WorkspaceRoot"
    Complete-Readiness 1
  }

  $repoLexical = [System.IO.Path]::GetFullPath($RepoPath)
  $workspaceLexical = [System.IO.Path]::GetFullPath($WorkspaceRoot)
  if ($repoLexical -ieq $workspaceLexical) {
    Add-ReadinessError 'workspace_root_target' "Workspace root is not a supported run target: $repoLexical"
    Complete-Readiness 1
  }
  if (-not (Test-PathInside $workspaceLexical $repoLexical)) {
    Add-ReadinessError 'workspace_mismatch' "Repository path must be inside WorkspaceRoot. Repo: $repoLexical WorkspaceRoot: $workspaceLexical"
    Complete-Readiness 1
  }

  $reparsePoint = Get-ReparsePoint $workspaceLexical $repoLexical
  if ($reparsePoint) {
    Add-ReadinessError 'reparse_target' "Repository path crosses a reparse point and cannot be trusted: $reparsePoint"
    Complete-Readiness 1
  }

  $resolvedRepo = (Resolve-Path -LiteralPath $repoLexical).Path
  $resolvedWorkspace = (Resolve-Path -LiteralPath $workspaceLexical).Path
  $result.repoPath = $resolvedRepo

  $pipelinesRoot = Join-Path $resolvedWorkspace 'pipelines'
  if ($resolvedRepo -ieq $pipelinesRoot) {
    Add-ReadinessError 'pipelines_parent_target' "The pipelines parent is not a supported run target: $resolvedRepo"
    Complete-Readiness 1
  }

  $allowedPipelines = @(
    'gtm-orchestrator',
    'leadgrow-video',
    'design-pipeline',
    'content',
    'newsletter-pipeline',
    'outbound',
    'leadgrow-video-storyboard-clean'
  )
  if (Test-Path -LiteralPath $pipelinesRoot) {
    $pipelinesItem = Get-Item -LiteralPath $pipelinesRoot -Force -ErrorAction Stop
    if (-not $pipelinesItem.PSIsContainer) {
      Add-ReadinessError 'pipelines_not_directory' "Pipeline layout invalid: '$pipelinesRoot' exists but is not a directory."
      Complete-Readiness 1
    }
    if (($pipelinesItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
      Add-ReadinessError 'pipelines_reparse' "Pipeline layout invalid: pipelines root is a reparse point: $pipelinesRoot"
      Complete-Readiness 1
    }
    try {
      $pipelineDirectories = @(Get-ChildItem -LiteralPath $pipelinesRoot -Directory -ErrorAction Stop)
    } catch {
      Add-ReadinessError 'pipelines_unreadable' "Pipeline layout could not be enumerated: $($_.Exception.Message)"
      Complete-Readiness 1
    }
    $invalidPipelines = @($pipelineDirectories | Where-Object { $allowedPipelines -notcontains $_.Name } | Select-Object -ExpandProperty Name)
    if ($invalidPipelines.Count -gt 0) {
      Add-ReadinessError 'invalid_pipeline_layout' "Pipeline layout invalid. Non-allowlisted directories: $($invalidPipelines -join ', ')"
      Complete-Readiness 1
    }
  }

  $validateScript = Join-Path $PSScriptRoot 'validate-pipeline-layout.ps1'
  if (-not (Test-Path -LiteralPath $validateScript -PathType Leaf)) {
    Add-ReadinessError 'missing_layout_validator' "Pipeline layout validator is missing: $validateScript"
    Complete-Readiness 1
  }
  $hostExecutable = (Get-Process -Id $PID).Path
  $layout = Invoke-BoundedProcess $hostExecutable @('-NoProfile', '-File', $validateScript, '-RepoRoot', $resolvedWorkspace) $PSScriptRoot $false 30000
  if ($layout.TimedOut -or $layout.OutputLimitExceeded -or $layout.ExitCode -ne 0) {
    Add-ReadinessError 'invalid_pipeline_layout' ("Pipeline layout invalid: " + (($layout.Stderr + ' ' + $layout.Stdout).Trim()))
    Complete-Readiness 1
  }
  $result.layoutValid = $true

  $script:GitExecutable = Resolve-CommandPath 'git' @('Application') @($resolvedRepo, $resolvedWorkspace)
  if (-not $script:GitExecutable) {
    Add-ReadinessError 'missing_git' 'Trusted Git executable was not found outside the target workspace.'
    Complete-Readiness 1
  }

  $isCanonicalMonorepoPipeline = $false
  $canonicalPipelineName = $null
  $workspaceGitignore = Join-Path $resolvedWorkspace '.gitignore'
  if (Test-Path -LiteralPath $workspaceGitignore -PathType Leaf) {
    foreach ($line in (Get-Content -LiteralPath $workspaceGitignore)) {
      if ($line -match '^!pipelines/([a-zA-Z0-9_-]+)/$') {
        $candidate = Join-Path $pipelinesRoot $Matches[1]
        if ((Test-Path -LiteralPath $candidate -PathType Container) -and
            $resolvedRepo -ieq (Resolve-Path -LiteralPath $candidate).Path) {
          $isCanonicalMonorepoPipeline = $true
          $canonicalPipelineName = $Matches[1]
          break
        }
      }
    }
  }

  $gitInspectionRoot = if ($isCanonicalMonorepoPipeline) { $resolvedWorkspace } else { $resolvedRepo }
  $topLevel = Invoke-Git @('rev-parse', '--show-toplevel') $gitInspectionRoot
  if ($topLevel.ExitCode -ne 0 -or -not $topLevel.Stdout.Trim()) {
    Add-ReadinessError 'not_git_repo' "Repository path is not inside a git repository: $resolvedRepo"
    Complete-Readiness 1
  }
  $gitRoot = (Resolve-Path -LiteralPath $topLevel.Stdout.Trim()).Path
  if ($gitRoot -ine $gitInspectionRoot) {
    Add-ReadinessError 'wrong_git_root' "Repository path must be the git toplevel: $resolvedRepo (toplevel: $gitRoot)"
    Complete-Readiness 1
  }

  $head = Invoke-Git @('rev-parse', '--verify', 'HEAD^{commit}') $gitInspectionRoot
  if ($head.ExitCode -ne 0 -or -not $head.Stdout.Trim()) {
    Add-ReadinessError 'unborn_head' 'Repository must have a committed HEAD before readiness can pass.'
    Complete-Readiness 1
  }
  $result.checkedHead = $head.Stdout.Trim()

  $branch = Invoke-Git @('symbolic-ref', '--quiet', '--short', 'HEAD') $gitInspectionRoot
  if ($branch.ExitCode -ne 0 -or -not $branch.Stdout.Trim()) {
    Add-ReadinessError 'detached_head' 'Detached HEAD is not ready. Switch to a feature branch.'
    Complete-Readiness 1
  }
  $result.branch = $branch.Stdout.Trim()

  if ($DefaultBranch) {
    $explicitDefault = Invoke-Git @('show-ref', '--verify', '--quiet', "refs/heads/$DefaultBranch") $gitInspectionRoot
    if ($explicitDefault.ExitCode -ne 0) {
      Add-ReadinessError 'invalid_default_branch' "DefaultBranch '$DefaultBranch' does not name a local branch."
      Complete-Readiness 1
    }
    $result.defaultBranch = $DefaultBranch
  }
  else {
    $remoteDefault = Invoke-Git @('symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD') $gitInspectionRoot
    if ($remoteDefault.ExitCode -eq 0 -and $remoteDefault.Stdout.Trim()) {
      $candidate = ($remoteDefault.Stdout.Trim() -replace '^origin/', '')
      $remoteRef = Invoke-Git @('show-ref', '--verify', '--quiet', "refs/remotes/origin/$candidate") $gitInspectionRoot
      if ($remoteRef.ExitCode -eq 0) { $result.defaultBranch = $candidate }
    }
    if (-not $result.defaultBranch) {
      foreach ($candidate in @('main', 'master')) {
        $candidateRef = Invoke-Git @('show-ref', '--verify', '--quiet', "refs/heads/$candidate") $gitInspectionRoot
        if ($candidateRef.ExitCode -eq 0) {
          $result.defaultBranch = $candidate
          break
        }
      }
    }
  }
  if (-not $result.defaultBranch) {
    Add-ReadinessError 'unknown_default_branch' 'Unable to determine the default branch. Pass -DefaultBranch with a validated local branch name.'
    Complete-Readiness 1
  }
  if ($result.branch -eq $result.defaultBranch) {
    Add-ReadinessError 'default_branch' "Default branch '$($result.defaultBranch)' is not ready. Switch to a feature branch."
    Complete-Readiness 1
  }

  $hiddenFlags = Invoke-Git @('ls-files', '-v') $gitInspectionRoot
  if ($hiddenFlags.ExitCode -ne 0) {
    Add-ReadinessError 'git_index_check_failed' "Unable to inspect tracked-file flags: $($hiddenFlags.Stderr.Trim())"
    Complete-Readiness 1
  }
  $hiddenPaths = @(Get-OutputLines $hiddenFlags.Stdout | Where-Object { $_ -cmatch '^[a-zS] ' })
  if ($hiddenPaths.Count -gt 0) {
    Add-ReadinessError 'hidden_index_state' 'Tracked files use assume-unchanged or skip-worktree flags. Clear those flags before readiness.'
    Complete-Readiness 1
  }

  try {
    $dirty = Get-DirtyState $gitInspectionRoot
  } catch {
    Add-ReadinessError 'git_status_failed' $_.Exception.Message
    Complete-Readiness 1
  }
  $result.dirtyPathCount = $dirty.Count
  if ($dirty.Count -gt 1000) {
    $result.dirtyPaths = @($dirty.Paths | Select-Object -First 1000)
    $result.dirtyPathsTruncated = $true
  }
  else {
    $result.dirtyPaths = @($dirty.Paths)
  }
  if ($dirty.Count -gt 0) {
    Add-ReadinessError 'dirty_tree' 'Working tree is dirty. Commit or otherwise resolve the listed paths before preparing a run.'
    Complete-Readiness 1
  }

  $commonDirResult = Invoke-Git @('rev-parse', '--git-common-dir') $gitInspectionRoot
  if ($commonDirResult.ExitCode -ne 0) {
    Add-ReadinessError 'git_identity_failed' 'Unable to determine repository common Git directory.'
    Complete-Readiness 1
  }
  $sourceCommonDir = Resolve-GitPath $gitInspectionRoot $commonDirResult.Stdout.Trim()

  # Isolation is the default: every run leases a treehouse worktree unless the caller
  # opts out with -NoIsolation. Canonical monorepo pipelines always require isolation
  # and cannot opt out.
  if ($NoIsolation -and $isCanonicalMonorepoPipeline) {
    Add-ReadinessError 'noisolation_forbidden_canonical' 'Canonical monorepo pipelines always require isolation; -NoIsolation is not allowed here.'
  }
  $result.isolationRequired = [bool]($isCanonicalMonorepoPipeline -or (-not $NoIsolation))
  $treehouse = $null
  if ($result.isolationRequired) {
    $treehouse = Resolve-CommandPath 'treehouse' @('Application', 'ExternalScript') @($resolvedRepo, $resolvedWorkspace)
    $result.treehouseAvailable = [bool]$treehouse
    if (-not $treehouse) {
      $remediation = if ($isCanonicalMonorepoPipeline) {
        'Treehouse is required for this canonical pipeline. Install treehouse or choose a standalone repository.'
      } else {
        'Treehouse is required for isolation but is not on PATH. Install treehouse, or pass -NoIsolation to run on the current feature branch without isolation.'
      }
      Add-ReadinessError 'missing_treehouse' $remediation
      Complete-Readiness 1
    }
  }

  if ($CheckOnly -and $result.isolationRequired) {
    $treehouseStatus = Invoke-BoundedProcess $treehouse @('status') $gitInspectionRoot $false $InternalTreehouseStatusTimeoutMilliseconds
    if ($treehouseStatus.TimedOut -or $treehouseStatus.OutputLimitExceeded -or $treehouseStatus.ExitCode -ne 0) {
      Add-ReadinessError 'treehouse_not_ready' ("Treehouse status failed from '$gitInspectionRoot': " + (($treehouseStatus.Stderr + ' ' + $treehouseStatus.Stdout).Trim()))
      Complete-Readiness 1
    }
    Add-ReadinessError 'isolation_not_prepared' 'Isolation is required and available but not prepared. Rerun with -PrepareIsolation and use the returned runPath.'
    $result.runPath = $null
    Complete-Readiness 1
  }

  if ($PrepareIsolation) {
    if ($LeaseHolder -notmatch '^[a-zA-Z0-9._-]+$') {
      Add-ReadinessError 'invalid_lease_holder' 'LeaseHolder may contain only letters, numbers, dot, underscore, and hyphen.'
      Complete-Readiness 1
    }

    $lease = Invoke-BoundedProcess $treehouse @('get', '--lease', '--lease-holder', $LeaseHolder) $gitInspectionRoot $false 60000
    if ($lease.TimedOut -or $lease.OutputLimitExceeded -or $lease.ExitCode -ne 0) {
      Add-ReadinessError 'treehouse_lease_failed' ("Treehouse lease failed: " + (($lease.Stderr + ' ' + $lease.Stdout).Trim()))
      Complete-Readiness 1
    }
    $leaseLines = @(Get-OutputLines $lease.Stdout | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    if ($leaseLines.Count -ne 1) {
      $cleanupCandidates = @()
      foreach ($line in $leaseLines) {
        if (-not [System.IO.Path]::IsPathRooted($line) -or $line.StartsWith('\\')) { continue }
        try {
          $candidatePath = [System.IO.Path]::GetFullPath($line)
          if (-not (Test-Path -LiteralPath $candidatePath -PathType Container)) { continue }
          $candidateCommon = Invoke-Git @('rev-parse', '--git-common-dir') $candidatePath
          if ($candidateCommon.ExitCode -ne 0) { continue }
          if ((Resolve-GitPath $candidatePath $candidateCommon.Stdout.Trim()) -ieq $sourceCommonDir) {
            $cleanupCandidates += $candidatePath
          }
        }
        catch { }
      }

      $cleanup = 'Lease path could not be safely identified for automatic return. Inspect treehouse status.'
      if ($cleanupCandidates.Count -eq 1) {
        $returnResult = Invoke-BoundedProcess $treehouse @('return', $cleanupCandidates[0]) $gitInspectionRoot $false 30000
        $cleanup = if ($returnResult.ExitCode -eq 0) { 'Lease was returned.' } else { "Lease return failed: $($returnResult.Stderr.Trim())" }
      }
      Add-ReadinessError 'invalid_treehouse_output' "Treehouse must return exactly one lease path on stdout; received $($leaseLines.Count). $cleanup"
      Complete-Readiness 1
    }

    $leaseCandidate = $leaseLines[0]
    if (-not [System.IO.Path]::IsPathRooted($leaseCandidate) -or $leaseCandidate.StartsWith('\\')) {
      Add-ReadinessError 'invalid_lease_path' "Treehouse returned a non-local lease path: $leaseCandidate"
      Complete-Readiness 1
    }
    $leasePath = [System.IO.Path]::GetFullPath($leaseCandidate)
    $leaseAcquired = $true
    $leaseValid = $false
    try {
      if (-not (Test-Path -LiteralPath $leasePath -PathType Container)) { throw "Lease path does not exist: $leasePath" }
      $leaseItem = Get-Item -LiteralPath $leasePath -Force
      if (($leaseItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Lease path is a reparse point: $leasePath" }

      $leaseTopLevel = Invoke-Git @('rev-parse', '--show-toplevel') $leasePath
      $leaseCommon = Invoke-Git @('rev-parse', '--git-common-dir') $leasePath
      $leaseHead = Invoke-Git @('rev-parse', '--verify', 'HEAD^{commit}') $leasePath
      if ($leaseTopLevel.ExitCode -ne 0 -or $leaseCommon.ExitCode -ne 0 -or $leaseHead.ExitCode -ne 0) {
        throw 'Lease is not a valid Git worktree.'
      }
      if ((Resolve-Path -LiteralPath $leaseTopLevel.Stdout.Trim()).Path -ine $leasePath) {
        throw "Lease Git toplevel does not match lease path: $leasePath"
      }
      $leaseCommonDir = Resolve-GitPath $leasePath $leaseCommon.Stdout.Trim()
      if ($leaseCommonDir -ine $sourceCommonDir) { throw 'Lease belongs to a different repository.' }
      $leaseDirty = Get-DirtyState $leasePath
      if ($leaseDirty.Count -ne 0) { throw 'Lease worktree is dirty.' }
      if (-not (Confirm-SourceState $gitInspectionRoot $result.checkedHead $result.branch)) {
        throw 'Source repository changed before isolated branch creation. Rerun readiness.'
      }

      $holderSlug = ($LeaseHolder -replace '[^a-zA-Z0-9-]', '-').Trim('-')
      if (-not $holderSlug) { $holderSlug = 'lease' }
      if ($holderSlug.Length -gt 40) { $holderSlug = $holderSlug.Substring(0, 40).TrimEnd('-') }
      $sourceSlug = ($result.branch -replace '[^a-zA-Z0-9-]', '-').Trim('-')
      if (-not $sourceSlug) { $sourceSlug = 'source' }
      if ($sourceSlug.Length -gt 40) { $sourceSlug = $sourceSlug.Substring(0, 40).TrimEnd('-') }
      $headLength = [Math]::Min(12, $result.checkedHead.Length)
      $headPrefix = $result.checkedHead.Substring(0, $headLength).ToLowerInvariant()
      $branchNonce = [Guid]::NewGuid().ToString('N').Substring(0, 8)
      $runBranch = "harness/$holderSlug/$sourceSlug-$headPrefix-$branchNonce"

      $branchFormat = Invoke-Git @('check-ref-format', '--branch', $runBranch) $leasePath
      if ($branchFormat.ExitCode -ne 0) { throw "Generated run branch is invalid: $runBranch" }
      $branchCreate = Invoke-Git @('switch', '-c', $runBranch, $result.checkedHead) $leasePath
      if ($branchCreate.ExitCode -ne 0) {
        throw "Unable to create derived run branch '$runBranch': $($branchCreate.Stderr.Trim())"
      }

      $leaseBranch = Invoke-Git @('symbolic-ref', '--quiet', '--short', 'HEAD') $leasePath
      $leaseHead = Invoke-Git @('rev-parse', '--verify', 'HEAD^{commit}') $leasePath
      if ($leaseBranch.ExitCode -ne 0 -or $leaseBranch.Stdout.Trim() -ne $runBranch) {
        throw "Lease did not attach to derived run branch '$runBranch'."
      }
      if ($leaseHead.ExitCode -ne 0 -or $leaseHead.Stdout.Trim() -ne $result.checkedHead) {
        throw 'Derived run branch HEAD does not match the checked source HEAD.'
      }
      $leaseDirty = Get-DirtyState $leasePath
      if ($leaseDirty.Count -ne 0) { throw 'Derived run branch worktree is dirty.' }
      $result.runBranch = $runBranch

      if ($isCanonicalMonorepoPipeline) {
        $leasedPipeline = Join-Path (Join-Path $leasePath 'pipelines') $canonicalPipelineName
        if (-not (Test-Path -LiteralPath $leasedPipeline -PathType Container)) {
          throw "Leased worktree is missing pipelines/$canonicalPipelineName."
        }
        $leasedReparse = Get-ReparsePoint $leasePath $leasedPipeline
        if ($leasedReparse) { throw "Leased pipeline crosses a reparse point: $leasedReparse" }
        $result.runPath = (Resolve-Path -LiteralPath $leasedPipeline).Path
      }
      else {
        $result.runPath = $leasePath
      }

      if (-not (Confirm-SourceState $gitInspectionRoot $result.checkedHead $result.branch)) {
        throw 'Source repository changed during isolation preparation. Rerun readiness.'
      }
      $leaseValid = $true
    }
    catch {
      $cleanup = 'Lease return was not attempted.'
      if ($leaseAcquired) {
        $returnResult = Invoke-BoundedProcess $treehouse @('return', $leasePath) $gitInspectionRoot $false 30000
        $cleanup = if ($returnResult.ExitCode -eq 0) { 'Lease was returned.' } else { "Lease return failed: $($returnResult.Stderr.Trim())" }
      }
      Add-ReadinessError 'invalid_lease' "$($_.Exception.Message) $cleanup"
      Complete-Readiness 1
    }

    if ($leaseValid) {
      $result.leasePath = $leasePath
      $result.leaseHolder = $LeaseHolder
      $escapedLease = $leasePath.Replace("'", "''")
      $result.returnCommand = "treehouse return '$escapedLease'"
      $result.isolationPrepared = $true
    }
  }
  else {
    if (-not (Confirm-SourceState $gitInspectionRoot $result.checkedHead $result.branch)) {
      Add-ReadinessError 'source_changed' 'Source repository changed during readiness checks. Rerun readiness.'
      Complete-Readiness 1
    }
    $result.runPath = $resolvedRepo
    $result.runBranch = $result.branch
  }

  $result.status = 'READY'
  $result.readyForRun = $true
  Complete-Readiness 0
}
catch {
  Add-ReadinessError 'unexpected_error' $_.Exception.Message
  Complete-Readiness 1
}
