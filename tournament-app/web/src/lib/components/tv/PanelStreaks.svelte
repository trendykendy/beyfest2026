<script lang="ts">
  // Motion for a battle royale fighter panel, as the VS and winner banners
  // have: light streaks racing across it (towards the middle of the screen,
  // `rev` for the right half) and the band's ink-and-white top and bottom
  // edges. Goes in the panel's upright content, over the picture and under
  // the name tag; the panel clips it.
  // --k (the timing multiplier) is inherited from the screen.
  let { rev = false, lite = false }: { rev?: boolean; lite?: boolean } = $props();

  // Random once per mount; transform-only loops.
  // svelte-ignore state_referenced_locally
  const streaks = Array.from({ length: lite ? 4 : 9 }, () => ({
    top: Math.round(Math.random() * 100),
    len: Math.round(120 + Math.random() * 300),
    thick: Math.round(2 + Math.random() * 5),
    dur: Math.round(400 + Math.random() * 500),
    delay: -Math.round(Math.random() * 900),
    alpha: (0.3 + Math.random() * 0.45).toFixed(2),
  }));
</script>

<div class="ps" class:rev>
  {#each streaks as s}
    <i
      style:top="{s.top}%"
      style:width="{s.len}px"
      style:height="{s.thick}px"
      style:opacity={s.alpha}
      style:--dur="{s.dur}ms"
      style:--delay="{s.delay}ms"
    ></i>
  {/each}
</div>
<div class="edge top"></div>
<div class="edge bot"></div>

<style>
  .ps {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .ps i {
    position: absolute;
    left: 0;
    border-radius: 99px;
    background: linear-gradient(90deg, transparent, #fff);
    animation: streak calc(var(--dur) * var(--k)) linear calc(var(--delay) * var(--k)) infinite;
  }
  .rev i {
    animation-name: streak-rev;
    background: linear-gradient(270deg, transparent, #fff);
  }
  @keyframes streak {
    from {
      transform: translateX(-500px);
    }
    to {
      transform: translateX(900px);
    }
  }
  @keyframes streak-rev {
    from {
      transform: translateX(900px);
    }
    to {
      transform: translateX(-500px);
    }
  }
  /* The band's borders, as in the VS intro: ink outside, white inside. */
  .edge {
    position: absolute;
    left: 0;
    right: 0;
    height: 20px;
    z-index: 1;
  }
  .edge.top {
    top: 0;
    background: linear-gradient(var(--ink) 0 7px, var(--paper) 7px 100%);
  }
  .edge.bot {
    bottom: 0;
    background: linear-gradient(var(--paper) 0 13px, var(--ink) 13px 100%);
  }
  @media (prefers-reduced-motion: reduce) {
    .ps {
      display: none;
    }
  }
</style>
