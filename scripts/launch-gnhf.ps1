<#
.SYNOPSIS
  Launch a gnhf overnight run DETACHED from inside a Claude Code session, so a user never
  has to drop to a terminal. The process survives this session closing; output streams to a
  log file and a JSON handle records the PID/log/args for later checking.

.DESCRIPTION
  Pre-flights (gnhf on PATH, ~/.gnhf/config.yml present, snapshots a dirty tree), then starts
  gnhf hidden and detached via the .cmd shim. Model + agent come from ~/.gnhf/config.yml
  (Opus is enforced there) - this script does not override them.

  gnhf hard-refuses to start on a dirty working tree. Detached, that abort is silent - it only
  shows up in the log after the fact. So a dirty tree is snapshotted into a reversible commit
  before launch, giving gnhf the clean tree it needs. Pass -NoSnapshot to keep warn-only.

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
  [string]$RepoPath = (Get-Location).Path,
  [switch]$NoSnapshot
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

# gnhf anchors runs, logs, and --worktree siblings to cwd's git toplevel. Launch from the
# nested pipeline repo, not the Everything_CC monorepo root or pipelines/ parent.
$gitDir = Join-Path $RepoPath ".git"
if (-not (Test-Path $gitDir)) {
  Write-Error @"
RepoPath is not a git repository (no .git): $RepoPath
GNHF must run from the target nested repo (e.g. C:\Users\mitch\Everything_CC\pipelines\gtm-orchestrator), not the workspace root or a parent folder.
Pass -RepoPath explicitly after cd'ing to the repo, or cd there before launch.
"@
  exit 1
}

$ecRoot = "C:\Users\mitch\Everything_CC"
try {
  $resolvedRepo = (Resolve-Path $RepoPath).Path
  $resolvedEc = (Resolve-Path $ecRoot).Path
} catch {
  $resolvedRepo = $RepoPath
  $resolvedEc = $ecRoot
}
if ($resolvedRepo -ieq $resolvedEc) {
  Write-Error @"
Refusing GNHF launch from Everything_CC monorepo root: $RepoPath
cd to the nested repo first (e.g. pipelines\gtm-orchestrator), then relaunch with -RepoPath or from that directory.
See: C:\Users\mitch\Everything_CC\.claude\reference\pipeline-allowlist.md
"@
  exit 1
}

$pipelinesRoot = Join-Path $ecRoot "pipelines"
if (Test-Path $pipelinesRoot) {
  try {
    $resolvedPipelines = (Resolve-Path $pipelinesRoot).Path
    if ($resolvedRepo -ieq $resolvedPipelines) {
      Write-Error @"
Refusing GNHF launch from pipelines/ parent (not a repo): $RepoPath
cd into the target pipeline repo (gtm-orchestrator, leadgrow-video, or design-pipeline) before launch.
"@
      exit 1
    }
  } catch { }
}

$validateScript = Join-Path (Split-Path $MyInvocation.MyCommand.Path -Parent) "validate-pipeline-layout.ps1"
if (Test-Path $validateScript) {
  & $validateScript -RepoRoot $resolvedEc
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Pipeline layout invalid - fix before GNHF launch. See .claude/reference/pipeline-allowlist.md"
    exit 1
  }
}

Push-Location $RepoPath
try {
  # gnhf hard-refuses a dirty tree ("Working tree is not clean. Commit or stash changes first.").
  # Detached, that abort never reaches the operator except in the log. Snapshot the dirty state
  # into a reversible commit so gnhf gets the clean tree it requires and actually starts.
  $dirty = git status --porcelain 2>$null
  if ($dirty) {
    if ($NoSnapshot) {
      Write-Warning "Working tree not clean and -NoSnapshot set - gnhf will likely abort on a dirty tree."
    }
    else {
      # Windows PowerShell 5.1: stderr redirection on a native command under
      # ErrorActionPreference=Stop turns benign git warnings (e.g. CRLF) into a
      # terminating NativeCommandError. Relax it around the git calls.
      $prevEap = $ErrorActionPreference
      $ErrorActionPreference = "Continue"
      git add -A 2>&1 | Out-Null
      git commit -m "chore(gnhf): pre-run snapshot before detached launch" 2>&1 | Out-Null
      $ErrorActionPreference = $prevEap
      $snap = git rev-parse --short HEAD 2>$null
      if ($LASTEXITCODE -ne 0 -or -not $snap) {
        Write-Error "Dirty tree and snapshot commit failed - resolve the tree manually, then relaunch. gnhf would abort on a dirty tree."; exit 1
      }
      Write-Output "Dirty tree snapshotted to commit $snap (reverse with: git reset $snap~1)."
    }
  }

  $logDir = Join-Path $RepoPath ".gnhf-runs"
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $log = Join-Path $logDir "gnhf-$stamp.log"
  $errLog = "$log.err"
  $handle = Join-Path $logDir "gnhf-$stamp.handle.json"

  # Build as single string with explicit quoting - Start-Process + .cmd shims
  # don't preserve array-element quoting for args containing spaces.
  $gnhfArgs = "`"$Objective`" --max-iterations $MaxIterations"
  if ($StopWhen) { $gnhfArgs += " --stop-when `"$StopWhen`"" }

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
