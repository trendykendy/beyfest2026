#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Beyfest 2026 tournament app — one-command launcher for macOS and Linux
# (including a Raspberry Pi). The Windows twin is start.ps1.
#
# Starts PocketBase (data + realtime API) and the built SvelteKit server,
# both bound to 0.0.0.0 so the TV and phones on the venue wifi can reach
# them. Detects this machine's LAN IP so it can print the addresses to open.
#
#   ./start.sh                     (on a Mac you can double-click start.command)
#   BEYFEST_IP=192.168.1.20 ./start.sh   to force the address it prints
#
# First run needs the internet: it installs packages, builds the web app and
# downloads the PocketBase build for this machine. Do it at home, not at the
# venue. After that it runs offline.
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

root="$(cd "$(dirname "$0")" && pwd)"
pb_version="0.40.4" # keep in step with pb/pocketbase.exe on Windows
pb_bin="$root/pb/pocketbase"
pb_data="$root/pb/pb_data"
pb_mig="$root/pb/pb_migrations"
web_dir="$root/web"
web_build="$web_dir/build/index.js"
web_port=3000

fail() {
  echo "" >&2
  echo "  $1" >&2
  echo "" >&2
  exit 1
}

# ── Tools ────────────────────────────────────────────────────────────
# Bun is only needed to install and build (from a git checkout). The Pi
# package comes ready-built, so there Node alone is enough.
need_bun() {
  command -v bun >/dev/null 2>&1 ||
    fail "bun is not installed. Install it with:  curl -fsSL https://bun.sh/install | bash"
}

# Prefer Node to run the server (what start.ps1 uses); Bun can run it too.
if command -v node >/dev/null 2>&1; then
  runner="node"
elif command -v bun >/dev/null 2>&1; then
  runner="bun"
else
  fail "Neither Node nor Bun is installed. Install Bun:  curl -fsSL https://bun.sh/install | bash"
fi

# ── Detect the LAN IP (the interface that owns the default route) ────
detect_ip() {
  local ip=""
  if [[ "$(uname -s)" == "Darwin" ]]; then
    local iface
    iface="$(route -n get default 2>/dev/null | awk '/interface:/ {print $2}')"
    [[ -n "$iface" ]] && ip="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
  else
    # "ip route get" only asks the routing table; nothing is sent to 1.1.1.1.
    ip="$(ip -4 route get 1.1.1.1 2>/dev/null |
      awk '{for (i = 1; i < NF; i++) if ($i == "src") {print $(i + 1); exit}}')"
    [[ -z "$ip" ]] && ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi
  echo "${ip:-127.0.0.1}"
}
ip="${BEYFEST_IP:-$(detect_ip)}"

# ── PocketBase: download the build for this OS + CPU if it's missing ─
if [[ ! -x "$pb_bin" ]]; then
  case "$(uname -s)" in
    Darwin) os="darwin" ;;
    Linux) os="linux" ;;
    *) fail "Unsupported system $(uname -s). On Windows use start.ps1." ;;
  esac
  case "$(uname -m)" in
    arm64 | aarch64) arch="arm64" ;;
    x86_64 | amd64) arch="amd64" ;;
    armv7l) arch="armv7" ;; # 32-bit Raspberry Pi OS
    *) fail "Unsupported CPU $(uname -m)." ;;
  esac
  command -v unzip >/dev/null 2>&1 || fail "unzip is not installed (sudo apt install unzip)."

  zip_url="https://github.com/pocketbase/pocketbase/releases/download/v${pb_version}/pocketbase_${pb_version}_${os}_${arch}.zip"
  echo "  First run: downloading PocketBase ${pb_version} (${os}/${arch})…"
  tmp="$(mktemp -d)"
  curl -fL --progress-bar -o "$tmp/pb.zip" "$zip_url" ||
    fail "Download failed. Are you online? ($zip_url)"
  unzip -o -q "$tmp/pb.zip" pocketbase -d "$root/pb"
  rm -rf "$tmp"
  chmod +x "$pb_bin"
fi

# ── Install packages and build the web app if needed ────────────────
if [[ ! -f "$web_build" ]]; then
  need_bun
  if [[ ! -d "$root/node_modules" ]]; then
    echo "  First run: installing packages…"
    (cd "$root" && bun install)
  fi
  echo "  First run: building the web app…"
  (cd "$web_dir" && bun run build)
fi

# ── Fresh database: create it, and choose the passwords ───────────────
organiser_email="organiser@beyfest.local"
superuser_email="admin@beyfest.local"
organiser_pw=""
login_note="Login: $organiser_email"

ask_password() { # $1 = what it's for; the answer is left in $REPLY
  local first second
  while true; do
    read -rsp "  $1 (at least 10 characters): " first
    echo
    if ((${#first} < 10)); then
      echo "  Too short, try again."
      continue
    fi
    read -rsp "  Type it again: " second
    echo
    [[ "$first" == "$second" ]] && break
    echo "  They didn't match, try again."
  done
  REPLY="$first"
}

if [[ ! -d "$pb_data" ]]; then
  echo "  First run: creating the database…"
  "$pb_bin" migrate up --dir="$pb_data" --migrationsDir="$pb_mig" >/dev/null
  if [[ -t 0 ]]; then
    echo ""
    echo "  Choose the passwords. Write them down somewhere safe."
    ask_password "Organiser password (for the admin page)"
    organiser_pw="$REPLY"
    ask_password "PocketBase admin password (for backups/restores)"
    superuser_pw="$REPLY"
  else
    # Nobody at the keyboard to ask: the published defaults, loudly.
    superuser_pw="beyfestadmin2026"
    login_note="Login: $organiser_email / beyfest2026  (DEFAULT PASSWORDS: change them before the event)"
  fi
  "$pb_bin" superuser upsert "$superuser_email" "$superuser_pw" --dir="$pb_data" >/dev/null
fi

echo ""
echo "  BEYFEST 2026 — Tournament"
echo "  ------------------------------------------------------------"
echo "  Public display :  http://${ip}:${web_port}"
echo "  TV screen      :  http://${ip}:${web_port}/tv"
echo "  Organiser admin:  http://${ip}:${web_port}/admin"
echo "  PocketBase admin: http://127.0.0.1:8090/_/  (on this machine)"
echo "  ------------------------------------------------------------"
echo "  $login_note"
echo "  Close this window (or Ctrl+C) to stop both servers."
echo ""

# ── Start PocketBase in the background (migrations run automatically) ─
"$pb_bin" serve --http=0.0.0.0:8090 --dir="$pb_data" --migrationsDir="$pb_mig" \
  >"$root/pb/pocketbase.log" 2>&1 &
pb_pid=$!

# The organiser login lives in the database, so its new password is set
# through PocketBase's API once it's up (scripts/set-organiser-password.mjs).
if [[ -n "$organiser_pw" ]]; then
  SU_EMAIL="$superuser_email" SU_PW="$superuser_pw" ORG_EMAIL="$organiser_email" ORG_PW="$organiser_pw"     "$runner" "$root/scripts/set-organiser-password.mjs" || {
    kill "$pb_pid" 2>/dev/null
    fail "Couldn't set the organiser password (see above). Delete pb/pb_data and run this again."
  }
  unset organiser_pw superuser_pw
fi

web_pid=""

# Stop both servers when the web server exits, on Ctrl+C, or when the window closes.
cleanup() {
  echo ""
  echo "  Shutting down…"
  kill "$pb_pid" $web_pid 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT TERM HUP

# ── Start the web server ─────────────────────────────────────────────
# It runs in the background and we wait on it, so a signal to this script is
# handled straight away rather than after the server has exited.
export HOST="0.0.0.0"
export PORT="$web_port"
"$runner" "$web_build" &
web_pid=$!
wait "$web_pid"
