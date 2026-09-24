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

<!-- A group's table as a white slab, like the TV: black header, a stripe on
     each row for where that blader is heading. Destinations are outlined
     ("so far") until the group is finished, then filled in. -->
<div class="gcard">
  <header class="ghead">
    <h3>{group.name}</h3>
    <span class="progress">{group.complete ? "Final standings" : `${played} of ${groupMatches.length} played`}</span>
  </header>

  <table>
    <thead>
      <tr>
        <th class="r"><span class="sr">Place</span></th>
        <th>Blader</th>
        <th class="n">W–L</th>
        <th class="n" title="Points scored (the second tie-breaker)">Points</th>
        <th class="n" title="Points scored minus points conceded (the first tie-breaker)">Point diff.</th>
        {#if showDestinations}<th class="d">Goes to</th>{/if}
      </tr>
    </thead>
    <tbody>
      {#each rows as row, i (row.playerId)}
        {@const dest = destinationOf(i + 1, group.size, knockoutType)}
        <tr class="tier-{dest.tier}">
          <td class="r">{i + 1}</td>
          <td class="pn">{names.get(row.playerId)}</td>
          <td class="n wl">{row.wins}–{row.losses}</td>
          <td class="n">{row.pointsFor}</td>
          <td class="n">{row.pointDiff > 0 ? "+" : ""}{row.pointDiff}</td>
          {#if showDestinations}
            <td class="d">
              <span class="chip" class:projected={!group.complete}>{dest.label}</span>
            </td>
          {/if}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .gcard {
    background: var(--paper);
    color: var(--ink);
    border: var(--outline) solid var(--ink);
    box-shadow: var(--shadow-offset) var(--shadow-offset) 0 var(--ink);
  }
  .ghead {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    background: var(--ink);
    color: var(--paper);
    padding: 8px 14px 10px;
  }
  h3 {
    font-size: 1.6rem;
  }
  .progress {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--gold);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.95rem;
  }
  th {
    font-size: 0.72rem;
    font-weight: 600;
    line-height: 1.1;
    color: var(--ink-soft);
    text-align: left;
    vertical-align: bottom;
    padding: 8px 6px 4px;
  }
  td {
    padding: 6px;
    border-top: 1px solid #dfe3f2;
  }
  /* Where each blader is heading, as a stripe down the left edge. */
  tr {
    --tier: var(--on-field-soft);
  }
  tr.tier-wb {
    --tier: var(--wb);
  }
  tr.tier-mb {
    --tier: var(--mb);
  }
  tr.tier-lb {
    --tier: var(--lb);
  }
  tbody td:first-child {
    border-left: 6px solid var(--tier);
  }
  .r {
    width: 32px;
    text-align: center;
    font-family: var(--font-display);
    color: var(--ink-soft);
  }
  .n {
    width: 52px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .wl {
    font-weight: 700;
  }
  .pn {
    font-family: var(--font-display);
    font-stretch: 62%;
    text-transform: uppercase;
    font-size: 1.25rem;
    line-height: 1;
    padding-right: 0.3em; /* italic overhang */
  }
  .d {
    text-align: right;
    width: 84px;
  }
  .chip {
    display: inline-block;
    font-size: 0.75rem;
    font-weight: 700;
    line-height: 1;
    padding: 5px 8px;
    background: var(--tier);
    color: var(--ink);
    border: 2px solid var(--ink);
  }
  tr.tier-lb .chip {
    color: var(--paper);
  }
  /* Still being played: where they'd go if it ended now. */
  tr .chip.projected {
    background: transparent;
    color: var(--ink-soft);
    border-color: var(--tier);
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
</style>
