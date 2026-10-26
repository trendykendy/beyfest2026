<script lang="ts">
  import starterList from "../../../../../static/starter-fighters/fighters.json";
  import { toFace } from "$lib/fighters";
  import { planRoyale } from "$lib/royale";
  import RoyaleDraw from "$lib/components/tv/RoyaleDraw.svelte";
  import { page } from "$app/state";
  import { tick } from "svelte";

  // Lab page for the battle royale draw (shown when the heats are generated).
  // Not linked from anywhere.
  // ?n=<players> ?spaces=<2–8> ?noimg ?noface ?lite ?clean ?t=<ms> freezes.
  // The 12 starters, then walk-ins without a fighter (silhouettes).
  type Starter = { name: string; kana?: string; image?: string; face?: unknown };
  const STARTERS = starterList as Starter[];

  let n = $state(Math.min(40, Math.max(2, Number(page.url.searchParams.get("n") ?? 12))));
  let spaces = $state(Math.min(8, Math.max(2, Number(page.url.searchParams.get("spaces") ?? 5))));
  let noImg = $state(page.url.searchParams.has("noimg"));
  let noFace = $state(page.url.searchParams.has("noface"));
  let lite = $state(page.url.searchParams.has("lite"));
  let slow = $state(1);
  let hold = $state(true);
  let showControls = $state(!page.url.searchParams.has("clean"));
  let run = $state(0);

  const fighters = $derived(
    Array.from({ length: n }, (_, i) => {
      const s = STARTERS[i];
      if (!s) return { name: `Walk-in ${i + 1}`, kana: "", img: "", face: null };
      return {
        name: s.name,
        kana: s.kana ?? "",
        img: noImg || !s.image ? "" : `/starter-fighters/${s.image}`,
        face: noFace ? null : toFace(s.face),
      };
    }),
  );
  const plan = $derived(planRoyale(n, spaces));

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
<svelte:head><title>Battle royale draw · lab</title></svelte:head>

<div class="page">
  <div class="stage">
    {#if "error" in plan}
      <p class="err">{plan.error}</p>
    {:else}
      {#key run}
        <RoyaleDraw {fighters} heats={plan.heats} finalSize={plan.finalSize} sudden={plan.sudden} {slow} {hold} {lite} />
      {/key}
    {/if}
  </div>

  {#if showControls}
    <div class="controls">
      <button onclick={replay}>Replay</button>
      <span class="group">
        Bladers
        {#each [4, 6, 9, 12, 16, 20, 24, 32] as k}
          <button class:on={n === k} onclick={() => ((n = k), replay())}>{k}</button>
        {/each}
      </span>
      <span class="group">
        Spaces
        {#each [3, 4, 5, 6, 8] as k}
          <button class:on={spaces === k} onclick={() => ((spaces = k), replay())}>{k}</button>
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
      <label><input type="checkbox" bind:checked={lite} onchange={replay} /> Lite</label>
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
  .err {
    padding: 40px;
    font-size: 24px;
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
