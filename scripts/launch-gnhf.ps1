<#
.SYNOPSIS
  Compatibility entry point for non-launching harness readiness checks.

.DESCRIPTION
  Accepts the legacy launcher parameter surface, then delegates synchronously to
  prepare-harness-run.ps1. It never starts task execution or creates run logs.
  Without -Parallel or -PrepareIsolation, it delegates to -CheckOnly, which does not mutate Git state.
  With -Parallel or -PrepareIsolation, it acquires a Treehouse lease and creates a unique derived Git branch at the checked source HEAD before returning READY.

.EXAMPLE
  powershell -NoProfile -File scripts/launch-gnhf.ps1 `
    -RepoPath C:\path\to\repo -CurrentBranch
#>
param(
  [string]$Objective = "",
  [string]$StopWhen = "",
  [int]$MaxIterations = 30,
  [string]$RepoPath = (Get-Location).Path,
  [string]$WorkspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")).Path,
  [switch]$NoSnapshot,
  [switch]$Parallel,
  [switch]$CurrentBranch,
  [string]$DefaultBranch = "",
  [switch]$PrepareIsolation
)
$ErrorActionPreference = "Stop"

$prepareScript = Join-Path $PSScriptRoot "prepare-harness-run.ps1"
if (-not (Test-Path -LiteralPath $prepareScript -PathType Leaf)) {
  [ordered]@{
    status = "NOT_READY"
    repoPath = $RepoPath
    branch = $null
    defaultBranch = $null
    branchMode = "current"
    dirtyPaths = @()
    layoutValid = $false
    isolationRequired = [bool]($Parallel -or $PrepareIsolation)
    isolationPrepared = $false
    treehouseAvailable = $false
    runPath = $null
    errors = @("Readiness script is missing: $prepareScript")
  } | ConvertTo-Json -Depth 6 -Compress
  exit 1
}

$prepareArgs = @{
  RepoPath = $RepoPath
  WorkspaceRoot = $WorkspaceRoot
  CurrentBranch = $CurrentBranch
  DefaultBranch = $DefaultBranch
}
if ($Parallel -or $PrepareIsolation) {
  $prepareArgs.PrepareIsolation = $true
  $prepareArgs.Parallel = [bool]$Parallel
}
else {
  # Compatibility current-branch check: isolation is opt-in for this shim, so opt out
  # of the harness default-on isolation to preserve the non-isolated readiness report.
  $prepareArgs.CheckOnly = $true
  $prepareArgs.NoIsolation = $true
}

& $prepareScript @prepareArgs
exit $LASTEXITCODE
