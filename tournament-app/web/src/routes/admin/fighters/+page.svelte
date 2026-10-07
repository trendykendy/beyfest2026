<script lang="ts">
  import { enhance } from "$app/forms";
  import { fighterFor, fighterImageUrl, type PBFighter } from "$lib/fighters";

  let { data, form } = $props();

  // Images are served by PocketBase, which the browser reaches on port 8090
  // of whichever address served this page.
  const img = (f: PBFighter) => fighterImageUrl(data.pbUrl, f);

  // Bladers in the current tournament who'll get the silhouette.
  const unmatched = $derived(data.players.filter((n) => !fighterFor(n, data.fighters)));

  const editing = $derived(form && "editing" in form ? String(form.editing) : "");
</script>

<svelte:head><title>Fighters · Beyfest admin</title></svelte:head>

<div class="container">
  <div class="head">
    <a class="back" href="/admin">← Admin</a>
    <h1>Fighters</h1>
  </div>

  <p class="intro">
    The TV's VS intro shows each blader's cut-out and katakana before a match. A blader is matched to a
    fighter by name (capitals and spaces don't matter), so a fighter set up here works in every
    tournament. Anyone without a fighter, or without an image, gets a silhouette.
  </p>
  <p class="intro hint">
    Best images: a transparent PNG cut-out at least 1000px tall, with the blader facing left. Tick
    <b>Mirror</b> if one faces the other way. The previews show how each side will look.
  </p>

  {#if form?.error && !editing}
    <div class="banner err">{form.error}</div>
  {/if}

  {#if unmatched.length}
    <div class="banner warn">
      <b>No fighter yet for:</b>
      {unmatched.join(", ")}
    </div>
  {/if}

  <section class="card add">
    <h2 class="kicker">Add a fighter</h2>
    <form method="POST" action="?/add" enctype="multipart/form-data" use:enhance class="fields">
      <label>Name <input type="text" name="name" required placeholder="As entered for the tournament" /></label>
      <label>Katakana <input type="text" name="kana" placeholder="Optional, e.g. ラッシュ" /></label>
      <label>Image <input type="file" name="image" accept="image/png,image/webp,image/jpeg" /></label>
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
                <img
                  src={img(f)}
                  alt=""
                  style:transform="scaleX({(side === 'left') !== f.mirror ? -1 : 1})"
                />
              {:else}
                <span class="none">Silhouette</span>
              {/if}
            </div>
          {/each}
        </div>

        <form method="POST" action="?/update" enctype="multipart/form-data" use:enhance class="fields">
          <input type="hidden" name="id" value={f.id} />
          <label>Name <input type="text" name="name" value={f.name} required /></label>
          <label>Katakana <input type="text" name="kana" value={f.kana} /></label>
          <label>{f.image ? "Replace image" : "Image"} <input type="file" name="image" accept="image/png,image/webp,image/jpeg" /></label>
          <div class="checks">
            <label class="check"><input type="checkbox" name="mirror" checked={f.mirror} /> Mirror</label>
            {#if f.image}
              <label class="check"><input type="checkbox" name="removeImage" /> Remove image</label>
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
  .checks {
    display: flex;
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
