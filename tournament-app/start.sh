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
command -v bun >/dev/null 2>&1 ||
  fail "bun is not installed. Install it with:  curl -fsSL https://bun.sh/install | bash"

# Prefer Node to run the server (what start.ps1 uses); Bun can run it too.
if command -v node >/dev/null 2>&1; then runner="node"; else runner="bun"; fi

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
if [[ ! -d "$root/node_modules" ]]; then
  echo "  First run: installing packages…"
  (cd "$root" && bun install)
fi
if [[ ! -f "$web_build" ]]; then
  echo "  First run: building the web app…"
  (cd "$web_dir" && bun run build)
fi

# ── Fresh database: create it and the PocketBase superuser ───────────
# Same defaults as the README; change them before the event.
if [[ ! -d "$pb_data" ]]; then
  echo "  First run: creating the database…"
  "$pb_bin" migrate up --dir="$pb_data" --migrationsDir="$pb_mig" >/dev/null
  "$pb_bin" superuser upsert admin@beyfest.local beyfestadmin2026 --dir="$pb_data" >/dev/null
fi

echo ""
echo "  BEYFEST 2026 — Tournament"
echo "  ------------------------------------------------------------"
echo "  Public display :  http://${ip}:${web_port}"
echo "  TV screen      :  http://${ip}:${web_port}/tv"
echo "  Organiser admin:  http://${ip}:${web_port}/admin"
echo "  PocketBase admin: http://127.0.0.1:8090/_/  (on this machine)"
echo "  ------------------------------------------------------------"
echo "  Login: organiser@beyfest.local  /  beyfest2026"
echo "  Close this window (or Ctrl+C) to stop both servers."
echo ""

# ── Start PocketBase in the background (migrations run automatically) ─
"$pb_bin" serve --http=0.0.0.0:8090 --dir="$pb_data" --migrationsDir="$pb_mig" \
  >"$root/pb/pocketbase.log" 2>&1 &
pb_pid=$!

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
