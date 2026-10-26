<script lang="ts">
  import Trophy from "$lib/components/Trophy.svelte";
  import FighterSilhouette from "./FighterSilhouette.svelte";
  import { FINISHES } from "$lib/finishes";
  import type { ChampionRun } from "$lib/view";

  // The Champion scene: the winner's fighter in a gold frame with rays turning
  // behind it, their combat name on the big gold slab, how their tournament
  // went, and the runner-up. It plays its reveal each time the scene comes up
  // (slam-in, flash, confetti), then idles with a shine, a bobbing trophy and
  // falling confetti. Transform and opacity only, so it holds up on the Pi;
  // `lite` drops the turning rays and most of the confetti.
  // victory: the fighter's victory pose, if they have one: shown in the frame
  // instead of the cut-out, and never flipped (it has writing on it).
  type Fighter = { name: string; player: string; kana: string; img: string; victory?: string; mirror?: boolean };
  // An award for the ticker, names already filled in.
  type TickerAward = { key: string; title: string; name: string; detail: string };
  let {
    champion,
    runnerUp = null,
    run,
    awards = [],
    lite = false,
  }: {
    champion: Fighter; // name: combat name (or the player's own); player: as typed for the tournament
    runnerUp?: Fighter | null;
    run: ChampionRun;
    awards?: TickerAward[]; // the awards ticker along the bottom (none: no ticker)
    lite?: boolean;
  } = $props();

  // The ticker scrolls at a steady speed whatever the number of awards: the
  // list is drawn twice and slides by one copy's width per loop.
  const tickerSeconds = $derived(Math.max(12, awards.length * 7));

  const finishLabel = (key: string) => FINISHES.find((f) => f.key === key)?.label ?? key;

  // Stat tiles. Rounds and the favourite finish only exist when matches were
  // scored round by round.
  const tiles = $derived.by(() => {
    const out: { value: string; label: string; word?: boolean }[] = [
      { value: `${run.wins}–${run.losses}`, label: "Won–lost" },
      { value: `${run.pointDiff > 0 ? "+" : ""}${run.pointDiff}`, label: "Point difference" },
    ];
    if (run.roundsWon) out.push({ value: String(run.roundsWon), label: "Rounds won" });
    if (run.topFinish) {
      out.push({ value: finishLabel(run.topFinish.key), label: `Favourite finish, ×${run.topFinish.count}`, word: true });
    }
    return out;
  });

  const finalScore = $derived(
    !run.final ? "" : run.final.walkover ? "W/O" : `${run.final.score[0]}–${run.final.score[1]}`,
  );

  // Long combat names step down in size so the slab fits its column.
  const nameSize = (n: string) => (n.length <= 10 ? "" : n.length <= 14 ? "long" : "longer");
  const showPlayer = (f: Fighter) => !!f.player && f.player.trim().toLowerCase() !== f.name.trim().toLowerCase();

  // Confetti, random once per reveal. The first fall of every piece starts in
  // the second after the slam, so it reads as a burst; then they loop.
  const COLOURS = ["var(--gold)", "var(--gold)", "var(--paper)", "var(--red)", "#3fa0ff", "#ffe27a"];
  // svelte-ignore state_referenced_locally
  const confetti = Array.from({ length: lite ? 16 : 46 }, () => ({
    left: (Math.random() * 100).toFixed(1),
    w: Math.round(10 + Math.random() * 12),
    h: Math.round(6 + Math.random() * 8),
    colour: COLOURS[Math.floor(Math.random() * COLOURS.length)],
    dur: Math.round(3200 + Math.random() * 3000),
    delay: Math.round(450 + Math.random() * 1200),
    dx: Math.round((Math.random() - 0.5) * 240),
    rot: Math.round((Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 720)),
  }));
</script>

<div class="champ" class:lite>
  <div class="watermark" lang="ja" aria-hidden="true">チャンピオン</div>
  <div class="rays-wrap" aria-hidden="true"><div class="rays"></div></div>

  <div class="layout">
    <!-- The fighter faces right, towards the name. -->
    <div class="portrait">
      <div class="frame">
        <div class="pic">
          {#if champion.victory}
            <img src={champion.victory} alt="" />
          {:else if champion.img}
            <img src={champion.img} alt="" class:flip={!champion.mirror} />
          {:else}
            <div class="sil"><FighterSilhouette flip /></div>
          {/if}
        </div>
      </div>
      <div class="trophy"><div class="bob"><Trophy size="13rem" label="Trophy" /></div></div>
    </div>

    <div class="info">
      <div class="kicker"><span>Beyfest 2026 champion</span></div>
      {#if champion.kana}<div class="kana" lang="ja">{champion.kana}</div>{/if}
      <div class="name-slab {nameSize(champion.name)}">
        <span>{champion.name}</span>
        <i class="shine" aria-hidden="true"></i>
      </div>
      {#if showPlayer(champion)}<div class="player">{champion.player}</div>{/if}

      <div class="stats">
        {#each tiles as t, i (t.label)}
          <div class="tile" class:word={t.word} style:--i={i}>
            <b>{t.value}</b>
            <span>{t.label}</span>
          </div>
        {/each}
      </div>

      {#if runnerUp}
        <div class="runner">
          <span class="runner-tag"><span class="runner-kana" lang="ja">ランナーアップ</span>Runner-up</span>
          <span class="runner-name">
            {runnerUp.name}
            {#if showPlayer(runnerUp)}<small>{runnerUp.player}</small>{/if}
          </span>
          {#if finalScore}
            <span class="runner-score"><small>Grand final</small><b>{finalScore}</b></span>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <div class="confetti" aria-hidden="true">
    {#each confetti as c}
      <i
        style:left="{c.left}%"
        style:width="{c.w}px"
        style:height="{c.h}px"
        style:background={c.colour}
        style:--dur="{c.dur}ms"
        style:--delay="{c.delay}ms"
        style:--dx="{c.dx}px"
        style:--rot="{c.rot}deg"
      ></i>
    {/each}
  </div>
  {#if awards.length}
    <!-- The awards, scrolling along the bottom once the reveal has settled. -->
    <div class="ticker" style:--loop="{tickerSeconds}s">
      <span class="ticker-tag"><span lang="ja">アワード</span>Awards</span>
      <div class="ticker-window">
        <div class="ticker-run">
          {#each [0, 1] as copy (copy)}
            <div class="ticker-list" aria-hidden={copy === 1 ? "true" : undefined}>
              {#each awards as a (a.key)}
                <span class="tick">
                  <b>{a.title}</b>
                  <span class="tick-name">{a.name}</span>
                  <span class="tick-detail">{a.detail}</span>
                </span>
              {/each}
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
  <div class="flash" aria-hidden="true"></div>
</div>

<style>
  /* Timeline (ms after the scene comes up):
       0  rays and watermark fade in · 100 frame slides in
     450  name slab slams, flash, confetti starts
     550+ kicker, kana, player name · 950+ stat tiles · 1450 runner-up
     900  trophy drops onto the frame's corner, then bobs */
  .champ {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ── Background ─────────────────────────────────────────── */
  .watermark {
    position: absolute;
    left: 50%;
    bottom: -40px;
    translate: -50% 0;
    font-family: var(--font-display);
    font-size: 21rem;
    line-height: 1;
    white-space: nowrap;
    color: var(--gold);
    opacity: 0.07;
    pointer-events: none;
    animation: fade-in 600ms ease-out both;
  }
  /* Gold sunburst behind the portrait. The wrapper places and fades it; the
     inner square turns (one composited layer, painted once). */
  .rays-wrap {
    position: absolute;
    left: 27%;
    top: 50%;
    width: 0;
    height: 0;
    animation: rays-in 800ms cubic-bezier(0.2, 0.9, 0.3, 1) both;
  }
  .rays {
    position: absolute;
    left: -1300px;
    top: -1300px;
    width: 2600px;
    height: 2600px;
    /* Strong near the middle, fading out: faint gold over the blue reads grey. */
    background: repeating-conic-gradient(rgb(255 199 0 / 0.6) 0deg 7deg, transparent 7deg 18deg);
    mask-image: radial-gradient(circle, #000 0 22%, rgb(0 0 0 / 0.35) 34%, transparent 50%);
    will-change: transform;
    animation: spin 90s linear infinite;
  }
  .lite .rays {
    animation: none;
  }
  @keyframes rays-in {
    from {
      opacity: 0;
      transform: scale(0.5);
    }
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes fade-in {
    from {
      opacity: 0;
    }
  }

  .layout {
    position: relative;
    display: grid;
    grid-template-columns: 820px minmax(0, 940px);
    align-items: center;
    gap: 64px;
  }

  /* ── Portrait ───────────────────────────────────────────── */
  .portrait {
    position: relative;
  }
  .frame {
    transform: skewX(-6deg);
    border: 8px solid var(--gold);
    outline: 5px solid var(--ink);
    box-shadow: 18px 18px 0 var(--ink);
    background: var(--field-deep);
    animation: frame-in 560ms cubic-bezier(0.2, 0.9, 0.25, 1.05) 100ms both;
  }
  @keyframes frame-in {
    0% {
      opacity: 0;
      transform: translateX(-700px) skewX(-18deg);
    }
    70% {
      opacity: 1;
      transform: translateX(24px) skewX(-3deg);
    }
  }
  .pic {
    aspect-ratio: 3 / 2;
    overflow: hidden;
  }
  .pic img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    /* un-skew the picture inside the slanted frame (scaled up to cover the corners) */
    transform: skewX(6deg) scale(1.12);
  }
  .pic img.flip {
    transform: skewX(6deg) scale(-1.12, 1.12);
  }
  /* No picture: the silhouette on a gold glow. */
  .sil {
    --lite: var(--gold);
    height: 100%;
    display: grid;
    place-items: center;
    background: radial-gradient(circle at 50% 55%, rgb(255 199 0 / 0.45), transparent 62%);
  }
  .sil > :global(svg) {
    width: 78%;
  }
  .trophy {
    position: absolute;
    right: -70px;
    bottom: -90px;
    animation: trophy-in 520ms cubic-bezier(0.2, 1.3, 0.4, 1) 900ms both;
  }
  .bob {
    animation: bob 2400ms ease-in-out 1500ms infinite alternate;
  }
  @keyframes trophy-in {
    from {
      opacity: 0;
      transform: translateY(-500px) rotate(-25deg) scale(0.6);
    }
  }
  @keyframes bob {
    to {
      transform: translateY(-14px) rotate(3deg);
    }
  }

  /* ── Name and kicker ────────────────────────────────────── */
  .info {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 20px;
  }
  .kicker {
    transform: skewX(-12deg);
    background: var(--ink);
    border: 3px solid var(--gold);
    padding: 6px 26px 8px;
    animation: from-right 380ms cubic-bezier(0.2, 0.9, 0.3, 1.1) 550ms both;
  }
  .kicker span {
    display: block;
    transform: skewX(12deg);
    font-family: var(--font-display);
    text-transform: uppercase;
    font-size: 2.3rem;
    line-height: 1;
    color: var(--gold);
  }
  .kana {
    font-family: var(--font-display);
    font-size: 3rem;
    line-height: 1;
    letter-spacing: 0.06em;
    color: var(--gold);
    animation: from-right 380ms cubic-bezier(0.2, 0.9, 0.3, 1.1) 650ms both;
  }
  @keyframes from-right {
    from {
      opacity: 0;
      transform: translateX(260px) skewX(-12deg);
    }
  }

  /* The loudest thing on the TV: the big gold slab, slammed in oversized. */
  .name-slab {
    position: relative;
    max-width: 100%;
    overflow: hidden; /* keeps the shine inside the slab; the hard shadow still shows */
    transform: skewX(-10deg);
    background: var(--gold);
    color: var(--ink);
    border: 6px solid var(--ink);
    box-shadow: 16px 16px 0 var(--ink);
    padding: 6px 56px 14px;
    animation: slam 300ms cubic-bezier(0.55, 0, 1, 0.6) 450ms both;
  }
  .name-slab > span {
    display: block;
    transform: skewX(10deg);
    font-family: var(--font-display);
    font-stretch: 62%;
    text-transform: uppercase;
    font-size: 10rem;
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-inline: 0.1em; /* the italic last letter leans past its box */
  }
  .name-slab.long > span {
    font-size: 8rem;
  }
  .name-slab.longer > span {
    font-size: 6.4rem;
  }
  @keyframes slam {
    0% {
      opacity: 0;
      transform: translateY(-40px) skewX(-10deg) scale(2.4);
    }
    60% {
      opacity: 1;
    }
  }
  /* A white glint sweeping across the slab every few seconds. */
  .shine {
    position: absolute;
    inset: 0;
    background: linear-gradient(105deg, transparent 38%, rgb(255 255 255 / 0.75) 48%, rgb(255 255 255 / 0.75) 52%, transparent 62%);
    transform: translateX(-100%);
    animation: shine 3600ms ease-in-out 1500ms infinite;
  }
  @keyframes shine {
    0% {
      transform: translateX(-100%);
    }
    35%,
    100% {
      transform: translateX(100%);
    }
  }
  .player {
    font-family: var(--font-text);
    font-weight: 700;
    font-size: 2.4rem;
    line-height: 1;
    color: var(--paper);
    margin-left: 28px;
    animation: from-right 380ms cubic-bezier(0.2, 0.9, 0.3, 1.1) 750ms both;
  }

  /* ── Stats ──────────────────────────────────────────────── */
  .stats {
    display: flex;
    gap: 18px;
    margin-top: 14px;
  }
  .tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-width: 170px;
    padding: 10px 22px 12px;
    transform: skewX(-10deg);
    background: var(--paper);
    color: var(--ink);
    border: 4px solid var(--ink);
    border-top: 10px solid var(--gold);
    box-shadow: 8px 8px 0 var(--ink);
    animation: pop 340ms cubic-bezier(0.2, 1.3, 0.4, 1) calc(950ms + var(--i) * 110ms) both;
  }
  .tile > * {
    transform: skewX(10deg);
  }
  .tile b {
    font-family: var(--font-display);
    font-size: 4.6rem;
    line-height: 0.95;
    font-variant-numeric: tabular-nums;
  }
  .tile.word b {
    font-stretch: 62%;
    text-transform: uppercase;
    font-size: 3.6rem;
    line-height: 1.2; /* same height as the numbers */
  }
  .tile span {
    font-family: var(--font-text);
    font-weight: 700;
    font-size: 1.2rem;
    color: var(--ink-soft);
    white-space: nowrap;
  }
  @keyframes pop {
    from {
      opacity: 0;
      transform: translateY(60px) skewX(-10deg) scale(0.7);
    }
  }

  /* ── Runner-up ──────────────────────────────────────────── */
  /* A band with a cut end, like the TV's On now band. */
  .runner {
    display: flex;
    align-items: stretch;
    margin-top: 18px;
    padding-right: 20px;
    background: var(--ink);
    color: var(--paper);
    clip-path: polygon(0 0, 100% 0, calc(100% - 26px) 100%, 0 100%);
    animation: runner-in 420ms cubic-bezier(0.2, 0.9, 0.3, 1.1) 1450ms both;
  }
  .runner > * {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .runner-tag {
    background: var(--paper);
    color: var(--ink);
    padding: 8px 22px;
    font-family: var(--font-display);
    text-transform: uppercase;
    font-size: 1.7rem;
    line-height: 1;
  }
  .runner-kana {
    font-size: 1rem;
    color: var(--ink-soft);
    margin-bottom: 4px;
  }
  .runner-name {
    padding: 8px 28px;
    font-family: var(--font-display);
    font-stretch: 62%;
    text-transform: uppercase;
    font-size: 3rem;
    line-height: 1;
    white-space: nowrap;
  }
  .runner-name small {
    font-family: var(--font-text);
    font-stretch: 100%;
    font-weight: 600;
    text-transform: none;
    font-size: 1.2rem;
    color: var(--on-field-soft);
    margin-top: 4px;
  }
  .runner-score {
    align-items: center;
    padding: 6px 26px;
    border-left: 3px solid var(--field-line);
  }
  .runner-score small {
    font-family: var(--font-text);
    font-weight: 600;
    font-size: 1.05rem;
    color: var(--on-field-soft);
  }
  .runner-score b {
    font-family: var(--font-display);
    font-size: 2.8rem;
    line-height: 1;
    color: var(--gold);
  }
  @keyframes runner-in {
    from {
      opacity: 0;
      transform: translateY(80px);
    }
  }

  /* ── Confetti and flash ─────────────────────────────────── */
  .confetti {
    position: absolute;
    inset: -26px -46px; /* out to the stage's edges */
    overflow: hidden;
    pointer-events: none;
  }
  .confetti i {
    position: absolute;
    top: -30px;
    opacity: 0;
    animation: fall var(--dur) linear var(--delay) infinite;
  }
  @keyframes fall {
    0% {
      opacity: 1;
      transform: translate(0, 0) rotate(0deg);
    }
    90% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translate(var(--dx), 1100px) rotate(var(--rot));
    }
  }
  .flash {
    position: absolute;
    inset: -26px -46px;
    background: #fff;
    opacity: 0;
    pointer-events: none;
    animation: flash 360ms ease-out 450ms;
  }
  @keyframes flash {
    from {
      opacity: 0.85;
    }
    to {
      opacity: 0;
    }
  }

  /* ── Awards ticker ─────────────────────────────────────── */
  /* Fades in 10 s after the scene comes up, then scrolls on a loop. */
  .ticker {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 3;
    display: flex;
    align-items: stretch;
    height: 74px;
    background: var(--ink);
    border-top: 5px solid var(--gold);
    animation: fade-in 800ms ease-out 10s both;
  }
  .ticker-tag {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0 34px 0 22px;
    background: var(--gold);
    color: var(--ink);
    font-family: var(--font-display);
    font-size: 2rem;
    line-height: 1;
    text-transform: uppercase;
    clip-path: polygon(0 0, 100% 0, calc(100% - 18px) 100%, 0 100%);
  }
  .ticker-tag span {
    font-size: 0.5em;
    letter-spacing: 0.1em;
  }
  .ticker-window {
    flex: 1;
    overflow: hidden;
    display: flex;
    align-items: center;
  }
  .ticker-run {
    display: flex;
    width: max-content;
    animation: ticker var(--loop) linear 10s infinite;
  }
  .ticker-list {
    display: flex;
  }
  .tick {
    display: flex;
    align-items: baseline;
    gap: 16px;
    padding: 0 40px;
    white-space: nowrap;
    color: var(--paper);
    font-size: 1.7rem;
  }
  /* A gold diamond between awards. */
  .tick::after {
    content: "◆";
    color: var(--gold);
    font-size: 0.7em;
    margin-left: 24px;
  }
  .tick b {
    font-family: var(--font-display);
    text-transform: uppercase;
    color: var(--gold);
    padding-right: 0.15em; /* italic overhang */
  }
  .tick-name {
    font-family: var(--font-display);
    text-transform: uppercase;
    padding-right: 0.15em; /* italic overhang */
  }
  .tick-detail {
    font-weight: 600;
    color: var(--on-field-soft);
  }
  @keyframes ticker {
    to {
      transform: translateX(-50%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .champ * {
      animation: none !important;
    }
    .confetti {
      display: none;
    }
  }
</style>
