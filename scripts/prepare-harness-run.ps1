<#
.SYNOPSIS
  Checks whether a repository is ready for an approval-gated harness run.

.DESCRIPTION
  Performs repository, branch, dirty-tree, pipeline-layout, and isolation checks.
  Emits one JSON object to stdout. It never starts task execution or mutates git state.

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
  [switch]$CurrentBranch,
  [string]$LeaseHolder = "harness-readiness",
  [string]$DefaultBranch = ""
)
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

$result = [ordered]@{
  status                 = "NOT_READY"
  readyForRun            = $false
  mode                   = $null
  repoPath               = $null
  branch                 = $null
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

function Invoke-BoundedProcess(
  [string]$Executable,
  [string[]]$Arguments,
  [string]$WorkingDirectory,
  [bool]$ScrubGitEnvironment = $false,
  [int]$TimeoutMilliseconds = 30000,
  [int]$MaxOutputCharacters = 4194304
) {
  $actualExecutable = $Executable
  $actualArguments = @($Arguments)
  if ([System.IO.Path]::GetExtension($Executable) -ieq '.ps1') {
    $actualExecutable = (Get-Process -Id $PID).Path
    $actualArguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $Executable) + $actualArguments
  }

  $startInfo = New-Object System.Diagnostics.ProcessStartInfo
  $startInfo.FileName = $actualExecutable
  $startInfo.Arguments = (($actualArguments | ForEach-Object { Quote-NativeArgument "$_" }) -join ' ')
  $startInfo.WorkingDirectory = $WorkingDirectory
  $startInfo.UseShellExecute = $false
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.CreateNoWindow = $true
  try {
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    $startInfo.StandardOutputEncoding = $utf8
    $startInfo.StandardErrorEncoding = $utf8
  } catch { }

  if ($ScrubGitEnvironment) {
    foreach ($key in @($startInfo.EnvironmentVariables.Keys)) {
      if ($key -like 'GIT_*') { $startInfo.EnvironmentVariables.Remove($key) }
    }
    $startInfo.EnvironmentVariables['GIT_OPTIONAL_LOCKS'] = '0'
    $startInfo.EnvironmentVariables['GIT_TERMINAL_PROMPT'] = '0'
    $startInfo.EnvironmentVariables['LC_ALL'] = 'C.UTF-8'
    $startInfo.EnvironmentVariables['LANG'] = 'C.UTF-8'
  }

  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $startInfo
  if (-not $process.Start()) {
    return [pscustomobject]@{ ExitCode = -1; Stdout = ''; Stderr = 'Process failed to start.'; TimedOut = $false; OutputLimitExceeded = $false }
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
  $timedOut = $false
  $outputLimitExceeded = $false
  $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

  while (-not ($stdoutComplete -and $stderrComplete -and $process.HasExited)) {
    $remainingMilliseconds = $TimeoutMilliseconds - [int]$stopwatch.ElapsedMilliseconds
    if ($remainingMilliseconds -le 0) {
      $timedOut = $true
      break
    }

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
    if ($madeProgress) { continue }

    $waitTasks = @()
    if (-not $stdoutComplete) { $waitTasks += $stdoutTask }
    if (-not $stderrComplete) { $waitTasks += $stderrTask }
    $waitMilliseconds = $remainingMilliseconds
    if ($waitTasks.Count -gt 0) {
      $null = [System.Threading.Tasks.Task]::WaitAny([System.Threading.Tasks.Task[]]$waitTasks, $waitMilliseconds)
    }
    else {
      [void]$process.WaitForExit($waitMilliseconds)
    }
  }

  $stopwatch.Stop()
  if ($timedOut -or $outputLimitExceeded) {
    try { $process.Kill() } catch { }
    try { [void]$process.WaitForExit(5000) } catch { }
    try { [System.Threading.Tasks.Task]::WaitAll([System.Threading.Tasks.Task[]]@($stdoutTask, $stderrTask), 5000) | Out-Null } catch { }
  }

  $stdout = $stdoutBuilder.ToString()
  $stderr = $stderrBuilder.ToString()
  if ($outputLimitExceeded) {
    $stdout = ''
    $stderr = "Process output exceeded the $MaxOutputCharacters character safety limit."
  }

  $exitCode = if ($timedOut) { -2 } elseif ($outputLimitExceeded) { -3 } else { $process.ExitCode }
  $process.Dispose()
  return [pscustomobject]@{
    ExitCode = $exitCode
    Stdout = $stdout
    Stderr = $stderr
    TimedOut = $timedOut
    OutputLimitExceeded = $outputLimitExceeded
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

  $result.isolationRequired = [bool]($Parallel -or $PrepareIsolation -or $isCanonicalMonorepoPipeline)
  $treehouse = $null
  if ($result.isolationRequired) {
    $treehouse = Resolve-CommandPath 'treehouse' @('Application', 'ExternalScript') @($resolvedRepo, $resolvedWorkspace)
    $result.treehouseAvailable = [bool]$treehouse
    if (-not $treehouse) {
      $remediation = if ($isCanonicalMonorepoPipeline) {
        'Treehouse is required for this canonical pipeline. Install treehouse or choose a standalone repository.'
      } else {
        'Treehouse is required for isolation but is not on PATH. Install treehouse or rerun CheckOnly without Parallel.'
      }
      Add-ReadinessError 'missing_treehouse' $remediation
      Complete-Readiness 1
    }
  }

  if ($CheckOnly -and $result.isolationRequired) {
    $treehouseStatus = Invoke-BoundedProcess $treehouse @('status') $gitInspectionRoot $false 30000
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
      if ($leaseHead.Stdout.Trim() -ne $result.checkedHead) { throw 'Lease HEAD does not match the checked source HEAD.' }
      $leaseDirty = Get-DirtyState $leasePath
      if ($leaseDirty.Count -ne 0) { throw 'Lease worktree is dirty.' }

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
  }

  $result.status = 'READY'
  $result.readyForRun = $true
  Complete-Readiness 0
}
catch {
  Add-ReadinessError 'unexpected_error' $_.Exception.Message
  Complete-Readiness 1
}
