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
  [switch]$NoSnapshot,
  [switch]$Parallel
)
$ErrorActionPreference = "Stop"

# Derive a short kebab slug from the objective for the treehouse lease-holder label.
function Get-Slug([string]$text) {
  $s = ($text.ToLower() -replace '[^a-z0-9]+', '-').Trim('-')
  $words = ($s -split '-') | Where-Object { $_ } | Select-Object -First 4
  $slug = ($words -join '-')
  if ($slug.Length -gt 40) { $slug = $slug.Substring(0, 40).Trim('-') }
  if (-not $slug) { $slug = 'run' }
  return $slug
}

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
$ecRoot = "C:\Users\mitch\Everything_CC"
try {
  $resolvedRepo = (Resolve-Path $RepoPath).Path
  $resolvedEc = (Resolve-Path $ecRoot).Path
} catch {
  $resolvedRepo = $RepoPath
  $resolvedEc = $ecRoot
}

# Some pipelines (content, outbound) are deliberately monorepo-tracked, not nested repos -
# see .gitignore's "!pipelines/<name>/" exceptions and .claude/reference/pipeline-allowlist.md.
# They have no own .git, so they can't give gnhf a scoped repo toplevel directly. Detect them
# here and force treehouse worktree isolation below instead of erroring on missing .git.
function Get-CanonicalMonorepoPipelines([string]$ecRootPath) {
  $giPath = Join-Path $ecRootPath ".gitignore"
  $names = @()
  if (Test-Path $giPath) {
    Get-Content $giPath | ForEach-Object {
      if ($_ -match '^!pipelines/([a-zA-Z0-9_-]+)/$') { $names += $Matches[1] }
    }
  }
  return $names
}
$isCanonicalMonorepoPipeline = $false
$canonicalPipelineName = $null
foreach ($name in (Get-CanonicalMonorepoPipelines $resolvedEc)) {
  $candidate = Join-Path (Join-Path $resolvedEc "pipelines") $name
  try { $candidate = (Resolve-Path $candidate -ErrorAction SilentlyContinue).Path } catch { }
  if ($candidate -and ($resolvedRepo -ieq $candidate)) {
    $isCanonicalMonorepoPipeline = $true
    $canonicalPipelineName = $name
    break
  }
}

$gitDir = Join-Path $RepoPath ".git"
if (-not $isCanonicalMonorepoPipeline -and -not (Test-Path $gitDir)) {
  Write-Error @"
RepoPath is not a git repository (no .git): $RepoPath
GNHF must run from the target nested repo (e.g. C:\Users\mitch\Everything_CC\pipelines\gtm-orchestrator), not the workspace root or a parent folder.
Pass -RepoPath explicitly after cd'ing to the repo, or cd there before launch.
"@
  exit 1
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

# --- Worktree isolation (auto-lease on collision) -----------------------------
# Two detached gnhf runs in the same working tree step on each other. Detect a live
# run anchored to this repo and, if found (or -Parallel forced), lease an isolated
# treehouse worktree and run gnhf there instead. Handle/log/collision state always
# anchor to the ORIGINAL repo so the next launch can still see this run - except for
# canonical monorepo pipelines (content, outbound), which have no own .git and are
# force-included in Everything_CC's tracked tree: their state anchors to a TEMP scratch
# dir instead, so runs never leave untracked files in the live monorepo working tree.
$RunPath = $RepoPath
$leasePath = $null
$slug = Get-Slug $Objective

$runsDir = if ($isCanonicalMonorepoPipeline) { Join-Path $env:TEMP (Join-Path "gnhf-runs" $slug) } else { Join-Path $RepoPath ".gnhf-runs" }
$collision = $false
if (Test-Path $runsDir) {
  foreach ($h in Get-ChildItem -Path $runsDir -Filter "*.handle.json" -ErrorAction SilentlyContinue) {
    try {
      $meta = Get-Content $h.FullName -Raw | ConvertFrom-Json
      if ($meta.pid -and (Get-Process -Id $meta.pid -ErrorAction SilentlyContinue)) { $collision = $true; break }
    } catch { }
  }
}

if ($Parallel -or $collision -or $isCanonicalMonorepoPipeline) {
  $treehouse = Get-Command "treehouse" -ErrorAction SilentlyContinue
  if (-not $treehouse) {
    if ($isCanonicalMonorepoPipeline) {
      Write-Error "pipelines/$canonicalPipelineName is monorepo-tracked (no own .git) - gnhf needs a treehouse-leased worktree for git isolation, but treehouse is not on PATH. Install treehouse first."; exit 1
    }
    Write-Error "Parallel run needed (collision=$collision, -Parallel=$Parallel) but treehouse not on PATH. Install treehouse or wait for the live run to finish."; exit 1
  }
  if ($collision -and -not $Parallel) {
    Write-Warning "Live gnhf run detected in $RepoPath - auto-leasing an isolated worktree to avoid collision."
  }
  if ($isCanonicalMonorepoPipeline) {
    Write-Output "pipelines/$canonicalPipelineName is monorepo-tracked - leasing an isolated Everything_CC worktree so gnhf's git operations stay scoped there, not on your live tree."
  }
  # --lease prints ONLY the worktree path to stdout; banners go to stderr.
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $leasePath = (& $treehouse.Source get --lease --lease-holder "gnhf-$slug" | Select-Object -Last 1)
  $ErrorActionPreference = $prevEap
  if ($leasePath) { $leasePath = $leasePath.Trim() }
  if (-not $leasePath -or -not (Test-Path $leasePath)) {
    Write-Error "treehouse lease failed (returned '$leasePath'). Pool may be exhausted (max_trees) - run 'treehouse status', return a stale lease, then relaunch."; exit 1
  }
  Write-Output "Leased isolated worktree: $leasePath (holder: gnhf-$slug)"
  if ($isCanonicalMonorepoPipeline) {
    $leasedPipelinePath = Join-Path $leasePath (Join-Path "pipelines" $canonicalPipelineName)
    if (-not (Test-Path $leasedPipelinePath)) {
      & $treehouse.Source return $leasePath | Out-Null
      Write-Error "Leased worktree is missing pipelines/$canonicalPipelineName at ${leasedPipelinePath}: pool worktree may be stale. Run 'treehouse prune' then relaunch."; exit 1
    }
    $RunPath = $leasedPipelinePath
  } else {
    $RunPath = $leasePath
  }
}

Push-Location $RunPath
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

  $logDir = $runsDir
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $log = Join-Path $logDir "gnhf-$stamp.log"
  $errLog = "$log.err"
  $handle = Join-Path $logDir "gnhf-$stamp.handle.json"

  # Build as single string with explicit quoting - Start-Process + .cmd shims
  # don't preserve array-element quoting for args containing spaces.
  $gnhfArgs = "`"$Objective`" --max-iterations $MaxIterations"
  if ($StopWhen) { $gnhfArgs += " --stop-when `"$StopWhen`"" }

  # Detached + hidden: outlives this session. stdout/stderr -> log files. stdin -> NUL:
  # without an explicit redirect, a hidden/detached process's inherited stdin handle can be
  # unusable, and any git hook subprocess gnhf shells out to (e.g. pre-commit) that tries to
  # attach a console over that handle hangs forever at ~0% CPU instead of erroring. Seen live:
  # the post-iteration `git commit` stalled indefinitely on a stdin/console wait after
  # iteration 1 succeeded. Feeding a real (empty) stdin avoids the hang.
  # PowerShell's -RedirectStandardInput resolves its argument as a real file path (it can't
  # take the \\.\NUL device path directly) - an empty file gives the same immediate-EOF stdin.
  $stdinNul = Join-Path $env:TEMP "gnhf-launcher-stdin-nul.txt"
  if (-not (Test-Path $stdinNul)) { New-Item -ItemType File -Path $stdinNul -Force | Out-Null }
  $proc = Start-Process -FilePath $gnhf.Source -ArgumentList $gnhfArgs `
    -WorkingDirectory $RunPath -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput $log -RedirectStandardError $errLog -RedirectStandardInput $stdinNul

  [ordered]@{
    pid           = $proc.Id
    log           = $log
    errLog        = $errLog
    objective     = $Objective
    maxIterations = $MaxIterations
    stopWhen      = $StopWhen
    repo          = $RepoPath
    runPath       = $RunPath
    lease         = $leasePath
    started       = $stamp
  } | ConvertTo-Json | Set-Content -Path $handle -Encoding utf8

  Write-Output "gnhf launched DETACHED. PID=$($proc.Id)"
  Write-Output "cwd:    $RunPath"
  Write-Output "log:    $log"
  Write-Output "handle: $handle"
  Write-Output "check:  Get-Content '$log' -Tail 20   (or)   Get-Process -Id $($proc.Id)"
  Write-Output "stop:   Stop-Process -Id $($proc.Id)"
  if ($leasePath) {
    # Detached runs can't auto-return on exit - return the lease after morning review.
    Write-Output "return: treehouse return '$leasePath'   (run AFTER reviewing the morning report - frees the worktree)"
  }
}
finally { Pop-Location }
