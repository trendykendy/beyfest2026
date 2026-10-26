<script lang="ts">
  import ChampionScene from "$lib/components/tv/ChampionScene.svelte";
  import type { ChampionRun } from "$lib/view";
  import { page } from "$app/state";
  import { tick } from "svelte";

  // Lab page for the Champion scene. Not linked from anywhere. It's laid out
  // like the TV (1920×1080, header strip, stage padding) and scaled to fit.
  const FIGHTERS = {
    victory: {
      name: "The Buzzsaw",
      player: "Sean",
      kana: "ザ・バズソー",
      img: "/starter-fighters/buzzsaw.png",
      victory: "/starter-fighters/victory-buzzsaw.png",
    },
    picture: { name: "The Buzzsaw", player: "Sean", kana: "ザ・バズソー", img: "/starter-fighters/buzzsaw.png" },
    "no picture": { name: "The Modsmith", player: "Cuffe", kana: "ザ・モッドスミス", img: "" },
    "long name": { name: "The Torque Warden", player: "Moss", kana: "ザ・トルクウォーデン", img: "" },
    "no fighter": { name: "Ronan", player: "Ronan", kana: "", img: "" },
  };
  type Pick = keyof typeof FIGHTERS;
  const RUNNER_UP = { name: "The Breycist", player: "Conor", kana: "ザ・ブレイシスト", img: "" };

  const LOGGED: ChampionRun = {
    wins: 6,
    losses: 1,
    pointDiff: 21,
    roundsWon: 19,
    topFinish: { key: "knockout", count: 8 },
    final: { opponent: "", score: [7, 4], walkover: false },
  };
  // Results typed in as final scores only: no rounds, no favourite finish.
  const UNLOGGED: ChampionRun = { ...LOGGED, roundsWon: 0, topFinish: null };
  // The awards ticker (?noawards hides it, like a tournament with none).
  const AWARDS = [
    { key: "knockout", title: "Knockout king", name: "Sean", detail: "6 knockouts" },
    { key: "dominant", title: "Dominator", name: "Aoife & Cuffe", detail: "3 dominant finishes" },
    { key: "wall", title: "Iron wall", name: "Ronan", detail: "1.4 points let in a match" },
    { key: "comeback", title: "Comeback kid", name: "Mchale", detail: "won from 1–4 down against Steve" },
  ];

  let pick = $state<Pick>((page.url.searchParams.get("f") as Pick) ?? "picture");
  let logged = $state(!page.url.searchParams.has("unlogged"));
  let lite = $state(page.url.searchParams.has("lite"));
  let run = $state(0); // bump to replay
  let showControls = $state(!page.url.searchParams.has("clean"));

  // ?t=<ms> freezes every animation at that moment (for screenshots).
  const freezeAt = page.url.searchParams.get("t");
  $effect(() => {
    if (freezeAt === null) return;
    run; // re-freeze after a replay
    tick().then(() =>
      requestAnimationFrame(() => {
        for (const a of document.getAnimations()) {
          a.pause();
          a.currentTime = Number(freezeAt);
        }
      }),
    );
  });

  // The TV is laid out for 1920×1080; scale that to the window.
  let w = $state(1920);
  let h = $state(1080);
  const scale = $derived(Math.min(w / 1920, h / 1080));

  function replay() {
    run++;
  }
  function onkey(e: KeyboardEvent) {
    if (e.key === "h" || e.key === "H") showControls = !showControls;
    if (e.key === " " || e.key === "r" || e.key === "R") {
      e.preventDefault();
      replay();
    }
  }
</script>

<svelte:window onkeydown={onkey} bind:innerWidth={w} bind:innerHeight={h} />
<svelte:head><title>Champion · lab</title></svelte:head>

<div class="page">
  <div class="screen" style:transform="scale({scale})">
    <div class="strip"></div>
    <div class="stage">
      {#key run}
        <ChampionScene
          champion={FIGHTERS[pick]}
          runnerUp={RUNNER_UP}
          run={logged ? LOGGED : UNLOGGED}
          awards={page.url.searchParams.has("noawards") ? [] : AWARDS}
          {lite}
        />
      {/key}
    </div>
  </div>

  {#if showControls}
    <div class="controls">
      <button onclick={replay}>Replay</button>
      {#each Object.keys(FIGHTERS) as k (k)}
        <button class:on={pick === k} onclick={() => ((pick = k as Pick), replay())}>{k}</button>
      {/each}
      <label><input type="checkbox" bind:checked={logged} /> Scored round by round</label>
      <label><input type="checkbox" bind:checked={lite} onchange={replay} /> Lite (Pi)</label>
      <span class="hint">R / space replays · H hides this</span>
    </div>
  {/if}
</div>

<style>
  .page {
    position: fixed;
    inset: 0;
    background: #000;
    overflow: hidden;
  }
  .screen {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 1920px;
    height: 1080px;
    margin: -540px 0 0 -960px;
    display: flex;
    flex-direction: column;
    background:
      repeating-linear-gradient(-62deg, transparent 0 46px, rgb(255 255 255 / 0.035) 46px 48px),
      var(--field);
    color: var(--text);
    overflow: hidden;
  }
  /* Stand-in for the TV's header strip (same height). */
  .strip {
    height: 98px;
    flex: none;
    background: var(--field-deep);
    border-bottom: var(--outline) solid var(--ink);
  }
  .stage {
    flex: 1;
    min-height: 0;
    display: flex;
    padding: 26px 46px;
    overflow: hidden;
  }
  .controls {
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: 12px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 16px;
    padding: 10px 14px;
    background: rgb(0 0 0 / 0.78);
    color: #fff;
    font: 14px var(--font-text);
    border: 1px solid rgb(255 255 255 / 0.2);
  }
  button {
    font: inherit;
    padding: 4px 10px;
    background: #222;
    color: #fff;
    border: 1px solid #555;
    cursor: pointer;
  }
  button.on {
    background: var(--gold);
    color: #000;
  }
  .hint {
    opacity: 0.6;
    margin-left: auto;
  }
</style>
