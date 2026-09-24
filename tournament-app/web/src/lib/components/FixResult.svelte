<script lang="ts">
  import { enhance } from "$app/forms";
  import type { PBMatch } from "$lib/view";

  let {
    matches,
    label,
    context,
    error = "",
    errorFor = "",
  }: {
    matches: PBMatch[]; // finished matches
    label: (m: PBMatch, which: 1 | 2) => string;
    context: (m: PBMatch) => string;
    error?: string; // refusal from the last attempt
    errorFor?: string; // …and which match it was about
  } = $props();

  // Newest result first; the first one is the "last result" shown in the bar.
  const done = $derived(
    matches
      .filter((m) => m.matchStatus === "done")
      .sort((a, b) => (b.resultAt || "").localeCompare(a.resultAt || "") || b.orderIndex - a.orderIndex),
  );
  const last = $derived(done[0] ?? null);

  let open = $state(false);
  let code = $state("");
  // Pick up a refused attempt so the form stays open on that match.
  $effect(() => {
    if (errorFor) {
      open = true;
      code = errorFor;
    }
  });
  const picked = $derived(done.find((m) => m.code === code) ?? last);
  let s1 = $state(0);
  let s2 = $state(0);
  // Refill the score boxes when a different match is picked — not on every live
  // refresh, or typing would be overwritten.
  let filledFor = "";
  $effect(() => {
    const m = picked;
    if (!m || m.code === filledFor) return;
    filledFor = m.code;
    s1 = m.p1Score ?? 0;
    s2 = m.p2Score ?? 0;
  });
</script>

{#if last}
  <!-- The last result, with a way to fix it (or any earlier one). -->
  <div class="fix">
    <div class="bar">
      <span class="tag">Last result</span>
      <span class="res">
        <span class="ctx">{context(last)}</span>
        {#if last.walkover}
          {@const w = last.winner === last.p1 ? 1 : 2}
          <b>{label(last, w)}</b> won by walkover v {label(last, w === 1 ? 2 : 1)}
        {:else}
          <b>{label(last, 1)}</b> {last.p1Score}–{last.p2Score} <b>{label(last, 2)}</b>
        {/if}
      </span>
      <button type="button" class="toggle" onclick={() => ((open = !open), (code = last.code))}>
        {open ? "Close" : "Fix"}
      </button>
    </div>

    {#if open && picked}
      <form method="POST" action="?/correct" use:enhance={() => async ({ update, result }) => {
        await update({ reset: false });
        if (result.type === "success") open = false;
      }} class="form">
        <label class="pick">
          <span>Match</span>
          <select name="code" bind:value={code}>
            {#each done as m (m.code)}
              <option value={m.code}>{m.code}: {label(m, 1)} {m.p1Score}–{m.p2Score} {label(m, 2)}{m.walkover ? " (walkover)" : ""}</option>
            {/each}
          </select>
        </label>
        <div class="scores">
          <label><span>{label(picked, 1)}</span><input type="number" name="s1" min="0" max="11" bind:value={s1} /></label>
          <span class="dash">–</span>
          <label><span>{label(picked, 2)}</span><input type="number" name="s2" min="0" max="11" bind:value={s2} /></label>
          <button class="save" type="submit">Save fix</button>
        </div>
        {#if error && errorFor === picked.code}<p class="err">{error}</p>{/if}
        <p class="note">
          If the winner changes, the next round is updated too. That's refused if a later match has already been
          played with the old winner or loser.
        </p>
      </form>
    {/if}
  </div>
{/if}

<style>
  .fix {
    margin-top: 22px;
    border: 2px solid var(--field-line);
    background: var(--field);
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 8px 10px;
  }
  .tag {
    font-family: var(--font-display);
    text-transform: uppercase;
    font-size: 1rem;
    line-height: 1;
    padding: 5px 12px 6px;
    background: var(--ink);
    color: var(--paper);
    clip-path: polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%);
    white-space: nowrap;
  }
  .res {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-variant-numeric: tabular-nums;
  }
  .ctx {
    color: var(--on-field-soft);
    margin-right: 8px;
  }
  .toggle,
  .save {
    font-family: var(--font-text);
    font-weight: 700;
    border: 2px solid var(--ink);
    padding: 6px 14px;
    cursor: pointer;
  }
  .toggle {
    background: var(--paper);
    color: var(--ink);
  }
  .save {
    background: var(--gold);
    color: var(--ink);
    align-self: end;
  }
  .form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px 14px 14px;
    border-top: 2px solid var(--field-line);
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-weight: 600;
    font-size: 0.9rem;
  }
  .scores {
    display: flex;
    align-items: end;
    gap: 12px;
  }
  .scores input {
    width: 90px;
    font-size: 1.4rem;
    text-align: center;
  }
  .dash {
    padding-bottom: 10px;
  }
  select {
    font: inherit;
    padding: 8px;
    background: var(--paper);
    color: var(--ink);
    border: 2px solid var(--ink);
  }
  .err {
    background: var(--red);
    color: var(--paper);
    font-weight: 700;
    padding: 8px 12px;
  }
  .note {
    color: var(--on-field-soft);
    font-size: 0.85rem;
  }
</style>
