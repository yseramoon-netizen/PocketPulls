$ErrorActionPreference = "Stop"

$projectRoot = $PSScriptRoot
$oldLoginRoute = Join-Path $projectRoot "app\\login"

if (Test-Path -LiteralPath $oldLoginRoute) {
  Remove-Item -LiteralPath $oldLoginRoute -Recurse -Force
  Write-Host "Removed the old /login admin route."
} else {
  Write-Host "The old /login admin route was already removed."
}

Write-Host "Done. The site root now sends visitors to /sign-in."
