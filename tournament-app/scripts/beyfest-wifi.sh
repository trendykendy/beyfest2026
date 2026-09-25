#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Beyfest wifi on the Raspberry Pi (uses NetworkManager, standard on
# Raspberry Pi OS). install-pi.sh links it as the `beyfest-wifi` command.
#
#   beyfest-wifi add ["name"]   add a wifi network (asks for its password)
#   beyfest-wifi list           the networks this Pi knows
#   beyfest-wifi remove "name"  forget a network
#   beyfest-wifi status         what the Pi is connected to right now
#   beyfest-wifi hotspot        switch to the Pi's own "Beyfest" wifi now
#   beyfest-wifi auto           leave the hotspot and try the known networks again
#
# Used by the installer and the beyfest-network service:
#   beyfest-wifi setup-hotspot  create the hotspot (password from HOTSPOT_PASSWORD, or asks)
#   beyfest-wifi watch          every 10s: write the status for the TV, and switch to
#                               the hotspot after 60s with no wifi or cable connection
#
# The hotspot is never left automatically: once on it, the Pi stays on it
# until `beyfest-wifi auto` or a restart, so nobody gets dropped mid-event.
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

hotspot="beyfest-hotspot"                          # NetworkManager connection name
hotspot_ssid="${BEYFEST_HOTSPOT_SSID:-Beyfest}"    # the wifi name people see
prefix="beyfest-wifi-"                             # names of networks added here
status_file="${BEYFEST_NETWORK_FILE:-/run/beyfest/network.json}"
fallback_after="${BEYFEST_FALLBACK_SECONDS:-60}"

fail() {
  echo "  $*" >&2
  exit 1
}

command -v nmcli >/dev/null 2>&1 || fail "NetworkManager (nmcli) isn't installed."

# Changing networks needs root. Keep the variables the installer passes in.
if [[ "$EUID" -ne 0 ]]; then
  exec sudo --preserve-env=WIFI_SSID,WIFI_PASSWORD,HOTSPOT_PASSWORD,BEYFEST_HOTSPOT_SSID,BEYFEST_NETWORK_FILE,BEYFEST_FALLBACK_SECONDS,BEYFEST_WIFI_DEVICE \
    "$0" "$@"
fi

wifi_device() {
  # BEYFEST_WIFI_DEVICE is for testing on a machine without wifi.
  if [[ -n "${BEYFEST_WIFI_DEVICE:-}" ]]; then
    echo "$BEYFEST_WIFI_DEVICE"
    return
  fi
  nmcli -t -f DEVICE,TYPE device | awk -F: '$2 == "wifi" {print $1; exit}'
}

ask() { # $1 = prompt, $2 = "secret" to hide typing; the answer goes to stdout
  local answer
  if [[ "${2:-}" == "secret" ]]; then
    read -rsp "  $1" answer </dev/tty
    echo >/dev/tty
  else
    read -rp "  $1" answer </dev/tty
  fi
  printf '%s' "$answer"
}

hotspot_active() {
  nmcli -t -f NAME connection show --active | grep -qx "$hotspot"
}

# Prints "mode<TAB>ssid": mode is hotspot, wifi, ethernet or offline.
current_state() {
  if hotspot_active; then
    printf 'hotspot\t%s\n' "$hotspot_ssid"
    return
  fi
  local line dev type state conn ssid
  while IFS= read -r line; do
    # nmcli -t separates with ":" and escapes any ":" inside a value as "\:".
    IFS=$'\t' read -r dev type state conn <<<"$(sed 's/\\:/\x1f/g; s/:/\t/g; s/\x1f/:/g' <<<"$line")"
    [[ "$state" == connected* ]] || continue # also "connected (externally)"
    if [[ "$type" == "wifi" ]]; then
      ssid="$(nmcli -g 802-11-wireless.ssid connection show "$conn" 2>/dev/null || echo "$conn")"
      printf 'wifi\t%s\n' "$ssid"
      return
    fi
    if [[ "$type" == "ethernet" ]]; then
      printf 'ethernet\t\n'
      return
    fi
  done < <(nmcli -t -f DEVICE,TYPE,STATE,CONNECTION device)
  printf 'offline\t\n'
}

json_escape() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  printf '%s' "$s"
}

# The TV's standby screen reads this (see web/src/lib/server/network.ts).
write_status() {
  local mode="$1" ssid="$2" ip
  ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  mkdir -p "$(dirname "$status_file")"
  printf '{"mode":"%s","ssid":"%s","ip":"%s","host":"%s"}\n' \
    "$mode" "$(json_escape "$ssid")" "$ip" "$(hostname).local" >"$status_file.tmp"
  chmod 644 "$status_file.tmp"
  mv "$status_file.tmp" "$status_file"
}

cmd="${1:-status}"
shift || true

case "$cmd" in
  add)
    dev="$(wifi_device)"
    [[ -n "$dev" ]] || fail "This Pi has no wifi."
    ssid="${1:-${WIFI_SSID:-}}"
    [[ -n "$ssid" ]] || ssid="$(ask "Wifi network name: ")"
    [[ -n "$ssid" ]] || fail "No network name given."
    if [[ -v WIFI_PASSWORD ]]; then
      password="$WIFI_PASSWORD"
    else
      password="$(ask "Password for \"$ssid\" (leave empty if it has none): " secret)"
    fi
    if [[ -n "$password" ]] && ((${#password} < 8)); then
      fail "Wifi passwords are at least 8 characters. Nothing was changed."
    fi
    nmcli connection delete "$prefix$ssid" >/dev/null 2>&1 || true
    args=(connection add type wifi con-name "$prefix$ssid" ifname "$dev" ssid "$ssid"
      connection.autoconnect yes connection.autoconnect-priority 10)
    if [[ -n "$password" ]]; then args+=(wifi-sec.key-mgmt wpa-psk wifi-sec.psk "$password"); fi
    nmcli "${args[@]}" >/dev/null
    echo "  Added \"$ssid\". The Pi joins it whenever it's in range."
    if hotspot_active; then echo "  It's on its own hotspot now; run 'beyfest-wifi auto' to try the new network."; fi
    ;;

  list)
    echo "  Wifi networks this Pi knows (it joins whichever is in range):"
    nmcli -t -f NAME,TYPE connection show | while IFS=: read -r name type; do
      [[ "$type" == "802-11-wireless" && "$name" != "$hotspot" ]] || continue
      echo "    ${name#"$prefix"}"
    done
    echo "  Fallback hotspot: \"$hotspot_ssid\"$(nmcli -t -f NAME connection show | grep -qx "$hotspot" || echo " (not set up)")"
    ;;

  remove)
    name="${1:-}"
    [[ -n "$name" ]] || fail "Which network? See: beyfest-wifi list"
    [[ "$name" != "$hotspot" ]] || fail "That's the fallback hotspot; it can't be removed here."
    nmcli connection delete "$prefix$name" >/dev/null 2>&1 ||
      nmcli connection delete "$name" >/dev/null 2>&1 ||
      fail "No network called \"$name\". See: beyfest-wifi list"
    echo "  Forgot \"$name\"."
    ;;

  status)
    IFS=$'\t' read -r mode ssid <<<"$(current_state)"
    case "$mode" in
      hotspot) echo "  On its own hotspot: join the wifi \"$ssid\"." ;;
      wifi) echo "  On the wifi \"$ssid\"." ;;
      ethernet) echo "  On a network cable." ;;
      *) echo "  Not connected to anything yet." ;;
    esac
    echo "  Address: http://$(hostname).local  ($(hostname -I 2>/dev/null | awk '{print $1}'))"
    ;;

  hotspot)
    nmcli -t -f NAME connection show | grep -qx "$hotspot" || fail "The hotspot isn't set up. Re-run the installer with --wifi."
    echo "  Switching to the \"$hotspot_ssid\" hotspot. Anyone connected over the old network will drop off."
    nmcli connection up "$hotspot" >/dev/null 2>&1 ||
      fail "Couldn't start the hotspot. Is wifi switched on? (sudo raspi-config → Localisation → WLAN Country)"
    echo "  Done: join the wifi \"$hotspot_ssid\", then open http://$(hostname).local"
    ;;

  auto)
    if hotspot_active; then
      nmcli connection down "$hotspot" >/dev/null
      echo "  Left the hotspot; trying the known networks. If none connects within"
      echo "  ${fallback_after}s, the hotspot comes back by itself."
    else
      echo "  Not on the hotspot; nothing to do."
    fi
    ;;

  setup-hotspot)
    dev="$(wifi_device)"
    [[ -n "$dev" ]] || fail "This Pi has no wifi."
    password="${HOTSPOT_PASSWORD:-}"
    [[ -n "$password" ]] || password="$(ask "Password for the \"$hotspot_ssid\" hotspot (at least 8 characters): " secret)"
    ((${#password} >= 8)) || fail "The hotspot password needs at least 8 characters."
    nmcli connection delete "$hotspot" >/dev/null 2>&1 || true
    # 2.4 GHz WPA2 with CCMP only: the Pi 3's wifi chip is most reliable that way.
    # "shared" gives out addresses to phones and laptops that join.
    nmcli connection add type wifi con-name "$hotspot" ifname "$dev" ssid "$hotspot_ssid" \
      connection.autoconnect no 802-11-wireless.mode ap 802-11-wireless.band bg \
      ipv4.method shared ipv6.method disabled \
      wifi-sec.key-mgmt wpa-psk wifi-sec.proto rsn wifi-sec.pairwise ccmp wifi-sec.group ccmp \
      wifi-sec.psk "$password" >/dev/null
    echo "  Hotspot \"$hotspot_ssid\" is set up (used only when no other network connects)."
    ;;

  watch)
    offline_for=0
    while true; do
      IFS=$'\t' read -r mode ssid <<<"$(current_state)"
      write_status "$mode" "$ssid"
      if [[ "$mode" == "offline" ]]; then
        offline_for=$((offline_for + 10))
        if ((offline_for >= fallback_after)) && nmcli -t -f NAME connection show | grep -qx "$hotspot"; then
          echo "No network for ${offline_for}s: starting the hotspot."
          nmcli connection up "$hotspot" || echo "Couldn't start the hotspot; trying again shortly."
          offline_for=0
        fi
      else
        offline_for=0
      fi
      sleep 10
    done
    ;;

  *)
    sed -n '3,15p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
