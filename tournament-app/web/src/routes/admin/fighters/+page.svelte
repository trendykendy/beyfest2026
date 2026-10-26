<script lang="ts">
  import { enhance } from "$app/forms";
  import FacePicker from "$lib/components/FacePicker.svelte";
  import {
    fighterFor,
    fighterImageUrl,
    fighterMirroredUrl,
    fighterRoyaleVictoryUrl,
    fighterVictoryUrl,
    fighterVoiceUrl,
    artFor,
    type PBFighter,
  } from "$lib/fighters";

  let { data, form } = $props();

  // Images and voices are served by PocketBase, which the browser reaches on
  // port 8090 of whichever address served this page.
  const img = (f: PBFighter) => fighterImageUrl(data.pbUrl, f);
  // A preview side: the hand-made mirror image where it'd be flipped, if there is one.
  const sideArt = (f: PBFighter, side: string) =>
    artFor({ img: img(f), imgMirrored: fighterMirroredUrl(data.pbUrl, f) }, (side === "left") !== f.mirror);
  const victoryImg = (f: PBFighter) => fighterVictoryUrl(data.pbUrl, f, "300x200");
  const royaleVictoryImg = (f: PBFighter) => fighterRoyaleVictoryUrl(data.pbUrl, f, "300x200");

  // One clip at a time: a new Play stops the last one.
  let playing: HTMLAudioElement | null = null;
  function play(f: PBFighter) {
    playing?.pause();
    playing = new Audio(fighterVoiceUrl(data.pbUrl, f));
    playing.play().catch(() => {});
  }

  // Bladers in the current tournament who'll get the silhouette.
  const unmatched = $derived(data.players.filter((n) => !fighterFor(n, data.fighters)));

  const editing = $derived(form && "editing" in form ? String(form.editing) : "");
  // What "Add starting fighters" did, once pressed.
  const loaded = $derived(
    form && "starters" in form ? (form.starters as { added: number; filled: number }) : null,
  );
</script>

<svelte:head><title>Fighters · Beyfest admin</title></svelte:head>

<div class="container">
  <div class="head">
    <a class="back" href="/admin">← Admin</a>
    <h1>Fighters</h1>
  </div>

  <p class="intro">
    The TV's VS intro shows each blader's combat name, cut-out and katakana before a match, and the
    announcer calls out their voice clip. A blader is matched to a fighter by <b>player name</b>, the
    name typed in for the tournament (capitals and spaces don't matter), so a fighter set up here
    works in every tournament. Anyone without a fighter, or without an image, gets a silhouette.
  </p>
  <p class="intro hint">
    Best images: a transparent PNG cut-out at least 1000px tall, with the blader facing left. Tick
    <b>Mirror</b> if one faces the other way. The previews show how each side will look. Voice clips:
    an MP3 of the combat name, with no silence at the start. Face: click the face on the picture so
    screens that crop it (the battle royale, the phone) keep it in view; a new image needs it set
    again. Victory pose: a full 3:2 picture
    (background and all) for the Champion scene, shown as it is, never mirrored. Royale pose: the
    same, for the battle royale champion; without one the normal victory pose is used. Mirrored
    image: only for a cut-out with writing on it, the whole cut-out flipped by hand with the writing
    put right; it's shown wherever the cut-out would be mirrored (the left preview).
  </p>

  {#if form?.error && !editing}
    <div class="banner err">{form.error}</div>
  {/if}

  {#if loaded}
    <div class="banner ok">
      Starting fighters:
      {#if loaded.added || loaded.filled}
        {loaded.added} added{loaded.filled ? `, ${loaded.filled} filled in` : ""}.
      {:else}
        all already here.
      {/if}
    </div>
  {/if}

  <form method="POST" action="?/starters" use:enhance class="starters">
    <button class="btn" type="submit">Add starting fighters</button>
    <span class="hint">
      Adds the fighters that come with the app. Ones already here only get missing details filled in,
      so nothing you've changed is overwritten.
    </span>
  </form>

  {#if unmatched.length}
    <div class="banner warn">
      <b>No fighter yet for:</b>
      {unmatched.join(", ")}
    </div>
  {/if}

  <section class="card add">
    <h2 class="kicker">Add a fighter</h2>
    <form method="POST" action="?/add" enctype="multipart/form-data" use:enhance class="fields">
      <label>Combat name <input type="text" name="name" required placeholder="e.g. The Breycist" /></label>
      <label>Player name <input type="text" name="player" placeholder="As entered for the tournament" /></label>
      <label>Katakana <input type="text" name="kana" placeholder="Optional, e.g. ラッシュ" /></label>
      <label>Image <input type="file" name="image" accept="image/png,image/webp,image/jpeg" /></label>
      <label>Victory pose <input type="file" name="victory" accept="image/png,image/webp,image/jpeg" /></label>
      <label>Royale pose <input type="file" name="royaleVictory" accept="image/png,image/webp,image/jpeg" /></label>
      <label>Mirrored image <input type="file" name="imageMirrored" accept="image/png,image/webp,image/jpeg" /></label>
      <label>Voice <input type="file" name="voice" accept="audio/*" /></label>
      <label class="check"><input type="checkbox" name="mirror" /> Mirror</label>
      <button class="btn primary" type="submit">Add fighter</button>
    </form>
  </section>

  {#if data.fighters.length === 0}
    <p class="empty">No fighters yet.</p>
  {/if}

  <ul class="list">
    {#each data.fighters as f (f.id)}
      <li class="card fighter">
        <div class="previews">
          {#each ["left", "right"] as side}
            <!-- Left (red) is mirrored by the intro so it faces right; Mirror flips both. -->
            <div class="preview {side}">
              {#if f.image}
                {@const art = sideArt(f, side)}
                <img src={art.src} alt="" style:transform="scaleX({art.flip ? -1 : 1})" />
              {:else}
                <span class="none">Silhouette</span>
              {/if}
            </div>
          {/each}
          {#if f.victory}
            <div class="preview victory" title="Victory pose"><img src={victoryImg(f)} alt="" /></div>
          {/if}
          {#if f.royaleVictory}
            <div class="preview victory" title="Battle royale victory pose"><img src={royaleVictoryImg(f)} alt="" /></div>
          {/if}
        </div>

        <form method="POST" action="?/update" enctype="multipart/form-data" use:enhance class="fields">
          <input type="hidden" name="id" value={f.id} />
          <label>Combat name <input type="text" name="name" value={f.name} required /></label>
          <label>Player name <input type="text" name="player" value={f.player} /></label>
          <label>Katakana <input type="text" name="kana" value={f.kana} /></label>
          <label>{f.image ? "Replace image" : "Image"} <input type="file" name="image" accept="image/png,image/webp,image/jpeg" /></label>
          <label>{f.victory ? "Replace victory pose" : "Victory pose"} <input type="file" name="victory" accept="image/png,image/webp,image/jpeg" /></label>
          {#if f.image}
            <label>{f.imageMirrored ? "Replace mirrored image" : "Mirrored image"} <input type="file" name="imageMirrored" accept="image/png,image/webp,image/jpeg" /></label>
          {/if}
          <label>{f.royaleVictory ? "Replace royale pose" : "Royale pose"} <input type="file" name="royaleVictory" accept="image/png,image/webp,image/jpeg" /></label>
          <label>{f.voice ? "Replace voice" : "Voice"} <input type="file" name="voice" accept="audio/*" /></label>
          {#if f.image}
            <!-- Keyed on the saved point, so it resets once a save comes back. -->
            {#key JSON.stringify(f.face)}
              <div class="face"><FacePicker src={img(f)} face={f.face} /></div>
            {/key}
          {/if}
          <div class="checks">
            {#if f.voice}
              <button class="btn" type="button" onclick={() => play(f)}>▶ Play voice</button>
            {/if}
            <label class="check"><input type="checkbox" name="mirror" checked={f.mirror} /> Mirror</label>
            {#if f.image}
              <label class="check"><input type="checkbox" name="removeImage" /> Remove image</label>
            {/if}
            {#if f.victory}
              <label class="check"><input type="checkbox" name="removeVictory" /> Remove victory pose</label>
            {/if}
            {#if f.royaleVictory}
              <label class="check"><input type="checkbox" name="removeRoyaleVictory" /> Remove royale pose</label>
            {/if}
            {#if f.imageMirrored}
              <label class="check"><input type="checkbox" name="removeImageMirrored" /> Remove mirrored image</label>
            {/if}
            {#if f.voice}
              <label class="check"><input type="checkbox" name="removeVoice" /> Remove voice</label>
            {/if}
          </div>
          <button class="btn" type="submit">Save</button>
          {#if editing === f.id && form?.error}
            <div class="banner err inline">{form.error}</div>
          {/if}
        </form>

        <form
          method="POST"
          action="?/remove"
          use:enhance={({ cancel }) => {
            if (!confirm(`Delete ${f.name} from the fighter library?`)) cancel();
          }}
        >
          <input type="hidden" name="id" value={f.id} />
          <button class="btn danger" type="submit">Delete</button>
        </form>
      </li>
    {/each}
  </ul>
</div>

<style>
  .head {
    display: flex;
    align-items: baseline;
    gap: 18px;
    margin-bottom: 14px;
  }
  .head h1 {
    font-size: 2.4rem;
  }
  .back {
    font-weight: 700;
  }
  .intro {
    max-width: 760px;
    margin-bottom: 10px;
  }
  .hint {
    color: var(--on-field-soft);
    margin-bottom: 20px;
  }
  .banner {
    padding: 10px 14px;
    border-radius: 8px;
    margin-bottom: 16px;
  }
  .banner.err {
    background: var(--lb-soft);
    border: 1px solid var(--red);
  }
  .banner.warn {
    background: var(--mb-soft);
    border: 1px solid var(--gold);
  }
  .banner.ok {
    background: var(--surface);
    border: 1px solid var(--green);
  }
  .starters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 14px;
    margin-bottom: 16px;
  }
  .starters .hint {
    flex: 1;
    min-width: 240px;
    font-size: 0.9rem;
    margin: 0;
  }
  .banner.inline {
    margin: 0;
    flex-basis: 100%;
  }
  .kicker {
    font-size: 1.5rem;
    margin-bottom: 14px;
  }
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 18px;
    margin-bottom: 14px;
  }
  .fields {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 12px 16px;
  }
  .fields label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.9rem;
    color: var(--on-field-soft);
    min-width: 200px;
    flex: 1;
  }
  .fields label.check {
    flex-direction: row;
    align-items: center;
    min-width: 0;
    flex: none;
    color: var(--text);
  }
  .face {
    flex-basis: 100%;
  }
  .checks {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px;
  }
  input[type="file"] {
    color: var(--text);
  }
  .list {
    list-style: none;
  }
  .fighter {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 16px;
  }
  .fighter .fields {
    flex: 1;
    min-width: 300px;
  }
  /* Previews on the intro's banner colours. */
  .previews {
    display: flex;
    gap: 6px;
  }
  .preview {
    width: 150px;
    height: 100px;
    display: grid;
    place-items: center;
    overflow: hidden;
    border-radius: 6px;
  }
  .preview.left {
    background: linear-gradient(105deg, #5a0309, #b5121b 45%, var(--red));
  }
  .preview.right {
    background: linear-gradient(255deg, #020a4a, #0b2fb8 45%, #1f6bff);
  }
  .preview img {
    max-width: 100%;
    max-height: 100%;
  }
  .preview.victory {
    outline: 3px solid var(--gold);
  }
  .none {
    font-size: 0.8rem;
    color: rgb(255 255 255 / 0.7);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  .empty {
    color: var(--on-field-soft);
  }
</style>
