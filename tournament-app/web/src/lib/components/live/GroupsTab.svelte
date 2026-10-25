<script lang="ts">
  import {
    destinationOf,
    groupStandings,
    isLive,
    openingGroup,
    upNext,
    type PBGroup,
    type PBMatch,
    type PBPlayer,
  } from "$lib/view";
  import MatchRow from "./MatchRow.svelte";
  import StandingsTable from "./StandingsTable.svelte";

  // One group at a time (a phone can't fit three tables side by side): chips
  // to switch, then the table and its fixtures. Opens on the followed
  // blader's group, else one with a match on.
  let {
    groups,
    players,
    matches,
    names,
    knockoutType,
    followId = "",
    nextCode = "",
  }: {
    groups: PBGroup[];
    players: PBPlayer[];
    matches: PBMatch[];
    names: Map<string, string>;
    knockoutType: string;
    followId?: string;
    nextCode?: string;
  } = $props();

  let picked = $state<number | null>(null); // a chip tapped; until then, the opening group
  const shown = $derived(picked ?? openingGroup(groups, players, matches, followId, nextCode));
  const group = $derived(groups.find((g) => g.index === shown) ?? groups[0]);

  const fixturesOf = (gi: number) =>
    matches.filter((m) => m.stage === "group" && m.groupIndex === gi).sort((a, b) => a.orderIndex - b.orderIndex);
  const fixtures = $derived(group ? fixturesOf(group.index) : []);
  const played = $derived(fixtures.filter((m) => m.matchStatus === "done").length);
  // Only one fixture says "Next": the next match due anywhere (as on the TV).
  const nextUp = $derived(upNext(matches, nextCode)[0]?.code ?? "");
  const followedGroup = $derived(players.find((p) => p.id === followId)?.groupIndex ?? null);
</script>

{#if group}
  <div class="lv-chips" role="tablist" aria-label="Groups">
    {#each groups as g (g.id)}
      <button
        class="lv-chip"
        class:on={g.index === group.index}
        role="tab"
        aria-selected={g.index === group.index}
        onclick={() => (picked = g.index)}
      >
        {g.name}
        {#if fixturesOf(g.index).some(isLive)}<span class="lv-dot" title="Match on now"></span>{/if}
        {#if g.index === followedGroup}<span class="lv-star" title="Followed blader's group">★</span>{/if}
      </button>
    {/each}
  </div>

  <section class="lv-slab">
    <header class="lv-slab-head">
      <h2>{group.name}</h2>
      <span>{group.complete ? "Final standings" : `${played} of ${fixtures.length} played`}</span>
    </header>
    <StandingsTable
      rows={groupStandings(players, matches, group.index)}
      {names}
      fate={(rank) => destinationOf(rank, group.size, knockoutType)}
      projected={!group.complete}
      {followId}
    />
    {#if !group.complete}
      <p class="key">Dashed: where they'd go if the group ended now.</p>
    {/if}
  </section>

  <section>
    <h2 class="lv-h">Fixtures</h2>
    <div class="lv-slab">
      {#each fixtures as m (m.code)}
        <MatchRow match={m} {names} groupCount={groups.length} {followId} nextCode={nextUp} />
      {/each}
    </div>
  </section>
{/if}

<style>
  .key {
    font-size: 0.8rem;
    color: var(--ink-soft);
    padding: 6px 12px 8px;
    border-top: 2px solid #e3e6f3;
  }
</style>
