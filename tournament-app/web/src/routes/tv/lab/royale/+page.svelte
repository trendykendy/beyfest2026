<script lang="ts">
  import starterList from "../../../../../static/starter-fighters/fighters.json";
  import { toFace } from "$lib/fighters";
  import RoyaleIntro from "$lib/components/tv/RoyaleIntro.svelte";
  import { page } from "$app/state";
  import { tick } from "svelte";

  // Lab page for the battle royale intro. Not linked from anywhere.
  // ?n=<2–8> fighters, ?label=…, ?noimg, ?noface (the old centred crop), ?lite, ?clean, ?t=<ms> freezes.
  const STARTERS = [
    ["The Buzzsaw", "ザ・バズソー", "buzzsaw"],
    ["The Breycist", "ザ・ブレイシスト", "breycist"],
    ["The Torque Warden", "ザ・トルクウォーデン", "torquewarden"],
    ["The Modsmith", "ザ・モッドスミス", "modsmith"],
    ["The Joyzerker", "ザ・ジョイザーカー", "joyzerker"],
    ["The Pugilist", "ザ・ピュージリスト", "pugilist"],
    ["The Underdogger", "ザ・アンダードッガー", "underdogger"],
    ["Walk-in Wendy", "", ""],
  ];
  const LABELS = ["Heat 1", "Heat 2", "Sudden death", "Final"];

  let n = $state(Math.min(8, Math.max(2, Number(page.url.searchParams.get("n") ?? 4))));
  let label = $state(page.url.searchParams.get("label") ?? LABELS[0]);
  let noImg = $state(page.url.searchParams.has("noimg"));
  let noFace = $state(page.url.searchParams.has("noface"));
  // The starters' face points (fighters.json), by picture name.
  const faceOf = (img: string) =>
    noFace ? null : toFace(starterList.find((s: { image?: string }) => s.image === `${img}.png`)?.face);
  let lite = $state(page.url.searchParams.has("lite"));
  let slow = $state(1);
  let hold = $state(false);
  let showControls = $state(!page.url.searchParams.has("clean"));
  let run = $state(0);

  const fighters = $derived(
    STARTERS.slice(0, n).map(([name, kana, img]) => ({
      name,
      kana,
      img: noImg || !img ? "" : `/starter-fighters/${img}.png`,
      face: faceOf(img),
    })),
  );

  const freezeAt = page.url.searchParams.get("t");
  $effect(() => {
    if (freezeAt === null) return;
    run;
    tick().then(() =>
      requestAnimationFrame(() => {
        for (const a of document.getAnimations()) {
          a.pause();
          a.currentTime = Number(freezeAt);
        }
      }),
    );
  });
  const replay = () => run++;
  function onkey(e: KeyboardEvent) {
    if (e.key === "h" || e.key === "H") showControls = !showControls;
    if (e.key === " " || e.key === "r" || e.key === "R") {
      e.preventDefault();
      replay();
    }
  }
</script>

<svelte:window onkeydown={onkey} />
<svelte:head><title>Battle royale intro · lab</title></svelte:head>

<div class="page">
  <div class="stage">
    {#key run}
      <RoyaleIntro {fighters} {label} {slow} {hold} {lite} />
    {/key}
  </div>

  {#if showControls}
    <div class="controls">
      <button onclick={replay}>Replay</button>
      <span class="group">
        Fighters
        {#each [2, 3, 4, 5, 6, 7, 8] as k}
          <button class:on={n === k} onclick={() => ((n = k), replay())}>{k}</button>
        {/each}
      </span>
      <span class="group">
        {#each LABELS as l}
          <button class:on={label === l} onclick={() => ((label = l), replay())}>{l}</button>
        {/each}
      </span>
      <span class="group">
        Speed
        {#each [1, 2, 4] as k}
          <button class:on={slow === k} onclick={() => ((slow = k), replay())}>{k === 1 ? "1×" : `${1 / k}×`}</button>
        {/each}
      </span>
      <label><input type="checkbox" bind:checked={hold} onchange={replay} /> Hold</label>
      <label><input type="checkbox" bind:checked={noImg} onchange={replay} /> No images</label>
      <label><input type="checkbox" bind:checked={noFace} onchange={replay} /> No face points</label>
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
    display: grid;
    place-items: center;
  }
  .stage {
    position: relative;
    width: min(100vw, calc(100vh * 16 / 9));
    aspect-ratio: 16 / 9;
    background: var(--field-deep);
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
  .group {
    display: inline-flex;
    align-items: center;
    gap: 6px;
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
