<script lang="ts">
  import FighterSilhouette from "./FighterSilhouette.svelte";

  // The winner screen, after a match result: the winner's picture slams in
  // across a full-width banner through the middle of the screen, with the
  // match title and 勝者 / WINNER above it and the name tag, final score and
  // who they beat below. The "[name] wins!" call starts with the slam
  // (WINNER_SLAM in sounds.ts). It then holds, with the rays turning, until
  // `leaving` is set (the next match starting), plays its exit, and calls
  // ondone.
  //
  // Same conventions as VsIntro: a fixed 1920×1080 canvas, scaled to fit;
  // pure CSS keyframes, every duration and delay multiplied by --k (`slow`).
  // The banner takes the colour the winner had in the intro (p1 red, p2
  // blue), and the name tag sits on that side, as it did in the intro.
  //
  // img: the cut-out's URL ("" for the silhouette); cut-outs face left, and
  // mirror flips one that faces the other way. victory: the victory pose, shown
  // instead of the cut-out when there is one; never flipped (it has writing).
  type Fighter = { name: string; kana: string; img: string; victory?: string; mirror?: boolean };
  let {
    winner,
    loser,
    score = null, // [winner's, loser's]; null shows no score plate
    side = "red", // the winner's side in the VS intro: "red" (p1) or "blue" (p2)
    title = "", // matchContext(), as in the intro
    tier = "group", // bracket tier, colours the title's end caps
    walkover = false, // a no-show: WALKOVER instead of a score
    slow = 1, // timing multiplier: 2 = half speed (lab only)
    lite = false, // Pi-safe: no blur or drop-shadow filters, fewer streaks and shards
    leaving = false, // set to play the exit; ondone fires when it's over
    ondone,
  }: {
    winner: Fighter;
    loser: { name: string };
    score?: [number, number] | null;
    side?: "red" | "blue";
    title?: string;
    tier?: "wb" | "mb" | "lb" | "gf" | "group";
    walkover?: boolean;
    slow?: number;
    lite?: boolean;
    leaving?: boolean;
    ondone?: () => void;
  } = $props();

  // Timeline (ms at normal speed). Keep in step with the CSS delays below:
  //   0–430 the banner charges in from the winner's side
  //   450   slam: flash, shake, rings, shards
  //   600   勝者, then WINNER letter by letter (660–935)
  //   860   name tag; 1150 score; 1400 "defeats …"
  //   then it holds until `leaving`; the exit takes EXIT ms.
  const EXIT = 600;
  const LETTERS = [..."WINNER"];

  // Light streaks across the banner. Random once per mount; transform-only loops.
  // svelte-ignore state_referenced_locally
  const streaks = Array.from({ length: lite ? 10 : 20 }, () => ({
    top: Math.round(Math.random() * 520),
    len: Math.round(150 + Math.random() * 550),
    thick: Math.round(2 + Math.random() * 6),
    dur: Math.round(350 + Math.random() * 550),
    delay: -Math.round(Math.random() * 900),
    alpha: (0.3 + Math.random() * 0.5).toFixed(2),
    tint: Math.random() < 0.35,
  }));

  // Gold shards bursting out of the slam, from the middle of the banner.
  const SHARD_COLOURS = ["var(--gold)", "var(--gold)", "var(--paper)", "#ffe27a", "var(--c4)"];
  // svelte-ignore state_referenced_locally
  const shards = Array.from({ length: lite ? 12 : 30 }, (_, i) => {
    const a = Math.random() * Math.PI * 2;
    const r = 420 + Math.random() * 600;
    return {
      w: Math.round(12 + Math.random() * 22),
      h: Math.round(6 + Math.random() * 12),
      colour: SHARD_COLOURS[i % SHARD_COLOURS.length],
      dx: Math.round(Math.cos(a) * r),
      dy: Math.round(Math.sin(a) * r * 0.6),
      rot: Math.round((Math.random() - 0.5) * 1080),
      dur: Math.round(700 + Math.random() * 700),
    };
  });

  let w = $state(1920);
  const scale = $derived(w / 1920);

  $effect(() => {
    if (!leaving) return;
    const t = setTimeout(() => ondone?.(), EXIT * slow);
    return () => clearTimeout(t);
  });
</script>

<div
  class="win side-{side}"
  class:from-r={side === "blue"}
  class:leaving
  class:lite
  bind:clientWidth={w}
  style:--k={slow}
>
  <div class="canvas" style:transform="scale({scale})">
    <div class="backdrop"></div>
    <div class="rays-wrap"><div class="rays"></div></div>
    <div class="shake">
      <!-- The banner: the winner's picture, full width, cropped to the band. -->
      <div class="banner">
        <div class="pic">
          {#if winner.victory}
            <img src={winner.victory} alt="" />
          {:else if winner.img}
            <!-- Cut-outs face left: turned to face right for p1, as in the intro. -->
            <img src={winner.img} alt="" class:flip={(side === "red") !== !!winner.mirror} />
          {:else}
            <div class="sil"><FighterSilhouette flip={side === "red"} /></div>
          {/if}
        </div>
        <div class="tint"></div>
        <div class="focus"></div>
        <div class="streaks">
          {#each streaks as s}
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
        <div class="edge top"></div>
        <div class="edge bot"></div>
      </div>

      <div class="ring r1"></div>
      <div class="ring r2"></div>
      <div class="shards">
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

      <!-- Above the banner: 勝者 / WINNER. -->
      <div class="mark">
        <div class="shosha" lang="ja"><span>勝者</span></div>
        <div class="word">
          {#each LETTERS as c, i}
            <span class="ch" style:--at="{660 + i * 55}ms">
              <i class="g1">{c}</i><i class="g2">{c}</i><b>{c}</b>
            </span>
          {/each}
        </div>
      </div>

      <!-- Below the banner: the name tag on the winner's side, the score and
           who they beat on the other. -->
      <div class="nametag">
        {#if winner.kana}<div class="kana" lang="ja"><span>{winner.kana}</span></div>{/if}
        <div class="name" class:long={winner.name.length > 10}><span>{winner.name}</span></div>
      </div>
      <div class="result">
        {#if walkover}
          <div class="score"><div class="wo"><span>Walkover</span></div></div>
        {:else if score}
          <div class="score">
            <div class="num wn"><span>{score[0]}</span></div>
            <div class="num ln"><span>{score[1]}</span></div>
          </div>
        {/if}
        <div class="def"><s>{walkover ? "over" : "defeats"}</s>{loser.name}</div>
      </div>
    </div>
    {#if title}
      <div class="title tier-{tier}"><span>{title}</span></div>
    {/if}
    <div class="flash"></div>
  </div>
</div>

<style>
  .win {
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
  /* The winner's colours: the side they had in the VS intro. */
  .side-red {
    --c1: #5a0309;
    --c2: #b5121b;
    --c3: var(--red);
    --c4: #ff7a3d;
    --lite: #ffb199;
    --kana: #ff6b5e;
  }
  .side-blue {
    --c1: #020a4a;
    --c2: #0b2fb8;
    --c3: #1f6bff;
    --c4: #3fd0ff;
    --lite: #9fe6ff;
    --kana: #5fc4ff;
  }

  /* Layout (canvas px): title 22–110, 勝者 / WINNER 118–330, the banner
     345–805 (BAND_TOP–BAND_BOT), name tag / score / "defeats" 815–1060. */
  .backdrop {
    position: absolute;
    inset: 0;
    background:
      repeating-linear-gradient(-60deg, rgb(255 255 255 / 0.035) 0 2px, transparent 2px 16px),
      var(--field-deep);
    animation: fade-in calc(160ms * var(--k)) linear both;
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

  /* ── The banner ── */
  .banner {
    position: absolute;
    left: 0;
    right: 0;
    top: 345px;
    height: 460px;
    overflow: hidden;
    background: linear-gradient(105deg, var(--c1) 0%, var(--c2) 35%, var(--c3) 70%, var(--c4) 100%);
    animation: charge calc(450ms * var(--k)) cubic-bezier(0.2, 0.9, 0.25, 1.05) both;
  }
  .from-r .banner {
    background: linear-gradient(255deg, var(--c1) 0%, var(--c2) 35%, var(--c3) 70%, var(--c4) 100%);
    animation-name: charge-right;
  }
  @keyframes charge {
    0% {
      transform: translateX(-2000px) skewX(-14deg);
    }
    75% {
      transform: translateX(30px) skewX(3deg);
    }
    100% {
      transform: none;
    }
  }
  @keyframes charge-right {
    0% {
      transform: translateX(2000px) skewX(-14deg);
    }
    75% {
      transform: translateX(-30px) skewX(3deg);
    }
    100% {
      transform: none;
    }
  }
  /* The picture, centred in the band; it arrives a beat behind the banner,
     then pulls out slowly. */
  .pic {
    position: absolute;
    inset: 0;
    transform-origin: 50% 40%;
    animation:
      pic-in calc(650ms * var(--k)) cubic-bezier(0.15, 0.85, 0.3, 1) both,
      push calc(5000ms * var(--k)) cubic-bezier(0.2, 0.6, 0.4, 1) calc(450ms * var(--k)) both;
  }
  /* Sized so a face (about a quarter of the way down the picture) sits well
     inside the band, with the rest of the figure cropped off the bottom; its
     sides fade into the banner's colour. */
  .pic img {
    position: absolute;
    left: 50%;
    top: -40px;
    width: 1080px;
    height: 720px;
    margin-left: -540px;
    object-fit: cover;
    mask-image: linear-gradient(90deg, transparent 0, #000 14%, #000 86%, transparent 100%);
  }
  .pic img.flip {
    transform: scaleX(-1);
  }
  @keyframes pic-in {
    from {
      translate: -500px 0;
    }
  }
  .from-r .pic {
    animation-name: pic-in-right, push;
  }
  @keyframes pic-in-right {
    from {
      translate: 500px 0;
    }
  }
  @keyframes push {
    from {
      transform: scale(1.14);
    }
    to {
      transform: scale(1.03);
    }
  }
  .sil {
    position: absolute;
    left: 50%;
    top: 30px;
    width: 600px;
    margin-left: -300px;
  }
  /* The winner's colour washes in from the banner's ends, so the picture
     sits in it. */
  .tint {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      var(--c2) 0%,
      color-mix(in srgb, var(--c3) 45%, transparent) 14%,
      transparent 32% 68%,
      color-mix(in srgb, var(--c3) 45%, transparent) 86%,
      var(--c2) 100%
    );
  }
  /* Manga focus lines, clear of the middle where the face is. */
  .focus {
    position: absolute;
    width: 2600px;
    height: 2600px;
    left: -340px;
    top: -1070px;
    background: repeating-conic-gradient(rgb(255 255 255 / 0.12) 0deg 1.2deg, transparent 1.2deg 6deg);
    mask-image: radial-gradient(circle, transparent 0 520px, #000 820px);
    animation: focus-flicker calc(240ms * var(--k)) steps(1) infinite;
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
  .streaks {
    position: absolute;
    inset: -60px -200px;
    transform: rotate(-4deg);
  }
  .streaks i {
    position: absolute;
    left: 0;
    border-radius: 99px;
    background: linear-gradient(90deg, transparent, #fff);
    animation: streak calc(var(--dur) * var(--k)) linear calc(var(--delay) * var(--k)) infinite;
  }
  .streaks i.tint {
    background: linear-gradient(90deg, transparent, var(--lite));
  }
  .from-r .streaks i {
    animation-name: streak-rev;
    background: linear-gradient(270deg, transparent, #fff);
  }
  .from-r .streaks i.tint {
    background: linear-gradient(270deg, transparent, var(--lite));
  }
  @keyframes streak {
    from {
      transform: translateX(-800px);
    }
    to {
      transform: translateX(2400px);
    }
  }
  @keyframes streak-rev {
    from {
      transform: translateX(2400px);
    }
    to {
      transform: translateX(-800px);
    }
  }
  /* The band's borders, as in the VS intro: ink outside, white inside. */
  .edge {
    position: absolute;
    left: 0;
    right: 0;
    height: 20px;
  }
  .edge.top {
    top: 0;
    background: linear-gradient(var(--ink) 0 7px, var(--paper) 7px 100%);
  }
  .edge.bot {
    bottom: 0;
    background: linear-gradient(var(--paper) 0 13px, var(--ink) 13px 100%);
  }

  /* Gold rays turning behind WINNER: the idle motion while it holds. */
  .rays-wrap {
    position: absolute;
    left: 960px;
    top: 230px;
    width: 0;
    height: 0;
    opacity: 0;
    animation: fade-in-to calc(500ms * var(--k)) ease-out calc(450ms * var(--k)) forwards;
  }
  @keyframes fade-in-to {
    to {
      opacity: 1;
    }
  }
  .rays {
    position: absolute;
    left: -1100px;
    top: -1100px;
    width: 2200px;
    height: 2200px;
    background: repeating-conic-gradient(rgb(255 226 122 / 0.3) 0deg 6deg, transparent 6deg 15deg);
    mask-image: radial-gradient(circle, #000 10%, transparent 42%);
    animation: spin calc(24000ms * var(--k)) linear infinite;
  }
  @keyframes spin {
    to {
      rotate: 360deg;
    }
  }

  /* ── Slam ── */
  .shake {
    position: absolute;
    inset: 0;
    animation: shake calc(240ms * var(--k)) linear calc(450ms * var(--k));
  }
  @keyframes shake {
    0% { transform: translate(0, 0); }
    15% { transform: translate(-18px, 10px); }
    30% { transform: translate(15px, -12px); }
    45% { transform: translate(-10px, -6px); }
    60% { transform: translate(9px, 8px); }
    75% { transform: translate(-5px, 3px); }
    90% { transform: translate(3px, -2px); }
    100% { transform: translate(0, 0); }
  }
  .ring {
    position: absolute;
    left: 960px;
    top: 575px;
    width: 300px;
    height: 300px;
    margin: -150px 0 0 -150px;
    border-radius: 50%;
    opacity: 0;
    animation: ring calc(560ms * var(--k)) cubic-bezier(0.1, 0.7, 0.3, 1) calc(450ms * var(--k)) forwards;
  }
  .r1 {
    border: 16px solid #fff;
    box-shadow:
      0 0 40px #fff,
      inset 0 0 30px #fff;
  }
  .r2 {
    border: 10px solid var(--gold);
    animation-delay: calc(560ms * var(--k));
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
  .flash {
    position: absolute;
    inset: 0;
    background: #fff;
    opacity: 0;
    pointer-events: none;
    animation: flash calc(360ms * var(--k)) ease-out calc(450ms * var(--k)) forwards;
  }
  @keyframes flash {
    0% {
      opacity: 0.92;
    }
    100% {
      opacity: 0;
    }
  }
  .shards {
    position: absolute;
    left: 960px;
    top: 575px;
  }
  .shards i {
    position: absolute;
    left: 0;
    top: 0;
    width: var(--w);
    height: var(--h);
    background: var(--col);
    opacity: 0;
    animation: shard calc(var(--dur) * var(--k)) cubic-bezier(0.1, 0.8, 0.3, 1) calc(450ms * var(--k)) forwards;
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

  /* ── 勝者 / WINNER, above the banner ── */
  /* 勝者 is in the kana font subset already (theme.css header). */
  .mark {
    position: absolute;
    left: 0;
    right: 0;
    top: 116px;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 34px;
  }
  .shosha {
    transform: skewX(-12deg);
    background: var(--ink);
    color: var(--gold);
    border: 4px solid var(--gold);
    padding: 6px 26px 12px;
    font-family: var(--font-display);
    font-size: 76px;
    line-height: 1;
    letter-spacing: 0.12em;
    animation: tag-pop calc(300ms * var(--k)) cubic-bezier(0.2, 0.9, 0.3, 1.3) calc(600ms * var(--k)) both;
  }
  .shosha span {
    display: block;
    transform: skewX(12deg);
  }
  @keyframes tag-pop {
    from {
      transform: skewX(-12deg) scale(0);
    }
  }
  .word {
    display: flex;
  }
  /* Each letter slams down from oversize, a beat after the last, with a
     side-colour and a gold ghost snapping together behind it (as VS does). */
  .ch {
    position: relative;
    font-family: var(--font-display);
    font-stretch: 85%;
    font-size: 214px;
    line-height: 1;
    opacity: 0;
    animation:
      ch-slam calc(200ms * var(--k)) cubic-bezier(0.55, 0, 1, 0.6) calc(var(--at) * var(--k)) forwards,
      ch-glow calc(1300ms * var(--k)) ease-in-out calc(1400ms * var(--k)) infinite alternate;
  }
  .ch i,
  .ch b {
    font: inherit;
    font-style: normal;
  }
  /* Metallic fill over a heavy ink outline; padded so the background-clip
     fill covers the italic lean (see VsIntro). */
  .ch b {
    position: relative;
    display: block;
    padding: 0.1em 0.12em;
    margin: -0.1em -0.12em;
    background: linear-gradient(180deg, #fff 0%, #fff 36%, #ffe27a 56%, #ff8a1f 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    -webkit-text-stroke: 12px var(--ink);
    paint-order: stroke fill;
  }
  .ch i {
    position: absolute;
    left: 0;
    top: 0;
    color: var(--c3);
    opacity: 0;
    animation: ghost calc(320ms * var(--k)) ease-out calc((var(--at) + 140ms) * var(--k)) forwards;
  }
  .ch i.g1 {
    --dx: -40px;
  }
  .ch i.g2 {
    color: var(--gold);
    --dx: 40px;
  }
  @keyframes ch-slam {
    0% {
      opacity: 0;
      transform: translate(60px, -160px) rotate(-14deg) scale(3);
    }
    60% {
      opacity: 1;
    }
    100% {
      opacity: 1;
      transform: none;
    }
  }
  @keyframes ghost {
    0% {
      opacity: 0.95;
      transform: translateX(var(--dx));
    }
    100% {
      opacity: 0;
      transform: none;
    }
  }
  @keyframes ch-glow {
    from {
      filter: drop-shadow(0 0 10px rgb(255 255 255 / 0.5)) drop-shadow(0 0 22px rgb(255 200 80 / 0.4));
    }
    to {
      filter: drop-shadow(0 0 18px #fff) drop-shadow(0 0 44px rgb(255 200 80 / 0.9));
    }
  }

  /* ── Below the banner: name tag (winner's side), result (other side) ── */
  .nametag {
    position: absolute;
    left: 70px;
    bottom: 36px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
    max-width: 1000px;
  }
  .from-r .nametag {
    left: auto;
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
    color: var(--kana);
    padding: 6px 26px 10px;
    font-family: var(--font-display);
    font-size: 54px;
    line-height: 1;
    letter-spacing: 0.06em;
    animation: tag-in calc(320ms * var(--k)) cubic-bezier(0.2, 0.9, 0.3, 1.15) calc(980ms * var(--k)) both;
  }
  .name {
    background: var(--paper);
    border: 5px solid var(--ink);
    border-left: 26px solid var(--c3);
    box-shadow: 10px 10px 0 var(--ink);
    padding: 4px 40px 10px;
    color: var(--ink);
    font-family: var(--font-display);
    font-stretch: 85%;
    font-size: 132px;
    line-height: 1;
    text-transform: uppercase;
    white-space: nowrap;
    animation: tag-in calc(340ms * var(--k)) cubic-bezier(0.2, 0.9, 0.3, 1.15) calc(860ms * var(--k)) both;
  }
  .name.long {
    font-stretch: 62%;
    font-size: 110px;
  }
  .from-r .name {
    border-left: 5px solid var(--ink);
    border-right: 26px solid var(--c3);
  }
  .from-r .kana,
  .from-r .name {
    animation-name: tag-in-right;
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

  .result {
    position: absolute;
    right: 70px;
    top: 825px;
    display: flex;
    align-items: center;
    gap: 30px;
  }
  .from-r .result {
    right: auto;
    left: 70px;
    flex-direction: row-reverse;
  }
  /* The winner's points big and gold on black; the loser's smaller and dim. */
  .score {
    display: flex;
    transform: skewX(-12deg);
    animation: score-in calc(340ms * var(--k)) cubic-bezier(0.2, 0.9, 0.3, 1.2) calc(1150ms * var(--k)) both;
  }
  @keyframes score-in {
    from {
      transform: translateY(80px) skewX(-12deg) scale(0.4);
      opacity: 0;
    }
  }
  .num {
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-display);
    font-stretch: 85%;
    font-size: 170px;
    line-height: 1;
    padding: 0 28px 12px;
  }
  .num span,
  .wo span {
    display: block;
    transform: skewX(12deg);
  }
  .wn {
    background: var(--ink);
    color: var(--gold);
    border: 6px solid var(--gold);
    box-shadow: 10px 10px 0 var(--ink);
  }
  .ln {
    background: #262a40;
    color: #8d93b5;
    border: 6px solid var(--ink);
    border-left: 0;
    font-size: 116px;
    padding-bottom: 8px;
  }
  .wo {
    font-family: var(--font-display);
    font-stretch: 75%;
    font-size: 120px;
    line-height: 1;
    text-transform: uppercase;
    padding: 10px 40px 18px;
    background: var(--ink);
    color: var(--gold);
    border: 6px solid var(--gold);
    box-shadow: 10px 10px 0 var(--ink);
  }
  /* "DEFEATS STORM", beside the score, reading towards it. */
  .def {
    order: -1;
    max-width: 560px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: right;
    font-family: var(--font-display);
    font-stretch: 75%;
    font-size: 64px;
    line-height: 1.1;
    color: rgb(255 255 255 / 0.9);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    animation: def-in calc(300ms * var(--k)) ease-out calc(1400ms * var(--k)) both;
  }
  .from-r .def {
    text-align: left;
  }
  .def s {
    display: block;
    text-decoration: none;
    color: rgb(255 255 255 / 0.55);
    font-size: 0.66em;
  }
  @keyframes def-in {
    from {
      opacity: 0;
      transform: translateX(40px);
    }
  }

  /* ── Match title: already up from the intro, so no entrance ── */
  .title {
    position: absolute;
    left: 50%;
    top: 22px;
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
    animation: fade-in calc(160ms * var(--k)) linear both;
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

  /* ── Leaving: when the next match starts ── */
  .leaving .shake {
    animation: leave calc(450ms * var(--k)) cubic-bezier(0.6, 0, 0.9, 0.5) forwards;
  }
  .leaving.from-r .shake {
    animation-name: leave-right;
  }
  @keyframes leave {
    to {
      transform: translateX(-1400px) skewX(-10deg);
      opacity: 0;
    }
  }
  @keyframes leave-right {
    to {
      transform: translateX(1400px) skewX(-10deg);
      opacity: 0;
    }
  }
  .leaving .title {
    animation: title-out calc(300ms * var(--k)) cubic-bezier(0.6, 0, 0.9, 0.5) forwards;
  }
  @keyframes title-out {
    to {
      transform: translateY(-160px) skewX(-12deg);
    }
  }
  .leaving .backdrop,
  .leaving .rays-wrap {
    animation: fade-out calc(250ms * var(--k)) linear calc(350ms * var(--k)) both;
  }
  .leaving .rays-wrap {
    opacity: 1; /* its fade-in held it there; fade out from it */
    animation-delay: 0ms;
  }

  /* ── Lite (Pi-safe) ── */
  /* No blur or drop-shadow filters and nothing that repaints big areas every
     frame: the rays and focus lines stand still, WINNER pulses in scale
     instead of glowing, and there are half the streaks and shards. */
  .lite .focus,
  .lite .rays {
    animation: none;
  }
  .lite .r1 {
    box-shadow: none;
  }
  .lite .ch {
    animation: ch-slam calc(200ms * var(--k)) cubic-bezier(0.55, 0, 1, 0.6) calc(var(--at) * var(--k)) forwards;
  }
  .lite .ch b {
    animation: ch-pulse calc(1300ms * var(--k)) ease-in-out calc(1400ms * var(--k)) infinite alternate;
  }
  @keyframes ch-pulse {
    to {
      transform: scale(1.04);
    }
  }

  /* ── Reduced motion ── */
  /* No charge, slam, shake, flash or flying shards: the finished frame fades
     in, holds still, and fades out. */
  @media (prefers-reduced-motion: reduce) {
    .flash,
    .ring,
    .shards,
    .streaks,
    .ch i {
      display: none;
    }
    .shake,
    .focus,
    .banner,
    .pic,
    .shosha,
    .ch,
    .ch b,
    .score,
    .def,
    .kana,
    .name {
      animation: fade-in calc(300ms * var(--k)) linear both;
    }
    .rays-wrap {
      animation: none;
      opacity: 1;
    }
    .rays {
      animation: none;
    }
    .ch {
      opacity: 1;
    }
    .leaving .shake,
    .leaving .title,
    .leaving .backdrop,
    .leaving .rays-wrap {
      animation: fade-out calc(300ms * var(--k)) linear both;
    }
  }
</style>
