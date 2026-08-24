param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot
)

$ErrorActionPreference = "Stop"
$bundleRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$filesRoot = Join-Path $bundleRoot "FILES"
$publicRoot = Join-Path $filesRoot "public"

if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) {
    throw "Project root does not exist: $ProjectRoot"
}

if (-not (Test-Path -LiteralPath $publicRoot -PathType Container)) {
    throw "The package FILES/public folder is missing. Keep this script beside the FILES folder."
}

$removed = 0
$missing = 0

Get-ChildItem -LiteralPath $publicRoot -Recurse -File -Filter "*.webp" | ForEach-Object {
    $relativeWebp = $_.FullName.Substring($filesRoot.Length).TrimStart('\', '/')
    $relativePng = [System.IO.Path]::ChangeExtension($relativeWebp, ".png")
    $oldPng = Join-Path $ProjectRoot $relativePng

    if (Test-Path -LiteralPath $oldPng -PathType Leaf) {
        Remove-Item -LiteralPath $oldPng -Force
        Write-Host "Removed $relativePng"
        $removed++
    }
    else {
        $missing++
    }
}

Write-Host ""
Write-Host "Cleanup complete: $removed replaced PNG files removed; $missing were already absent."

