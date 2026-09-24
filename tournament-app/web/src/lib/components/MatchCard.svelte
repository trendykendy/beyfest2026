<script lang="ts">
  import type { PBMatch } from "$lib/view";
  import { slotLabel, tierOf } from "$lib/view";
  import { pointsToWin } from "@beyfest/engine";

  let {
    match,
    names,
    groupCount,
    compact = false,
  }: {
    match: PBMatch;
    names: Map<string, string>;
    groupCount: number;
    compact?: boolean;
  } = $props();

  const tier = $derived(tierOf(match.stage));

  function side(playerId: string, slot: PBMatch["slot1"]) {
    if (playerId) return { name: names.get(playerId) ?? "—", tbd: false };
    return { name: slotLabel(slot, groupCount), tbd: true };
  }

  const a = $derived(side(match.p1, match.slot1));
  const b = $derived(side(match.p2, match.slot2));
  const done = $derived(match.matchStatus === "done");
  const aWon = $derived(done && match.winner === match.p1);
  const bWon = $derived(done && match.winner === match.p2);
  const target = $derived(pointsToWin(match.stage, match.roundLabel));
</script>

<div
  class="match tier-{tier}"
  class:pending={match.matchStatus === "pending"}
  class:done
  class:compact
>
  <div class="code-row">
    <span class="code">{match.code}</span>
    <span class="target" class:hot={target > 5}>Ft{target}</span>
  </div>
  <div class="side" class:won={aWon} class:tbd={a.tbd}>
    <span class="pname">{a.name}</span>
    {#if done}<span class="score">{match.walkover ? (aWon ? "W/O" : "") : match.p1Score}</span>{/if}
  </div>
  <div class="side" class:won={bWon} class:tbd={b.tbd}>
    <span class="pname">{b.name}</span>
    {#if done}<span class="score">{match.walkover ? (bWon ? "W/O" : "") : match.p2Score}</span>{/if}
  </div>
</div>

<style>
  .match {
    --tier: var(--neutral);
    background: var(--surface);
    border: 1px solid var(--border);
    border-left: 3px solid var(--tier);
    border-radius: 8px;
    padding: 8px 10px;
    min-width: 168px;
    position: relative;
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
  .match.pending {
    opacity: 0.5;
    border-style: dashed;
  }
  .code-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    margin-bottom: 4px;
  }
  .code {
    font-family: var(--font-text);
    font-stretch: 75%;
    font-size: 0.62rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--tier);
    font-weight: 700;
  }
  .target {
    font-family: var(--font-text);
    font-stretch: 75%;
    font-size: 0.58rem;
    letter-spacing: 0.06em;
    font-weight: 700;
    color: var(--muted);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 0 6px;
    line-height: 1.4;
  }
  .target.hot {
    color: var(--tier);
    border-color: color-mix(in oklch, var(--tier) 50%, transparent);
    background: color-mix(in oklch, var(--tier) 12%, transparent);
  }
  .side {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 2px 0;
    font-size: 0.92rem;
  }
  .side + .side {
    border-top: 1px solid var(--border);
  }
  .pname {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .side.tbd .pname {
    color: var(--muted);
    font-style: italic;
    font-size: 0.82rem;
  }
  .side.won .pname {
    font-weight: 700;
    color: var(--tier);
  }
  .score {
    font-family: var(--font-text);
    font-stretch: 75%;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    font-size: 1.1rem;
    line-height: 1;
    min-width: 18px;
    text-align: right;
  }
  .side.won .score {
    color: var(--tier);
  }
  .compact {
    min-width: 150px;
  }
</style>
