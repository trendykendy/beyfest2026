<script lang="ts">
  import { enhance } from "$app/forms";
  import type { PBPlayer } from "$lib/view";

  let {
    players,
    error = "",
    errorFor = "",
  }: {
    players: PBPlayer[];
    error?: string; // a refused rename…
    errorFor?: string; // …and whose
  } = $props();

  // Group order, then name, so it matches the tables above.
  const list = $derived(
    [...players].sort((a, b) => (a.groupIndex ?? 99) - (b.groupIndex ?? 99) || a.name.localeCompare(b.name)),
  );
  let editing = $state("");
  $effect(() => {
    if (errorFor) editing = errorFor; // keep a refused rename open
  });
</script>

<!-- Everyone in the tournament: fix a name, or record that someone has left.
     Leaving walks over every match of theirs as it becomes playable. -->
<section class="bladers">
  <h2 class="kicker">Bladers</h2>
  <ul class="list">
    {#each list as p (p.id)}
      <li class="row" class:out={p.withdrawn}>
        {#if editing === p.id}
          <form method="POST" action="?/rename" use:enhance={() => async ({ update, result }) => {
            await update({ reset: false });
            if (result.type === "success") editing = "";
          }} class="rename">
            <input type="hidden" name="player" value={p.id} />
            <!-- svelte-ignore a11y_autofocus -->
            <input type="text" name="name" value={p.name} autofocus />
            <button class="save" type="submit">Save</button>
            <button type="button" class="link" onclick={() => (editing = "")}>Cancel</button>
            {#if error && errorFor === p.id}<span class="err">{error}</span>{/if}
          </form>
        {:else}
          <span class="grp">{p.groupIndex != null ? `Group ${p.groupIndex + 1}` : ""}</span>
          <span class="nm">{p.name}</span>
          {#if p.withdrawn}
            <span class="tag">Withdrawn</span>
          {:else}
            <button type="button" class="link" onclick={() => (editing = p.id)}>Rename</button>
          {/if}
          <form method="POST" action="?/withdraw" use:enhance={({ cancel }) => {
            if (!p.withdrawn && !confirm(`${p.name} leaves the tournament? Every match of theirs becomes a walkover, now and later.`)) cancel();
          }}>
            <input type="hidden" name="player" value={p.id} />
            <input type="hidden" name="withdrawn" value={p.withdrawn ? "false" : "true"} />
            <button class="link" class:danger={!p.withdrawn} type="submit">{p.withdrawn ? "Bring back" : "Withdraw"}</button>
          </form>
        {/if}
      </li>
    {/each}
  </ul>
</section>

<style>
  .bladers {
    margin-top: 40px;
  }
  .list {
    list-style: none;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px 16px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--paper);
    color: var(--ink);
    border: 2px solid var(--ink);
    padding: 6px 10px;
    min-height: 46px;
  }
  .row.out {
    background: #dfe3f2;
    color: var(--ink-soft);
  }
  .grp {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--ink-soft);
    width: 54px;
    flex: none;
  }
  .nm {
    flex: 1;
    min-width: 0;
    font-family: var(--font-display);
    font-stretch: 62%;
    text-transform: uppercase;
    font-size: 1.25rem;
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: 0.2em;
  }
  .row.out .nm {
    text-decoration: line-through;
  }
  .tag {
    font-size: 0.72rem;
    font-weight: 700;
    background: var(--ink);
    color: var(--paper);
    padding: 3px 6px;
  }
  .link {
    background: none;
    border: none;
    padding: 2px 4px;
    font: inherit;
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--ink-soft);
    cursor: pointer;
    text-decoration: underline;
  }
  .link:hover {
    color: var(--ink);
  }
  .link.danger {
    color: var(--red);
  }
  .rename {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    width: 100%;
  }
  .rename input[type="text"] {
    flex: 1;
    min-width: 120px;
    padding: 4px 8px;
    background: var(--paper);
    color: var(--ink);
    border: 2px solid var(--ink);
    border-radius: 0;
  }
  .save {
    font-weight: 700;
    padding: 4px 12px;
    background: var(--gold);
    color: var(--ink);
    border: 2px solid var(--ink);
    cursor: pointer;
  }
  .err {
    width: 100%;
    color: var(--red);
    font-weight: 700;
    font-size: 0.85rem;
  }
</style>
