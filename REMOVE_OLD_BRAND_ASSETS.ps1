$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$oldFiles = @(
  "public\jirachi.png",
  "public\mew.png",
  "public\shaymin.png",
  "public\unknown-pulls-icon.png",
  "public\unknown-pulls-apple-icon.png"
)

foreach ($relativePath in $oldFiles) {
  $target = Join-Path $projectRoot $relativePath

  if (Test-Path -LiteralPath $target -PathType Leaf) {
    Remove-Item -LiteralPath $target -Force
    Write-Host "Removed $relativePath"
  }
}

$oldArtFolder = Join-Path $projectRoot "public\unknown-pulls"

if (Test-Path -LiteralPath $oldArtFolder -PathType Container) {
  Remove-Item -LiteralPath $oldArtFolder -Recurse -Force
  Write-Host "Removed public\unknown-pulls"
}

Write-Host "Ancient Pulls artwork cleanup complete."
