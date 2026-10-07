<script lang="ts">
  import VsIntro from "$lib/components/tv/VsIntro.svelte";
  import { page } from "$app/state";
  import { tick } from "svelte";

  // Lab page for the VS intro experiment. Not linked from anywhere. The player
  // images live in static/lab/ and are gitignored (real people, public repo).
  let p1 = $state({ name: "Rush", kana: "ラッシュ", img: "/lab/p1.png" });
  let p2 = $state({ name: "Storm", kana: "ストーム", img: "/lab/p2.png" });

  let run = $state(0); // bump to replay
  let slow = $state(1);
  let hold = $state(false);
  let loop = $state(false);
  // ?clean hides the controls from the start (for screenshots).
  let showControls = $state(!page.url.searchParams.has("clean"));

  // ?t=<ms> freezes every animation at that moment (for screenshots).
  const freezeAt = page.url.searchParams.get("t");
  // ?zoom=<n>&at=<x%>,<y%> magnifies part of the stage (for checking detail).
  const zoom = Number(page.url.searchParams.get("zoom") ?? 1);
  const zoomAt = page.url.searchParams.get("at") ?? "50%,50%";

  function replay() {
    run++;
  }

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
  function swap() {
    [p1, p2] = [p2, p1];
    replay();
  }
  function done() {
    if (loop) setTimeout(replay, 600);
  }
  function onkey(e: KeyboardEvent) {
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    if (e.key === "h" || e.key === "H") showControls = !showControls;
    if (e.key === " " || e.key === "r" || e.key === "R") {
      e.preventDefault();
      replay();
    }
  }
</script>

<svelte:window onkeydown={onkey} />
<svelte:head><title>VS intro · lab</title></svelte:head>

<div class="page">
  <div class="stage" style:transform="scale({zoom})" style:transform-origin={zoomAt.replace(",", " ")}>
    {#key run}
      <VsIntro {p1} {p2} {slow} {hold} ondone={done} />
    {/key}
  </div>

  {#if showControls}
    <div class="controls">
      <button onclick={replay}>Replay</button>
      <span class="group">
        Speed
        {#each [1, 2, 4] as k}
          <button class:on={slow === k} onclick={() => ((slow = k), replay())}>{k === 1 ? "1×" : `${1 / k}×`}</button>
        {/each}
      </span>
      <button onclick={swap}>Swap sides</button>
      <label><input type="checkbox" bind:checked={hold} onchange={replay} /> Hold at end</label>
      <label><input type="checkbox" bind:checked={loop} /> Loop</label>
      <span class="group">
        <input class="name" bind:value={p1.name} onchange={replay} />
        <input class="kana" bind:value={p1.kana} onchange={replay} />
        vs
        <input class="name" bind:value={p2.name} onchange={replay} />
        <input class="kana" bind:value={p2.kana} onchange={replay} />
      </span>
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
  /* Largest 16:9 box that fits the window. */
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
  input.name {
    width: 110px;
  }
  input.kana {
    width: 90px;
  }
  .hint {
    opacity: 0.6;
    margin-left: auto;
  }
</style>
