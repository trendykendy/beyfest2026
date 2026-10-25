# ─────────────────────────────────────────────────────────────────────
# Beyfest 2026 tournament app — one-command launcher for the event laptop.
#
# Starts PocketBase (data + realtime API) and the built SvelteKit server,
# both bound to 0.0.0.0 so phones on the venue wifi can reach them. Detects
# the laptop's LAN IP so it can print the addresses to open. On a brand-new
# database it asks you to choose the organiser and PocketBase admin passwords.
#
# Once it's up, it opens the TV screen full screen (on a second screen if
# there is one) and keeps the PC from sleeping while it runs.
#
#   Right-click → "Run with PowerShell", or:  pwsh -File .\start.ps1
#   -NoTv   servers only, without opening the TV screen
# ─────────────────────────────────────────────────────────────────────
param([switch]$NoTv)
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$pbExe = Join-Path $root "pb\pocketbase.exe"
$pbData = Join-Path $root "pb\pb_data"
$pbMig = Join-Path $root "pb\pb_migrations"
$webDir = Join-Path $root "web"
$webBuild = Join-Path $webDir "build\index.js"
$organiserEmail = "organiser@beyfest.local"
$superuserEmail = "admin@beyfest.local"

# ── Bun builds the app, Node runs it ─────────────────────────────────
foreach ($tool in @(@("bun", "https://bun.sh"), @("node", "https://nodejs.org (the LTS)"))) {
  if (-not (Get-Command $tool[0] -ErrorAction SilentlyContinue)) {
    Write-Host "  $($tool[0]) isn't installed. Install it from $($tool[1]), then run this again." -ForegroundColor Red
    exit 1
  }
}

# ── PocketBase: download it if it's missing (it isn't kept in git) ────
# The version comes from start.sh, which the Mac and the Pi package use too,
# so all three stay on the same PocketBase. Needs internet: do the first run
# at home.
if (-not (Test-Path $pbExe)) {
  $pbVersion = (Select-String -Path (Join-Path $root "start.sh") -Pattern '^pb_version="([^"]+)"').Matches[0].Groups[1].Value
  $arch = if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "arm64" } else { "amd64" }
  $zipUrl = "https://github.com/pocketbase/pocketbase/releases/download/v$pbVersion/pocketbase_${pbVersion}_windows_$arch.zip"
  Write-Host "  First run: downloading PocketBase $pbVersion…" -ForegroundColor Cyan
  $zip = Join-Path ([System.IO.Path]::GetTempPath()) "pocketbase-$pbVersion.zip"
  try {
    # Windows PowerShell 5.1 may not offer TLS 1.2 by default; GitHub needs it.
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest $zipUrl -OutFile $zip -UseBasicParsing
    $unzipped = Join-Path ([System.IO.Path]::GetTempPath()) "pocketbase-$pbVersion"
    Expand-Archive -Path $zip -DestinationPath $unzipped -Force
    Copy-Item (Join-Path $unzipped "pocketbase.exe") $pbExe
    Remove-Item $zip, $unzipped -Recurse -Force -ErrorAction SilentlyContinue
  }
  catch {
    Write-Host "  Couldn't download PocketBase. Are you online? ($zipUrl)" -ForegroundColor Red
    exit 1
  }
}

# ── Detect the LAN IP (the adapter that owns the default route) ──────
$netCfg = Get-NetIPConfiguration |
  Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq "Up" } |
  Select-Object -First 1
$ip = $netCfg.IPv4Address.IPAddress
if (-not $ip) { $ip = "127.0.0.1" }

$webPort = 3000

# ── Build the web app if needed ─────────────────────────────────────
# Rebuilt whenever any of its code has changed since the last build, so new
# code (from git pull or a copied folder) never runs as an old build. Each
# build leaves a fingerprint of the files it was built from (name, size and
# time of every file). Timestamps alone would miss a copied folder: Explorer
# keeps the original times, which can be older than the last build.
function Get-Fingerprint([string[]]$paths) {
  # Folders are walked, files looked up on their own. (Windows PowerShell 5.1
  # treats a file given to -Recurse as a name to search for everywhere below,
  # which would pull in every package.json under node_modules.)
  $files = foreach ($p in $paths) {
    if (Test-Path -LiteralPath $p -PathType Container) { Get-ChildItem -LiteralPath $p -Recurse -File }
    elseif (Test-Path -LiteralPath $p) { Get-Item -LiteralPath $p }
  }
  [string[]]$lines = $files |
    ForEach-Object { "$($_.FullName.Substring($root.Length))|$($_.Length)|$($_.LastWriteTimeUtc.Ticks)" }
  # Ordinal, so 5.1 and 7 (whose culture-aware sorts differ) agree on the order.
  [Array]::Sort($lines, [StringComparer]::Ordinal)
  $bytes = [System.Text.Encoding]::UTF8.GetBytes(($lines -join "`n"))
  # Written for Windows PowerShell 5.1 too ("Run with PowerShell" uses it).
  $sha = [System.Security.Cryptography.SHA256]::Create()
  ($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString("x2") }) -join ""
}
$sources = @(
  (Join-Path $webDir "src"), (Join-Path $webDir "static"), (Join-Path $root "engine\src"),
  (Join-Path $webDir "svelte.config.js"), (Join-Path $webDir "vite.config.ts")
)
$packages = @(
  (Join-Path $root "bun.lock"), (Join-Path $root "package.json"),
  (Join-Path $webDir "package.json"), (Join-Path $root "engine\package.json")
)
# Kept inside build\ (gitignored): a fresh copy without a build has no
# fingerprint either, so it always builds.
$sourceStamp = Join-Path $webDir "build\.sources"
$packageStamp = Join-Path $webDir "build\.packages"
$sourcePrint = Get-Fingerprint ($sources + $packages)
$packagePrint = Get-Fingerprint $packages
$hasBuild = Test-Path $webBuild
$lastSources = if (Test-Path $sourceStamp) { Get-Content $sourceStamp -Raw } else { "" }
$lastPackages = if (Test-Path $packageStamp) { Get-Content $packageStamp -Raw } else { "" }

if (-not $hasBuild -or $lastSources.Trim() -ne $sourcePrint) {
  if ($hasBuild) { Write-Host "  The code has changed since the last build: rebuilding…" -ForegroundColor Cyan }
  else { Write-Host "  First run: building the web app…" -ForegroundColor Cyan }

  # A new or changed package comes in with the lock file: install it first.
  if ($lastPackages.Trim() -ne $packagePrint) {
    Push-Location $root
    bun install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { Write-Host "  bun install failed (offline?). Trying the build anyway." -ForegroundColor Yellow }
    Pop-Location
  }

  Push-Location $webDir
  bun run build
  $built = $LASTEXITCODE -eq 0
  Pop-Location
  if ($built) {
    Set-Content -Path $sourceStamp -Value $sourcePrint -NoNewline
    Set-Content -Path $packageStamp -Value $packagePrint -NoNewline
  }
  elseif (Test-Path $webBuild) {
    # Don't strand the event: keep going on the last good build. No new
    # fingerprint, so the next start tries the build again.
    Write-Host "  THE BUILD FAILED (see above). Running the PREVIOUS build instead:" -ForegroundColor Red
    Write-Host "  it won't have the newest changes." -ForegroundColor Red
  }
  else {
    Write-Host "  The build failed (see above), and there's no earlier build to fall back on." -ForegroundColor Red
    exit 1
  }
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

# ── Can phones get through Windows Firewall? ──────────────────────────
# Phones (and the QR code) reach this PC on ports 3000 and 8090. Two things
# quietly stop them: the network being "Public" (Windows' default for new
# wifi, where the usual allow-on-private-networks rules don't apply), and a
# Block rule left by a dismissed firewall prompt (Block beats Allow).
# Checked by program, as Windows' own prompt rules are: those can be read
# without admin rights; port rules can't.
$nodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source
$programs = @($pbExe, $nodeExe) | Where-Object { $_ }
$netProfile = if ($netCfg) { Get-NetConnectionProfile -InterfaceIndex $netCfg.InterfaceIndex -ErrorAction SilentlyContinue }
$category = if ($netProfile) { "$($netProfile.NetworkCategory)" -replace "DomainAuthenticated", "Domain" } else { "" }

$problems = @()
if ($category -eq "Public") {
  $problems += "Windows treats this network ($($netProfile.Name)) as Public, so phones are blocked."
}
if ($category) {
  # One pass over the firewall's program list, then each program checked
  # against it. Paths are stored lower-case, sometimes with %variables%.
  $appRules = Get-NetFirewallApplicationFilter -All -ErrorAction SilentlyContinue |
    Where-Object { $_.Program -match '\\(node|pocketbase)\.exe$' } |
    ForEach-Object {
      $rule = $_ | Get-NetFirewallRule
      [pscustomobject]@{ Program = [Environment]::ExpandEnvironmentVariables($_.Program); Rule = $rule }
    }
  # The profile the rule must cover: the network's own, or Private once
  # it's been switched from Public.
  $need = if ($category -eq "Public") { "Private" } else { $category }
  # With the firewall off for that kind of network, rules don't matter.
  $firewallOn = "$((Get-NetFirewallProfile -Name $need -ErrorAction SilentlyContinue).Enabled)" -ne "False"
  foreach ($exe in $programs | Where-Object { $firewallOn }) {
    $mine = @($appRules | Where-Object { $_.Program -eq $exe -and "$($_.Rule.Enabled)" -eq "True" -and "$($_.Rule.Direction)" -eq "Inbound" })
    $covers = { param($r) "$($r.Profile)" -match "Any|$need" }
    $name = Split-Path $exe -Leaf
    if ($mine | Where-Object { "$($_.Rule.Action)" -eq "Block" -and (& $covers $_.Rule) }) {
      $problems += "Windows Firewall has a rule BLOCKING $name."
    }
    elseif (-not ($mine | Where-Object { "$($_.Rule.Action)" -eq "Allow" -and (& $covers $_.Rule) })) {
      $problems += "Windows Firewall hasn't been told to let $name through."
    }
  }
}

if ($problems.Count) {
  Write-Host ""
  Write-Host "  Phones may not be able to connect:" -ForegroundColor Yellow
  $problems | ForEach-Object { Write-Host "   - $_" -ForegroundColor Yellow }
  $fix = $false
  if (-not [Console]::IsInputRedirected) {
    $answer = Read-Host "  Fix it now? Windows will ask for permission once. [Y/n]"
    $fix = $answer -notmatch '^\s*n'
  }
  if ($fix) {
    # One elevated PowerShell does it all, so there's a single admin prompt.
    # It drops Block rules for these programs, replaces our own Allow rules,
    # and makes a Public network Private.
    $list = ($programs | ForEach-Object { "'" + ($_ -replace "'", "''") + "'" }) -join ","
    $fixScript = @"
`$ErrorActionPreference = 'Continue'
foreach (`$exe in @($list)) {
  Get-NetFirewallApplicationFilter -All | Where-Object { [Environment]::ExpandEnvironmentVariables(`$_.Program) -eq `$exe } |
    Get-NetFirewallRule | Where-Object { "`$(`$_.Action)" -eq 'Block' -and "`$(`$_.Direction)" -eq 'Inbound' } | Remove-NetFirewallRule
  `$name = 'Beyfest 2026 - ' + (Split-Path `$exe -Leaf)
  Get-NetFirewallRule -DisplayName `$name -ErrorAction SilentlyContinue | Remove-NetFirewallRule
  New-NetFirewallRule -DisplayName `$name -Direction Inbound -Program `$exe -Action Allow -Profile Private,Domain | Out-Null
}
"@
    if ($category -eq "Public") {
      $fixScript += "`nSet-NetConnectionProfile -InterfaceIndex $($netCfg.InterfaceIndex) -NetworkCategory Private"
    }
    $encoded = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($fixScript))
    try {
      $p = Start-Process powershell -Verb RunAs -Wait -PassThru -WindowStyle Hidden `
        -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", $encoded
      if ($p.ExitCode -eq 0) { Write-Host "  Fixed: phones should be able to connect now." -ForegroundColor Green }
      else { Write-Host "  The fix didn't finish (code $($p.ExitCode)). Phones may still be blocked." -ForegroundColor Red }
    }
    catch {
      Write-Host "  No permission given, so nothing was changed. Phones may be blocked." -ForegroundColor Red
    }
  }
  else {
    Write-Host "  Not fixed. If phones can't connect, run this again and answer Y." -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "  BEYFEST 2026 — Tournament" -ForegroundColor Yellow
Write-Host "  ------------------------------------------------------------"
Write-Host "  Public display :  http://${ip}:$webPort" -ForegroundColor Green
Write-Host "  Organiser admin:  http://${ip}:$webPort/admin" -ForegroundColor Green
Write-Host "  PocketBase admin: http://127.0.0.1:8090/_/  (on this laptop)"
Write-Host "  ------------------------------------------------------------"
Write-Host "  $loginNote"
if ($NoTv) { Write-Host "  TV screen:        http://${ip}:$webPort/tv  (open it full screen on the TV)" }
else { Write-Host "  The TV screen opens by itself once the server is up (Alt+F4 closes it)." }
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

# ── Keep the PC and its screens awake while this runs ───────────────
# Like the Pi's screen-blanking switch-off: no sleep, no screen going dark
# mid-match. Windows drops it by itself when this window closes.
Add-Type -Namespace Beyfest -Name Power -MemberDefinition @"
[System.Runtime.InteropServices.DllImport("kernel32.dll")]
public static extern uint SetThreadExecutionState(uint flags);
"@
$ES_CONTINUOUS = [uint32]"0x80000000"; $ES_SYSTEM = [uint32]1; $ES_DISPLAY = [uint32]2
[void][Beyfest.Power]::SetThreadExecutionState($ES_CONTINUOUS -bor $ES_SYSTEM -bor $ES_DISPLAY)

# ── Open the TV screen once the web server answers ──────────────────
# Edge (on every Windows PC) in kiosk mode, with its own profile so it
# doesn't join an Edge that's already open, and sound allowed to start by
# itself (otherwise the announcer and music wait for a click on the TV).
$tvProfile = Join-Path $env:LOCALAPPDATA "Beyfest2026\tv-browser"
if (-not $NoTv) {
  $browser = @(
    (Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe"),
    (Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe")
  ) | Where-Object { Test-Path $_ } | Select-Object -First 1
  if ($browser) {
    # The TV is a second screen, if there is one that's landscape (a portrait
    # side monitor isn't it); otherwise the main screen.
    Add-Type -AssemblyName System.Windows.Forms
    $screen = [System.Windows.Forms.Screen]::AllScreens |
      Where-Object { -not $_.Primary -and $_.Bounds.Width -ge $_.Bounds.Height } |
      Sort-Object { $_.Bounds.Width * $_.Bounds.Height } -Descending | Select-Object -First 1
    if (-not $screen) { $screen = [System.Windows.Forms.Screen]::PrimaryScreen }
    $tvArgs = @(
      "--kiosk", "http://${ip}:$webPort/tv", "--edge-kiosk-type=fullscreen",
      "--user-data-dir=`"$tvProfile`"", "--no-first-run", "--noerrdialogs",
      "--disable-session-crashed-bubble", "--autoplay-policy=no-user-gesture-required",
      "--window-position=$($screen.Bounds.X),$($screen.Bounds.Y)"
    )
    # A background job, because the web server below holds this window.
    $null = Start-Job -ArgumentList "http://127.0.0.1:$webPort/ping", $browser, $tvArgs -ScriptBlock {
      param($ping, $exe, $argList)
      for ($i = 0; $i -lt 60; $i++) {
        try { $null = Invoke-WebRequest $ping -UseBasicParsing -TimeoutSec 3; break } catch { Start-Sleep -Seconds 2 }
      }
      Start-Process $exe -ArgumentList $argList
    }
  }
  else {
    Write-Host "  Edge isn't installed: open http://${ip}:$webPort/tv full screen on the TV yourself." -ForegroundColor Yellow
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
  # Close the TV screen too, rather than leave it showing an error. Found by
  # its own profile folder, so any other Edge windows are left alone.
  Get-CimInstance Win32_Process -Filter "Name = 'msedge.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine.Contains($tvProfile) } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  [void][Beyfest.Power]::SetThreadExecutionState($ES_CONTINUOUS)
}
