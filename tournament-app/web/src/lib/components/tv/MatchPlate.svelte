<script lang="ts">
  import type { PBMatch } from "$lib/view";
  import { slotLabel, tierOf } from "$lib/view";
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

  function side(pid: string, slot: PBMatch["slot1"]) {
    if (pid) return { name: names.get(pid) ?? "—", tbd: false };
    return { name: slotLabel(slot, groupCount), tbd: true };
  }
  const a = $derived(side(match.p1, match.slot1));
  const b = $derived(side(match.p2, match.slot2));
</script>

<div class="plate tier-{tier}" class:pending={match.matchStatus === "pending"} class:done>
  <div class="phead">
    <span class="pcode">{match.code}</span>
    <span class="pft">First to {target}</span>
  </div>
  <div class="side" class:won={done && match.winner === match.p1} class:tbd={a.tbd}>
    <span class="nm">{a.name}</span>
    {#if done}<span class="sc">{match.p1Score}</span>{/if}
  </div>
  <div class="side" class:won={done && match.winner === match.p2} class:tbd={b.tbd}>
    <span class="nm">{b.name}</span>
    {#if done}<span class="sc">{match.p2Score}</span>{/if}
  </div>
</div>

<style>
  .plate {
    --tier: var(--accent);
    position: relative;
    background: var(--tv-plate2);
    border: var(--outline) solid var(--ink);
    border-left: 6px solid var(--tier);
    min-width: 240px;
    box-shadow: 4px 4px 0 var(--ink);
  }
  .tier-wb {
    --tier: var(--wb);
  }
  .tier-mb {
    --tier: var(--mb);
  }
  .tier-lb {
    --tier: var(--lb);
  }
  .tier-gf {
    --tier: var(--gf);
  }
  .plate.pending {
    opacity: 0.5;
  }

  .phead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--accent);
    color: var(--ink);
    padding: 3px 9px;
  }
  .pcode {
    font-family: var(--font-text);
    font-stretch: 75%;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: 800;
    font-size: 0.74rem;
  }
  .pft {
    font-family: var(--font-text);
    font-stretch: 75%;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 0.6rem;
    font-weight: 700;
    opacity: 0.75;
  }

  .side {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 6px 10px;
    font-size: 1.15rem;
  }
  .side + .side {
    border-top: 1px solid var(--tv-line);
  }
  .nm {
    font-family: var(--font-display);
    font-stretch: 70%;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .side.tbd .nm {
    color: var(--tv-dim);
    font-style: italic;
    text-transform: none;
    font-weight: 500;
    font-size: 0.95rem;
  }
  .side.won {
    background: color-mix(in oklch, var(--accent) 13%, transparent);
  }
  .side.won .nm {
    color: var(--accent);
    font-weight: 800;
  }
  .sc {
    font-family: var(--font-display);
    font-stretch: 75%;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    font-size: 1.75rem;
    line-height: 1;
    min-width: 24px;
    text-align: right;
  }
  .side.won .sc {
    color: var(--accent);
  }

</style>
