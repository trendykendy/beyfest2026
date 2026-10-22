<script lang="ts">
  // The champion's crest: a gold bey with a crown, in a laurel wreath
  // (static/trophy.webp). An image rather than the 🏆 emoji, which has no
  // colour-emoji font to render with on Raspberry Pi OS and looked different on
  // every other machine. `size` sets the width; the crest is a little wider
  // than it is tall.
  let { size = "1em", label = "" }: { size?: string; label?: string } = $props();
</script>

<img
  class="trophy"
  src="/trophy.webp"
  alt={label}
  aria-hidden={label ? undefined : "true"}
  style:width={size}
  draggable="false"
/>

<style>
  .trophy {
    display: inline-block;
    height: auto;
    vertical-align: -0.12em;
    flex: none;
  }
</style>
