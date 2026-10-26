<script lang="ts">
  import { facePan, type Face } from "$lib/fighters";
  import FighterSilhouette from "./FighterSilhouette.svelte";

  // The battle royale's Qualified screen, after a heat or the sudden death:
  // the battle's name, 予選突破 / QUALIFIED slamming down, then everyone it
  // sends through to the final drops in, a slanted panel each (RoyaleIntro's
  // look). A heat whose runner-up goes to the sudden death says so in a strip
  // along the bottom. The call ("[A] and [B]… qualified!") starts as the
  // panels land (QUALIFIED_CALL in sounds.ts). It then holds until `leaving`
  // is set, plays its exit, and calls ondone.
  //
  // Same conventions as RoyaleIntro: a fixed 1920×1080 canvas scaled to fit;
  // every time is `calc(Nms * var(--k))`, so `slow` stretches it (lab only);
  // `lite` drops the drop-shadow filters for the Pi.
  // face: where the face is in the cut-out; it's slid sideways so the face
  // sits in the middle of its narrow panel.
  type Fighter = { name: string; kana: string; img: string; mirror?: boolean; face?: Face | null };
  let {
    fighters,
    label = "", // "Heat 1", "Sudden death"
    toSudden = "", // a heat's runner-up who goes to the sudden death
    slow = 1,
    lite = false,
    leaving = false, // set to play the exit; ondone fires when it's over
    ondone,
  }: {
    fighters: Fighter[];
    label?: string;
    toSudden?: string;
    slow?: number;
    lite?: boolean;
    leaving?: boolean;
    ondone?: () => void;
  } = $props();

  // Timeline (ms at normal speed). Keep in step with the CSS delays below:
  //    0  backdrop, the label · 150 QUALIFIED slams, flash
  //  550+ a panel every 110 ms · then the sudden death strip
  //   then it holds until `leaving`; the exit takes EXIT ms.
  const EXIT = 600;

  // Panel colours, as the intro's.
  const COLOURS = ["#e63329", "#1f6fff", "#19b25a", "#ffc700", "#9b4dff", "#ff7a1a", "#00b8d4", "#ff4fa3"];
  const n = $derived(fighters.length);
  // Narrower panels get smaller names.
  const nameSize = $derived(n <= 2 ? 72 : n <= 3 ? 64 : n <= 4 ? 56 : 40);

  let w = $state(1920);
  const scale = $derived(w / 1920);

  $effect(() => {
    if (!leaving) return;
    const t = setTimeout(() => ondone?.(), EXIT * slow);
    return () => clearTimeout(t);
  });
</script>

<div class="q" class:leaving class:lite class:with-strip={!!toSudden} bind:clientWidth={w} style:--k={slow} style:--n={n}>
  <div class="canvas" style:transform="scale({scale})">
    <div class="backdrop"></div>
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
                  <!-- Cut-outs face left: the left half turn to face the middle. -->
                  <img
                    src={f.img}
                    alt=""
                    style:transform="translateX({facePan(f.face ?? null, flip)}%){flip ? ' scaleX(-1)' : ''}"
                  />
                {:else}
                  <div class="sil"><FighterSilhouette flip={i < n / 2} /></div>
                {/if}
              </div>
              <div class="tag">
                {#if f.kana}<div class="kana" lang="ja">{f.kana}</div>{/if}
                <div class="name"><span>{f.name}</span></div>
              </div>
            </div>
          </div>
        {/each}
      </div>

      <div class="mark">
        {#if label}<div class="label"><span>Battle royale · {label}</span></div>{/if}
        <div class="mark-kana" lang="ja">予選突破</div>
        <div class="words">
          <span class="ghost g1" aria-hidden="true">Qualified</span>
          <span class="ghost g2" aria-hidden="true">Qualified</span>
          <span class="main">Qualified</span>
        </div>
      </div>

      {#if toSudden}
        <div class="strip"><span><b>{toSudden}</b> → sudden death</span></div>
      {/if}
    </div>
    <div class="flash"></div>
  </div>
</div>

<style>
  .q {
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
  .backdrop {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 60% 45% at 50% 18%, rgb(255 199 0 / 0.28), transparent 70%),
      var(--field-deep);
    animation: fade-in calc(200ms * var(--k)) ease-out both;
  }
  .shake {
    position: absolute;
    inset: 0;
    animation: shake calc(380ms * var(--k)) ease-out calc(150ms * var(--k)) both;
  }

  /* ── Fighter panels: centred, each at most 520px wide ── */
  .panels {
    position: absolute;
    left: 66px;
    right: 66px;
    top: 330px;
    bottom: 30px;
    display: flex;
    justify-content: center;
  }
  .with-strip .panels {
    bottom: 130px;
  }
  .panel {
    flex: 0 1 520px;
    position: relative;
    margin-left: -6px; /* overlapping, so the slants meet */
    transform: skewX(-9deg);
    background: linear-gradient(180deg, color-mix(in srgb, var(--c) 70%, #000) 0%, var(--c) 55%, color-mix(in srgb, var(--c) 60%, #000) 100%);
    border-left: 8px solid var(--ink);
    border-right: 8px solid var(--ink);
    overflow: hidden;
    animation: drop-down calc(320ms * var(--k)) cubic-bezier(0.2, 0.9, 0.3, 1.15) calc((550ms + var(--i) * 110ms) * var(--k)) both;
  }
  .panel.up {
    animation-name: drop-up;
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
  /* Down here the slant has moved the panel left, so the tag moves with it. */
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

  /* ── The label, 予選突破 / QUALIFIED ── */
  .mark {
    position: absolute;
    left: 0;
    right: 0;
    top: 28px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .label {
    background: var(--ink);
    border: 4px solid var(--gold);
    padding: 4px 34px 8px;
    transform: skewX(-10deg);
    animation: fade-in calc(200ms * var(--k)) ease-out both;
  }
  .label span {
    display: block;
    transform: skewX(10deg);
    font-family: var(--font-display);
    font-size: 44px;
    line-height: 1;
    text-transform: uppercase;
    color: var(--paper);
    padding-right: 0.1em;
  }
  .mark-kana {
    margin-top: 12px;
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
  .main {
    position: relative;
    color: var(--gold);
    -webkit-text-stroke: 6px var(--ink);
    paint-order: stroke fill;
    filter: drop-shadow(8px 8px 0 var(--ink));
    animation: slam calc(300ms * var(--k)) cubic-bezier(0.2, 0.9, 0.3, 1.2) calc(150ms * var(--k)) both;
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

  /* ── "TADHG → SUDDEN DEATH", along the bottom ── */
  .strip {
    position: absolute;
    left: 50%;
    bottom: 34px;
    translate: -50% 0;
    max-width: 1500px;
    background: var(--ink);
    border: 4px solid var(--red);
    padding: 6px 40px 10px;
    transform: skewX(-10deg);
    animation: strip-in calc(300ms * var(--k)) cubic-bezier(0.2, 0.9, 0.3, 1.2) calc((800ms + var(--n) * 110ms) * var(--k)) both;
  }
  .strip span {
    display: block;
    transform: skewX(10deg);
    font-family: var(--font-display);
    font-size: 52px;
    line-height: 1;
    text-transform: uppercase;
    color: rgb(255 255 255 / 0.7);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: 0.1em;
  }
  .strip b {
    font-weight: inherit;
    color: var(--paper);
  }

  .flash {
    position: absolute;
    inset: 0;
    background: #fff;
    opacity: 0;
    pointer-events: none;
    animation: flash calc(260ms * var(--k)) ease-out calc(150ms * var(--k)) both;
  }

  /* ── Exit (the next battle starting, or time up) ── */
  .leaving .panel {
    animation: leave-down calc(380ms * var(--k)) ease-in calc(var(--i) * 40ms * var(--k)) both;
  }
  .leaving .panel.up {
    animation-name: leave-up;
  }
  .leaving .mark {
    animation: mark-out calc(320ms * var(--k)) ease-in both;
  }
  .leaving .strip {
    animation: fade-out calc(250ms * var(--k)) ease-in both;
  }
  .leaving .backdrop {
    animation: fade-out calc(300ms * var(--k)) ease-in calc(300ms * var(--k)) both;
  }

  /* Pi-safe: no filters. */
  .lite .main,
  .lite .pic img {
    filter: none;
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
  @keyframes strip-in {
    from {
      transform: skewX(-10deg) translateY(60px);
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
    .q * {
      animation-duration: 1ms !important;
    }
  }
</style>
