#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Build the ready-to-run Raspberry Pi package, so the Pi never has to
# install packages or build anything (a Pi 3 has too little memory for it).
#
#   scripts/pi-package.sh [out-dir]           → out-dir/beyfest-pi-arm64.tar.gz
#   PB_ARCH=amd64 scripts/pi-package.sh ...   same, for testing on a PC
#
# GitHub runs this on every push (.github/workflows/pi-package.yml) and
# publishes the result as a release that install-pi.sh downloads.
#
# The package unpacks to beyfest/ with the same layout as this folder:
#   start.sh, pi-kiosk.sh, pb/pocketbase, pb/pb_migrations, web/build, web/node_modules,
#   VERSION
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

app="$(cd "$(dirname "$0")/.." && pwd)"
out="${1:-$app/dist}"
arch="${PB_ARCH:-arm64}"
pb_version="$(sed -n 's/^pb_version="\([^"]*\)".*/\1/p' "$app/start.sh")"
[[ -n "$pb_version" ]] || { echo "Couldn't read pb_version from start.sh" >&2; exit 1; }

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
stage="$work/beyfest"

# ── Install, test, build ────────────────────────────────────────────
cd "$app"
bun install --frozen-lockfile
bun run test
bun run build

# ── Assemble ────────────────────────────────────────────────────────
mkdir -p "$stage/pb" "$stage/web/node_modules" "$out"
cp start.sh scripts/pi-kiosk.sh "$stage/"
cp -r pb/pb_migrations "$stage/pb/"
cp -r web/build web/package.json "$stage/web/"

# The server's only runtime package; everything else is bundled into build/.
# -L copies the real files in case the package manager used a symlink.
if [[ -d web/node_modules/pocketbase ]]; then sdk="web/node_modules/pocketbase"; else sdk="node_modules/pocketbase"; fi
cp -rL "$sdk" "$stage/web/node_modules/pocketbase"

# PocketBase for the Pi (64-bit Raspberry Pi OS).
curl -fsSL -o "$work/pb.zip" \
  "https://github.com/pocketbase/pocketbase/releases/download/v${pb_version}/pocketbase_${pb_version}_linux_${arch}.zip"
unzip -q "$work/pb.zip" pocketbase -d "$stage/pb"
chmod +x "$stage/pb/pocketbase" "$stage/start.sh" "$stage/pi-kiosk.sh"

# What's in this package, for install-pi.sh and for "which version is this?".
{
  echo "commit=$(git rev-parse --short HEAD)"
  echo "branch=${GITHUB_REF_NAME:-$(git rev-parse --abbrev-ref HEAD)}"
  echo "built=$(date -u +%Y-%m-%dT%H:%MZ)"
  echo "pocketbase=${pb_version}"
} >"$stage/VERSION"

tar -C "$work" -czf "$out/beyfest-pi-${arch}.tar.gz" beyfest
echo "Package: $out/beyfest-pi-${arch}.tar.gz ($(du -h "$out/beyfest-pi-${arch}.tar.gz" | cut -f1))"
