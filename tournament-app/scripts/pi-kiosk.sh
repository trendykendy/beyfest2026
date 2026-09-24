#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Raspberry Pi: show the Beyfest TV screen full-screen in Chromium.
#
#   scripts/pi-kiosk.sh 192.168.1.20    TV for the app running on the Mac
#                                       (use the IP that start.sh prints)
#   scripts/pi-kiosk.sh                 TV for the app running on this Pi
#   scripts/pi-kiosk.sh localhost:80    host:port when it isn't port 3000
#                                       (install-pi.sh serves on port 80)
#   scripts/pi-kiosk.sh --install 192.168.1.20
#                                       also open it automatically at login
#
# It waits until the app answers before opening the browser, so it's safe to
# start the Pi before the Mac. Press Alt+F4 to leave the kiosk.
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

script="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"

install=false
if [[ "${1:-}" == "--install" ]]; then
  install=true
  shift
fi
host="${1:-127.0.0.1}"
[[ "$host" == *:* ]] || host="${host}:3000" # the Mac/start.sh port unless given
url="http://${host}/tv"

# ── --install: run this script at every login (XDG autostart) ────────
if $install; then
  mkdir -p "$HOME/.config/autostart"
  cat >"$HOME/.config/autostart/beyfest-tv.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Beyfest TV
Exec=$script $host
EOF
  echo "  The TV screen will open at login, showing $url"
  echo "  To stop that: rm ~/.config/autostart/beyfest-tv.desktop"
fi

# ── Find Chromium (the name differs between Raspberry Pi OS releases) ─
browser=""
for name in chromium-browser chromium; do
  if command -v "$name" >/dev/null 2>&1; then
    browser="$name"
    break
  fi
done
[[ -n "$browser" ]] || { echo "  Chromium is not installed (sudo apt install chromium)." >&2; exit 1; }

# ── Keep the screen awake (X11 only; on Wayland use raspi-config, see README) ─
if [[ -n "${DISPLAY:-}" ]] && command -v xset >/dev/null 2>&1; then
  xset s off -dpms s noblank 2>/dev/null || true
fi

# ── Wait for the app (/ping answers 204 once the web server and PocketBase are up) ─
echo "  Waiting for $url …"
until curl -fs -o /dev/null --max-time 3 "http://${host}/ping"; do
  sleep 3
done

# --incognito: no "restore pages?" bubble after the Pi loses power.
exec "$browser" --kiosk --incognito --noerrdialogs --disable-infobars \
  --disable-session-crashed-bubble --check-for-update-interval=31536000 \
  --autoplay-policy=no-user-gesture-required "$url"
