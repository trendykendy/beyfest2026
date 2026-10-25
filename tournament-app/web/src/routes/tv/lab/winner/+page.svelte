<script lang="ts">
  import WinnerScreen from "$lib/components/tv/WinnerScreen.svelte";
  import { WINNER_OUT } from "$lib/sounds";
  import { page } from "$app/state";
  import { tick } from "svelte";

  // Lab page for the winner screen. Not linked from anywhere. Uses the
  // starter fighters' pictures (static/starter-fighters).
  const FIGHTERS = {
    picture: { name: "The Buzzsaw", kana: "ザ・バズソー", img: "/starter-fighters/buzzsaw.png" },
    victory: {
      name: "The Buzzsaw",
      kana: "ザ・バズソー",
      img: "/starter-fighters/buzzsaw.png",
      victory: "/starter-fighters/victory-buzzsaw.png",
    },
    "no picture": { name: "The Modsmith", kana: "ザ・モッドスミス", img: "" },
    "long name": { name: "The Torque Warden", kana: "ザ・トルクウォーデン", img: "/starter-fighters/torquewarden.png" },
    "no fighter": { name: "Ronan", kana: "", img: "" },
  };
  type Pick = keyof typeof FIGHTERS;
  const LOSERS = ["The Breycist", "Storm", "The Fairy Dancer"];

  // Match titles as the TV words them, each with its bracket tier.
  type Tier = "wb" | "mb" | "lb" | "gf" | "group";
  const TITLES: [string, Tier][] = [
    ["Group 1, match 4 of 6", "group"],
    ["Winners semi-final", "wb"],
    ["Mid bracket round 2", "mb"],
    ["Losers semi-final", "lb"],
    ["Grand final", "gf"],
  ];

  const q = page.url.searchParams;
  // ?f=<pick> starts on a given fighter: picture, victory, "no picture", "long name", "no fighter".
  let pick = $state<Pick>((q.get("f") as Pick) in FIGHTERS ? (q.get("f") as Pick) : "picture");
  // ?noimg: the silhouette whatever the pick.
  let noImg = $state(q.has("noimg"));
  let loser = $state(LOSERS[0]);
  let title = $state(q.get("title") ?? TITLES[1][0]);
  let tier = $state<Tier>((q.get("tier") as Tier) ?? TITLES[1][1]);
  // ?side=blue: the winner was p2.
  let side = $state<"red" | "blue">(q.get("side") === "blue" ? "blue" : "red");
  // ?wo: a walkover.
  let walkover = $state(q.has("wo"));
  let wins = $state(5);
  let losses = $state(3);
  // ?lite: the Pi-safe version.
  let lite = $state(q.has("lite"));
  // ?out=<ms>: when it leaves (the TV times this to the stinger's last hit).
  let out = $state(Number(q.get("out") ?? WINNER_OUT));

  let run = $state(0); // bump to replay
  let slow = $state(1);
  let hold = $state(q.has("hold"));
  let loop = $state(false);
  // ?clean hides the controls from the start (for screenshots).
  let showControls = $state(!q.has("clean"));

  const winner = $derived.by(() => {
    const f = FIGHTERS[pick];
    return noImg ? { ...f, img: "", victory: "" } : f;
  });

  // ?t=<ms> freezes every animation at that moment (for screenshots).
  const freezeAt = q.get("t");
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

  function replay() {
    run++;
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
<svelte:head><title>Winner screen · lab</title></svelte:head>

<div class="page">
  <div class="stage">
    {#key run}
      <WinnerScreen
        {winner}
        loser={{ name: loser }}
        score={[wins, losses]}
        {side}
        {title}
        {tier}
        {walkover}
        {slow}
        {hold}
        {lite}
        {out}
        ondone={done}
      />
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
      <span class="group">
        {#each Object.keys(FIGHTERS) as Pick[] as p}
          <button class:on={pick === p} onclick={() => ((pick = p), replay())}>{p}</button>
        {/each}
      </span>
      <span class="group">
        Winner was
        <button class:on={side === "red"} onclick={() => ((side = "red"), replay())}>p1 (red)</button>
        <button class:on={side === "blue"} onclick={() => ((side = "blue"), replay())}>p2 (blue)</button>
      </span>
      <span class="group">
        Score
        <input class="num" type="number" min="0" bind:value={wins} onchange={replay} />–
        <input class="num" type="number" min="0" bind:value={losses} onchange={replay} />
      </span>
      <span class="group">
        Beat
        {#each LOSERS as l}
          <button class:on={loser === l} onclick={() => ((loser = l), replay())}>{l}</button>
        {/each}
      </span>
      <label><input type="checkbox" bind:checked={walkover} onchange={replay} /> Walkover</label>
      <label><input type="checkbox" bind:checked={noImg} onchange={replay} /> No images</label>
      <label><input type="checkbox" bind:checked={lite} onchange={replay} /> Lite (Pi)</label>
      <label><input type="checkbox" bind:checked={hold} onchange={replay} /> Hold at end</label>
      <label><input type="checkbox" bind:checked={loop} /> Loop</label>
      <span class="group">
        Leave at
        <input class="out" type="number" step="100" bind:value={out} onchange={replay} /> ms
      </span>
      <span class="group">
        {#each TITLES as [t, tr]}
          <button class:on={title === t} onclick={() => ((title = t), (tier = tr), replay())}>{t}</button>
        {/each}
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
  input.num {
    width: 52px;
  }
  input.out {
    width: 80px;
  }
  .hint {
    opacity: 0.6;
    margin-left: auto;
  }
</style>
