#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Beyfest 2026 — install or update the tournament app on a Raspberry Pi.
#
# On the Pi (64-bit Raspberry Pi OS with desktop, connected to the internet):
#
#   curl -fsSL https://raw.githubusercontent.com/trendykendy/beyfest2026/main/tournament-app/install-pi.sh | bash
#
# Run the same command again at any time to update. It keeps the tournament
# data and backups; only the app is replaced. Options (add after "bash -s --"):
#   --passwords   set new organiser and PocketBase admin passwords
#   --wifi        add wifi networks and set a new hotspot password
#   --no-kiosk    don't open the TV screen on this Pi (server only)
#
# What it sets up:
#   /opt/beyfest/app    the app (replaced on update; the last one is kept as app.previous)
#   /opt/beyfest/data   the database and its automatic backups (never replaced)
#   beyfest-pb.service, beyfest-web.service   start at boot, restart if they crash
#   hostname "beyfest", so admin is http://beyfest.local/admin
#   desktop auto-login, no screen blanking, the TV page full-screen at login
#   wifi: the networks you add, and a fallback "Beyfest" hotspot when none
#     connects (beyfest-network.service); manage them later with `beyfest-wifi`
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

repo="trendykendy/beyfest2026"
channel="${BEYFEST_CHANNEL:-main}" # the branch whose package to install (release pi-<branch>)
pkg_url="${BEYFEST_PKG_URL:-https://github.com/${repo}/releases/download/pi-${channel}/beyfest-pi-arm64.tar.gz}"
base="/opt/beyfest"
app="$base/app"
data="$base/data"
organiser_email="organiser@beyfest.local"
superuser_email="admin@beyfest.local"
web_port=80

say() { printf '\n  %s\n' "$*"; }
fail() {
  printf '\n  ERROR: %s\n\n' "$*" >&2
  exit 1
}

set_passwords=false
set_wifi=false
kiosk=true
for arg in "$@"; do
  case "$arg" in
    --passwords) set_passwords=true ;;
    --wifi) set_wifi=true ;;
    --no-kiosk) kiosk=false ;;
    *) fail "Unknown option $arg" ;;
  esac
done

# ── Checks ───────────────────────────────────────────────────────────
[[ "$(uname -s)" == "Linux" ]] || fail "This is for a Raspberry Pi. On a Mac use start.command."
[[ "$(uname -m)" == "aarch64" || -n "${BEYFEST_PKG_URL:-}" ]] ||
  fail "This needs the 64-bit Raspberry Pi OS (this system is $(uname -m)). Re-image the SD card with Raspberry Pi Imager."
[[ "$EUID" -ne 0 ]] || fail "Run this as your normal user, not with sudo. It asks for sudo when it needs it."
command -v systemctl >/dev/null 2>&1 || fail "systemd is needed (Raspberry Pi OS has it)."

first_install=false
[[ -d "$data" ]] || first_install=true
if $first_install; then
  set_passwords=true
  set_wifi=true
fi

# Wifi is managed with NetworkManager (standard since Raspberry Pi OS Bookworm).
has_nm=false
if command -v nmcli >/dev/null 2>&1; then has_nm=true; fi
$has_nm || set_wifi=false

# Questions are read from the terminal, because the script itself arrives on
# stdin when it's run as "curl … | bash".
if $set_passwords || $set_wifi; then
  [[ -r /dev/tty ]] || fail "Passwords have to be typed in, so run this from a terminal."
fi

ask_password() { # $1 = what it's for; the answer is left in $REPLY
  local first second
  while true; do
    read -rsp "  $1 (at least 10 characters): " first </dev/tty
    echo
    if ((${#first} < 10)); then
      echo "  Too short, try again."
      continue
    fi
    read -rsp "  Type it again: " second </dev/tty
    echo
    [[ "$first" == "$second" ]] && break
    echo "  They didn't match, try again."
  done
  REPLY="$first"
}

echo ""
echo "  BEYFEST 2026 — Raspberry Pi install"
echo "  ------------------------------------------------------------"
if $first_install; then echo "  First install."; else echo "  Updating (your tournament data is kept)."; fi

if $set_passwords; then
  say "Choose the passwords. Write them down somewhere safe."
  ask_password "Organiser password (for the admin page)"
  organiser_pw="$REPLY"
  ask_password "PocketBase admin password (for backups/restores)"
  superuser_pw="$REPLY"
fi

wifi_names=()
wifi_passwords=()
if $set_wifi; then
  say "Wifi. Add every network the Pi might need (home, venue, a phone hotspot…)."
  echo "  It joins whichever is in range. Press Enter on an empty name to finish."
  echo "  (A Pi 3 model B only sees 2.4 GHz networks.)"
  while true; do
    read -rp "  Wifi network name: " name </dev/tty
    [[ -n "$name" ]] || break
    while true; do
      read -rsp "  Its password (Enter if it has none): " pw </dev/tty
      echo
      [[ -z "$pw" || ${#pw} -ge 8 ]] && break
      echo "  Wifi passwords are at least 8 characters, try again."
    done
    wifi_names+=("$name")
    wifi_passwords+=("$pw")
  done
  say "If none of those networks connects, the Pi makes its own wifi called \"Beyfest\"."
  while true; do
    read -rsp "  Password for the Beyfest wifi (at least 8 characters): " hotspot_pw </dev/tty
    echo
    ((${#hotspot_pw} >= 8)) && break
    echo "  Too short, try again."
  done
fi

sudo -v || fail "sudo is needed to install."

# ── System packages ─────────────────────────────────────────────────
say "Installing system packages (this can take a few minutes on a Pi 3)…"
sudo apt-get update -qq
pkgs=(nodejs curl avahi-daemon)
if $has_nm; then pkgs+=(dnsmasq-base); fi # hands out addresses on the hotspot
if $kiosk && ! command -v chromium-browser >/dev/null 2>&1 && ! command -v chromium >/dev/null 2>&1; then
  # The package name differs between Raspberry Pi OS releases (chromium-browser
  # on Bookworm, chromium on Trixie). Pick the one that can actually be installed.
  if apt-cache policy chromium-browser 2>/dev/null | grep -q "Candidate: [0-9]"; then
    pkgs+=(chromium-browser)
  else
    pkgs+=(chromium)
  fi
fi
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${pkgs[@]}" >/dev/null
node -e 'process.exit(+process.versions.node.split(".")[0] >= 18 ? 0 : 1)' ||
  fail "Node 18 or newer is needed; this Pi has $(node --version)."

# ── Download the app ────────────────────────────────────────────────
say "Downloading the app…"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
curl -fL --progress-bar -o "$tmp/pkg.tar.gz" "$pkg_url" || fail "Download failed: $pkg_url"
tar -xzf "$tmp/pkg.tar.gz" -C "$tmp"
[[ -f "$tmp/beyfest/web/build/index.js" ]] || fail "The download doesn't look like a Beyfest package."
sed 's/^/  /' "$tmp/beyfest/VERSION"

# ── Swap it in (the data folder is never touched) ────────────────────
sudo systemctl stop beyfest-web beyfest-pb 2>/dev/null || true
sudo mkdir -p "$base"
sudo chown "$USER:" "$base"
rm -rf "$base/app.previous"
[[ -d "$app" ]] && mv "$app" "$base/app.previous"
mv "$tmp/beyfest" "$app"
mkdir -p "$data"

if $first_install; then
  "$app/pb/pocketbase" migrate up --dir="$data" --migrationsDir="$app/pb/pb_migrations" >/dev/null
fi
if $set_passwords; then
  "$app/pb/pocketbase" superuser upsert "$superuser_email" "$superuser_pw" --dir="$data" >/dev/null
fi

# ── Services: start at boot, restart if they crash ───────────────────
say "Setting up the services…"
sudo tee /etc/systemd/system/beyfest-pb.service >/dev/null <<EOF
[Unit]
Description=Beyfest PocketBase (database + live updates)
After=network.target

[Service]
User=$USER
ExecStart=$app/pb/pocketbase serve --http=0.0.0.0:8090 --dir=$data --migrationsDir=$app/pb/pb_migrations
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/systemd/system/beyfest-web.service >/dev/null <<EOF
[Unit]
Description=Beyfest web app (TV, admin and public pages)
After=network.target beyfest-pb.service
Wants=beyfest-pb.service

[Service]
User=$USER
Environment=HOST=0.0.0.0 PORT=$web_port
# Written by beyfest-network.service; the TV's standby screen shows it.
Environment=BEYFEST_NETWORK_FILE=/run/beyfest/network.json
# Lets the app use port 80 without running as root.
AmbientCapabilities=CAP_NET_BIND_SERVICE
ExecStart=$(command -v node) $app/web/build/index.js
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now beyfest-pb beyfest-web >/dev/null 2>&1
sudo systemctl restart beyfest-pb beyfest-web

printf '\n  Waiting for the app to answer'
for _ in $(seq 1 60); do
  if curl -fs -o /dev/null --max-time 2 "http://127.0.0.1:${web_port}/ping"; then break; fi
  printf '.'
  sleep 2
done
echo ""
curl -fs -o /dev/null --max-time 2 "http://127.0.0.1:${web_port}/ping" ||
  fail "The app didn't start. See: journalctl -u beyfest-web -u beyfest-pb -n 50"

# The organiser login lives in the database, so its password is set through
# PocketBase's API, signed in as the admin. Passwords go via the environment,
# not the command line, so they don't show up in the process list.
if $set_passwords; then
  SU_EMAIL="$superuser_email" SU_PW="$superuser_pw" ORG_EMAIL="$organiser_email" ORG_PW="$organiser_pw" \
    node - <<'JS' || fail "Couldn't set the organiser password."
const base = "http://127.0.0.1:8090/api";
const { SU_EMAIL, SU_PW, ORG_EMAIL, ORG_PW } = process.env;
async function call(path, init = {}) {
  const res = await fetch(base + path, { ...init, headers: { "content-type": "application/json", ...init.headers } });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}
(async () => {
  const { token } = await call("/collections/_superusers/auth-with-password", {
    method: "POST",
    body: JSON.stringify({ identity: SU_EMAIL, password: SU_PW }),
  });
  const filter = encodeURIComponent(`email="${ORG_EMAIL}"`);
  const list = await call(`/collections/organisers/records?filter=${filter}`, { headers: { authorization: token } });
  if (!list.items.length) throw new Error(`no organiser ${ORG_EMAIL}`);
  await call(`/collections/organisers/records/${list.items[0].id}`, {
    method: "PATCH",
    headers: { authorization: token },
    body: JSON.stringify({ password: ORG_PW, passwordConfirm: ORG_PW }),
  });
})().catch((e) => {
  console.error("  " + e.message);
  process.exit(1);
});
JS
  unset organiser_pw superuser_pw
fi

# ── Wifi: known networks, the fallback hotspot, and the watcher ───────
if $has_nm; then
  sudo ln -sf "$app/beyfest-wifi.sh" /usr/local/bin/beyfest-wifi
  # Raspberry Pi OS keeps wifi switched off until a country is set.
  if command -v raspi-config >/dev/null 2>&1 &&
    [[ -z "$(sudo raspi-config nonint get_wifi_country 2>/dev/null)" ]]; then
    sudo raspi-config nonint do_wifi_country IE
  fi
  if $set_wifi; then
    say "Setting up wifi…"
    for i in "${!wifi_names[@]}"; do
      WIFI_SSID="${wifi_names[$i]}" WIFI_PASSWORD="${wifi_passwords[$i]}" "$app/beyfest-wifi.sh" add
    done
    HOTSPOT_PASSWORD="$hotspot_pw" "$app/beyfest-wifi.sh" setup-hotspot
    unset wifi_passwords hotspot_pw
  fi
  sudo tee /etc/systemd/system/beyfest-network.service >/dev/null <<UNIT
[Unit]
Description=Beyfest wifi: status for the TV, and the hotspot when no network connects
After=NetworkManager.service
Wants=NetworkManager.service

[Service]
ExecStart=$app/beyfest-wifi.sh watch
Restart=always
RestartSec=5
RuntimeDirectory=beyfest
RuntimeDirectoryPreserve=yes

[Install]
WantedBy=multi-user.target
UNIT
  sudo systemctl daemon-reload
  sudo systemctl enable beyfest-network >/dev/null 2>&1
  sudo systemctl restart beyfest-network
else
  say "NetworkManager isn't installed (older Raspberry Pi OS?), so wifi setup and the hotspot were skipped."
fi

# ── Raspberry Pi OS settings: name, auto-login, no blanking ──────────
reboot_needed=false
if command -v raspi-config >/dev/null 2>&1; then
  if [[ "$(hostname)" != "beyfest" ]]; then
    sudo raspi-config nonint do_hostname beyfest
    reboot_needed=true
  fi
  if $kiosk; then
    sudo raspi-config nonint do_boot_behaviour B4 # desktop, logged in automatically
    sudo raspi-config nonint do_blanking 1        # 1 = screen blanking off
  fi
else
  say "Not Raspberry Pi OS (no raspi-config): skipped the hostname, auto-login and screen blanking."
fi

# ── The TV screen at login ───────────────────────────────────────────
autostart="$HOME/.config/autostart/beyfest-tv.desktop"
if $kiosk; then
  mkdir -p "$(dirname "$autostart")"
  cat >"$autostart" <<EOF
[Desktop Entry]
Type=Application
Name=Beyfest TV
Exec=$app/pi-kiosk.sh localhost:$web_port
EOF
  $first_install && reboot_needed=true
else
  rm -f "$autostart"
fi

# ── Done ─────────────────────────────────────────────────────────────
ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo ""
echo "  ------------------------------------------------------------"
echo "  Done. Beyfest is running and starts by itself at boot."
echo ""
echo "  Organiser admin : http://beyfest.local/admin   (or http://${ip:-<pi-ip>}/admin)"
echo "  Public page     : http://beyfest.local"
echo "  TV screen       : http://beyfest.local/tv"
echo "  PocketBase admin: http://beyfest.local:8090/_/  (backups, restores)"
echo "  Logins          : $organiser_email / $superuser_email"
echo "  Data + backups  : $data"
if $has_nm; then echo "  Wifi            : beyfest-wifi list | add | status | hotspot | auto"; fi
echo "  ------------------------------------------------------------"

if ! $first_install; then
  # An open TV page still runs the old code; a restart loads the new one.
  reboot_needed=true
fi
if $reboot_needed && [[ -r /dev/tty ]]; then
  read -rp "  Restart the Pi now to finish? [Y/n] " answer </dev/tty || answer="n"
  if [[ "$answer" =~ ^[Nn] ]]; then
    echo "  Restart it later with: sudo reboot"
  else
    sudo reboot
  fi
fi
