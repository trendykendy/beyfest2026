<script lang="ts">
  // The winner screen's slam, for the battle royale titles: a white ring and
  // a gold one blasting outwards, and gold shards flying off, from (x, y) at
  // `at` ms. Sits inside a 1920×1080 canvas whose --k is the timing multiplier.
  let { x = 960, y = 200, at = 150, lite = false }: { x?: number; y?: number; at?: number; lite?: boolean } = $props();

  const SHARD_COLOURS = ["var(--gold)", "var(--gold)", "var(--paper)", "#ffe27a", "#ff7a1a"];
  // Random once per mount. Flatter than the winner's: the title is wide.
  // svelte-ignore state_referenced_locally
  const shards = Array.from({ length: lite ? 12 : 30 }, (_, i) => {
    const a = Math.random() * Math.PI * 2;
    const r = 420 + Math.random() * 600;
    return {
      w: Math.round(12 + Math.random() * 22),
      h: Math.round(6 + Math.random() * 12),
      colour: SHARD_COLOURS[i % SHARD_COLOURS.length],
      dx: Math.round(Math.cos(a) * r),
      dy: Math.round(Math.sin(a) * r * 0.5),
      rot: Math.round((Math.random() - 0.5) * 1080),
      dur: Math.round(700 + Math.random() * 700),
    };
  });
</script>

<div class="sb" class:lite style:left="{x}px" style:top="{y}px" style:--at="{at}ms">
  <div class="ring r1"></div>
  <div class="ring r2"></div>
  {#each shards as s}
    <i
      style:--w="{s.w}px"
      style:--h="{s.h}px"
      style:--col={s.colour}
      style:--dx="{s.dx}px"
      style:--dy="{s.dy}px"
      style:--rot="{s.rot}deg"
      style:--dur="{s.dur}ms"
    ></i>
  {/each}
</div>

<style>
  .sb {
    position: absolute;
    width: 0;
    height: 0;
    pointer-events: none;
  }
  .ring {
    position: absolute;
    left: -150px;
    top: -150px;
    width: 300px;
    height: 300px;
    border-radius: 50%;
    opacity: 0;
    animation: ring calc(560ms * var(--k)) cubic-bezier(0.1, 0.7, 0.3, 1) calc(var(--at) * var(--k)) forwards;
  }
  .r1 {
    border: 16px solid #fff;
    box-shadow:
      0 0 40px #fff,
      inset 0 0 30px #fff;
  }
  .r2 {
    border: 10px solid var(--gold);
    animation-delay: calc((var(--at) + 110ms) * var(--k));
  }
  i {
    position: absolute;
    left: 0;
    top: 0;
    width: var(--w);
    height: var(--h);
    background: var(--col);
    opacity: 0;
    animation: shard calc(var(--dur) * var(--k)) cubic-bezier(0.1, 0.8, 0.3, 1) calc(var(--at) * var(--k)) forwards;
  }
  .lite .r1 {
    box-shadow: none;
  }
  @keyframes ring {
    0% {
      transform: scale(0.15);
      opacity: 1;
    }
    100% {
      transform: scale(5);
      opacity: 0;
    }
  }
  @keyframes shard {
    0% {
      opacity: 1;
      transform: translate(0, 0) rotate(0deg);
    }
    70% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translate(var(--dx), var(--dy)) rotate(var(--rot));
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .sb {
      display: none;
    }
  }
</style>
