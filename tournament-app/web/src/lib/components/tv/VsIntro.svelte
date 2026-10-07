<script lang="ts">
  import { onMount } from "svelte";

  // The fighter intro before a match: two half-banners (red p1, blue p2) slam
  // together on a lightning seam and VS lands on the join. EXPERIMENT: only the
  // lab page (/tv/lab/vs) shows it for now; later it plays before the stadium
  // draw on Start match.
  //
  // Everything is laid out on a fixed 1920×1080 canvas, scaled to fit, so the
  // seam's coordinates are the same at any screen size.
  type Fighter = { name: string; kana: string; img: string };
  let {
    p1,
    p2,
    slow = 1, // timing multiplier: 2 = half speed (lab only)
    hold = false, // stay on the held frame instead of leaving (lab only)
    ondone,
  }: { p1: Fighter; p2: Fighter; slow?: number; hold?: boolean; ondone?: () => void } = $props();

  // Timeline (ms at normal speed).
  const OUT = 4200; // banners split apart
  const END = 4800; // gone; ondone fires

  let w = $state(1920);
  const scale = $derived(w / 1920);

  onMount(() => {
    if (hold) return;
    const t = setTimeout(() => ondone?.(), END * slow);
    return () => clearTimeout(t);
  });
</script>

<div class="vs" bind:clientWidth={w} style:--k={slow}>
  <div class="canvas" style:transform="scale({scale})">
    <!-- banners, seam, VS and names go here -->
  </div>
</div>

<style>
  .vs {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }
  .canvas {
    position: absolute;
    left: 0;
    top: 0;
    width: 1920px;
    height: 1080px;
    transform-origin: 0 0;
  }
</style>
