<script lang="ts">
  import { onMount } from "svelte";
  import { artFor, facePan, type Face } from "$lib/fighters";
  import FighterSilhouette from "./FighterSilhouette.svelte";
  import RoyaleBackdrop from "./RoyaleBackdrop.svelte";
  import SlamBurst from "./SlamBurst.svelte";
  import PanelStreaks from "./PanelStreaks.svelte";

  // The battle royale's intro, in the VS intro's style, for 2–8 fighters at
  // once: "BATTLE ROYALE" slams down with the battle's name (Heat 1, Sudden
  // death, Final), then everyone in it drops in, a slanted panel each, from
  // alternate sides. It holds while the announcer talks, then clears.
  //
  // Same conventions as VsIntro: a fixed 1920×1080 canvas scaled to fit;
  // every time is `calc(Nms * var(--k))`, so `slow` stretches it (lab only);
  // `lite` drops the blur and drop-shadow filters for the Pi.
  // img: the cut-out's URL ("" for the silhouette). Cut-outs face left, so
  // the left half turn to face the middle; mirror flips one the other way.
  // face: where the face is in the cut-out; it's slid sideways so the face
  // sits in the middle of its narrow panel.
  type Fighter = { name: string; kana: string; img: string; imgMirrored?: string; mirror?: boolean; face?: Face | null };
  let {
    fighters,
    label = "",
    slow = 1,
    hold = false, // lab only: stay on the last frame
    lite = false,
    out = 4200, // ms: when it starts to clear (later while the announcer talks)
    ondone,
  }: {
    fighters: Fighter[];
    label?: string;
    slow?: number;
    hold?: boolean;
    lite?: boolean;
    out?: number;
    ondone?: () => void;
  } = $props();

  // Timeline (ms):
  //    0  backdrop · 150 "BATTLE ROYALE" slams, flash · 450 the label
  //  550+ a panel every 110 ms, alternating top and bottom
  //  out  everything clears; out+600 ondone
  const STEP = 110;
  // svelte-ignore state_referenced_locally
  const OUT = out;
  const END = OUT + 600;

  // Panel colours, round the arena.
  const COLOURS = ["#e63329", "#1f6fff", "#19b25a", "#ffc700", "#9b4dff", "#ff7a1a", "#00b8d4", "#ff4fa3"];
  const n = $derived(fighters.length);
  // Narrower panels get smaller names.
  const nameSize = $derived(n <= 3 ? 72 : n <= 4 ? 60 : n <= 5 ? 46 : n <= 6 ? 40 : 30);

  let w = $state(1920);
  const scale = $derived(w / 1920);

  onMount(() => {
    if (hold) return;
    const t = setTimeout(() => ondone?.(), END * slow);
    return () => clearTimeout(t);
  });
</script>

<div class="br" class:hold class:lite bind:clientWidth={w} style:--k={slow} style:--out="{OUT}ms" style:--n={n}>
  <div class="canvas" style:transform="scale({scale})">
    <!-- The winner screen's dressing: pinstripes, rays behind the title, the
         slam's rings and shards, streaks across the panels. -->
    <RoyaleBackdrop rayY={164} outAt={hold ? null : OUT} {lite} />
    <div class="shake">
      <div class="panels">
        {#each fighters as f, i (i)}
          <div
            class="panel"
            class:up={i % 2 === 0}
            style:--i={i}
            style:--c={COLOURS[i % COLOURS.length]}
            style:--name-size="{nameSize}px"
          >
            <div class="panel-in">
              <div class="pic">
                {#if f.img}
                  {@const flip = (i < n / 2) !== !!f.mirror}
                  {@const art = artFor(f, flip)}
                  <img
                    src={art.src}
                    alt=""
                    style:transform="translateX({facePan(f.face ?? null, flip)}%){art.flip ? ' scaleX(-1)' : ''}"
                  />
                {:else}
                  <div class="sil"><FighterSilhouette flip={i < n / 2} /></div>
                {/if}
              </div>
              <!-- Over the picture, under the name tag, as on the winner's banner. -->
              <PanelStreaks rev={i >= n / 2} {lite} />
              <div class="tag">
                {#if f.kana}<div class="kana" lang="ja">{f.kana}</div>{/if}
                <div class="name"><span>{f.name}</span></div>
              </div>
            </div>
          </div>
        {/each}
      </div>

      <SlamBurst y={164} {lite} />
      <div class="mark">
        <div class="mark-kana" lang="ja">バトルロイヤル</div>
        <div class="words">
          <span class="ghost g1" aria-hidden="true">Battle royale</span>
          <span class="ghost g2" aria-hidden="true">Battle royale</span>
          <span class="main">Battle royale</span>
        </div>
        {#if label}<div class="label"><span>{label}</span></div>{/if}
      </div>
    </div>
    <div class="flash"></div>
  </div>
</div>

<style>
  .br {
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
  .shake {
    position: absolute;
    inset: 0;
    animation: shake calc(380ms * var(--k)) ease-out calc(150ms * var(--k)) both;
  }

  /* ── Fighter panels ── */
  /* Inset so the slant (about 60px either way at the corners) keeps the end
     panels' name tags on screen. */
  .panels {
    position: absolute;
    left: 66px;
    right: 66px;
    top: 300px;
    height: 740px;
    display: flex;
  }
  .panel {
    flex: 1;
    position: relative;
    margin-left: -6px; /* overlapping, so the slants meet */
    transform: skewX(-9deg);
    background: linear-gradient(180deg, color-mix(in srgb, var(--c) 70%, #000) 0%, var(--c) 55%, color-mix(in srgb, var(--c) 60%, #000) 100%);
    border-left: 8px solid var(--ink);
    border-right: 8px solid var(--ink);
    overflow: hidden;
    animation:
      drop-down calc(320ms * var(--k)) cubic-bezier(0.2, 0.9, 0.3, 1.15) calc((550ms + var(--i) * 110ms) * var(--k)) both,
      leave-down calc(380ms * var(--k)) ease-in calc((var(--out) + var(--i) * 40ms) * var(--k)) forwards;
  }
  .panel.up {
    animation:
      drop-up calc(320ms * var(--k)) cubic-bezier(0.2, 0.9, 0.3, 1.15) calc((550ms + var(--i) * 110ms) * var(--k)) both,
      leave-up calc(380ms * var(--k)) ease-in calc((var(--out) + var(--i) * 40ms) * var(--k)) forwards;
  }
  /* Content stands upright inside the slanted panel. */
  .panel-in {
    position: absolute;
    inset: 0 -60px;
    transform: skewX(9deg);
  }
  .pic {
    position: absolute;
    left: 0;
    right: 0;
    top: 10px;
    bottom: 120px;
    display: flex;
    justify-content: center;
    align-items: flex-end;
  }
  .pic img {
    height: 100%;
    width: auto;
    max-width: none;
    filter: drop-shadow(0 10px 0 rgb(0 0 0 / 0.35));
  }
  .sil {
    height: 80%;
    aspect-ratio: 3 / 4;
    --lite: color-mix(in srgb, var(--c) 40%, #fff);
  }
  /* Down here the slant has moved the panel about 47px left (tan 9° × its
     distance below the middle), so the tag moves with it. */
  .tag {
    position: absolute;
    left: 23px;
    right: 117px;
    bottom: 26px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .kana {
    font-family: var(--font-display);
    font-size: calc(var(--name-size) * 0.45);
    color: var(--c);
    background: var(--ink);
    padding: 2px 12px;
    line-height: 1.2;
    white-space: nowrap;
    max-width: 100%;
    overflow: hidden;
  }
  .name {
    max-width: 100%;
    background: var(--paper);
    color: var(--ink);
    border: 5px solid var(--ink);
    box-shadow: 6px 6px 0 var(--ink);
    padding: 2px 14px 4px;
  }
  /* Long names wrap onto a second line rather than being cut short. */
  .name span {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    font-family: var(--font-display);
    font-size: var(--name-size);
    line-height: 1.02;
    text-align: center;
    text-transform: uppercase;
    overflow-wrap: anywhere;
    padding-right: 0.12em; /* italic overhang */
  }

  /* ── BATTLE ROYALE ── */
  .mark {
    position: absolute;
    left: 0;
    right: 0;
    top: 34px;
    display: flex;
    flex-direction: column;
    align-items: center;
    animation: mark-out calc(320ms * var(--k)) ease-in calc(var(--out) * var(--k)) forwards;
  }
  .mark-kana {
    font-family: var(--font-display);
    font-size: 34px;
    letter-spacing: 0.3em;
    color: var(--gold);
    animation: fade-in calc(250ms * var(--k)) ease-out calc(300ms * var(--k)) both;
  }
  .words {
    position: relative;
    font-family: var(--font-display);
    font-size: 168px;
    line-height: 0.95;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .words span {
    display: block;
    padding-right: 0.08em;
  }
  /* WINNER's metallic fill over a heavy ink outline, then its glow pulse
     while it holds. Padded so the background-clip fill covers the italic
     lean (see VsIntro). */
  .words .main {
    position: relative;
    padding: 0.1em 0.12em;
    margin: -0.1em -0.12em;
    background: linear-gradient(180deg, #fff 0%, #fff 36%, #ffe27a 56%, #ff8a1f 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    -webkit-text-stroke: 10px var(--ink);
    paint-order: stroke fill;
    filter: drop-shadow(8px 8px 0 var(--ink));
    animation:
      slam calc(300ms * var(--k)) cubic-bezier(0.2, 0.9, 0.3, 1.2) calc(150ms * var(--k)) both,
      glow calc(1300ms * var(--k)) ease-in-out calc(1200ms * var(--k)) infinite alternate;
  }
  @keyframes glow {
    from {
      filter: drop-shadow(8px 8px 0 var(--ink)) drop-shadow(0 0 10px rgb(255 255 255 / 0.5)) drop-shadow(0 0 22px rgb(255 200 80 / 0.4));
    }
    to {
      filter: drop-shadow(8px 8px 0 var(--ink)) drop-shadow(0 0 18px #fff) drop-shadow(0 0 44px rgb(255 200 80 / 0.9));
    }
  }
  .ghost {
    position: absolute;
    inset: 0;
    -webkit-text-stroke: 0;
    opacity: 0;
  }
  .g1 {
    color: var(--red);
    animation: ghost-l calc(500ms * var(--k)) ease-out calc(200ms * var(--k)) both;
  }
  .g2 {
    color: #1f6fff;
    animation: ghost-r calc(500ms * var(--k)) ease-out calc(200ms * var(--k)) both;
  }
  .label {
    margin-top: 6px;
    background: var(--ink);
    border: 4px solid var(--gold);
    padding: 4px 34px 8px;
    transform: skewX(-10deg);
    animation: label-in calc(260ms * var(--k)) cubic-bezier(0.2, 0.9, 0.3, 1.2) calc(450ms * var(--k)) both;
  }
  .label span {
    display: block;
    transform: skewX(10deg);
    font-family: var(--font-display);
    font-size: 54px;
    line-height: 1;
    text-transform: uppercase;
    color: var(--paper);
    padding-right: 0.1em;
  }

  .flash {
    position: absolute;
    inset: 0;
    background: #fff;
    opacity: 0;
    pointer-events: none;
    animation: flash calc(260ms * var(--k)) ease-out calc(150ms * var(--k)) both;
  }

  /* Pi-safe: no filters, so no glow either. */
  .lite .main,
  .lite .pic img {
    filter: none;
  }
  .lite .main {
    animation: slam calc(300ms * var(--k)) cubic-bezier(0.2, 0.9, 0.3, 1.2) calc(150ms * var(--k)) both;
  }
  .hold .panel,
  .hold .mark {
    animation-delay: 0s !important;
  }
  .hold .panel,
  .hold .panel.up {
    animation: none;
  }
  .hold .mark {
    animation: none;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
  }
  @keyframes fade-out {
    to {
      opacity: 0;
    }
  }
  @keyframes shake {
    0%,
    100% {
      transform: none;
    }
    20% {
      transform: translate(-14px, 8px);
    }
    40% {
      transform: translate(12px, -6px);
    }
    60% {
      transform: translate(-7px, 4px);
    }
    80% {
      transform: translate(4px, -2px);
    }
  }
  @keyframes drop-down {
    from {
      transform: skewX(-9deg) translateY(-110%);
    }
  }
  @keyframes drop-up {
    from {
      transform: skewX(-9deg) translateY(110%);
    }
  }
  @keyframes leave-down {
    to {
      transform: skewX(-9deg) translateY(115%);
    }
  }
  @keyframes leave-up {
    to {
      transform: skewX(-9deg) translateY(-115%);
    }
  }
  @keyframes slam {
    from {
      transform: scale(2.4);
      opacity: 0;
    }
    60% {
      opacity: 1;
    }
  }
  @keyframes ghost-l {
    0% {
      opacity: 0.9;
      transform: translateX(-60px);
    }
    100% {
      opacity: 0;
      transform: translateX(-14px);
    }
  }
  @keyframes ghost-r {
    0% {
      opacity: 0.9;
      transform: translateX(60px);
    }
    100% {
      opacity: 0;
      transform: translateX(14px);
    }
  }
  @keyframes label-in {
    from {
      transform: skewX(-10deg) translateY(-30px) scale(0.6);
      opacity: 0;
    }
  }
  @keyframes mark-out {
    to {
      transform: translateY(-120%);
      opacity: 0;
    }
  }
  @keyframes flash {
    0% {
      opacity: 0.85;
    }
    100% {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .br * {
      animation-duration: 1ms !important;
    }
  }
</style>
