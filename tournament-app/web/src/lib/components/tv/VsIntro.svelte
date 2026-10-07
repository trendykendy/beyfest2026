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
  // img: the cut-out's URL ("" for the silhouette). Cut-outs face left;
  // mirror flips one that faces the other way.
  type Fighter = { name: string; kana: string; img: string; mirror?: boolean };
  let {
    p1,
    p2,
    title = "", // where the match sits, e.g. matchContext(): "Group 1, match 4 of 6"
    tier = "group", // bracket tier (view.ts tierOf), colours the title's end caps
    slow = 1, // timing multiplier: 2 = half speed (lab only)
    hold = false, // stay on the held frame instead of leaving (lab only)
    ondone,
  }: {
    p1: Fighter;
    p2: Fighter;
    title?: string;
    tier?: "wb" | "mb" | "lb" | "gf" | "group";
    slow?: number;
    hold?: boolean;
    ondone?: () => void;
  } = $props();

  // Timeline (ms at normal speed). Keep in step with the CSS delays below.
  const OUT = 4200; // banners split apart
  const END = 4800; // gone; ondone fires

  // The banners fill a band across the middle of the screen (BAND_TOP to
  // BAND_BOT), with a border on its top and bottom edges.
  const BAND_TOP = 150;
  const BAND_BOT = 930;
  const EDGE = 20; // border thickness; the bolt's glow stops inside it

  // The lightning seam, top to bottom of the band. Both banners are clipped to
  // it, so they interlock exactly. One diagonal shaped like an angular S (a ⚡):
  // down and left, a long jog back right whose corners stick out past the VS
  // burst, then down and left again at the same slope.
  const SEAM: [number, number][] = [
    [1150, BAND_TOP],
    [735, 465],
    [1195, 615],
    [780, BAND_BOT],
  ];
  const pts = SEAM.map(([x, y]) => `${x}px ${y}px`).join(", ");
  const clipRed = `polygon(0 ${BAND_TOP}px, ${pts}, 0 ${BAND_BOT}px)`;
  const clipBlue = `polygon(1920px ${BAND_TOP}px, ${pts}, 1920px ${BAND_BOT}px)`;

  const seamPath = "M" + SEAM.map(([x, y]) => `${x} ${y}`).join(" L");

  // Crackle: the seam re-drawn with small random kinks. Two variants flicker
  // against each other so the bolt looks alive.
  function crackle() {
    const out: string[] = [];
    SEAM.forEach(([x, y], i) => {
      if (i === 0) return void out.push(`M${x} ${y}`);
      const [px, py] = SEAM[i - 1];
      for (let k = 1; k <= 4; k++) {
        const t = k / 4;
        const j = k === 4 ? 0 : (Math.random() - 0.5) * 34;
        out.push(`L${(px + (x - px) * t + j).toFixed(1)} ${(py + (y - py) * t).toFixed(1)}`);
      }
    });
    return out.join(" ");
  }
  const crackles = [crackle(), crackle()];

  // Small forked bolts off the seam near each end, crackling into the band
  // (into open background, clear of the faces).
  const FORKS = [
    "M1084 200 L1030 214 L1018 252 L962 262 L936 296",
    "M1110 180 L1070 170 L1060 196",
    "M846 880 L904 870 L922 836 L980 826 L1006 792",
    "M820 905 L862 914 L872 890",
  ];

  // Impact burst behind VS: a 16-point star with uneven spikes.
  const burst = (() => {
    const out: string[] = [];
    const n = 16;
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2;
      const r = i % 2 ? 22 + (i % 3) * 3 : 46 + ((i * 7) % 5);
      out.push(`${(50 + Math.cos(a) * r).toFixed(1)}% ${(50 + Math.sin(a) * r).toFixed(1)}%`);
    }
    return `polygon(${out.join(", ")})`;
  })();

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
    <!-- p1 (left) is turned to face right; a fighter's mirror flag flips that. -->
    <div class="fighter">
      {#if f.img}
        <img class="art" class:flip={(side === "red") !== !!f.mirror} src={f.img} alt="" />
      {:else}
        <div class="art" class:flip={side === "red"}>{@render silhouette()}</div>
      {/if}
    </div>
    <div class="edge top"></div>
    <div class="edge bot"></div>
  </div>
{/snippet}

<!-- Stand-in for a fighter with no image: a launching blader in silhouette,
     facing left like the cut-outs (so it mirrors the same way), with a hard
     rim light in the banner's colour. -->
{#snippet silhouette()}
  <svg class="art silhouette" viewBox="0 0 600 400" aria-hidden="true">
    <ellipse cx="185" cy="78" rx="58" ry="64" />
    <polygon points="150,130 250,95 372,150 332,232 198,242" />
    <polygon points="172,148 218,188 132,282 96,254" />
    <circle cx="106" cy="276" r="40" />
    <polygon points="34,304 108,248 136,282 62,336" />
    <polygon points="298,108 330,136 444,88 432,60" />
    <circle cx="442" cy="72" r="27" />
    <polygon points="298,168 362,148 528,222 506,254" />
    <polygon points="276,214 332,198 478,300 446,324" />
    <!-- un-mirrored with the figure, so it always reads the right way -->
    <text class="mystery" x="185" y="112">?</text>
  </svg>
{/snippet}

<!-- Name tags sit outside the banners' clip so they can overlap the bottom
     border and the fighters. -->
{#snippet tag(side: "l" | "r", f: Fighter)}
  <div class="nametag {side}">
    {#if f.kana}<div class="kana"><span>{f.kana}</span></div>{/if}
    <div class="name" class:long={f.name.length > 10}><span>{f.name}</span></div>
  </div>
{/snippet}

<div class="vs" class:hold bind:clientWidth={w} style:--k={slow} style:--out="{OUT}ms">
  <div class="canvas" style:transform="scale({scale})">
    <div class="backdrop"></div>
    <div class="shake">
      {@render banner("red", p1, redStreaks)}
      {@render banner("blue", p2, blueStreaks)}

      <svg class="seam" viewBox="0 0 1920 1080" aria-hidden="true">
        <defs>
          <linearGradient id="vs-seam-glow" gradientUnits="userSpaceOnUse" x1="650" y1="0" x2="1280" y2="0">
            <stop offset="0" stop-color="#ff5a4a" />
            <stop offset="0.5" stop-color="#e9d8ff" />
            <stop offset="1" stop-color="#4ab8ff" />
          </linearGradient>
          <filter id="vs-blur" filterUnits="userSpaceOnUse" x="-100" y="-100" width="2120" height="1280">
            <feGaussianBlur stdDeviation="16" />
          </filter>
          <!-- The bolt and its glow stop at the inner edge of the white borders. -->
          <clipPath id="vs-band">
            <rect x="-100" y={BAND_TOP + EDGE} width="2120" height={BAND_BOT - BAND_TOP - 2 * EDGE} />
          </clipPath>
        </defs>
        <g class="bolt" clip-path="url(#vs-band)">
          <path class="glow" d={seamPath} pathLength="1" />
          <path class="mid" d={seamPath} pathLength="1" />
          <path class="crk a" d={crackles[0]} />
          <path class="crk b" d={crackles[1]} />
          <path class="core" d={seamPath} pathLength="1" />
        </g>
        <g class="forks" clip-path="url(#vs-band)">
          {#each FORKS as d}
            <path class="glow" {d} />
            <path class="core" {d} />
          {/each}
        </g>
      </svg>

      <div class="ring r1"></div>
      <div class="ring r2"></div>

      <div class="mark">
        <div class="burst" style:clip-path={burst}></div>
        <div class="burst inner" style:clip-path={burst}></div>
        {#each ["v", "s"] as c}
          <span class="ch {c}">
            <i class="ghost red-g">{c.toUpperCase()}</i>
            <i class="ghost blue-g">{c.toUpperCase()}</i>
            <b>{c.toUpperCase()}</b>
          </span>
        {/each}
      </div>

      {@render tag("l", p1)}
      {@render tag("r", p2)}

      {#if title}
        <div class="title tier-{tier}"><span>{title}</span></div>
      {/if}
    </div>
    <div class="flash"></div>
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

  /* Behind the band: the dark stage, fading in and out with the intro. */
  .backdrop {
    position: absolute;
    inset: 0;
    background:
      repeating-linear-gradient(-60deg, rgb(255 255 255 / 0.035) 0 2px, transparent 2px 16px),
      var(--field-deep);
    animation: fade-in calc(160ms * var(--k)) linear both;
  }
  .vs:not(.hold) .backdrop {
    animation:
      fade-in calc(160ms * var(--k)) linear both,
      fade-out calc(250ms * var(--k)) linear calc(var(--out) * var(--k) + 350ms * var(--k)) forwards;
  }
  @keyframes fade-in {
    from {
      opacity: 0;
    }
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

  /* The band's top and bottom borders: an ink line outside, white inside.
     Each banner carries its half, so they meet under the bolt. */
  .edge {
    position: absolute;
    left: 0;
    right: 0;
    height: 20px;
  }
  .edge.top {
    top: 150px;
    background: linear-gradient(var(--ink) 0 7px, var(--paper) 7px 100%);
  }
  .edge.bot {
    top: 910px;
    background: linear-gradient(var(--paper) 0 13px, var(--ink) 13px 100%);
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

  /* ── Slam: shake, lightning seam, shockwave, flash ─────────── */
  /* The banners land at ~430ms; the bolt strikes down the seam and everything
     hits at 450ms. */
  .shake {
    position: absolute;
    inset: 0;
    animation: shake calc(220ms * var(--k)) linear calc(450ms * var(--k));
  }
  @keyframes shake {
    0% { transform: translate(0, 0); }
    15% { transform: translate(-16px, 9px); }
    30% { transform: translate(14px, -11px); }
    45% { transform: translate(-10px, -6px); }
    60% { transform: translate(9px, 8px); }
    75% { transform: translate(-5px, 3px); }
    90% { transform: translate(3px, -2px); }
    100% { transform: translate(0, 0); }
  }

  .seam {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    pointer-events: none;
  }
  .seam path {
    fill: none;
    stroke-linejoin: miter;
    stroke-linecap: round;
  }
  .bolt .glow,
  .forks .glow {
    stroke: url(#vs-seam-glow);
    stroke-width: 80;
    filter: url(#vs-blur);
  }
  .bolt .mid {
    stroke: #d8f4ff;
    stroke-width: 22;
  }
  .bolt .core {
    stroke: #fff;
    stroke-width: 9;
  }
  /* Strike: the bolt draws top to bottom just before the slam. */
  .bolt .glow,
  .bolt .mid,
  .bolt .core {
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    animation: strike calc(130ms * var(--k)) cubic-bezier(0.5, 0, 1, 1) calc(330ms * var(--k)) forwards;
  }
  @keyframes strike {
    to {
      stroke-dashoffset: 0;
    }
  }
  /* Once struck, the bolt flickers for the rest of the intro. */
  .bolt {
    animation: bolt-flicker calc(900ms * var(--k)) steps(1) calc(600ms * var(--k)) infinite;
  }
  @keyframes bolt-flicker {
    0% { opacity: 1; }
    8% { opacity: 0.55; }
    12% { opacity: 1; }
    47% { opacity: 0.8; }
    50% { opacity: 1; }
    71% { opacity: 0.5; }
    74% { opacity: 1; }
  }
  .crk {
    stroke: #fff;
    stroke-width: 3;
    opacity: 0;
    animation: crk calc(160ms * var(--k)) steps(1) calc(470ms * var(--k)) infinite;
  }
  .crk.b {
    animation-delay: calc(550ms * var(--k));
  }
  @keyframes crk {
    0% { opacity: 0.9; }
    50% { opacity: 0; }
  }

  .forks .core {
    stroke: #fff;
    stroke-width: 4;
  }
  .forks .glow {
    stroke-width: 36;
  }
  /* Forks flash at the slam, again as VS lands, and once in the hold. */
  .forks {
    opacity: 0;
    animation: forks calc(2400ms * var(--k)) steps(1) calc(450ms * var(--k)) forwards;
  }
  @keyframes forks {
    0% { opacity: 1; }
    4% { opacity: 0; }
    6% { opacity: 1; }
    10% { opacity: 0; }
    14% { opacity: 1; }
    17% { opacity: 0; }
    82% { opacity: 1; }
    85% { opacity: 0; }
    87% { opacity: 1; }
    90%, 100% { opacity: 0; }
  }

  .ring {
    position: absolute;
    left: 965px;
    top: 540px;
    width: 300px;
    height: 300px;
    margin: -150px 0 0 -150px;
    border-radius: 50%;
    opacity: 0;
    animation: ring calc(520ms * var(--k)) cubic-bezier(0.1, 0.7, 0.3, 1) calc(450ms * var(--k)) forwards;
  }
  .r1 {
    border: 16px solid #fff;
    box-shadow:
      0 0 40px #fff,
      inset 0 0 30px #fff;
  }
  .r2 {
    border: 8px solid #cfe8ff;
    animation-delay: calc(540ms * var(--k));
  }
  @keyframes ring {
    0% {
      transform: scale(0.15);
      opacity: 1;
    }
    100% {
      transform: scale(4.2);
      opacity: 0;
    }
  }

  .flash {
    position: absolute;
    inset: 0;
    background: #fff;
    opacity: 0;
    pointer-events: none;
    animation: flash calc(340ms * var(--k)) ease-out calc(450ms * var(--k)) forwards;
  }
  @keyframes flash {
    0% {
      opacity: 0.92;
    }
    100% {
      opacity: 0;
    }
  }

  /* ── VS ─────────────────────────────────────────────────── */
  /* V then S slam down from oversize onto the seam, each with a red/blue
     ghost split that snaps together; then the mark breathes with a glow. */
  .mark {
    position: absolute;
    left: 965px;
    top: 552px;
    width: 0;
    height: 0;
  }
  .burst {
    position: absolute;
    left: -235px;
    top: -235px;
    width: 470px;
    height: 470px;
    background: radial-gradient(circle, #fff 0 30%, #ffe27a 55%, #ff9d2e 80%);
    transform: scale(0);
    animation:
      burst-in calc(300ms * var(--k)) cubic-bezier(0.2, 1.4, 0.4, 1) calc(600ms * var(--k)) forwards,
      burst-spin calc(9000ms * var(--k)) linear calc(900ms * var(--k)) infinite;
  }
  .burst.inner {
    background: var(--ink);
    transform: scale(0) rotate(11deg);
    animation:
      burst-in-inner calc(300ms * var(--k)) cubic-bezier(0.2, 1.4, 0.4, 1) calc(640ms * var(--k)) forwards,
      burst-spin-rev calc(12000ms * var(--k)) linear calc(940ms * var(--k)) infinite;
  }
  @keyframes burst-in {
    to {
      transform: scale(1);
    }
  }
  @keyframes burst-in-inner {
    to {
      transform: scale(0.8) rotate(11deg);
    }
  }
  @keyframes burst-spin {
    from {
      transform: scale(1) rotate(0deg);
    }
    to {
      transform: scale(1) rotate(360deg);
    }
  }
  @keyframes burst-spin-rev {
    from {
      transform: scale(0.8) rotate(11deg);
    }
    to {
      transform: scale(0.8) rotate(-349deg);
    }
  }

  .ch {
    position: absolute;
    font-family: var(--font-display);
    font-stretch: 85%;
    font-size: 300px;
    line-height: 1;
    opacity: 0;
    animation:
      ch-slam calc(210ms * var(--k)) cubic-bezier(0.55, 0, 1, 0.6) var(--at) forwards,
      ch-glow calc(1400ms * var(--k)) ease-in-out calc(1200ms * var(--k)) infinite alternate;
  }
  .ch i,
  .ch b {
    font: inherit;
  }
  /* The letter: metallic fill over a heavy ink outline. The italic glyphs lean
     out past their box, and a background-clip fill only paints inside the
     box (the outline doesn't care), so pad the box to cover the lean and pull
     it back with negative margins so the letter doesn't move. */
  .ch b {
    position: relative;
    display: block;
    padding: 0.1em 0.3em;
    margin: -0.1em -0.3em;
    background: linear-gradient(180deg, #fff 0%, #fff 38%, #ffe27a 58%, #ff8a1f 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    -webkit-text-stroke: 12px var(--ink);
    paint-order: stroke fill;
  }
  .ch.v {
    --at: calc(620ms * var(--k));
    --from: translate(-260px, -200px) rotate(-22deg) scale(3.4);
    left: -200px;
    top: -200px;
  }
  .ch.s {
    --at: calc(740ms * var(--k));
    --from: translate(260px, 200px) rotate(18deg) scale(3.4);
    left: -12px;
    top: -128px;
  }
  @keyframes ch-slam {
    0% {
      opacity: 0;
      transform: var(--from);
    }
    60% {
      opacity: 1;
    }
    100% {
      opacity: 1;
      transform: none;
    }
  }
  @keyframes ch-glow {
    from {
      filter: drop-shadow(0 0 10px rgb(255 255 255 / 0.6)) drop-shadow(0 0 24px rgb(255 200 80 / 0.5));
    }
    to {
      filter: drop-shadow(0 0 18px #fff) drop-shadow(0 0 48px rgb(255 200 80 / 0.9));
    }
  }
  /* Ghost split: red and blue copies behind the letter, offset either side,
     snapping in and fading just after it lands. */
  .ghost {
    position: absolute;
    left: 0;
    top: 0;
    font-style: normal;
    opacity: 0;
    animation: ghost calc(320ms * var(--k)) ease-out calc(var(--at) + 150ms * var(--k)) forwards;
  }
  .red-g {
    color: var(--red);
    --dx: -46px;
  }
  .blue-g {
    color: #1f8bff;
    --dx: 46px;
  }
  @keyframes ghost {
    0% {
      opacity: 0.95;
      transform: translateX(var(--dx));
    }
    100% {
      opacity: 0;
      transform: translateX(0);
    }
  }

  /* Leaving: the bolt and forks go with the banners. */
  .vs:not(.hold) .mark {
    animation: mark-out calc(260ms * var(--k)) cubic-bezier(0.6, 0, 0.9, 0.5) calc(var(--out) * var(--k)) forwards;
  }
  @keyframes mark-out {
    to {
      transform: scale(0);
      opacity: 0;
    }
  }
  .vs:not(.hold) .seam {
    animation: fade-out calc(200ms * var(--k)) linear calc(var(--out) * var(--k)) forwards;
  }
  @keyframes fade-out {
    to {
      opacity: 0;
    }
  }

  /* ── Match title ────────────────────────────────────────── */
  /* A slanted telop slab centred in the dark strip above the band. Its end
     caps take the bracket tier's colour (none for group games); the Grand
     final is the inverted slab, black with gold, as everywhere on the TV. */
  .title {
    position: absolute;
    left: 50%;
    top: 34px;
    translate: -50% 0;
    transform: skewX(-12deg);
    background: var(--paper);
    border: 5px solid var(--ink);
    box-shadow: 8px 8px 0 var(--ink);
    padding: 2px 44px 6px;
    font-family: var(--font-display);
    font-stretch: 75%;
    font-size: 58px;
    line-height: 1.05;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink);
    white-space: nowrap;
    animation: title-in calc(380ms * var(--k)) cubic-bezier(0.2, 0.9, 0.3, 1.1) calc(1150ms * var(--k)) both;
  }
  .title span {
    display: block;
    transform: skewX(12deg);
  }
  .title.tier-wb,
  .title.tier-mb,
  .title.tier-lb {
    border-left: 22px solid var(--cap);
    border-right: 22px solid var(--cap);
  }
  .tier-wb {
    --cap: var(--wb);
  }
  .tier-mb {
    --cap: var(--mb);
  }
  .tier-lb {
    --cap: var(--lb);
  }
  .title.tier-gf {
    background: var(--ink);
    color: var(--gold);
    border-color: var(--gold);
    box-shadow: 8px 8px 0 var(--gold);
  }
  /* Drops in from above, unfolding sideways. */
  @keyframes title-in {
    from {
      transform: translateY(-150px) skewX(-12deg) scaleX(0.3);
      opacity: 0;
    }
  }
  .vs:not(.hold) .title {
    animation:
      title-in calc(380ms * var(--k)) cubic-bezier(0.2, 0.9, 0.3, 1.1) calc(1150ms * var(--k)) both,
      title-out calc(300ms * var(--k)) cubic-bezier(0.6, 0, 0.9, 0.5) calc(var(--out) * var(--k)) forwards;
  }
  @keyframes title-out {
    to {
      transform: translateY(-160px) skewX(-12deg);
    }
  }

  /* ── Name tags ──────────────────────────────────────────── */
  /* Telop slabs at the outer bottom corner of each banner: the katakana on a
     black tag, the name on a white slab with a side-colour stripe. Both are
     slanted; the text inside is set upright again. */
  .nametag {
    position: absolute;
    bottom: 80px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-width: 760px;
  }
  .nametag.l {
    left: 70px;
    align-items: flex-start;
  }
  .nametag.r {
    right: 70px;
    align-items: flex-end;
  }
  .kana,
  .name {
    transform: skewX(-12deg);
  }
  .kana span,
  .name span {
    display: block;
    transform: skewX(12deg);
  }
  .kana {
    background: var(--ink);
    padding: 6px 26px 10px;
    font-family: var(--font-display);
    font-size: 54px;
    line-height: 1;
    letter-spacing: 0.06em;
    animation: tag-in calc(320ms * var(--k)) cubic-bezier(0.2, 0.9, 0.3, 1.15) calc(980ms * var(--k)) both;
  }
  .l .kana {
    color: #ff6b5e;
  }
  .r .kana {
    color: #5fc4ff;
  }
  .name {
    background: var(--paper);
    border: 5px solid var(--ink);
    box-shadow: 10px 10px 0 var(--ink);
    padding: 4px 40px 10px;
    font-family: var(--font-display);
    font-stretch: 85%;
    font-size: 132px;
    line-height: 1;
    text-transform: uppercase;
    color: var(--ink);
    white-space: nowrap;
    animation: tag-in calc(340ms * var(--k)) cubic-bezier(0.2, 0.9, 0.3, 1.15) calc(860ms * var(--k)) both;
  }
  .name.long {
    font-stretch: 62%;
    font-size: 110px;
  }
  .l .name {
    border-left: 26px solid var(--red);
  }
  .r .name {
    border-right: 26px solid #1f6bff;
  }
  .r .kana,
  .r .name {
    animation-name: tag-in-right;
  }
  .r .name {
    animation-delay: calc(920ms * var(--k));
  }
  .r .kana {
    animation-delay: calc(1040ms * var(--k));
  }
  /* Leaving: each tag goes with its banner. */
  .vs:not(.hold) .nametag.l {
    animation: out-left calc(450ms * var(--k)) cubic-bezier(0.6, 0, 0.9, 0.5) calc(var(--out) * var(--k)) forwards;
  }
  .vs:not(.hold) .nametag.r {
    animation: out-right calc(450ms * var(--k)) cubic-bezier(0.6, 0, 0.9, 0.5) calc(var(--out) * var(--k)) forwards;
  }
  @keyframes tag-in {
    from {
      transform: translateX(-900px) skewX(-12deg);
    }
  }
  @keyframes tag-in-right {
    from {
      transform: translateX(900px) skewX(-12deg);
    }
  }

  /* ── Fighters ───────────────────────────────────────────── */
  /* The cut-outs face left, so p1 (left side) is mirrored to face p2. They
     arrive a beat behind their banner (parallax), then push in slowly. */
  /* The cut-outs are cropped flat at the top, so they sit with that edge
     just off the top of the screen; the band below is for the names. */
  .fighter {
    position: absolute;
    top: 140px;
    width: 1200px;
    transform-origin: 50% 100%;
  }
  .fighter img {
    display: block;
    width: 100%;
  }
  /* The cut-outs are also cropped flat on the fist side, which the seam's jog
     can expose: fade that inner edge out. */
  .red .fighter {
    left: -360px;
    mask-image: linear-gradient(to left, transparent 0, #000 9%);
    animation:
      fighter-left calc(650ms * var(--k)) cubic-bezier(0.15, 0.85, 0.3, 1) both,
      push calc(3600ms * var(--k)) linear calc(650ms * var(--k)) forwards;
  }
  .art.flip {
    transform: scaleX(-1);
  }
  .silhouette {
    display: block;
    width: 100%;
    fill: #070816;
    /* a thick round-jointed outline in the same colour softens the shapes */
    stroke: #070816;
    stroke-width: 14;
    stroke-linejoin: round;
    overflow: visible;
    /* hard rim light, up and towards the seam */
    filter: drop-shadow(-7px -6px 0 var(--lite));
    transform: scale(0.86);
    transform-origin: 50% 60%;
  }
  .mystery {
    font-family: var(--font-display);
    font-size: 110px;
    text-anchor: middle;
    fill: var(--lite);
    stroke: none;
  }
  .art.flip .mystery {
    transform: scaleX(-1);
    transform-origin: 185px 78px;
  }
  .blue .fighter {
    right: -350px;
    mask-image: linear-gradient(to right, transparent 0, #000 9%);
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
