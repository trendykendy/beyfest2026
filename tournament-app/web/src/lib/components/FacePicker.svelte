<script lang="ts">
  import { faceCrop, type Face } from "$lib/fighters";

  // The Fighters page's face point: click the cut-out on the face, and drag
  // the slider until the ring fits it. The round preview is how the battle
  // royale board will crop it. Sends faceX/faceY/faceH with the edit form
  // (all empty once cleared); nothing is saved until the form is.
  let { src, face: start }: { src: string; face: Face | null } = $props();

  // svelte-ignore state_referenced_locally
  let face = $state<Face | null>(start);
  // A first click with no face yet: about a head's height in these cut-outs.
  const DEFAULT_H = 0.25;

  function pick(e: MouseEvent) {
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width;
    const y = (e.clientY - box.top) / box.height;
    face = { x: round(x), y: round(y), h: face?.h ?? DEFAULT_H };
  }
  const round = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 1000) / 1000;
</script>

<div class="fp">
  <div class="fp-row">
    <!-- The click target is the picture itself, so x/y are fractions of it. -->
    <button type="button" class="fp-pic" onclick={pick} title="Click the face">
      <img {src} alt="" draggable="false" />
      {#if face}
        <!-- The ring is face.h of the picture's height; the box is 3:2-ish but
             the ring is sized in height units so it stays round. -->
        <span
          class="fp-ring"
          style:left="{face.x * 100}%"
          style:top="{face.y * 100}%"
          style:height="{face.h * 100}%"
        ></span>
      {/if}
    </button>
    <div class="fp-side">
      <span class="fp-round">
        {#if face}<img {src} alt="" style={faceCrop(face)} />{/if}
      </span>
      {#if face}
        <button type="button" class="btn" onclick={() => (face = null)}>Clear face</button>
      {/if}
    </div>
  </div>
  {#if face}
    <label class="fp-size">
      Face size
      <input type="range" min="0.05" max="0.6" step="0.005" bind:value={face.h} />
    </label>
  {:else}
    <span class="fp-hint">No face set: click the face so cropped screens keep it in view.</span>
  {/if}
  <input type="hidden" name="faceX" value={face?.x ?? ""} />
  <input type="hidden" name="faceY" value={face?.y ?? ""} />
  <input type="hidden" name="faceH" value={face?.h ?? ""} />
</div>

<style>
  .fp {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .fp-row {
    display: flex;
    align-items: flex-end;
    gap: 10px;
  }
  .fp-pic {
    position: relative;
    display: block;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--field);
    cursor: crosshair;
    overflow: hidden;
    line-height: 0;
  }
  .fp-pic img {
    display: block;
    height: 160px;
    width: auto;
    pointer-events: none;
  }
  .fp-ring {
    position: absolute;
    aspect-ratio: 1;
    transform: translate(-50%, -50%);
    border: 3px solid var(--gold);
    border-radius: 50%;
    box-shadow: 0 0 0 2px rgb(0 0 0 / 0.6);
    pointer-events: none;
  }
  .fp-side {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  /* As RoyaleBoard's pictures, a little bigger. */
  .fp-round {
    position: relative;
    display: block;
    width: 72px;
    height: 72px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--field);
    border: 3px solid var(--ink);
  }
  .fp-size {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.9rem;
    color: var(--on-field-soft);
  }
  .fp-hint {
    font-size: 0.85rem;
    color: var(--on-field-soft);
  }
</style>
