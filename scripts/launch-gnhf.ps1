<#
.SYNOPSIS
  Launch a gnhf overnight run DETACHED from inside a Claude Code session, so a user never
  has to drop to a terminal. The process survives this session closing; output streams to a
  log file and a JSON handle records the PID/log/args for later checking.

.DESCRIPTION
  Pre-flights (gnhf on PATH, ~/.gnhf/config.yml present, warns on dirty tree), then starts
  gnhf hidden and detached via the .cmd shim. Model + agent come from ~/.gnhf/config.yml
  (Opus is enforced there) - this script does not override them.

  NOTE: PowerShell's Start-Process quotes each -ArgumentList item; an objective containing
  literal double-quotes can mis-quote. Keep objectives as plain prose, or pass a short
  objective and let the running agent read a longer brief from a file you reference in it.
  Smoke-test once (a 1-iteration run) before trusting this for a real overnight launch.

.EXAMPLE
  pwsh scripts/launch-gnhf.ps1 -Objective "Drain the backlog in ./api, tests green" `
    -StopWhen "bun test exits 0 and backlog.md is empty" -MaxIterations 30
#>
param(
  [Parameter(Mandatory = $true)][string]$Objective,
  [string]$StopWhen = "",
  [int]$MaxIterations = 30,
  [string]$RepoPath = (Get-Location).Path
)
$ErrorActionPreference = "Stop"

# --- Pre-flight ---------------------------------------------------------------
$configPath = Join-Path $HOME ".gnhf\config.yml"
if (-not (Test-Path $configPath)) {
  Write-Error "gnhf config missing: $configPath - run /onboard first."; exit 1
}
# Prefer the .cmd shim: Start-Process can launch it directly; the extensionless shim can't.
$gnhf = Get-Command "gnhf.cmd" -ErrorAction SilentlyContinue
if (-not $gnhf) { $gnhf = Get-Command "gnhf" -ErrorAction SilentlyContinue }
if (-not $gnhf) { Write-Error "gnhf not on PATH - npm i -g gnhf."; exit 1 }
if (-not (Test-Path $RepoPath)) { Write-Error "RepoPath does not exist: $RepoPath"; exit 1 }

Push-Location $RepoPath
try {
  $dirty = git status --porcelain 2>$null
  if ($dirty) {
    Write-Warning "Working tree not clean - gnhf commits each iteration on top of the current state."
  }

  $logDir = Join-Path $RepoPath ".gnhf-runs"
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $log = Join-Path $logDir "gnhf-$stamp.log"
  $errLog = "$log.err"
  $handle = Join-Path $logDir "gnhf-$stamp.handle.json"

  $gnhfArgs = @($Objective, "--max-iterations", "$MaxIterations")
  if ($StopWhen) { $gnhfArgs += @("--stop-when", $StopWhen) }

  # Detached + hidden: outlives this session. stdout/stderr -> log files.
  $proc = Start-Process -FilePath $gnhf.Source -ArgumentList $gnhfArgs `
    -WorkingDirectory $RepoPath -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput $log -RedirectStandardError $errLog

  [ordered]@{
    pid           = $proc.Id
    log           = $log
    errLog        = $errLog
    objective     = $Objective
    maxIterations = $MaxIterations
    stopWhen      = $StopWhen
    repo          = $RepoPath
    started       = $stamp
  } | ConvertTo-Json | Set-Content -Path $handle -Encoding utf8

  Write-Output "gnhf launched DETACHED. PID=$($proc.Id)"
  Write-Output "log:    $log"
  Write-Output "handle: $handle"
  Write-Output "check:  Get-Content '$log' -Tail 20   (or)   Get-Process -Id $($proc.Id)"
  Write-Output "stop:   Stop-Process -Id $($proc.Id)"
}
finally { Pop-Location }
