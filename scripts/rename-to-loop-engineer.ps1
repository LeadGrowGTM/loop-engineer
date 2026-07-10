<#
  Rename tools/agent/agent-harness -> tools/agent/loop-engineer and fix runtime refs.

  RUN THIS FROM A FRESH TERMINAL (or after closing the Claude Code session that is
  anchored to the agent-harness dir). It will FAIL on the Move-Item step if any process
  still holds the old dir as its cwd.

  Usage (Windows PowerShell 5.1 - use 'powershell', not 'pwsh'):
    powershell -ExecutionPolicy Bypass -File "<this path>"            # do it
    powershell -ExecutionPolicy Bypass -File "<this path>" -DryRun    # preview, touch nothing
#>
param([switch]$DryRun)
$ErrorActionPreference = "Stop"

$agentDir = "C:\Users\mitch\Everything_CC\tools\agent"
$old      = Join-Path $agentDir "agent-harness"
$new      = Join-Path $agentDir "loop-engineer"

# --- 1. Move the directory (atomic rename, same volume) -----------------------
if (Test-Path $new) {
  Write-Error "Target already exists: $new - resolve manually."; exit 1
}
if (-not (Test-Path $old)) {
  Write-Warning "Old dir $old not found - assuming already moved; continuing to ref-fix."
} elseif ($DryRun) {
  Write-Output "[dry] would move: $old -> $new"
} else {
  try { Move-Item -Path $old -Destination $new -ErrorAction Stop; Write-Output "Moved: agent-harness -> loop-engineer" }
  catch { Write-Error "Move failed (a process still holds the dir as cwd): $($_.Exception.Message)"; exit 1 }
}

# --- 2. Rewrite references ----------------------------------------------------
# Replace both path forms and the bare kebab name, only in a CURATED file list so
# session logs / history / caches are never touched.
$reps = @(
  @{ from = 'tools\agent\agent-harness'; to = 'tools\agent\loop-engineer' },  # windows path
  @{ from = 'tools/agent/agent-harness'; to = 'tools/agent/loop-engineer' },  # posix path
  @{ from = 'agent-harness';             to = 'loop-engineer' }               # bare name (last)
)

# External runtime files (outside the moved repo) that name the old path.
$external = @(
  "C:\Users\mitch\.claude\reference\workspace-ontology.md",
  "C:\Users\mitch\.claude\reference\pipeline-allowlist.md",
  "C:\Users\mitch\.claude\skills\gnhf\SKILL.md",
  "C:\Users\mitch\.claude\skills\write-goal-prompt\SKILL.md",
  "C:\Users\mitch\Everything_CC\.claude\reference\workspace-ontology.md",
  "C:\Users\mitch\Everything_CC\.claude\reference\pipeline-allowlist.md"
)

# In-repo runtime + identity docs (now under the NEW path). Skip temp/history/kb archival.
# Exclude THIS script - it legitimately carries the old name in $old and comments.
$repoFiles = @()
if (Test-Path $new) {
  $repoFiles = Get-ChildItem -Path $new -Recurse -File -Include *.md,*.mdc,*.ts,*.ps1,*.html,*.json |
    Where-Object {
      $_.FullName -notmatch '\\\.git\\' -and
      $_.FullName -notmatch '\\node_modules\\' -and
      $_.FullName -notmatch '\\\.test-tmp\\' -and
      $_.FullName -notmatch '\\temp\\' -and
      $_.FullName -notmatch '\\\.gnhf-runs\\' -and
      $_.FullName -notmatch '\\\.tmp\\' -and
      $_.Name -ne 'rename-to-loop-engineer.ps1'
    } | Select-Object -ExpandProperty FullName
}

$targets = @($external + $repoFiles) | Where-Object { Test-Path $_ } | Select-Object -Unique
$changed = 0
foreach ($f in $targets) {
  $txt = Get-Content -Raw -LiteralPath $f
  $orig = $txt
  foreach ($r in $reps) { $txt = $txt.Replace($r.from, $r.to) }
  if ($txt -ne $orig) {
    if ($DryRun) { Write-Output "[dry] would edit: $f" }
    else { [System.IO.File]::WriteAllText($f, $txt, (New-Object System.Text.UTF8Encoding($false))); Write-Output "edited: $f" }
    $changed++
  }
}
Write-Output ""
Write-Output "Ref files changed: $changed"
Write-Output "NOTE: in-repo edits are uncommitted - cd '$new' and commit them:"
Write-Output "  git add -A; git commit -m 'chore: rename dir agent-harness -> loop-engineer'"
Write-Output "Then reopen Claude Code in: $new"
