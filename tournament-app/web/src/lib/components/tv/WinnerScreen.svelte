<script lang="ts">
  import { onMount } from "svelte";
  import FighterSilhouette from "./FighterSilhouette.svelte";

  // The winner screen, after every match result: the VS intro's band comes
  // back, the winner's half charges across and knocks the loser's half off
  // the screen, then 勝者 / WINNER slams in over gold rays with the final
  // score, the winner's name tag and who they beat. Short and punchy: the
  // "[name] wins!" call starts with the slam (WINNER_SLAM in sounds.ts) and
  // the screen leaves on the stinger's last hit (winnerOut).
  //
  // Same conventions as VsIntro: a fixed 1920×1080 canvas, scaled to fit;
  // pure CSS keyframes, every duration and delay multiplied by --k (`slow`).
  // The winner keeps the colour (and side) they had in the intro: p1 red from
  // the left, p2 blue from the right. Everything is laid out for a winner
  // from the left; .from-r mirrors the band (not the text) for the right.
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
    hold = false, // stay on the held frame instead of leaving (lab only)
    lite = false, // Pi-safe: no blur or drop-shadow filters, fewer streaks and shards
    out = 4900, // ms: when it leaves (later while the announcer talks, see winnerOut)
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
    hold?: boolean;
    lite?: boolean;
    out?: number;
    ondone?: () => void;
  } = $props();

  // Timeline (ms at normal speed). Keep in step with the CSS delays below:
  //   0     the two halves, as the intro left them
  //   0–450 the winner's half charges across
  //   450   slam: flash, shake, rings, shards; the loser's half is knocked off
  //   640   勝者, then WINNER letter by letter (700–975)
  //   860   name tag; 1150 score; 1400 "defeats …"
  //   OUT   everything leaves; END gone, ondone fires
  // Fixed for the screen's life: it's timed once, when it starts.
  // svelte-ignore state_referenced_locally
  const OUT = out;
  const END = OUT + 600;
  // svelte-ignore state_referenced_locally
  const fromR = side === "blue";

  const LETTERS = [..."WINNER"];

  // Light streaks across the band. Random once per mount; transform-only loops.
  // svelte-ignore state_referenced_locally
  const streaks = Array.from({ length: lite ? 12 : 24 }, () => ({
    top: Math.round(Math.random() * 1080),
    len: Math.round(150 + Math.random() * 550),
    thick: Math.round(2 + Math.random() * 7),
    dur: Math.round(350 + Math.random() * 550),
    delay: -Math.round(Math.random() * 900),
    alpha: (0.35 + Math.random() * 0.65).toFixed(2),
    tint: Math.random() < 0.35,
  }));

  // Gold shards bursting out of the slam.
  const SHARD_COLOURS = ["var(--gold)", "var(--gold)", "var(--paper)", "#ffe27a", "var(--c4)"];
  // svelte-ignore state_referenced_locally
  const shards = Array.from({ length: lite ? 12 : 28 }, (_, i) => {
    const a = Math.random() * Math.PI * 2;
    const r = 380 + Math.random() * 520;
    return {
      w: Math.round(12 + Math.random() * 22),
      h: Math.round(6 + Math.random() * 12),
      colour: SHARD_COLOURS[i % SHARD_COLOURS.length],
      dx: Math.round(Math.cos(a) * r),
      dy: Math.round(Math.sin(a) * r * 0.75),
      rot: Math.round((Math.random() - 0.5) * 1080),
      dur: Math.round(700 + Math.random() * 700),
    };
  });

  let w = $state(1920);
  const scale = $derived(w / 1920);

  onMount(() => {
    if (hold) return;
    const t = setTimeout(() => ondone?.(), END * slow);
    return () => clearTimeout(t);
  });
</script>

<div
  class="win side-{side}"
  class:from-r={fromR}
  class:hold
  class:lite
  bind:clientWidth={w}
  style:--k={slow}
  style:--out="{OUT}ms"
>
  <div class="canvas" style:transform="scale({scale})">
    <div class="backdrop"></div>
    <div class="shake">
      <!-- The band and the picture: mirrored for a winner from the right. -->
      <div class="go">
        <div class="mirror">
          <div class="half lose">
            <div class="lose-bg"><div class="edge top"></div><div class="edge bot"></div></div>
            <div class="lname"><span>{loser.name}</span></div>
          </div>
          <div class="band">
            <div class="rays"></div>
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
          <div class="panel">
            <div class="rim"></div>
            <div class="rim2"></div>
            <div class="pic">
              <div class="push">
                {#if winner.victory}
                  <img src={winner.victory} alt="" class:flip={fromR} />
                {:else if winner.img}
                  <img src={winner.img} alt="" class:flip={!winner.mirror} />
                {:else}
                  <!-- Un-mirrored, so the "?" reads the right way round. -->
                  <div class="sil"><FighterSilhouette flip={!fromR} /></div>
                {/if}
              </div>
            </div>
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
        </div>
      </div>

      <!-- The words: never mirrored, laid out on the other side from the picture. -->
      <div class="fly">
        <div class="mark">
          <div class="shosha" lang="ja"><span>勝者</span></div>
          <div class="word">
            {#each LETTERS as c, i}
              <span class="ch" style:--at="{700 + i * 55}ms">
                <i class="g1">{c}</i><i class="g2">{c}</i><b>{c}</b>
              </span>
            {/each}
          </div>
        </div>
        {#if walkover}
          <div class="score"><div class="wo"><span>Walkover</span></div></div>
        {:else if score}
          <div class="score">
            <div class="num wn"><span>{score[0]}</span></div>
            <div class="num ln"><span>{score[1]}</span></div>
          </div>
        {/if}
        <div class="def" class:solo={!walkover && !score}><s>{walkover ? "over" : "defeats"}</s>{loser.name}</div>
        <div class="nametag">
          {#if winner.kana}<div class="kana" lang="ja"><span>{winner.kana}</span></div>{/if}
          <div class="name" class:long={winner.name.length > 10}><span>{winner.name}</span></div>
        </div>
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
  /* The winner's colours: the side they had in the VS intro. --l* are the
     loser's half, the other side's colours. */
  .side-red {
    --c1: #5a0309;
    --c2: #b5121b;
    --c3: var(--red);
    --c4: #ff7a3d;
    --lite: #ffb199;
    --kana: #ff6b5e;
    --l1: #020a4a;
    --l2: #0b2fb8;
    --l3: #3fd0ff;
  }
  .side-blue {
    --c1: #020a4a;
    --c2: #0b2fb8;
    --c3: #1f6bff;
    --c4: #3fd0ff;
    --lite: #9fe6ff;
    --kana: #5fc4ff;
    --l1: #5a0309;
    --l2: #b5121b;
    --l3: #ff7a3d;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    background:
      repeating-linear-gradient(-60deg, rgb(255 255 255 / 0.035) 0 2px, transparent 2px 16px),
      var(--field-deep);
    animation: fade-in calc(160ms * var(--k)) linear both;
  }
  .win:not(.hold) .backdrop {
    animation:
      fade-in calc(160ms * var(--k)) linear both,
      fade-out calc(250ms * var(--k)) linear calc(var(--out) * var(--k) + 350ms * var(--k)) forwards;
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

  .go,
  .mirror,
  .fly {
    position: absolute;
    inset: 0;
  }
  .from-r .mirror {
    transform: scaleX(-1);
  }

  /* The band's borders, as in the VS intro: ink outside, white inside. */
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

  /* ── Opening: the loser's half, as the intro left it, knocked off ── */
  .half {
    position: absolute;
    inset: 0;
  }
  .lose {
    animation:
      fade-in calc(120ms * var(--k)) linear both,
      knocked calc(520ms * var(--k)) cubic-bezier(0.3, 0.6, 0.6, 1) calc(430ms * var(--k)) forwards;
  }
  .lose-bg {
    position: absolute;
    inset: 0;
    clip-path: polygon(1080px 150px, 1920px 150px, 1920px 930px, 840px 930px);
    background: linear-gradient(255deg, var(--l1) 0%, var(--l2) 60%, var(--l3) 100%);
  }
  /* It dims as it's hit. */
  .lose-bg::after {
    content: "";
    position: absolute;
    inset: 0;
    background: #000;
    opacity: 0;
    animation: dim calc(300ms * var(--k)) linear calc(430ms * var(--k)) forwards;
  }
  @keyframes dim {
    to {
      opacity: 0.6;
    }
  }
  @keyframes knocked {
    to {
      transform: translate(2100px, 160px) rotate(14deg);
      visibility: hidden;
    }
  }
  .lname {
    position: absolute;
    right: 70px;
    bottom: 80px;
    transform: skewX(-12deg);
    background: var(--paper);
    border: 5px solid var(--ink);
    border-right: 26px solid var(--l3);
    box-shadow: 10px 10px 0 var(--ink);
    padding: 4px 40px 10px;
    font-family: var(--font-display);
    font-stretch: 85%;
    font-size: 132px;
    line-height: 1;
    text-transform: uppercase;
    color: var(--ink);
    white-space: nowrap;
  }
  .lname span {
    display: block;
    transform: skewX(12deg);
  }
  .from-r .lname span {
    transform: scaleX(-1) skewX(12deg);
  }

  /* ── The winner's band: charges across and takes the screen ── */
  /* Wider than the screen, so its slanted front shows while it charges. */
  .band {
    position: absolute;
    inset: 0 -300px 0 0;
    clip-path: polygon(0 150px, 2200px 150px, 1960px 930px, 0 930px);
    background: linear-gradient(105deg, var(--c1) 0%, var(--c2) 35%, var(--c3) 70%, var(--c4) 100%);
    animation: charge calc(450ms * var(--k)) cubic-bezier(0.5, 0, 0.75, 0.4) both;
  }
  @keyframes charge {
    0% {
      transform: translateX(-1120px);
    }
    60% {
      transform: translateX(-1030px);
    }
    100% {
      transform: none;
    }
  }
  .focus {
    position: absolute;
    width: 2600px;
    height: 2600px;
    left: -900px;
    top: -760px;
    background: repeating-conic-gradient(rgb(255 255 255 / 0.13) 0deg 1.2deg, transparent 1.2deg 6deg);
    mask-image: radial-gradient(circle, transparent 0 300px, #000 560px);
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
    inset: -200px;
    transform: rotate(-7deg);
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
  @keyframes streak {
    from {
      transform: translateX(-800px);
    }
    to {
      transform: translateX(2400px);
    }
  }
  /* Gold rays turning behind WINNER. */
  .rays {
    position: absolute;
    left: 1420px;
    top: 400px;
    width: 2000px;
    height: 2000px;
    margin: -1000px 0 0 -1000px;
    background: repeating-conic-gradient(rgb(255 226 122 / 0.32) 0deg 6deg, transparent 6deg 15deg);
    mask-image: radial-gradient(circle, #000 12%, transparent 48%);
    opacity: 0;
    animation:
      rays-in calc(500ms * var(--k)) ease-out calc(450ms * var(--k)) forwards,
      spin calc(24000ms * var(--k)) linear infinite;
  }
  @keyframes rays-in {
    to {
      opacity: 1;
    }
  }
  @keyframes spin {
    to {
      rotate: 360deg;
    }
  }

  /* ── The winner's picture, in a slanted manga panel ── */
  .panel {
    position: absolute;
    inset: 0;
    animation: panel-in calc(560ms * var(--k)) cubic-bezier(0.15, 0.85, 0.3, 1.05) calc(200ms * var(--k)) both;
  }
  @keyframes panel-in {
    from {
      transform: translateX(-700px);
    }
  }
  .rim,
  .rim2,
  .pic {
    position: absolute;
    inset: 0;
  }
  .rim {
    background: var(--ink);
    clip-path: polygon(0 170px, 1172px 170px, 948px 910px, 0 910px);
  }
  .rim2 {
    background: var(--paper);
    clip-path: polygon(0 170px, 1160px 170px, 936px 910px, 0 910px);
  }
  .pic {
    overflow: hidden;
    clip-path: polygon(0 170px, 1138px 170px, 914px 910px, 0 910px);
    background: radial-gradient(circle at 40% 45%, var(--c4), var(--c2) 55%, var(--c1));
  }
  /* A slow pull-out from the slam on. */
  .push {
    position: absolute;
    left: -40px;
    top: 140px;
    width: 1200px;
    height: 800px;
    transform-origin: 50% 60%;
    animation: push calc(4400ms * var(--k)) linear calc(450ms * var(--k)) both;
  }
  @keyframes push {
    from {
      transform: scale(1.12);
    }
    to {
      transform: scale(1.02);
    }
  }
  .push img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .push img.flip {
    transform: scaleX(-1);
  }
  .sil {
    position: absolute;
    left: 100px;
    top: 90px;
    width: 860px;
  }
  .from-r .sil {
    transform: scaleX(-1);
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
    left: 1060px;
    top: 540px;
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
      transform: scale(4.6);
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
    left: 1060px;
    top: 540px;
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

  /* ── 勝者 / WINNER ── */
  /* 勝者 is in the kana font subset already (theme.css header). */
  .mark {
    position: absolute;
    left: 1010px;
    top: 196px;
  }
  .from-r .mark {
    left: 50px;
  }
  .shosha {
    display: inline-block;
    margin-left: 40px;
    transform: skewX(-12deg);
    background: var(--ink);
    color: var(--gold);
    padding: 4px 30px 10px;
    font-family: var(--font-display);
    font-size: 64px;
    line-height: 1;
    letter-spacing: 0.14em;
    animation: tag-pop calc(300ms * var(--k)) cubic-bezier(0.2, 0.9, 0.3, 1.3) calc(640ms * var(--k)) both;
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
    margin-top: -6px;
  }
  /* Each letter slams down from oversize, a beat after the last, with a
     side-colour and a gold ghost snapping together behind it (as VS does). */
  .ch {
    position: relative;
    font-family: var(--font-display);
    font-stretch: 85%;
    font-size: 236px;
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

  /* ── Score ── */
  /* The winner's points big and gold on black; the loser's smaller and dim. */
  .score {
    position: absolute;
    left: 1210px;
    top: 516px;
    display: flex;
    transform: skewX(-12deg);
    animation: score-in calc(340ms * var(--k)) cubic-bezier(0.2, 0.9, 0.3, 1.2) calc(1150ms * var(--k)) both;
  }
  .from-r .score {
    left: auto;
    right: 1210px;
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
    font-size: 220px;
    line-height: 1;
    padding: 0 30px 14px;
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
    font-size: 150px;
    padding-bottom: 8px;
  }
  .wo {
    font-family: var(--font-display);
    font-stretch: 75%;
    font-size: 150px;
    line-height: 1;
    text-transform: uppercase;
    padding: 6px 40px 16px;
    background: var(--ink);
    color: var(--gold);
    border: 6px solid var(--gold);
    box-shadow: 10px 10px 0 var(--ink);
  }
  .def {
    position: absolute;
    left: 1200px;
    top: 786px;
    max-width: 680px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-display);
    font-stretch: 75%;
    font-size: 52px;
    line-height: 1.1;
    color: rgb(255 255 255 / 0.85);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    animation: def-in calc(300ms * var(--k)) ease-out calc(1400ms * var(--k)) both;
  }
  .def.solo {
    top: 560px;
    font-size: 72px;
  }
  .from-r .def {
    left: auto;
    right: 1200px;
    text-align: right;
  }
  .def s {
    text-decoration: none;
    color: rgb(255 255 255 / 0.55);
    font-size: 0.77em;
    margin-right: 12px;
  }
  @keyframes def-in {
    from {
      opacity: 0;
      transform: translateX(40px);
    }
  }

  /* ── Name tag, where the intro had it ── */
  .nametag {
    position: absolute;
    bottom: 80px;
    left: 70px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
    max-width: 900px;
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

  /* ── Match title: already up from the intro, so no entrance ── */
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

  /* ── Leaving: the band and words go the way the winner came from ── */
  .win:not(.hold) .go,
  .win:not(.hold) .fly {
    animation: leave calc(450ms * var(--k)) cubic-bezier(0.6, 0, 0.9, 0.5) calc(var(--out) * var(--k)) forwards;
  }
  .win.from-r:not(.hold) .go,
  .win.from-r:not(.hold) .fly {
    animation-name: leave-right;
  }
  @keyframes leave {
    to {
      transform: translateX(-1300px) skewX(-10deg);
    }
  }
  @keyframes leave-right {
    to {
      transform: translateX(1300px) skewX(-10deg);
    }
  }
  .win:not(.hold) .title {
    animation:
      fade-in calc(160ms * var(--k)) linear both,
      title-out calc(300ms * var(--k)) cubic-bezier(0.6, 0, 0.9, 0.5) calc(var(--out) * var(--k)) forwards;
  }
  @keyframes title-out {
    to {
      transform: translateY(-160px) skewX(-12deg);
    }
  }

  /* ── Lite (Pi-safe) ── */
  /* No blur or drop-shadow filters and nothing that repaints big areas every
     frame: the rays and focus lines stand still, WINNER pulses in scale
     instead of glowing, and there are half the streaks and shards. */
  .lite .focus,
  .lite .rays {
    animation: none;
  }
  .lite .rays {
    opacity: 1;
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
     in, holds, and fades out. */
  @media (prefers-reduced-motion: reduce) {
    .flash,
    .ring,
    .shards,
    .streaks,
    .lose,
    .ch i {
      display: none;
    }
    .shake,
    .focus,
    .band,
    .panel,
    .push,
    .shosha,
    .ch,
    .ch b,
    .score,
    .def,
    .kana,
    .name {
      animation: fade-in calc(300ms * var(--k)) linear both;
    }
    .rays {
      animation: none;
      opacity: 1;
    }
    .ch {
      opacity: 1;
    }
    .win:not(.hold) .go,
    .win:not(.hold) .fly,
    .win:not(.hold) .title {
      animation: fade-out calc(300ms * var(--k)) linear calc(var(--out) * var(--k)) forwards;
    }
  }
</style>
