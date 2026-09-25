# ─────────────────────────────────────────────────────────────────────
# Beyfest 2026 tournament app — one-command launcher for the event laptop.
#
# Starts PocketBase (data + realtime API) and the built SvelteKit server,
# both bound to 0.0.0.0 so phones on the venue wifi can reach them. Detects
# the laptop's LAN IP so it can print the addresses to open. On a brand-new
# database it asks you to choose the organiser and PocketBase admin passwords.
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
$organiserEmail = "organiser@beyfest.local"
$superuserEmail = "admin@beyfest.local"

# ── Detect the LAN IP (the adapter that owns the default route) ──────
$ip = (Get-NetIPConfiguration |
  Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq "Up" } |
  Select-Object -First 1).IPv4Address.IPAddress
if (-not $ip) { $ip = "127.0.0.1" }

$webPort = 3000

# ── Build the web app if needed ─────────────────────────────────────
if (-not (Test-Path $webBuild)) {
  Write-Host "  First run: building the web app…" -ForegroundColor Cyan
  Push-Location $webDir
  bun run build
  Pop-Location
}

# ── Fresh database: create it, and choose the passwords ───────────────
function Read-NewPassword([string]$what) {
  while ($true) {
    $first = [System.Net.NetworkCredential]::new("", (Read-Host "  $what (at least 10 characters)" -AsSecureString)).Password
    if ($first.Length -lt 10) { Write-Host "  Too short, try again."; continue }
    $second = [System.Net.NetworkCredential]::new("", (Read-Host "  Type it again" -AsSecureString)).Password
    if ($first -eq $second) { return $first }
    Write-Host "  They didn't match, try again."
  }
}

$organiserPw = $null
$loginNote = "Login: $organiserEmail"
if (-not (Test-Path $pbData)) {
  Write-Host "  First run: creating the database…" -ForegroundColor Cyan
  & $pbExe migrate up "--dir=$pbData" "--migrationsDir=$pbMig" | Out-Null
  if (-not [Console]::IsInputRedirected) {
    Write-Host ""
    Write-Host "  Choose the passwords. Write them down somewhere safe."
    $organiserPw = Read-NewPassword "Organiser password (for the admin page)"
    $superuserPw = Read-NewPassword "PocketBase admin password (for backups/restores)"
  }
  else {
    # Nobody at the keyboard to ask: the published defaults, loudly.
    $superuserPw = "beyfestadmin2026"
    $loginNote = "Login: $organiserEmail / beyfest2026  (DEFAULT PASSWORDS: change them before the event)"
  }
  & $pbExe superuser upsert $superuserEmail $superuserPw "--dir=$pbData" | Out-Null
}

Write-Host ""
Write-Host "  BEYFEST 2026 — Tournament" -ForegroundColor Yellow
Write-Host "  ------------------------------------------------------------"
Write-Host "  Public display :  http://${ip}:$webPort" -ForegroundColor Green
Write-Host "  Organiser admin:  http://${ip}:$webPort/admin" -ForegroundColor Green
Write-Host "  PocketBase admin: http://127.0.0.1:8090/_/  (on this laptop)"
Write-Host "  ------------------------------------------------------------"
Write-Host "  $loginNote"
Write-Host "  Put the Public display on the projector; share the URL with players."
Write-Host "  Close this window (or Ctrl+C) to stop both servers."
Write-Host ""

# ── Start PocketBase in its own window (migrations run automatically) ─
$pb = Start-Process -FilePath $pbExe `
  -ArgumentList "serve", "--http=0.0.0.0:8090", "--dir=$pbData", "--migrationsDir=$pbMig" `
  -PassThru -WindowStyle Minimized

# The organiser login lives in the database, so its new password is set
# through PocketBase's API once it's up (scripts\set-organiser-password.mjs).
# Passwords go via the environment, not the command line.
if ($organiserPw) {
  $env:SU_EMAIL = $superuserEmail; $env:SU_PW = $superuserPw
  $env:ORG_EMAIL = $organiserEmail; $env:ORG_PW = $organiserPw
  node (Join-Path $root "scripts\set-organiser-password.mjs")
  $ok = $LASTEXITCODE -eq 0
  $env:SU_PW = $null; $env:ORG_PW = $null; $organiserPw = $null; $superuserPw = $null
  if (-not $ok) {
    Stop-Process -Id $pb.Id -Force -ErrorAction SilentlyContinue
    Write-Host "  Couldn't set the organiser password (see above). Delete pb\pb_data and run this again." -ForegroundColor Red
    exit 1
  }
}

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
