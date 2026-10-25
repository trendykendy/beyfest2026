<script lang="ts">
  // "Use the starting fighters" on the create form: a pop-up listing every
  // starter, all ticked at first, so the organiser can untick anyone who
  // didn't turn up. Confirming puts the ticked ones in the Bladers box and
  // keeps any walk-ins already typed there.
  import { mergeStarters, splitNames, tickedStarters, type StarterPick } from "$lib/starters";

  let { starters, text = $bindable() }: { starters: StarterPick[]; text: string } = $props();

  let dialog: HTMLDialogElement;
  let ticked = $state<string[]>([]);

  const players = $derived(starters.map((s) => s.player));
  // How many bladers the box would hold: the ticked starters plus walk-ins.
  const total = $derived(splitNames(mergeStarters(text, players, ticked)).length);
  const walkIns = $derived(total - ticked.length);

  function open() {
    ticked = tickedStarters(text, players);
    dialog.showModal();
  }
  function use() {
    text = mergeStarters(text, players, ticked);
    dialog.close();
  }
  // A click on the dimmed backdrop lands on the <dialog> itself (the panel
  // inside fills it), so that cancels, as Escape does.
  function backdrop(e: MouseEvent) {
    if (e.target === dialog) dialog.close();
  }
</script>

<button class="btn" type="button" onclick={open}>Use the starting fighters</button>

<dialog bind:this={dialog} onclick={backdrop} aria-labelledby="starter-picker-title">
  <div class="panel">
    <header class="head">
      <h2 id="starter-picker-title">Starting fighters</h2>
      <div class="all">
        <button type="button" onclick={() => (ticked = [...players])}>All</button>
        <button type="button" onclick={() => (ticked = [])}>None</button>
      </div>
    </header>

    <!-- Not named, so they never go in with the create form. -->
    <div class="grid">
      {#each starters as s (s.player)}
        <label class="card" class:on={ticked.includes(s.player)}>
          <input type="checkbox" value={s.player} bind:group={ticked} />
          <span class="pic">
            {#if s.image}
              <img src="/starter-fighters/{s.image}" alt="" loading="lazy" />
            {:else}
              <span class="none">?</span>
            {/if}
          </span>
          <span class="name">{s.name}</span>
          <span class="player">{s.player}</span>
        </label>
      {/each}
    </div>

    <footer class="foot">
      <p class="count">
        <b>{ticked.length} picked</b>
        {#if walkIns > 0}+ {walkIns} typed in{/if}
        <!-- Only a hint: walk-ins can still be typed in after. -->
        {#if total < 8}
          <span class="warn">{8 - total} short of 8.</span>
        {:else if total > 15}
          <span class="warn">{total - 15} over 15.</span>
        {/if}
      </p>
      <div class="actions">
        <button class="btn" type="button" onclick={() => dialog.close()}>Cancel</button>
        <button class="btn primary" type="button" onclick={use}>Use these {ticked.length}</button>
      </div>
    </footer>
  </div>
</dialog>

<style>
  dialog {
    padding: 0;
    margin: auto;
    width: min(760px, calc(100vw - 24px));
    max-height: calc(100dvh - 24px);
    background: var(--paper);
    color: var(--ink);
    border: var(--outline) solid var(--ink);
    box-shadow: var(--shadow-offset) var(--shadow-offset) 0 var(--ink);
  }
  dialog::backdrop {
    background: rgb(7 8 22 / 0.7);
  }
  /* Header and buttons stay put; only the cards scroll. */
  .panel {
    display: flex;
    flex-direction: column;
    max-height: calc(100dvh - 24px - 2 * var(--outline));
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    background: var(--ink);
    color: var(--paper);
    padding: 10px 16px 12px;
  }
  .head h2 {
    font-size: 1.6rem;
  }
  .all {
    display: flex;
    gap: 6px;
  }
  .all button {
    font-family: var(--font-text);
    font-weight: 700;
    font-size: 0.85rem;
    text-transform: uppercase;
    background: var(--field);
    color: var(--paper);
    border: 2px solid var(--field-line);
    padding: 6px 10px;
    cursor: pointer;
  }
  .all button:hover {
    border-color: var(--paper);
  }
  .grid {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 10px;
    padding: 14px 16px;
  }
  /* Ticked = gold slab; unticked fades back. */
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    border: 2px solid var(--ink);
    background: var(--paper);
    cursor: pointer;
    opacity: 0.5;
  }
  .card.on {
    background: var(--gold);
    box-shadow: 4px 4px 0 var(--ink);
    opacity: 1;
  }
  .card input {
    position: absolute;
    top: 6px;
    left: 6px;
    width: 22px;
    height: 22px;
    margin: 0;
    accent-color: var(--ink);
  }
  .card:has(input:focus-visible) {
    outline: 3px solid var(--field);
    outline-offset: 2px;
  }
  .pic {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 4 / 3;
    background: var(--field);
    border-bottom: 2px solid var(--ink);
    overflow: hidden;
  }
  .pic img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .none {
    font-family: var(--font-display);
    font-size: 2.5rem;
    color: rgb(255 255 255 / 0.7);
  }
  .name {
    font-family: var(--font-display);
    font-stretch: 62%;
    text-transform: uppercase;
    font-size: 1.1rem;
    line-height: 1.05;
    padding: 6px 8px 0;
  }
  .player {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--ink-soft);
    padding: 0 8px 6px;
  }
  .foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px 14px;
    border-top: 2px solid var(--ink);
    padding: 12px 16px;
  }
  .count {
    font-weight: 600;
  }
  .warn {
    color: var(--red);
    margin-left: 4px;
  }
  .actions {
    display: flex;
    gap: 8px;
    margin-left: auto;
  }
  /* The site's .btn is made for the dark field; on paper it needs ink. */
  .actions .btn {
    border-color: var(--ink);
  }
  .actions .btn:not(.primary) {
    background: var(--paper);
    color: var(--ink);
  }
  .actions .btn:not(.primary):hover {
    background: var(--ink);
    color: var(--paper);
  }
</style>
