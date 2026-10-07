<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { STADIA, stadiumOf } from "$lib/stadia";

  // The stadium draw over Match centre. Three looks, all built from the old
  // launch countdown's black band and slam-in cards:
  //   reel      — the name card rolls like a slot reel onto the stadium
  //   spotlight — all three slam in; a highlight hops between them and stops
  //   spin      — a bey-top disc twirls and winds down under a pointer
  // "launch" (Start match) ends on ゴーシュート / LET IT RIP; "next" (every
  // later round, and a redraw) is a ~3s shuffle then the name. Transform and
  // opacity only, so it stays smooth on the Pi.
  let {
    stadium,
    kind,
    round,
    look,
    ondone,
  }: {
    stadium: string; // key of the stadium drawn
    kind: "launch" | "next";
    round: number; // the round it's for (shown on "next")
    look: "reel" | "spotlight" | "spin";
    ondone: () => void;
  } = $props();

  // Fixed for this draw: the parent keys a new one per draw, so read once.
  const [s, launch, LOOK] = untrack(() => [stadiumOf(stadium) ?? STADIA[0], kind === "launch", look] as const);
  const idx = Math.max(0, STADIA.findIndex((x) => x.key === s.key));

  // Timeline (ms from mount). LAND: the stadium is shown. RIP: the launch's
  // LET IT RIP card. OUT: the band folds away.
  const START = LOOK === "spotlight" ? (launch ? 450 : 250) : 0;
  const SPIN = { reel: launch ? 2200 : 1900, spotlight: launch ? 2100 : 1700, spin: launch ? 2600 : 2000 }[LOOK];
  const LAND = LOOK === "spotlight" ? START + SPIN + 150 : LOOK === "spin" ? SPIN - 150 : SPIN;
  const RIP = 4000;
  const OUT = launch ? RIP + 1500 : 3000;
  const BAND_H = LOOK === "reel" ? (launch ? 460 : 400) : launch ? 560 : 520;

  let phase = $state<"draw" | "rip">("draw");
  let landed = $state(false);
  let leaving = $state(false);

  // Reel: enough loops of I/II/III to roll for a while, ending on the draw.
  const seq: number[] = [];
  for (let k = 0; k < (launch ? 5 : 4) * 3; k++) seq.push(k % 3);
  while (seq[seq.length - 1] !== idx) seq.push(seq.length % 3);
  let numReel = $state<HTMLElement>();
  let nameReel = $state<HTMLElement>();
  let rolling = $state(STADIA[seq[0]].key); // colour follows the name in the window

  // Spotlight: the hop times, getting further apart, and where it starts so
  // the last hop lands on the draw.
  const hops: number[] = [];
  for (let t = 0, gap = 55; t + gap < SPIN; gap *= 1.16) hops.push((t += gap));
  let hot = $state(-1);
  let trio = $state<HTMLElement>();
  let slide = $state(0); // px the winner moves to sit centre stage once it lands

  // Spin: whole turns plus the draw's segment (segment k is centred at k·120°),
  // with a little wobble inside the segment so it doesn't always stop dead centre.
  let disc = $state<HTMLElement>();
  const wobble = (Math.random() - 0.5) * 60;
  const spinTo = (launch ? 5 : 3) * 360 + ((360 - idx * 120) % 360) + wobble;

  onMount(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    let poll: ReturnType<typeof setInterval> | undefined;

    if (LOOK === "reel" && numReel && nameReel) {
      const end = `translateY(-${(seq.length - 1) * 1.12}em)`;
      const opts: KeyframeAnimationOptions = { duration: SPIN, easing: "cubic-bezier(.15,.55,.2,1)", fill: "forwards" };
      for (const el of [numReel, nameReel]) el.animate([{ transform: "translateY(0)" }, { transform: end }], opts);
      const el = nameReel;
      poll = setInterval(() => {
        const y = -new DOMMatrix(getComputedStyle(el).transform).m42;
        const row = parseFloat(getComputedStyle(el).fontSize) * 1.12;
        rolling = STADIA[seq[Math.min(seq.length - 1, Math.round(y / row))]].key;
      }, 40);
    }
    if (LOOK === "spotlight") {
      let k = (((idx - hops.length) % 3) + 3) % 3;
      for (const t of hops) at(START + t, () => (hot = k = (k + 1) % 3));
    }
    if (LOOK === "spin" && disc) {
      disc.animate([{ transform: "rotate(0deg)" }, { transform: `rotate(${spinTo}deg)` }], {
        duration: SPIN,
        easing: "cubic-bezier(.1,.6,.15,1)",
        fill: "forwards",
      });
    }

    at(LAND, () => {
      clearInterval(poll);
      // Spotlight: measure before anything moves, so the winner can glide from
      // its slot to the centre while the other two drop away.
      const pick = trio?.children[idx] as HTMLElement | undefined;
      if (trio && pick) {
        const box = trio.getBoundingClientRect();
        const card = pick.getBoundingClientRect();
        slide = box.left + box.width / 2 - (card.left + card.width / 2);
      }
      landed = true;
    });
    if (launch) at(RIP, () => (phase = "rip"));
    at(OUT, () => (leaving = true));
    at(OUT + 260, ondone);
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(poll);
    };
  });
</script>

{#snippet heading()}
  {#if launch}
    <span class="kana" lang="ja">スタジアム</span>
  {:else}
    <span class="kicker">Round {round} · Stadium</span>
  {/if}
{/snippet}

{#snippet codename(extra = "")}
  <span class="codename {extra}" class:shown={landed}>{s.code}</span>
{/snippet}

<div class="sd" aria-live="polite" aria-label="Round {round}: {s.name}">
  <div class="band" class:out={leaving} style="--band-h: {BAND_H}px"></div>

  {#if phase === "rip"}
    <div class="layer slam" class:fade={leaving}>
      <span class="kana" lang="ja">ゴーシュート</span>
      <span class="card rip-card"><b>Let it rip!</b></span>
    </div>
  {:else if look === "reel"}
    <div class="layer slam" class:fade={leaving}>
      {@render heading()}
      <span class="card st-card reeling" class:land={landed} data-stadium={landed ? s.key : rolling}>
        <span class="n"><span class="reel-win"><span class="reel" bind:this={numReel}>
          {#each seq as k, i (i)}<span>{STADIA[k].num}</span>{/each}
        </span></span></span>
        <span class="t"><span class="reel-win wide"><span class="reel" bind:this={nameReel}>
          {#each seq as k, i (i)}<span>{STADIA[k].name}</span>{/each}
        </span></span></span>
      </span>
      {@render codename()}
    </div>
  {:else if look === "spotlight"}
    <div class="layer" class:fade={leaving}>
      {@render heading()}
      <div class="trio" bind:this={trio} style="--slide: {slide}px">
        {#each STADIA as st, k (st.key)}
          <div
            class="opt"
            class:hot={!landed && hot === k}
            class:win={landed && k === idx}
            class:gone={landed && k !== idx}
            data-stadium={st.key}
          >
            <div class="opt-in" style="animation-delay: {k * 90}ms">
              <span class="card opt-card"><b class="opt-num">{st.num}</b><b>{st.name}</b></span>
            </div>
          </div>
        {/each}
      </div>
      {@render codename()}
    </div>
  {:else}
    <div class="layer" class:fade={leaving}>
      <div class="spin-row">
        <div class="disc-wrap slam">
          <div class="pointer"></div>
          <div class="disc" bind:this={disc}>
            {#each STADIA as st, k (st.key)}
              <div class="seg" style="transform: rotate({k * 120}deg)"><b>{st.num}</b></div>
            {/each}
          </div>
        </div>
        <div class="spin-side">
          {@render heading()}
          <span class="card st-card small" class:shown={landed} data-stadium={s.key}>
            <span class="n"><b>{s.num}</b></span><span class="t"><b>{s.name}</b></span>
          </span>
          {@render codename()}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .sd {
    position: absolute;
    inset: 0;
    z-index: 6;
    display: grid;
    place-items: center;
    pointer-events: none;
  }
  /* The launch countdown's black band, kept as-is. */
  .band {
    position: absolute;
    left: -5%;
    right: -5%;
    top: 50%;
    height: var(--band-h);
    margin-top: calc(var(--band-h) / -2);
    background: var(--ink);
    transform: skewY(-4deg);
    animation: band-in 260ms cubic-bezier(0.2, 0.9, 0.3, 1) both;
  }
  .band.out {
    animation: band-out 240ms cubic-bezier(0.6, 0, 0.8, 0.2) both;
  }
  .layer {
    position: relative;
    grid-area: 1 / 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
  }
  .slam {
    animation: slam-hold 900ms cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
  }
  .fade {
    animation: fade-out 220ms ease-in both;
  }
  @keyframes band-in {
    from {
      transform: skewY(-4deg) scaleX(0);
    }
    to {
      transform: skewY(-4deg) scaleX(1);
    }
  }
  @keyframes band-out {
    from {
      transform: skewY(-4deg) scaleY(1);
    }
    to {
      transform: skewY(-4deg) scaleY(0);
    }
  }
  @keyframes slam-hold {
    0% {
      opacity: 0;
      transform: scale(1.9);
    }
    30% {
      opacity: 1;
      transform: scale(0.96);
    }
    45%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }
  @keyframes fade-out {
    to {
      opacity: 0;
      transform: scale(0.9);
    }
  }

  .kana {
    font-family: var(--font-display);
    font-size: 3.4rem;
    line-height: 1;
    color: var(--gold);
  }
  .kicker {
    font-family: var(--font-text);
    font-weight: 700;
    font-stretch: 75%;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: var(--on-field-soft);
    font-size: 1.8rem;
  }
  /* Nickname under the name; holds its space so nothing jumps when it lands. */
  .codename {
    font-family: var(--font-display);
    text-transform: uppercase;
    font-size: 3rem;
    line-height: 1;
    color: var(--gold);
    padding-right: 0.12em; /* italic overhang */
    visibility: hidden;
  }
  .codename.shown {
    visibility: visible;
    animation: slam-hold 700ms cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
  }

  /* The telop card (same build as LET IT RIP): skewed slab, letters straightened. */
  .card {
    font-family: var(--font-display);
    text-transform: uppercase;
    line-height: 1;
    background: var(--red);
    color: var(--paper);
    border: 6px solid var(--paper);
    box-shadow: 16px 16px 0 var(--gold);
    transform: skewX(-10deg);
  }
  .card b {
    display: block;
    font-weight: inherit;
    transform: skewX(10deg);
    padding-right: 0.12em; /* italic overhang */
  }
  .rip-card {
    font-size: 12rem;
    padding: 6px 60px 16px;
  }

  /* Stadium card: white slab, numeral block in the stadium's colour. */
  .st-card {
    display: inline-flex;
    align-items: stretch;
    font-size: 8.5rem;
    font-stretch: 70%;
    background: var(--paper);
    color: var(--ink);
    box-shadow: 16px 16px 0 var(--st);
  }
  .st-card .n {
    display: grid;
    place-items: center;
    background: var(--st);
    color: var(--st-ink);
    padding: 8px 40px 14px;
    border-right: 6px solid var(--ink);
    min-width: 2.2em;
  }
  .st-card .t {
    display: grid;
    place-items: center;
    padding: 8px 50px 14px;
    white-space: nowrap;
  }
  .st-card.land {
    animation: land 380ms cubic-bezier(0.2, 0.9, 0.3, 1.5);
  }
  @keyframes land {
    from {
      transform: skewX(-10deg) scale(1.14);
    }
    to {
      transform: skewX(-10deg) scale(1);
    }
  }

  /* Reel: a clipping window per cell, the list rolls up through it. The side
     padding is room for the italic overhang, which the window would cut. */
  .reeling .n,
  .reeling .t {
    padding-top: 0;
    padding-bottom: 0;
  }
  .reel-win {
    display: block;
    height: 1.12em;
    overflow: hidden;
    padding: 0 0.2em;
    transform: skewX(10deg);
  }
  .reel-win.wide {
    width: 7.8em;
  }
  .reel {
    display: block;
    will-change: transform;
  }
  .reel > span {
    display: block;
    height: 1.12em;
    line-height: 1.12em;
    text-align: center;
    white-space: nowrap;
  }

  /* Spotlight: three slabs; the lit one lifts and turns gold-edged. */
  .trio {
    display: flex;
    gap: 60px;
    margin-top: 44px;
  }
  .opt {
    font-size: 4.6rem;
    font-stretch: 70%;
    opacity: 0.45;
    transition:
      transform 90ms ease-out,
      opacity 200ms;
  }
  .opt-in {
    animation: slam-hold 520ms cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
  }
  .opt-card {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    background: var(--paper);
    color: var(--ink);
    border-color: var(--ink);
    box-shadow: 10px 10px 0 var(--st);
    padding: 10px 36px 16px;
  }
  .opt-card .opt-num {
    font-size: 1.9em;
    color: var(--st-ink);
    background: var(--st);
    padding: 0 0.3em;
    margin-bottom: 6px;
    border: 4px solid var(--ink);
  }
  .opt.hot,
  .opt.win {
    opacity: 1;
    transform: translateY(-26px) scale(1.12);
  }
  /* The winner glides to centre stage (--slide, measured on landing). */
  .opt.win {
    transform: translate(var(--slide), -26px) scale(1.2);
    transition:
      transform 360ms cubic-bezier(0.2, 0.9, 0.3, 1.1),
      opacity 200ms;
  }
  .opt.hot .opt-card,
  .opt.win .opt-card {
    border-color: var(--gold);
    box-shadow: 10px 10px 0 var(--gold);
  }
  .opt.gone {
    opacity: 0;
    transform: translateY(60px) scale(0.8);
    transition:
      transform 260ms ease-in,
      opacity 260ms;
  }

  /* Spin: a disc in the three stadium colours (same order as STADIA). */
  .spin-row {
    display: flex;
    align-items: center;
    gap: 70px;
  }
  .disc-wrap {
    position: relative;
    width: 380px;
    height: 380px;
    flex: none;
  }
  /* Shadow on a still layer, so it doesn't swing round with the spin. */
  .disc-wrap::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: var(--gold);
    transform: translate(12px, 12px);
  }
  .disc {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 8px solid var(--paper);
    overflow: hidden;
    will-change: transform;
    background: conic-gradient(from -60deg, var(--gold) 0 120deg, var(--green) 0 240deg, var(--red) 0 360deg);
  }
  .disc::after {
    content: "";
    position: absolute;
    inset: 36%;
    border-radius: 50%;
    background: var(--ink);
    border: 8px solid var(--paper);
  }
  .seg {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 0;
    height: 0;
  }
  .seg b {
    position: absolute;
    left: -0.6em;
    top: -1.9em;
    width: 1.2em;
    text-align: center;
    font-family: var(--font-display);
    font-size: 4.4rem;
    color: var(--ink);
  }
  .pointer {
    position: absolute;
    left: 50%;
    top: -34px;
    margin-left: -26px;
    width: 52px;
    height: 58px;
    background: var(--paper);
    clip-path: polygon(0 0, 100% 0, 50% 100%);
    z-index: 2;
  }
  .pointer::after {
    content: "";
    position: absolute;
    inset: 7px 9px 14px;
    background: var(--red);
    clip-path: polygon(0 0, 100% 0, 50% 100%);
  }
  .spin-side {
    display: flex;
    flex-direction: column;
    gap: 22px;
    align-items: flex-start;
    min-width: 900px;
  }
  .st-card.small {
    font-size: 6.2rem;
    transform-origin: left center;
    visibility: hidden;
  }
  .st-card.small.shown {
    visibility: visible;
    animation: slam-hold-skew 900ms cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
  }
  /* slam-hold for a skewed card (the keyframes would drop its skew). */
  @keyframes slam-hold-skew {
    0% {
      opacity: 0;
      transform: skewX(-10deg) scale(1.9);
    }
    30% {
      opacity: 1;
      transform: skewX(-10deg) scale(0.96);
    }
    45%,
    100% {
      opacity: 1;
      transform: skewX(-10deg) scale(1);
    }
  }
</style>
