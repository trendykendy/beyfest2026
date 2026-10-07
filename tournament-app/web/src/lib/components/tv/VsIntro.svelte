<script lang="ts">
  import { onMount } from "svelte";

  // The fighter intro before a match: two half-banners (red p1, blue p2) slam
  // together on a lightning seam and VS lands on the join. EXPERIMENT: only the
  // lab page (/tv/lab/vs) shows it for now; later it plays before the stadium
  // draw on Start match.
  //
  // Everything is laid out on a fixed 1920×1080 canvas, scaled to fit, so the
  // seam's coordinates are the same at any screen size. Every duration and
  // delay in the CSS is multiplied by --k (the `slow` prop).
  type Fighter = { name: string; kana: string; img: string };
  let {
    p1,
    p2,
    slow = 1, // timing multiplier: 2 = half speed (lab only)
    hold = false, // stay on the held frame instead of leaving (lab only)
    ondone,
  }: { p1: Fighter; p2: Fighter; slow?: number; hold?: boolean; ondone?: () => void } = $props();

  // Timeline (ms at normal speed). Keep in step with the CSS delays below.
  const OUT = 4200; // banners split apart
  const END = 4800; // gone; ondone fires

  // The lightning seam, top to bottom, on the 1920×1080 canvas. Both banners
  // are clipped to it, so they interlock exactly. Two big points: one jabs
  // into the blue side, one into the red side.
  const SEAM: [number, number][] = [
    [1030, 0],
    [985, 330],
    [1080, 395],
    [955, 640],
    [845, 700],
    [935, 745],
    [895, 1080],
  ];
  const pts = SEAM.map(([x, y]) => `${x}px ${y}px`).join(", ");
  const clipRed = `polygon(0 0, ${pts}, 0 1080px)`;
  const clipBlue = `polygon(1920px 0, ${pts}, 1920px 1080px)`;

  // Light streaks racing across each banner towards the seam. Random once per
  // mount; transform-only loops.
  function streaks(n: number) {
    return Array.from({ length: n }, () => ({
      top: Math.round(Math.random() * 1080),
      len: Math.round(150 + Math.random() * 550),
      thick: Math.round(2 + Math.random() * 7),
      dur: Math.round(350 + Math.random() * 550),
      delay: -Math.round(Math.random() * 900),
      alpha: (0.35 + Math.random() * 0.65).toFixed(2),
      tint: Math.random() < 0.35, // some take the banner's light colour
    }));
  }
  const redStreaks = streaks(26);
  const blueStreaks = streaks(26);

  let w = $state(1920);
  const scale = $derived(w / 1920);

  onMount(() => {
    if (hold) return;
    const t = setTimeout(() => ondone?.(), END * slow);
    return () => clearTimeout(t);
  });
</script>

{#snippet banner(side: "red" | "blue", f: Fighter, list: ReturnType<typeof streaks>)}
  <div class="banner {side}" style:clip-path={side === "red" ? clipRed : clipBlue}>
    <div class="focus"></div>
    <div class="streaks">
      {#each list as s}
        <i
          class:tint={s.tint}
          style:top="{s.top}px"
          style:width="{s.len}px"
          style:height="{s.thick}px"
          style:opacity={s.alpha}
          style:--dur="{s.dur}ms"
          style:--delay="{s.delay}ms"
        ></i>
      {/each}
    </div>
    <div class="fighter">
      <img src={f.img} alt="" />
    </div>
  </div>
{/snippet}

<div class="vs" class:hold bind:clientWidth={w} style:--k={slow} style:--out="{OUT}ms">
  <div class="canvas" style:transform="scale({scale})">
    {@render banner("red", p1, redStreaks)}
    {@render banner("blue", p2, blueStreaks)}
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

  /* ── Banners ─────────────────────────────────────────────── */
  .banner {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }
  .red {
    --lite: #ffb199;
    background: linear-gradient(105deg, #5a0309 0%, #b5121b 45%, var(--red) 75%, #ff7a3d 100%);
    animation:
      in-left calc(450ms * var(--k)) cubic-bezier(0.2, 0.9, 0.25, 1.05) both,
      out-left calc(450ms * var(--k)) cubic-bezier(0.6, 0, 0.9, 0.5) calc(var(--out) * var(--k)) forwards;
  }
  .blue {
    --lite: #9fe6ff;
    background: linear-gradient(255deg, #020a4a 0%, #0b2fb8 45%, #1f6bff 75%, #3fd0ff 100%);
    animation:
      in-right calc(450ms * var(--k)) cubic-bezier(0.2, 0.9, 0.25, 1.05) both,
      out-right calc(450ms * var(--k)) cubic-bezier(0.6, 0, 0.9, 0.5) calc(var(--out) * var(--k)) forwards;
  }
  .hold .banner {
    animation-name: in-left;
  }
  .hold .blue {
    animation-name: in-right;
  }
  @keyframes in-left {
    0% {
      transform: translateX(-1150px) skewX(-14deg);
    }
    75% {
      transform: translateX(28px) skewX(3deg);
    }
    100% {
      transform: none;
    }
  }
  @keyframes in-right {
    0% {
      transform: translateX(1150px) skewX(-14deg);
    }
    75% {
      transform: translateX(-28px) skewX(3deg);
    }
    100% {
      transform: none;
    }
  }
  @keyframes out-left {
    to {
      transform: translateX(-1250px) skewX(-10deg);
    }
  }
  @keyframes out-right {
    to {
      transform: translateX(1250px) skewX(-10deg);
    }
  }

  /* Manga focus lines (集中線) radiating from behind the fighter, flickering
     between a few angles like hand-drawn frames. */
  .focus {
    position: absolute;
    width: 2400px;
    height: 2400px;
    top: -660px;
    background: repeating-conic-gradient(rgb(255 255 255 / 0.13) 0deg 1.2deg, transparent 1.2deg 6deg);
    mask-image: radial-gradient(circle, transparent 0 260px, #000 520px);
    animation: focus-flicker calc(240ms * var(--k)) steps(1) infinite;
  }
  .red .focus {
    left: -720px;
  }
  .blue .focus {
    left: 240px;
  }
  @keyframes focus-flicker {
    0% {
      transform: rotate(0deg);
    }
    33% {
      transform: rotate(2.1deg);
    }
    66% {
      transform: rotate(4.3deg);
    }
  }

  /* Streaks: a slight downhill tilt reads as speed. */
  .streaks {
    position: absolute;
    inset: -200px;
    transform: rotate(-7deg);
  }
  .streaks i {
    position: absolute;
    left: 0;
    border-radius: 99px;
    animation: streak-in calc(var(--dur) * var(--k)) linear calc(var(--delay) * var(--k)) infinite;
  }
  .red .streaks i {
    background: linear-gradient(90deg, transparent, #fff);
  }
  .blue .streaks i {
    background: linear-gradient(270deg, transparent, #fff);
    animation-name: streak-in-rev;
  }
  .red .streaks i.tint {
    background: linear-gradient(90deg, transparent, var(--lite));
  }
  .blue .streaks i.tint {
    background: linear-gradient(270deg, transparent, var(--lite));
  }
  @keyframes streak-in {
    from {
      transform: translateX(-800px);
    }
    to {
      transform: translateX(2400px);
    }
  }
  @keyframes streak-in-rev {
    from {
      transform: translateX(2400px);
    }
    to {
      transform: translateX(-800px);
    }
  }

  /* ── Fighters ───────────────────────────────────────────── */
  /* The cut-outs face left, so p1 (left side) is mirrored to face p2. They
     arrive a beat behind their banner (parallax), then push in slowly. */
  .fighter {
    position: absolute;
    bottom: 50px;
    width: 1320px;
  }
  /* The cut-outs are cropped flat at the top: fade that edge out. */
  .fighter img {
    display: block;
    width: 100%;
    mask-image: linear-gradient(to bottom, transparent 0, #000 9%);
  }
  .red .fighter {
    left: -290px;
    animation:
      fighter-left calc(650ms * var(--k)) cubic-bezier(0.15, 0.85, 0.3, 1) both,
      push calc(3600ms * var(--k)) linear calc(650ms * var(--k)) forwards;
  }
  .red .fighter img {
    transform: scaleX(-1);
  }
  .blue .fighter {
    right: -290px;
    animation:
      fighter-right calc(650ms * var(--k)) cubic-bezier(0.15, 0.85, 0.3, 1) both,
      push calc(3600ms * var(--k)) linear calc(650ms * var(--k)) forwards;
  }
  @keyframes fighter-left {
    from {
      transform: translateX(-420px);
    }
  }
  @keyframes fighter-right {
    from {
      transform: translateX(420px);
    }
  }
  @keyframes push {
    to {
      transform: scale(1.06);
    }
  }
</style>
