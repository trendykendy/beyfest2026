<script lang="ts">
  import type { PBGroup, PBMatch, PBPlayer } from "$lib/view";
  import { groupStandings, destinationOf, nameMap } from "$lib/view";

  let {
    group,
    players,
    matches,
    knockoutType,
    showDestinations = true,
  }: {
    group: PBGroup;
    players: PBPlayer[];
    matches: PBMatch[];
    knockoutType: string;
    showDestinations?: boolean;
  } = $props();

  const names = $derived(nameMap(players));
  const rows = $derived(groupStandings(players, matches, group.index));
  const groupMatches = $derived(matches.filter((m) => m.stage === "group" && m.groupIndex === group.index));
  const played = $derived(groupMatches.filter((m) => m.matchStatus === "done").length);
</script>

<div class="gcard">
  <div class="ghead">
    <h3>{group.name}</h3>
    <span class="tag">{group.size} players · {group.format} RR</span>
  </div>
  <div class="progress">
    <span>{played}/{groupMatches.length} matches</span>
    {#if group.complete}<span class="done-chip">Complete</span>{/if}
  </div>

  <table>
    <thead>
      <tr>
        <th class="r">#</th>
        <th>Player</th>
        <th class="n">W</th>
        <th class="n">L</th>
        <th class="n" title="Points scored">PF</th>
        <th class="n" title="Points scored minus points conceded">Point diff.</th>
        {#if showDestinations}<th class="d">Goes to</th>{/if}
      </tr>
    </thead>
    <tbody>
      {#each rows as row, i (row.playerId)}
        {@const dest = destinationOf(i + 1, group.size, knockoutType)}
        <tr>
          <td class="r">{i + 1}</td>
          <td class="pn">{names.get(row.playerId)}</td>
          <td class="n">{row.wins}</td>
          <td class="n">{row.losses}</td>
          <td class="n">{row.pointsFor}</td>
          <td class="n">{row.pointDiff > 0 ? "+" : ""}{row.pointDiff}</td>
          {#if showDestinations}
            <td class="d">
              <span class="chip tier-{dest.tier}" class:dim={!group.complete}>{dest.label}</span>
            </td>
          {/if}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .gcard {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px 18px;
  }
  .ghead {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }
  h3 {
    font-size: 1.5rem;
  }
  .tag {
    font-size: 0.66rem;
    color: var(--muted);
  }
  .progress {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.75rem;
    color: var(--muted);
    margin: 6px 0 10px;
  }
  .done-chip {
    color: var(--green);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-size: 0.68rem;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }
  th {
    font-family: var(--font-text);
    font-stretch: 75%;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.64rem;
    color: var(--muted);
    text-align: left;
    padding: 4px 6px;
    border-bottom: 1px solid var(--border);
  }
  td {
    padding: 5px 6px;
    border-bottom: 1px solid var(--border);
  }
  tr:last-child td {
    border-bottom: none;
  }
  .r {
    width: 22px;
    color: var(--muted);
    text-align: center;
  }
  .n {
    width: 32px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .pn {
    font-weight: 600;
  }
  .d {
    text-align: right;
    width: 76px;
  }
  .chip {
    --c: var(--neutral);
    font-family: var(--font-text);
    font-stretch: 75%;
    font-size: 0.62rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 20px;
    color: var(--c);
    border: 1px solid color-mix(in oklch, var(--c) 50%, transparent);
    background: color-mix(in oklch, var(--c) 14%, transparent);
  }
  .chip.tier-wb {
    --c: var(--wb);
  }
  .chip.tier-mb {
    --c: var(--mb);
  }
  .chip.tier-lb {
    --c: var(--lb);
  }
  .chip.dim {
    opacity: 0.45;
  }
</style>
