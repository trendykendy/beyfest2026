<script lang="ts">
  // Flat trophy mark in the telop style (gold fill, heavy black outline).
  // Replaces the 🏆 emoji, which has no colour-emoji font to render with on
  // Raspberry Pi OS and looked different on every other machine.
  let { size = "1em", label = "" }: { size?: string; label?: string } = $props();
</script>

<svg
  class="trophy"
  viewBox="0 0 64 64"
  width={size}
  height={size}
  role={label ? "img" : undefined}
  aria-label={label || undefined}
  aria-hidden={label ? undefined : "true"}
>
  <!-- handles -->
  <path d="M14 12H4v8c0 8 6 13 14 13" fill="none" stroke="#000" stroke-width="5" stroke-linejoin="round" />
  <path d="M50 12h10v8c0 8-6 13-14 13" fill="none" stroke="#000" stroke-width="5" stroke-linejoin="round" />
  <!-- cup -->
  <path d="M12 6h40v14c0 12-8 20-20 20S12 32 12 20Z" fill="var(--gold, #ffc700)" stroke="#000" stroke-width="4" stroke-linejoin="round" />
  <!-- stem + base -->
  <path d="M27 40h10v9H27Z" fill="var(--gold, #ffc700)" stroke="#000" stroke-width="4" stroke-linejoin="round" />
  <path d="M17 49h30l3 10H14Z" fill="#000" />
  <!-- highlight cut: a diagonal slash, not a gradient -->
  <path d="M20 11h7l-6 17h-4Z" fill="#fff" />
</svg>

<style>
  .trophy {
    display: inline-block;
    vertical-align: -0.12em;
    flex: none;
  }
</style>
