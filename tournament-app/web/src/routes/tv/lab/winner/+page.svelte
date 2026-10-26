<script lang="ts">
  import WinnerScreen from "$lib/components/tv/WinnerScreen.svelte";
  import { Announcer } from "$lib/components/tv/announcer";
  import { STINGER, WINNER_SLAM, WINS, winsCall } from "$lib/sounds";
  import { page } from "$app/state";
  import { onMount, tick } from "svelte";

  // Lab page for the winner screen. Not linked from anywhere. Uses the
  // starter fighters' pictures and voices (static/starter-fighters).
  const SF = "/starter-fighters/";
  const FIGHTERS = {
    picture: { name: "The Buzzsaw", kana: "ザ・バズソー", img: SF + "buzzsaw.png", voice: SF + "the-buzzsaw.mp3" },
    "no picture": { name: "The Modsmith", kana: "ザ・モッドスミス", img: "", voice: SF + "the-modsmith.mp3" },
    "long name": {
      name: "The Torque Warden",
      kana: "ザ・トルクウォーデン",
      img: SF + "torquewarden.png",
      voice: SF + "the-torque-warden.mp3",
    },
    "no fighter": { name: "Ronan", kana: "", img: "", voice: "" },
  };
  type Pick = keyof typeof FIGHTERS;
  const LOSERS = ["The Breycist", "Storm", "The Fairy Dancer"];

  // Match titles as the TV words them, each with its bracket tier. (No grand
  // final: it goes straight to the Champion scene instead.)
  type Tier = "wb" | "mb" | "lb" | "gf" | "group";
  const TITLES: [string, Tier][] = [
    ["Group 1, match 4 of 6", "group"],
    ["Winners semi-final", "wb"],
    ["Mid bracket round 2", "mb"],
    ["Losers semi-final", "lb"],
  ];

  const q = page.url.searchParams;
  // ?f=<pick> starts on a given fighter: picture, "no picture", "long name", "no fighter".
  const qf = q.get("f") as Pick;
  let pick = $state<Pick>(qf in FIGHTERS ? qf : "picture");
  // ?noimg: the silhouette whatever the pick.
  let noImg = $state(q.has("noimg"));
  let loser = $state(LOSERS[0]);
  let title = $state(q.get("title") ?? TITLES[1][0]);
  let tier = $state<Tier>((q.get("tier") as Tier) ?? TITLES[1][1]);
  // ?side=blue: the winner was p2.
  let side = $state<"red" | "blue">(q.get("side") === "blue" ? "blue" : "red");
  // ?wo: a walkover.
  let walkover = $state(q.has("wo"));
  // ?royale: a battle royale heat ("Last bey standing", the runner-up, no Up next).
  let royale = $state(q.has("royale"));
  let wins = $state(5);
  let losses = $state(3);
  // ?lite: the Pi-safe version.
  let lite = $state(q.has("lite"));

  let run = $state(0); // bump to replay
  let slow = $state(1);
  let leaving = $state(false); // the next match starting
  let gone = $state(false); // it has left; Replay brings it back
  // ?clean hides the controls from the start (for screenshots).
  let showControls = $state(!q.has("clean"));

  const winner = $derived.by(() => {
    const f = FIGHTERS[pick];
    return noImg ? { ...f, img: "" } : f;
  });

  // The "Up next" fixture: ?next=tbd (a side not decided yet, shown by its
  // slot label as the TV does) or ?next=none (waiting on other results).
  const NEXTS = {
    fixture: { p1: "Niamh", p2: "Aoife", title: "Group 1, match 5 of 6", tier: "group" as Tier },
    tbd: { p1: "Conor", p2: "Winner of WB semi 2", title: "Winners final", tier: "wb" as Tier },
    none: null,
  };
  type NextPick = keyof typeof NEXTS;
  const qn = q.get("next") as NextPick;
  let nextPick = $state<NextPick>(qn in NEXTS ? qn : "fixture");

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

  // ── Sound ──
  // The TV's own Announcer and timing: the match music plays for LEAD_IN (as
  // it does through a match), then the result goes in and the screen starts;
  // "[name] wins!" starts with its slam (WINNER_SLAM), and the music cuts to
  // the stinger when the call ends, exactly as endMatch does on the TV.
  // Off by default: ticking the box is the click the browser wants first.
  const LEAD_IN = 2000;
  const announcer = new Announcer();
  let sound = $state(false);
  let waiting = $state(false); // the music's lead-in, before the result
  let leadTimer: ReturnType<typeof setTimeout> | undefined;
  onMount(() => {
    announcer.setEnabled(false);
    return () => {
      clearTimeout(leadTimer);
      announcer.setEnabled(false);
    };
  });
  const calls = $derived(winsCall(winner.voice, walkover));
  const file = (u: string) => u.split("/").pop();
  const soundNote = $derived(
    `match music (a random track) for ${LEAD_IN / 1000} s → ` +
      (calls.length ? `"${winner.name} wins!" (${calls.map(file).join(" + ")}) from the slam → ` : "no call (walkover or no voice) → ") +
      `stinger (${file(STINGER)})` +
      (slow !== 1 ? " · sound is always 1× speed" : ""),
  );

  function toggleSound() {
    announcer.setEnabled(sound);
    if (sound) {
      [WINS, STINGER, ...Object.values(FIGHTERS).map((f) => f.voice)].forEach((u) => announcer.preload(u));
      replay();
    } else {
      clearTimeout(leadTimer);
      waiting = false;
    }
  }

  function replay() {
    clearTimeout(leadTimer);
    leaving = false;
    gone = false;
    if (!sound) {
      waiting = false;
      run++;
      return;
    }
    // Start the match music (a VS intro with no calls), then the result.
    announcer.silenceMatch(0);
    announcer.intro([]);
    waiting = true;
    leadTimer = setTimeout(() => {
      waiting = false;
      run++;
      announcer.endMatch(calls, true, WINNER_SLAM);
    }, LEAD_IN);
  }
  function leave() {
    if (gone || waiting) return;
    leaving = true;
    if (sound) announcer.silenceMatch(300); // a new intro fades the stinger out like this
  }
  function onkey(e: KeyboardEvent) {
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    if (e.key === "h" || e.key === "H") showControls = !showControls;
    if (e.key === "l" || e.key === "L") leave();
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
    {#if waiting}
      <div class="waiting">Match music… the result goes in shortly</div>
    {:else if !gone}
      {#key run}
        <WinnerScreen
          {winner}
          loser={{ name: loser }}
          score={[wins, losses]}
          {side}
          {title}
          {tier}
          {walkover}
          {royale}
          {slow}
          {lite}
          {leaving}
          next={royale ? null : NEXTS[nextPick]}
          ondone={() => (gone = true)}
        />
      {/key}
    {:else}
      <div class="waiting">Next match starting (the VS intro takes over here)</div>
    {/if}
  </div>

  {#if showControls}
    <div class="controls">
      <button onclick={replay}>Replay</button>
      <button onclick={leave} disabled={gone || waiting}>Next match starts (leave)</button>
      <label class="snd"><input type="checkbox" bind:checked={sound} onchange={toggleSound} /> Sound</label>
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
      <span class="group">
        Up next
        <!-- No replay: on the TV the strip changes live while the screen holds. -->
        {#each Object.keys(NEXTS) as NextPick[] as n}
          <button class:on={nextPick === n} onclick={() => (nextPick = n)}>{n === "tbd" ? "TBD side" : n}</button>
        {/each}
      </span>
      <label><input type="checkbox" bind:checked={walkover} onchange={replay} /> Walkover</label>
      <label><input type="checkbox" bind:checked={royale} onchange={replay} /> Battle royale</label>
      <label><input type="checkbox" bind:checked={noImg} onchange={replay} /> No images</label>
      <label><input type="checkbox" bind:checked={lite} onchange={replay} /> Lite (Pi)</label>
      <span class="group">
        {#each TITLES as [t, tr]}
          <button class:on={title === t} onclick={() => ((title = t), (tier = tr), replay())}>{t}</button>
        {/each}
      </span>
      <span class="note">{sound ? "Sound: " + soundNote : "Sound off (tick Sound to hear the TV's sequence)"}</span>
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
  /* Largest 16:9 box that fits the window. */
  .stage {
    position: relative;
    width: min(100vw, calc(100vh * 16 / 9));
    aspect-ratio: 16 / 9;
    background: var(--field-deep);
    overflow: hidden;
  }
  .waiting {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: var(--on-field-soft);
    font: 600 2vw var(--font-text);
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
  input.num {
    width: 52px;
  }
  .note {
    flex-basis: 100%;
    opacity: 0.85;
  }
  .hint {
    opacity: 0.6;
    margin-left: auto;
  }
</style>
