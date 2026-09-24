# ─────────────────────────────────────────────────────────────────────
# Beyfest 2026 tournament app — one-command launcher for the event laptop.
#
# Starts PocketBase (data + realtime API) and the built SvelteKit server,
# both bound to 0.0.0.0 so phones on the venue wifi can reach them. Detects
# the laptop's LAN IP so it can print the addresses to open.
#
#   Right-click → "Run with PowerShell", or:  pwsh -File .\start.ps1
# ─────────────────────────────────────────────────────────────────────
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$pbExe = Join-Path $root "pb\pocketbase.exe"
$pbData = Join-Path $root "pb\pb_data"
$pbMig = Join-Path $root "pb\pb_migrations"
$webDir = Join-Path $root "web"
$webBuild = Join-Path $webDir "build\index.js"

# ── Detect the LAN IP (the adapter that owns the default route) ──────
$ip = (Get-NetIPConfiguration |
  Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq "Up" } |
  Select-Object -First 1).IPv4Address.IPAddress
if (-not $ip) { $ip = "127.0.0.1" }

$webPort = 3000

Write-Host ""
Write-Host "  BEYFEST 2026 — Tournament" -ForegroundColor Yellow
Write-Host "  ------------------------------------------------------------"
Write-Host "  Public display :  http://${ip}:$webPort" -ForegroundColor Green
Write-Host "  Organiser admin:  http://${ip}:$webPort/admin" -ForegroundColor Green
Write-Host "  PocketBase admin: http://127.0.0.1:8090/_/  (on this laptop)"
Write-Host "  ------------------------------------------------------------"
Write-Host "  Login: organiser@beyfest.local  /  beyfest2026"
Write-Host "  Put the Public display on the projector; share the URL with players."
Write-Host "  Close this window (or Ctrl+C) to stop both servers."
Write-Host ""

# ── Build the web app if needed ─────────────────────────────────────
if (-not (Test-Path $webBuild)) {
  Write-Host "  First run: building the web app…" -ForegroundColor Cyan
  Push-Location $webDir
  bun run build
  Pop-Location
}

# ── Start PocketBase in its own window (migrations run automatically) ─
$pb = Start-Process -FilePath $pbExe `
  -ArgumentList "serve", "--http=0.0.0.0:8090", "--dir=$pbData", "--migrationsDir=$pbMig" `
  -PassThru -WindowStyle Minimized

# ── Start the web server in the foreground ──────────────────────────
$env:HOST = "0.0.0.0"
$env:PORT = "$webPort"
try {
  node $webBuild
}
finally {
  Write-Host "`n  Shutting down…" -ForegroundColor Yellow
  if ($pb -and -not $pb.HasExited) { Stop-Process -Id $pb.Id -Force -ErrorAction SilentlyContinue }
}
