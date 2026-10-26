<script lang="ts">
  import starterList from "../../../../../static/starter-fighters/fighters.json";
  import { toFace } from "$lib/fighters";
  import QualifiedScreen from "$lib/components/tv/QualifiedScreen.svelte";
  import { Announcer } from "$lib/components/tv/announcer";
  import { AND, QUALIFIED, QUALIFIED_CALL, qualifiedCall } from "$lib/sounds";
  import { page } from "$app/state";
  import { onMount, tick } from "svelte";

  // Lab page for the battle royale's Qualified screen. Not linked from anywhere.
  // ?n=<1–4> through, ?sd (a runner-up to the sudden death), ?label=…,
  // ?noimg, ?noface (the old centred crop), ?lite, ?clean, ?t=<ms> freezes.
  const SF = "/starter-fighters/";
  const STARTERS = [
    ["The Buzzsaw", "ザ・バズソー", "buzzsaw", "the-buzzsaw"],
    ["The Torque Warden", "ザ・トルクウォーデン", "torquewarden", "the-torque-warden"],
    ["The Modsmith", "ザ・モッドスミス", "modsmith", "the-modsmith"],
    ["Walk-in Wendy", "", "", ""],
  ];
  const LABELS = ["Heat 1", "Heat 2", "Sudden death"];

  const q = page.url.searchParams;
  let n = $state(Math.min(4, Math.max(1, Number(q.get("n") ?? 2))));
  let toSudden = $state(q.has("sd"));
  let label = $state(q.get("label") ?? LABELS[0]);
  let noImg = $state(q.has("noimg"));
  let noFace = $state(q.has("noface"));
  // The starters' face points (fighters.json), by picture name.
  const faceOf = (img: string) =>
    noFace ? null : toFace(starterList.find((s: { image?: string }) => s.image === `${img}.png`)?.face);
  let lite = $state(q.has("lite"));
  let slow = $state(1);
  let leaving = $state(false);
  let gone = $state(false);
  let showControls = $state(!q.has("clean"));
  let run = $state(0);

  const fighters = $derived(
    STARTERS.slice(0, n).map(([name, kana, img]) => ({ name, kana, img: noImg || !img ? "" : `${SF}${img}.png`, face: faceOf(img) })),
  );
  const voices = $derived(STARTERS.slice(0, n).map(([, , , v]) => (v ? `${SF}${v}.mp3` : "")));

  const freezeAt = q.get("t");
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

  // ── Sound: the TV's call, from the panels landing (no music here). ──
  const announcer = new Announcer();
  let sound = $state(false);
  onMount(() => {
    announcer.setEnabled(false);
    return () => announcer.setEnabled(false);
  });
  function toggleSound() {
    announcer.setEnabled(sound);
    if (sound) {
      [AND, QUALIFIED, ...STARTERS.map(([, , , v]) => (v ? `${SF}${v}.mp3` : ""))].forEach((u) => u && announcer.preload(u));
      replay();
    }
  }

  function replay() {
    leaving = false;
    gone = false;
    run++;
    if (sound) {
      announcer.silenceMatch(0);
      announcer.endMatch(qualifiedCall(voices), false, QUALIFIED_CALL);
    }
  }
  function onkey(e: KeyboardEvent) {
    if (e.key === "h" || e.key === "H") showControls = !showControls;
    if (e.key === "l" || e.key === "L") leaving = true;
    if (e.key === " " || e.key === "r" || e.key === "R") {
      e.preventDefault();
      replay();
    }
  }
</script>

<svelte:window onkeydown={onkey} />
<svelte:head><title>Qualified screen · lab</title></svelte:head>

<div class="page">
  <div class="stage">
    {#if !gone}
      {#key run}
        <QualifiedScreen
          {fighters}
          {label}
          toSudden={toSudden ? "Tadhg" : ""}
          {slow}
          {lite}
          {leaving}
          ondone={() => (gone = true)}
        />
      {/key}
    {/if}
  </div>

  {#if showControls}
    <div class="controls">
      <button onclick={replay}>Replay</button>
      <button onclick={() => (leaving = true)} disabled={gone}>Next battle starts (leave)</button>
      <label class="snd"><input type="checkbox" bind:checked={sound} onchange={toggleSound} /> Sound</label>
      <span class="group">
        Through
        {#each [1, 2, 3, 4] as k}
          <button class:on={n === k} onclick={() => ((n = k), replay())}>{k}</button>
        {/each}
      </span>
      <label><input type="checkbox" bind:checked={toSudden} onchange={replay} /> Runner-up → sudden death</label>
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
      <label><input type="checkbox" bind:checked={noImg} onchange={replay} /> No images</label>
      <label><input type="checkbox" bind:checked={noFace} onchange={replay} /> No face points</label>
      <label><input type="checkbox" bind:checked={lite} onchange={replay} /> Lite (Pi)</label>
      <span class="hint">R / space replays · L leaves · H hides this</span>
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
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  button.on {
    background: var(--gold);
    color: #000;
  }
  .snd {
    font-weight: 700;
    color: var(--gold);
  }
  .hint {
    opacity: 0.6;
    margin-left: auto;
  }
</style>
