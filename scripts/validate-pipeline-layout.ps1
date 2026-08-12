<#
.SYNOPSIS
  Fail if pipelines/ contains directories outside the canonical allowlist.

.DESCRIPTION
  Prevents GNHF/revert workers from leaving chaotic duplicate folders at
  C:\Users\mitch\Everything_CC\pipelines\. Only gtm-orchestrator, leadgrow-video,
  and design-pipeline are valid top-level pipeline workspaces.

.EXAMPLE
  pwsh validate-pipeline-layout.ps1
  pwsh validate-pipeline-layout.ps1 -RepoRoot C:\Users\mitch\Everything_CC
#>
param(
  [string]$RepoRoot = "C:\Users\mitch\Everything_CC"
)
$ErrorActionPreference = "Stop"

$Allowlist = @(
  "gtm-orchestrator",
  "leadgrow-video",
  "design-pipeline",
  "content",
  "newsletter-pipeline",
  "outbound",
  "leadgrow-video-storyboard-clean"
)

function Get-DirectoryClassification {
  param(
    [System.IO.DirectoryInfo]$Directory,
    [string]$PipelinesRoot
  )

  $gitFile = Join-Path $Directory.FullName ".git"
  if (-not (Test-Path -LiteralPath $gitFile -PathType Leaf)) {
    if ($Allowlist -contains $Directory.Name) {
      return [PSCustomObject]@{ Classification = "allowlisted_project"; Owner = $null }
    }
    return [PSCustomObject]@{ Classification = "unknown_directory"; Owner = $null }
  }

  try {
    $gitFileContents = Get-Content -LiteralPath $gitFile -Raw -ErrorAction Stop
  } catch {
    return [PSCustomObject]@{ Classification = "malformed_git_file"; Owner = $null }
  }

  if ($gitFileContents -notmatch "(?s)^gitdir:\s*(?<gitdir>.+?)\s*$") {
    return [PSCustomObject]@{ Classification = "malformed_git_file"; Owner = $null }
  }

  try {
    $gitDirPath = $Matches["gitdir"].Trim()
    if (-not [System.IO.Path]::IsPathRooted($gitDirPath)) {
      $gitDirPath = Join-Path $Directory.FullName $gitDirPath
    }
    $gitDirPath = [System.IO.Path]::GetFullPath($gitDirPath)
  } catch {
    return [PSCustomObject]@{ Classification = "malformed_git_file"; Owner = $null }
  }

  $worktreesDirectory = Split-Path -Path $gitDirPath -Parent
  $gitDirectory = Split-Path -Path $worktreesDirectory -Parent
  $owner = Split-Path -Path $gitDirectory -Parent
  $normalizedPipelinesRoot = [System.IO.Path]::GetFullPath($PipelinesRoot).TrimEnd("\", "/")
  $normalizedOwnerParent = [System.IO.Path]::GetFullPath((Split-Path -Path $owner -Parent)).TrimEnd("\", "/")
  $registeredGitFile = Join-Path $gitDirPath "gitdir"
  $normalizedGitFile = [System.IO.Path]::GetFullPath($gitFile)
  $isRegisteredWorktree = $false

  if (Test-Path -LiteralPath $registeredGitFile -PathType Leaf) {
    try {
      $registeredGitFilePath = (Get-Content -LiteralPath $registeredGitFile -Raw -ErrorAction Stop).Trim()
      if (-not [System.IO.Path]::IsPathRooted($registeredGitFilePath)) {
        $registeredGitFilePath = Join-Path $gitDirPath $registeredGitFilePath
      }
      $isRegisteredWorktree = [System.IO.Path]::GetFullPath($registeredGitFilePath) -ieq $normalizedGitFile
    } catch {
      $isRegisteredWorktree = $false
    }
  }

  if ($isRegisteredWorktree) {
    try {
      $registeredWorktreePaths = @(
        & git -C $owner worktree list --porcelain 2>$null |
          Where-Object { $_ -like "worktree *" } |
          ForEach-Object { [System.IO.Path]::GetFullPath($_.Substring(("worktree ").Length)) }
      )
      $isRegisteredWorktree = $LASTEXITCODE -eq 0 -and ($registeredWorktreePaths -contains $Directory.FullName)
    } catch {
      $isRegisteredWorktree = $false
    }
  }

  if ((Split-Path -Path $worktreesDirectory -Leaf) -eq "worktrees" -and
      (Split-Path -Path $gitDirectory -Leaf) -eq ".git" -and
      $normalizedOwnerParent -ieq $normalizedPipelinesRoot -and
      $isRegisteredWorktree -and
      $owner -ine $Directory.FullName) {
    return [PSCustomObject]@{ Classification = "misplaced_worktree"; Owner = $owner }
  }

  if ($Allowlist -contains $Directory.Name) {
    return [PSCustomObject]@{ Classification = "allowlisted_project"; Owner = $null }
  }
  return [PSCustomObject]@{ Classification = "unknown_directory"; Owner = $null }
}

$PipelinesRoot = Join-Path $RepoRoot "pipelines"
if (-not (Test-Path $PipelinesRoot)) {
  Write-Output "OK: pipelines/ does not exist yet."
  exit 0
}

$Classifications = Get-ChildItem -Path $PipelinesRoot -Directory -ErrorAction SilentlyContinue |
  ForEach-Object {
    $classification = Get-DirectoryClassification -Directory $_ -PipelinesRoot $PipelinesRoot
    [PSCustomObject]@{
      Name = $_.Name
      Path = $_.FullName
      Classification = $classification.Classification
      Owner = $classification.Owner
    }
  }

$Invalid = @($Classifications | Where-Object { $_.Classification -notin @("allowlisted_project") })

if ($Invalid.Count -eq 0) {
  Write-Output "OK: pipelines/ contains only allowlisted workspaces."
  exit 0
}

[Console]::Error.WriteLine(@"
pipelines/ layout invalid. Found $($Invalid.Count) non-allowlisted folder(s):
$($Invalid | ForEach-Object { "  - $($_.Name) [$($_.Classification)]" } | Out-String)
$($Invalid | Where-Object { $_.Classification -eq "misplaced_worktree" } | ForEach-Object { "Audit: git -C '$($_.Owner.Replace("'", "''"))' worktree list --porcelain`nCleanup (after audit): git -C '$($_.Owner.Replace("'", "''"))' worktree remove '$($_.Path.Replace("'", "''"))'" } | Out-String)
No cleanup was performed.
Allowlist: $($Allowlist -join ', ')
See: C:\Users\mitch\Everything_CC\.claude\reference\pipeline-allowlist.md
"@)
exit 1
