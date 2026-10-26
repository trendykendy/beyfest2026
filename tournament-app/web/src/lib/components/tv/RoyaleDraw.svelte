<script lang="ts">
  import { onMount } from "svelte";
  import { faceCrop, type Face } from "$lib/fighters";
  import FighterSilhouette from "./FighterSilhouette.svelte";

  // The battle royale draw, shown when the heats are generated: a bey seen
  // from above. "BATTLE ROYALE" slams into the gold hub, a wheel with a wedge
  // for every blader spins in and stops, then heat by heat a ring segment
  // sweeps round the rim, that heat's wedges flash into its colour and the
  // sector pops out. The plan fills the sides, it holds, then clears.
  //
  // Same conventions as RoyaleIntro: a fixed 1920×1080 canvas scaled to fit;
  // every time is `calc(Nms * var(--k))`, so `slow` stretches it (lab only);
  // `lite` drops the filters. `hold` (lab only) never clears.
  // fighters: in drawn order, so each heat is a run of neighbouring wedges.
  // heats: heat sizes (royale.ts planRoyale); empty means one battle, the final.
  type Fighter = { name: string; kana: string; img: string; face?: Face | null };
  let {
    fighters,
    heats = [],
    finalSize = 0,
    sudden = 0,
    slow = 1,
    hold = false,
    lite = false,
    ondone,
  }: {
    fighters: Fighter[];
    heats?: number[];
    finalSize?: number;
    sudden?: number;
    slow?: number;
    hold?: boolean;
    lite?: boolean;
    ondone?: () => void;
  } = $props();

  // Timeline (ms):
  //    0  backdrop · 150 "BATTLE ROYALE" slams into the hub, flash
  //  250  the wheel grows in and spins, stopping at SPIN_END
  //  REVEAL + i × STEP  heat i: ring, colour, pop
  //  INFO  the sides fill in · OUT clears · OUT+600 ondone
  const SPIN_AT = 250;
  const SPIN = 2600;
  const REVEAL = SPIN_AT + SPIN + 200;
  const STEP = 650;
  // svelte-ignore state_referenced_locally
  const GROUPS = heats.length || 1;
  const INFO = REVEAL + GROUPS * STEP + 200;
  const OUT = INFO + 3000;
  const END = OUT + 600;

  // Heat colours, as RoyaleIntro's panels.
  const COLOURS = ["#e63329", "#1f6fff", "#19b25a", "#ffc700", "#9b4dff", "#ff7a1a", "#00b8d4", "#ff4fa3"];

  // Wheel geometry, in the wheel's own 940×940 box. Angles in degrees,
  // 0 at the top, clockwise.
  const C = 470;
  const HUB = 132; // gold hub
  const IN = 148; // wedges start
  const OUTR = 404; // wedges end
  const BAND = 438; // heat ring's centre line (56 thick)
  const pt = (r: number, a: number) => {
    const t = (a * Math.PI) / 180;
    return `${(C + r * Math.sin(t)).toFixed(1)} ${(C - r * Math.cos(t)).toFixed(1)}`;
  };
  // A ring slice from a0 to a1 (clockwise), between radii r0 and r1.
  function slice(a0: number, a1: number, r0: number, r1: number) {
    const big = a1 - a0 > 180 ? 1 : 0;
    return `M ${pt(r0, a0)} L ${pt(r1, a0)} A ${r1} ${r1} 0 ${big} 1 ${pt(r1, a1)} L ${pt(r0, a1)} A ${r0} ${r0} 0 ${big} 0 ${pt(r0, a0)} Z`;
  }
  // A whole ring (one battle: nothing to split), as two half-circle arcs each way.
  function ring(r0: number, r1: number) {
    const half = (r: number, sweep: number) => `A ${r} ${r} 0 1 ${sweep} ${pt(r, 180)} A ${r} ${r} 0 1 ${sweep} ${pt(r, 0)}`;
    return `M ${pt(r1, 0)} ${half(r1, 1)} Z M ${pt(r0, 0)} ${half(r0, 0)} Z`;
  }
  // An arc for a label to sit on. Labels on the bottom half run the other way
  // so they're not upside down, with the baseline nearer the rim.
  function labelArc(a0: number, a1: number) {
    const mid = (a0 + a1) / 2;
    const bottom = mid > 90 && mid < 270;
    const r = bottom ? BAND + 12 : BAND - 12;
    const big = a1 - a0 > 180 ? 1 : 0;
    return bottom ? `M ${pt(r, a1)} A ${r} ${r} 0 ${big} 0 ${pt(r, a0)}` : `M ${pt(r, a0)} A ${r} ${r} 0 ${big} 1 ${pt(r, a1)}`;
  }

  const n = $derived(fighters.length);
  const per = $derived(360 / n);
  // Pictures shrink as the wedges narrow; names follow the room left.
  const pic = $derived(Math.min(112, Math.round(((2 * Math.PI * 330) / n) * 0.72)));
  const picR = $derived(OUTR - pic / 2 - 14);
  const nameIn = IN + 14;
  const nameOut = $derived(picR - pic / 2 - 12);
  const nameSize = $derived(Math.min(34, Math.round(((2 * Math.PI * ((nameIn + nameOut) / 2)) / n) * 0.55)));

  type Wedge = { f: Fighter; i: number; a0: number; a1: number; mid: number };
  type Group = { label: string; c: string; a0: number; a1: number; mid: number; wedges: Wedge[] };
  const groups = $derived.by(() => {
    const sizes = heats.length ? heats : [n];
    const out: Group[] = [];
    let at = 0;
    sizes.forEach((size, g) => {
      const wedges = fighters.slice(at, at + size).map((f, j) => {
        const i = at + j;
        return { f, i, a0: i * per, a1: (i + 1) * per, mid: (i + 0.5) * per };
      });
      const a0 = at * per;
      const a1 = Math.min((at + size) * per, a0 + 359.9);
      out.push({ label: heats.length ? `Heat ${g + 1}` : "Final", c: COLOURS[g % COLOURS.length], a0, a1, mid: (a0 + a1) / 2, wedges });
      at += size;
    });
    return out;
  });
  // A name reads outward on the right half, inward on the left.
  const nameTurn = (mid: number) => (mid > 180 ? mid + 90 : mid - 90);
  // Long names are squeezed to fit (a rough width for the display face).
  const nameFit = (name: string) => {
    const room = nameOut - nameIn;
    return name.length * nameSize * 0.52 > room ? room : undefined;
  };
  // Where a sector pops to: outward along its middle.
  const pop = (mid: number, d = 20) => {
    const t = (mid * Math.PI) / 180;
    return `${(Math.sin(t) * d).toFixed(1)}px, ${(-Math.cos(t) * d).toFixed(1)}px`;
  };

  let w = $state(1920);
  const scale = $derived(w / 1920);

  onMount(() => {
    if (hold) return;
    const t = setTimeout(() => ondone?.(), END * slow);
    return () => clearTimeout(t);
  });
</script>

<div class="draw" class:hold class:lite bind:clientWidth={w} style:--k={slow} style:--out="{OUT}ms" style:--info="{INFO}ms">
  <div class="canvas" style:transform="scale({scale})">
    <div class="backdrop"></div>
    <div class="shake">
      <!-- The plan, either side of the wheel. -->
      <div class="side left">
        <div class="big">{n}</div>
        <div class="small">bladers</div>
      </div>
      <div class="side right">
        {#if heats.length}
          <div class="line"><b>{heats.length}</b> heats</div>
          {#if sudden}<div class="line sd">Sudden death</div>{/if}
          <div class="line gold">Final of <b>{finalSize}</b></div>
        {:else}
          <div class="line gold">One battle</div>
          <div class="line sm">Last bey standing</div>
        {/if}
      </div>

      <div class="wheel-pop">
        <div class="wheel">
          {#each groups as g, gi (gi)}
            <div class="group" style:--g={gi} style:--c={g.c} style:--pop={groups.length > 1 ? pop(g.mid) : "0px, 0px"}>
              <svg viewBox="0 0 940 940" aria-hidden="true">
                <defs>
                  <path id="band-label-{gi}" d={labelArc(g.a0, g.a1)} />
                </defs>
                {#each g.wedges as wd (wd.i)}
                  <path class="wedge {wd.i % 2 ? 'odd' : ''}" d={slice(wd.a0, wd.a1, IN, OUTR)} />
                  <path class="tint" d={slice(wd.a0, wd.a1, IN, OUTR)} />
                  <text
                    class="nm"
                    transform="translate({pt((nameIn + nameOut) / 2, wd.mid).replace(' ', ',')}) rotate({nameTurn(wd.mid)})"
                    font-size={nameSize}
                    textLength={nameFit(wd.f.name)}
                    lengthAdjust="spacingAndGlyphs">{wd.f.name}</text
                  >
                {/each}
                <path class="band" d={groups.length > 1 ? slice(g.a0 + 0.6, g.a1 - 0.6, BAND - 28, BAND + 28) : ring(BAND - 28, BAND + 28)} />
                <text class="band-label"><textPath href="#band-label-{gi}" startOffset="50%">{g.label}</textPath></text>
              </svg>
              {#each g.wedges as wd (wd.i)}
                {@const [x, y] = pt(picR, wd.mid).split(" ").map(Number)}
                <div class="pic-at" style:left="{x}px" style:top="{y}px" style:--size="{pic}px">
                  <div class="pic">
                    {#if wd.f.img}<img src={wd.f.img} alt="" style={faceCrop(wd.f.face ?? null)} />{:else}<span class="sil"><FighterSilhouette /></span>{/if}
                  </div>
                </div>
              {/each}
            </div>
          {/each}
        </div>
        <div class="hub">
          <div class="hub-kana" lang="ja">バトルロイヤル</div>
          <div class="hub-words">Battle<br />royale</div>
        </div>
      </div>
    </div>
    <div class="flash"></div>
  </div>
</div>

<style>
  .draw {
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
      radial-gradient(circle at 50% 50%, rgb(255 199 0 / 0.22), transparent 55%),
      repeating-conic-gradient(from 0deg at 50% 50%, rgb(255 255 255 / 0.035) 0deg 6deg, transparent 6deg 12deg),
      var(--field-deep);
    animation:
      fade-in calc(200ms * var(--k)) ease-out both,
      fade-out calc(400ms * var(--k)) ease-in calc(var(--out) * var(--k)) both;
  }
  .shake {
    position: absolute;
    inset: 0;
    animation: shake calc(380ms * var(--k)) ease-out calc(150ms * var(--k)) both;
  }

  /* ── The wheel ── */
  .wheel-pop {
    position: absolute;
    left: 490px;
    top: 70px;
    width: 940px;
    height: 940px;
    animation:
      grow calc(500ms * var(--k)) cubic-bezier(0.2, 0.9, 0.3, 1.1) calc(250ms * var(--k)) both,
      wheel-out calc(450ms * var(--k)) ease-in calc(var(--out) * var(--k)) forwards;
  }
  .wheel {
    position: absolute;
    inset: 0;
    --spin: 1260deg;
    animation: spin calc(2600ms * var(--k)) cubic-bezier(0.12, 0.65, 0.18, 1) calc(250ms * var(--k)) both;
  }
  .group {
    position: absolute;
    inset: 0;
    --at: calc((3050ms + var(--g) * 650ms) * var(--k));
    animation: pop calc(380ms * var(--k)) cubic-bezier(0.2, 0.9, 0.3, 1.4) var(--at) both;
  }
  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .wedge {
    fill: #1a2d86;
    stroke: var(--ink);
    stroke-width: 5;
    stroke-linejoin: round;
  }
  .wedge.odd {
    fill: #13226a;
  }
  .tint {
    fill: var(--c);
    stroke: var(--ink);
    stroke-width: 5;
    stroke-linejoin: round;
    animation: tint calc(500ms * var(--k)) ease-out var(--at) both;
  }
  .nm {
    font-family: var(--font-display);
    text-transform: uppercase;
    fill: var(--paper);
    stroke: var(--ink);
    stroke-width: 6px;
    paint-order: stroke fill;
    text-anchor: middle;
    dominant-baseline: central;
  }
  .band {
    fill: var(--c);
    stroke: var(--ink);
    stroke-width: 5;
    animation: band-in calc(420ms * var(--k)) cubic-bezier(0.2, 0.9, 0.3, 1.2) var(--at) both;
    transform-origin: 470px 470px;
  }
  .band-label {
    font-family: var(--font-display);
    font-size: 36px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    fill: var(--paper);
    stroke: var(--ink);
    stroke-width: 6px;
    paint-order: stroke fill;
    text-anchor: middle;
    animation: fade-in calc(250ms * var(--k)) ease-out calc(var(--at) + 180ms * var(--k)) both;
  }

  /* Pictures stay upright while the wheel spins: each turns back the same
     amount, on the same curve. */
  .pic-at {
    position: absolute;
    width: var(--size);
    height: var(--size);
    margin: calc(var(--size) / -2) 0 0 calc(var(--size) / -2);
    animation: unspin calc(2600ms * var(--k)) cubic-bezier(0.12, 0.65, 0.18, 1) calc(250ms * var(--k)) both;
  }
  .pic {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    overflow: hidden;
    background: var(--field);
    border: 5px solid var(--ink);
    box-shadow: 0 0 0 4px var(--paper);
    animation: pic-lit calc(400ms * var(--k)) ease-out var(--at) both;
  }
  .pic img {
    width: 100%;
    height: 100%;
    /* Without a face point; faceCrop() replaces this when there is one. */
    object-fit: cover;
    object-position: 60% 20%;
  }
  .sil {
    display: block;
    width: 100%;
    height: 100%;
    --lite: var(--on-field-soft);
  }

  /* ── The hub: "BATTLE ROYALE" slams in ── */
  .hub {
    position: absolute;
    left: calc(470px - 132px);
    top: calc(470px - 132px);
    width: 264px;
    height: 264px;
    border-radius: 50%;
    background: radial-gradient(circle at 40% 35%, #ffe066, var(--gold) 55%, #c79200);
    border: 8px solid var(--ink);
    box-shadow:
      0 0 0 6px var(--paper),
      0 0 0 14px var(--ink);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--ink);
    animation: slam calc(320ms * var(--k)) cubic-bezier(0.2, 0.9, 0.3, 1.2) calc(150ms * var(--k)) both;
  }
  .hub-kana {
    font-family: var(--font-display);
    font-size: 18px;
    letter-spacing: 0.2em;
  }
  .hub-words {
    font-family: var(--font-display);
    font-size: 66px;
    line-height: 0.88;
    text-transform: uppercase;
    text-align: center;
    padding-right: 0.08em;
  }

  /* ── The sides ── */
  .side {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 440px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 6px;
    font-family: var(--font-display);
    text-transform: uppercase;
    color: var(--paper);
  }
  .left {
    left: 40px;
    align-items: center;
    animation: from-left calc(400ms * var(--k)) cubic-bezier(0.2, 0.9, 0.3, 1.2) calc(var(--info) * var(--k)) both;
  }
  .right {
    right: 40px;
    align-items: center;
    animation: from-right calc(400ms * var(--k)) cubic-bezier(0.2, 0.9, 0.3, 1.2) calc(var(--info) * var(--k)) both;
  }
  .big {
    font-size: 240px;
    line-height: 0.85;
    color: var(--gold);
    -webkit-text-stroke: 6px var(--ink);
    paint-order: stroke fill;
    filter: drop-shadow(8px 8px 0 var(--ink));
    padding-right: 0.08em;
  }
  .small {
    font-size: 54px;
    background: var(--ink);
    padding: 2px 24px 6px;
    transform: skewX(-10deg);
  }
  .line {
    font-size: 58px;
    line-height: 1;
    background: var(--ink);
    border: 4px solid var(--paper);
    padding: 6px 26px 10px;
    transform: skewX(-10deg);
  }
  .line b {
    color: var(--gold);
  }
  .line.gold {
    background: var(--gold);
    color: var(--ink);
    border-color: var(--ink);
  }
  .line.gold b {
    color: var(--ink);
  }
  .line.sm {
    font-size: 40px;
    white-space: nowrap;
  }
  .line.sd {
    background: var(--red);
    font-size: 44px;
  }

  .flash {
    position: absolute;
    inset: 0;
    background: #fff;
    opacity: 0;
    pointer-events: none;
    animation: flash calc(260ms * var(--k)) ease-out calc(150ms * var(--k)) both;
  }

  /* No filters for slow machines. */
  .lite .big {
    filter: none;
  }
  /* Hold: everything comes in, nothing clears. */
  .hold .backdrop {
    animation: fade-in calc(200ms * var(--k)) ease-out both;
  }
  .hold .wheel-pop {
    animation: grow calc(500ms * var(--k)) cubic-bezier(0.2, 0.9, 0.3, 1.1) calc(250ms * var(--k)) both;
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
  @keyframes grow {
    from {
      transform: scale(0.15);
      opacity: 0;
    }
  }
  @keyframes wheel-out {
    to {
      transform: scale(1.3);
      opacity: 0;
    }
  }
  @keyframes spin {
    from {
      transform: rotate(calc(var(--spin) * -1));
    }
  }
  @keyframes unspin {
    from {
      transform: rotate(var(--spin));
    }
  }
  @keyframes pop {
    0% {
      transform: none;
    }
    100% {
      transform: translate(var(--pop));
    }
  }
  @keyframes tint {
    0% {
      opacity: 0;
    }
    1% {
      opacity: 1;
      fill: #fff;
    }
    100% {
      opacity: 1;
      fill: var(--c);
    }
  }
  @keyframes band-in {
    from {
      opacity: 0;
      transform: scale(0.9);
    }
  }
  @keyframes pic-lit {
    0% {
      box-shadow: 0 0 0 4px var(--paper);
    }
    40% {
      box-shadow: 0 0 0 14px #fff;
    }
    100% {
      box-shadow: 0 0 0 6px var(--c);
    }
  }
  @keyframes slam {
    from {
      transform: scale(3.2);
      opacity: 0;
    }
    60% {
      opacity: 1;
    }
  }
  @keyframes from-left {
    from {
      transform: translateX(-120%);
      opacity: 0;
    }
  }
  @keyframes from-right {
    from {
      transform: translateX(120%);
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
    .draw * {
      animation-duration: 1ms !important;
    }
  }
</style>
