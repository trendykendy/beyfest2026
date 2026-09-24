<script lang="ts">
  import type { PBMatch, PBPlayer } from "$lib/view";
  import { miniRRStandings, nameMap, ordinal } from "$lib/view";

  let {
    matches,
    players,
    stage,
    advancers,
  }: {
    matches: PBMatch[];
    players: PBPlayer[];
    stage: "wb_rr" | "lb_rr";
    advancers: number;
  } = $props();

  const tier = $derived(stage === "wb_rr" ? "wb" : "lb");
  const title = $derived(stage === "wb_rr" ? "Winners round-robin" : "Losers round-robin");
  const names = $derived(nameMap(players));
  const rows = $derived(miniRRStandings(matches, stage));
  const stageMatches = $derived(matches.filter((m) => m.stage === stage));
  const played = $derived(stageMatches.filter((m) => m.matchStatus === "done").length);
  const finished = $derived(stageMatches.length > 0 && played === stageMatches.length);

  // Where each place goes next, in words (matches the TV's round-robin scene).
  function fate(rank: number): { text: string; tier: "gf" | "mb" | "out" } {
    if (stage === "wb_rr") return rank === 1 ? { text: "Grand final", tier: "gf" } : { text: "Mid bracket", tier: "mb" };
    return rank <= advancers ? { text: "Mid bracket", tier: "mb" } : { text: "Out", tier: "out" };
  }
</script>

<!-- A mini round-robin as a white slab with a green (Winners) or red (Losers)
     header, the same build as the group tables. -->
<div class="rr tier-{tier}">
  <header class="rr-head">
    <h3>{title}</h3>
    <span class="prog">{finished ? "Final standings" : `${played} of ${stageMatches.length} played`}</span>
  </header>
  <table>
    <tbody>
      {#each rows as row, i (row.playerId)}
        {@const f = fate(i + 1)}
        <tr class:out={f.tier === "out"}>
          <td class="seed">{ordinal(i + 1)}</td>
          <td class="pn">{names.get(row.playerId)}</td>
          <td class="rec">{row.wins}–{row.losses}</td>
          <td class="pf" title="Points scored">{row.pointsFor} pts</td>
          <td class="fate"><span class="chip to-{f.tier}" class:projected={!finished}>{f.text}</span></td>
        </tr>
      {/each}
      {#if rows.length === 0}
        <tr><td class="empty" colspan="5">Waiting for the group stage to finish.</td></tr>
      {/if}
    </tbody>
  </table>
</div>

<style>
  .rr {
    --tier: var(--on-field-soft);
    background: var(--paper);
    color: var(--ink);
    border: var(--outline) solid var(--ink);
    box-shadow: var(--shadow-offset) var(--shadow-offset) 0 var(--ink);
    min-width: 0;
  }
  .tier-wb {
    --tier: var(--wb);
  }
  .tier-lb {
    --tier: var(--lb);
  }
  .rr-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    background: var(--tier);
    color: var(--ink);
    padding: 8px 14px 10px;
    border-bottom: var(--outline) solid var(--ink);
  }
  .tier-lb .rr-head {
    color: var(--paper);
  }
  h3 {
    font-size: 1.5rem;
  }
  .prog {
    font-size: 0.85rem;
    font-weight: 700;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.95rem;
  }
  td {
    padding: 7px 8px;
    border-top: 1px solid #dfe3f2;
  }
  tr:first-child td {
    border-top: none;
  }
  .seed {
    width: 44px;
    font-family: var(--font-display);
    color: var(--ink-soft);
  }
  .pn {
    font-family: var(--font-display);
    font-stretch: 62%;
    text-transform: uppercase;
    font-size: 1.25rem;
    line-height: 1;
    padding-right: 0.3em;
  }
  .rec {
    width: 48px;
    text-align: center;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .pf {
    width: 60px;
    text-align: center;
    color: var(--ink-soft);
    font-variant-numeric: tabular-nums;
  }
  .fate {
    text-align: right;
    width: 110px;
  }
  .chip {
    --c: var(--on-field-soft);
    display: inline-block;
    font-size: 0.75rem;
    font-weight: 700;
    line-height: 1;
    padding: 5px 8px;
    white-space: nowrap;
    background: var(--c);
    color: var(--ink);
    border: 2px solid var(--ink);
  }
  .chip.to-mb {
    --c: var(--mb);
  }
  /* The Grand Final is the inverted slab everywhere: black with gold. */
  .chip.to-gf {
    background: var(--ink);
    color: var(--gold);
  }
  .chip.to-out {
    background: #dfe3f2;
    color: var(--ink-soft);
    border-color: #dfe3f2;
  }
  .rr .chip.projected {
    background: transparent;
    color: var(--ink-soft);
    border-color: var(--c);
  }
  .rr .chip.to-gf.projected {
    border-color: var(--ink);
  }
  tr.out .pn {
    color: var(--ink-soft);
  }
  .empty {
    color: var(--ink-soft);
    font-style: italic;
    text-align: center;
  }
</style>
