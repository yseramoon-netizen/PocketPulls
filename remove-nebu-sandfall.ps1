$ErrorActionPreference = "Stop"

$projectRoot = (Get-Location).Path
$packageJson = Join-Path $projectRoot "package.json"

if (-not (Test-Path -LiteralPath $packageJson)) {
  throw "Run this file from the Ancient Pulls project root (the folder containing package.json)."
}

$targets = @(
  "app/(player)/duat",
  "app/duat-preview",
  "app/api/player/duat",
  "components/player/duat",
  "lib/player/endless-duat-engine.ts",
  "lib/player/endless-duat-server.ts",
  "public/ancient-pulls/nebu-digging-24frames-v2.png",
  "INSTALL_FIRST_ENDLESS_DUAT.md",
  "ENDLESS_DUAT_FILE_MANIFEST.md"
)

foreach ($target in $targets) {
  $resolvedTarget = Join-Path $projectRoot $target
  if (Test-Path -LiteralPath $resolvedTarget) {
    Remove-Item -LiteralPath $resolvedTarget -Recurse -Force
    Write-Host "Removed $target"
  }
}

$navPath = Join-Path $projectRoot "components/player/PlayerNav.tsx"
if (Test-Path -LiteralPath $navPath) {
  $nav = [System.IO.File]::ReadAllText($navPath)
  $navPattern = '(?ms)^\s*\{\s*href:\s*["'']\/duat["''],\s*label:\s*["'']Nebu Sandfall["''],\s*glyph:\s*["''][^"'']*["''],\s*\},\s*'
  $updatedNav = [regex]::Replace($nav, $navPattern, "")

  if ($updatedNav -ne $nav) {
    [System.IO.File]::WriteAllText($navPath, $updatedNav, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Removed Nebu Sandfall from player navigation"
  } else {
    Write-Host "Nebu Sandfall navigation entry was already absent"
  }
}

$migrationDirectory = Join-Path $projectRoot "supabase/migrations"
New-Item -ItemType Directory -Path $migrationDirectory -Force | Out-Null
$migrationPath = Join-Path $migrationDirectory "20260813_remove_nebu_sandfall_v65.sql"
$migration = @'
-- Remove Nebu Sandfall and all of its server-side progress and reward state.

drop function if exists public.claim_endless_duat_wish(uuid, uuid);
drop function if exists public.forge_endless_duat_fragment(uuid);
drop function if exists public.record_endless_duat_heartbeat(uuid, integer);

drop table if exists public.player_duat_wish_claims;
drop table if exists public.player_duat_progress;
drop table if exists public.player_duat_accounts;
'@
[System.IO.File]::WriteAllText($migrationPath, $migration, [System.Text.UTF8Encoding]::new($false))

Write-Host ""
Write-Host "Nebu Sandfall has been removed from the project."
Write-Host "Apply the new Supabase migration when deploying to erase its stored progress and claim data."

