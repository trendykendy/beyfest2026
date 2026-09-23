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
  const title = $derived(stage === "wb_rr" ? "Winners Mini-RR" : "Losers Mini-RR");
  const names = $derived(nameMap(players));
  const rows = $derived(miniRRStandings(matches, stage));
  const stageMatches = $derived(matches.filter((m) => m.stage === stage));
  const played = $derived(stageMatches.filter((m) => m.matchStatus === "done").length);

  function seedLabel(rank: number): string {
    const prefix = stage === "wb_rr" ? "WB" : "LB";
    return `${prefix}-${ordinal(rank)}`;
  }
  function fate(rank: number): { text: string; kind: "adv" | "out" } {
    if (stage === "wb_rr") {
      if (rank === 1) return { text: "→ Grand Final", kind: "adv" };
      return { text: "→ Mid Bracket", kind: "adv" };
    }
    return rank <= advancers
      ? { text: "→ Mid Bracket", kind: "adv" }
      : { text: "Eliminated", kind: "out" };
  }
</script>

<div class="rr tier-{tier}">
  <div class="rr-head">
    <h4>{title}</h4>
    <span class="prog">{played}/{stageMatches.length}</span>
  </div>
  <table>
    <tbody>
      {#each rows as row, i (row.playerId)}
        {@const f = fate(i + 1)}
        <tr class:out={f.kind === "out"}>
          <td class="seed">{seedLabel(i + 1)}</td>
          <td class="pn">{names.get(row.playerId)}</td>
          <td class="rec">{row.wins}–{row.losses}</td>
          <td class="pf" title="Points scored">{row.pointsFor}</td>
          <td class="fate {f.kind}">{f.text}</td>
        </tr>
      {/each}
      {#if rows.length === 0}
        <tr><td class="empty" colspan="5">Waiting for entrants…</td></tr>
      {/if}
    </tbody>
  </table>
</div>

<style>
  .rr {
    --tier: var(--neutral);
    background: var(--surface);
    border: 1px solid var(--border);
    border-top: 3px solid var(--tier);
    border-radius: var(--radius);
    padding: 12px 14px;
    min-width: 240px;
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
    margin-bottom: 8px;
  }
  h4 {
    font-family: "Bebas Neue", sans-serif;
    font-size: 1.15rem;
    letter-spacing: 0.04em;
    color: var(--tier);
  }
  .prog {
    font-size: 0.72rem;
    color: var(--muted);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.88rem;
  }
  td {
    padding: 4px 6px;
    border-bottom: 1px solid var(--border);
  }
  tr:last-child td {
    border-bottom: none;
  }
  .seed {
    font-family: "Barlow Condensed", sans-serif;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 0.66rem;
    font-weight: 700;
    color: var(--tier);
    width: 54px;
  }
  .pn {
    font-weight: 600;
  }
  .rec {
    text-align: center;
    font-variant-numeric: tabular-nums;
    color: var(--muted);
    width: 44px;
  }
  .pf {
    text-align: center;
    font-variant-numeric: tabular-nums;
    color: var(--muted);
    width: 30px;
  }
  .fate {
    text-align: right;
    font-size: 0.72rem;
    white-space: nowrap;
  }
  .fate.adv {
    color: var(--tier);
    font-weight: 600;
  }
  .fate.out {
    color: var(--muted);
  }
  tr.out .pn {
    color: var(--muted);
  }
  .empty {
    color: var(--muted);
    font-style: italic;
    text-align: center;
  }
</style>
