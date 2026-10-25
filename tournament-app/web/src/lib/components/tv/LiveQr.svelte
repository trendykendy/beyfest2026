<script lang="ts">
  // A QR code from qrPath() (lib/qr.ts): dark squares on a paper card with
  // the quiet zone round it that scanners need. Static, no animation (Pi).
  let { size, path, px }: { size: number; path: string; px: number } = $props();
  const QUIET = 3; // squares of white border; 4 is the spec, 3 scans fine on a lit screen
</script>

<svg
  viewBox="{-QUIET} {-QUIET} {size + QUIET * 2} {size + QUIET * 2}"
  width={px}
  height={px}
  shape-rendering="crispEdges"
  role="img"
  aria-label="QR code"
>
  <rect x={-QUIET} y={-QUIET} width={size + QUIET * 2} height={size + QUIET * 2} fill="#fff" />
  <path d={path} fill="#000" />
</svg>

<style>
  svg {
    display: block;
  }
</style>
