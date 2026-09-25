<script lang="ts">
  // One knockout match on the TV bracket: a small white telop slab. The header
  // band carries the tier colour (green Winners, gold Mid, red Losers, black
  // Grand Final) and turns red while the match is being played.
  import type { PBMatch } from "$lib/view";
  import { slotLabel, tierOf, isLive } from "$lib/view";
  import { pointsToWin } from "@beyfest/engine";

  let {
    match,
    names,
    groupCount,
  }: {
    match: PBMatch;
    names: Map<string, string>;
    groupCount: number;
  } = $props();

  const tier = $derived(tierOf(match.stage));
  const target = $derived(pointsToWin(match.stage, match.roundLabel));
  const done = $derived(match.matchStatus === "done");
  const live = $derived(isLive(match));
  const walkover = $derived(done && match.walkover);

  function side(pid: string, slot: PBMatch["slot1"]) {
    if (pid) return { name: names.get(pid) ?? "—", tbd: false };
    return { name: slotLabel(slot, groupCount), tbd: true };
  }
  const a = $derived(side(match.p1, match.slot1));
  const b = $derived(side(match.p2, match.slot2));
  // A walkover shows no score, just "Walkover" in the header.
  const s1 = $derived(walkover ? null : done ? match.p1Score : live ? match.liveP1 : null);
  const s2 = $derived(walkover ? null : done ? match.p2Score : live ? match.liveP2 : null);
  const won1 = $derived(done && match.winner === match.p1);
  const won2 = $derived(done && match.winner === match.p2);
</script>

<div class="plate tier-{tier}" class:pending={match.matchStatus === "pending"} class:live>
  <div class="phead">
    <span class="pcode">{match.code}</span>
    <span class="pft">{walkover ? "Walkover" : live ? "Live" : `First to ${target}`}</span>
  </div>
  <div class="side" class:won={won1} class:lost={won2} class:tbd={a.tbd}>
    <span class="nm">{a.name}</span>
    {#if s1 !== null}<span class="sc">{s1}</span>{/if}
  </div>
  <div class="side" class:won={won2} class:lost={won1} class:tbd={b.tbd}>
    <span class="nm">{b.name}</span>
    {#if s2 !== null}<span class="sc">{s2}</span>{/if}
  </div>
</div>

<style>
  .plate {
    --tier: var(--gold);
    --tier-ink: var(--ink);
    background: var(--paper);
    color: var(--ink);
    border: var(--outline) solid var(--ink);
    box-shadow: 6px 6px 0 var(--ink);
    min-width: 280px;
  }
  .tier-wb {
    --tier: var(--wb);
  }
  .tier-mb {
    --tier: var(--mb);
  }
  .tier-lb {
    --tier: var(--lb);
    --tier-ink: var(--paper);
  }
  .tier-gf {
    --tier: var(--ink);
    --tier-ink: var(--gold);
  }
  .plate.live {
    --tier: var(--red);
    --tier-ink: var(--paper);
  }
  /* Waiting on earlier results: present but quiet. */
  .plate.pending {
    background: #dfe3f2;
    box-shadow: none;
    border-style: dashed;
  }

  .phead {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    background: var(--tier);
    color: var(--tier-ink);
    border-bottom: var(--outline) solid var(--ink);
    padding: 4px 12px 5px;
    font-family: var(--font-text);
    font-weight: 700;
    font-size: 1.05rem;
    line-height: 1.2;
  }
  .pcode {
    font-weight: 800;
  }

  .side {
    display: flex;
    align-items: stretch;
    justify-content: space-between;
    min-height: 54px;
  }
  .side + .side {
    border-top: 2px solid #e3e6f3;
  }
  .nm {
    align-self: center;
    font-family: var(--font-display);
    font-stretch: 62%;
    text-transform: uppercase;
    font-size: 2rem;
    line-height: 1;
    padding: 6px 12px 6px 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* Unresolved slot, e.g. "Winner of MB1": readable, but clearly not a name. */
  .side.tbd .nm {
    font-family: var(--font-text);
    font-stretch: 100%;
    text-transform: none;
    font-size: 1.3rem;
    font-weight: 600;
    color: var(--ink-soft);
  }
  .sc {
    flex: none;
    min-width: 58px;
    display: grid;
    place-items: center;
    font-family: var(--font-display);
    font-size: 2.2rem;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    border-left: 2px solid #e3e6f3;
  }
  .side.won .sc {
    background: var(--gold);
    border-left-color: var(--ink);
  }
  .side.lost {
    color: var(--ink-soft);
  }
</style>
