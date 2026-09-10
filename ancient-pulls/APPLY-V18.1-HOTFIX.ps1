param(
  [string]$ProjectRoot = "C:\Users\LukasMoon\pocketpulls"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$PackageRoot = $PSScriptRoot

if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot "package.json"))) {
  throw "package.json not found in $ProjectRoot"
}

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $ProjectRoot ".pocketpulls-backups\$Timestamp-v18.1-hotfix"
New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null

# Remove the accidental duplicate route introduced by V18.
$BadRoute = Join-Path $ProjectRoot "app\sign-in\page.tsx"
if (Test-Path -LiteralPath $BadRoute) {
  $BackupBad = Join-Path $BackupRoot "app\sign-in\page.tsx"
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $BackupBad) | Out-Null
  Copy-Item -LiteralPath $BadRoute -Destination $BackupBad -Force
  Remove-Item -LiteralPath $BadRoute -Force
  Write-Host "Removed duplicate app/sign-in/page.tsx" -ForegroundColor Yellow
}

# Install the V18 player sign-in logic into the EXISTING route-group location.
$Source = Join-Path $PackageRoot "app\(auth)\sign-in\page.tsx"
$Target = Join-Path $ProjectRoot "app\(auth)\sign-in\page.tsx"
if (Test-Path -LiteralPath $Target) {
  $BackupTarget = Join-Path $BackupRoot "app\(auth)\sign-in\page.tsx"
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $BackupTarget) | Out-Null
  Copy-Item -LiteralPath $Target -Destination $BackupTarget -Force
}
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Target) | Out-Null
Copy-Item -LiteralPath $Source -Destination $Target -Force
Write-Host "Installed V18 player sign-in into app/(auth)/sign-in/page.tsx" -ForegroundColor Green

# Remove an empty app/sign-in folder if V18 created it.
$BadFolder = Join-Path $ProjectRoot "app\sign-in"
if (Test-Path -LiteralPath $BadFolder) {
  $items = Get-ChildItem -LiteralPath $BadFolder -Force -ErrorAction SilentlyContinue
  if (-not $items) {
    Remove-Item -LiteralPath $BadFolder -Force
  }
}

foreach ($rel in @(".next", ".turbo", "node_modules\.cache")) {
  $path = Join-Path $ProjectRoot $rel
  if (Test-Path -LiteralPath $path) {
    Remove-Item -LiteralPath $path -Recurse -Force
  }
}
$tsInfo = Join-Path $ProjectRoot "tsconfig.tsbuildinfo"
if (Test-Path -LiteralPath $tsInfo) { Remove-Item -LiteralPath $tsInfo -Force }

Push-Location $ProjectRoot
try {
  Write-Host "Running TypeScript validation..." -ForegroundColor Cyan
  & npx tsc --noEmit --pretty false
  if ($LASTEXITCODE -ne 0) { throw "TypeScript validation failed." }

  Write-Host "Running production build..." -ForegroundColor Cyan
  & npm run build
  if ($LASTEXITCODE -ne 0) { throw "Production build failed." }
}
finally {
  Pop-Location
}

Write-Host "PASS: V18.1 sign-in route hotfix installed." -ForegroundColor Green
Write-Host "Backup: $BackupRoot" -ForegroundColor DarkGray
