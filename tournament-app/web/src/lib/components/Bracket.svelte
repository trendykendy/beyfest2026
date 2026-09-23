<script lang="ts">
  import type { PBMatch, PBPlayer } from "$lib/view";
  import { nameMap, tierOf } from "$lib/view";
  import MatchCard from "./MatchCard.svelte";

  let {
    matches,
    players,
    groupCount,
  }: {
    matches: PBMatch[];
    players: PBPlayer[];
    groupCount: number;
  } = $props();

  const names = $derived(nameMap(players));

  // Knockout matches grouped into columns by round label, in play order.
  const columns = $derived.by(() => {
    const ko = matches
      .filter((m) => m.stage !== "group")
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const cols: { label: string; tier: string; matches: PBMatch[] }[] = [];
    for (const m of ko) {
      let col = cols.find((c) => c.label === m.roundLabel);
      if (!col) {
        col = { label: m.roundLabel, tier: tierOf(m.stage), matches: [] };
        cols.push(col);
      }
      col.matches.push(m);
    }
    return cols;
  });
</script>

<div class="bracket">
  {#each columns as col (col.label)}
    <div class="col tier-{col.tier}">
      <div class="col-head">{col.label}</div>
      <div class="col-body">
        {#each col.matches as m (m.code)}
          <MatchCard match={m} {names} {groupCount} />
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .bracket {
    display: flex;
    gap: 18px;
    overflow-x: auto;
    padding: 8px 4px 18px;
    align-items: stretch;
  }
  .col {
    --tier: var(--neutral);
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 176px;
  }
  .col.tier-wb {
    --tier: var(--wb);
  }
  .col.tier-mb {
    --tier: var(--mb);
  }
  .col.tier-lb {
    --tier: var(--lb);
  }
  .col.tier-gf {
    --tier: var(--gf);
  }
  .col-head {
    font-family: var(--font-text);
    font-stretch: 75%;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--tier);
    padding-bottom: 6px;
    border-bottom: 2px solid color-mix(in oklch, var(--tier) 40%, transparent);
    position: sticky;
    top: 0;
  }
  .col-body {
    display: flex;
    flex-direction: column;
    gap: 10px;
    justify-content: center;
    flex: 1;
  }
</style>
