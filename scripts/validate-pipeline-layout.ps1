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

$PipelinesRoot = Join-Path $RepoRoot "pipelines"
if (-not (Test-Path $PipelinesRoot)) {
  Write-Output "OK: pipelines/ does not exist yet."
  exit 0
}

$Invalid = Get-ChildItem -Path $PipelinesRoot -Directory -ErrorAction SilentlyContinue |
  Where-Object { $Allowlist -notcontains $_.Name } |
  Select-Object -ExpandProperty Name

if ($Invalid.Count -eq 0) {
  Write-Output "OK: pipelines/ contains only allowlisted workspaces."
  exit 0
}

Write-Error @"
pipelines/ layout invalid. Found $($Invalid.Count) non-allowlisted folder(s):
$($Invalid | ForEach-Object { "  - $_" } | Out-String)
Allowlist: $($Allowlist -join ', ')
See: C:\Users\mitch\Everything_CC\.claude\reference\pipeline-allowlist.md
"@
exit 1
