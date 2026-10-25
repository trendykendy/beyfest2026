// A QR code as one SVG path, for the TV's "scan for live results" codes.
// Drawn on the server, so the TV just shows a static picture (light on the
// Pi). `uqr` is a devDependency so the build bundles it: the Pi package only
// ships web/build (see scripts/pi-package.sh).

import { encode } from "uqr";

// size: squares across (no quiet zone; the component adds it).
// path: one 1×1 square per dark module, in module units.
export function qrPath(text: string): { size: number; path: string } {
  // M (15% recovery) still scans if a corner of the TV glares.
  const { size, data } = encode(text, { ecc: "M", border: 0 });
  let path = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[y][x]) path += `M${x} ${y}h1v1h-1z`;
    }
  }
  return { size, path };
}
