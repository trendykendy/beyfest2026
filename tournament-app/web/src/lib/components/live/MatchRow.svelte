<script lang="ts">
  import { isLive, sideName, tierOf, type PBMatch } from "$lib/view";

  // One fixture or result on a line, for the phone page:
  //   Conor   5–3   Sean     (result; the winner bold, the loser faded)
  //   Conor   2–1   Sean     (live, red)
  //   Conor   Next  Sean     (the next match to be called)
  //   Conor    v    Sean     (later)
  // Sides read as the slot ("Group 1 winner") until a player is in it.
  let {
    match,
    names,
    groupCount,
    followId = "",
    nextCode = "",
    label = "",
  }: {
    match: PBMatch;
    names: Map<string, string>;
    groupCount: number;
    followId?: string;
    nextCode?: string; // the one match to mark "Next"
    label?: string; // small caption above, e.g. "Group 2, match 4 of 6"
  } = $props();

  const status = $derived(
    match.matchStatus === "done" ? "done" : isLive(match) ? "live" : match.code === nextCode ? "next" : "later",
  );
  const w1 = $derived(status === "done" && match.winner === match.p1);
  const w2 = $derived(status === "done" && match.winner === match.p2);
  const mine = $derived(!!followId && (match.p1 === followId || match.p2 === followId));
</script>

<div class="row {status} tier-{tierOf(match.stage)}" class:mine>
  {#if label}<span class="cap">{label}</span>{/if}
  <span class="p" class:win={w1} class:lose={w2} class:tbd={!match.p1} class:me={mine && match.p1 === followId}>
    {sideName(match, 1, names, groupCount)}
  </span>
  <span class="mid">
    {#if status === "done"}{match.walkover ? "W/O" : `${match.p1Score}–${match.p2Score}`}
    {:else if status === "live"}{match.liveP1}–{match.liveP2}
    {:else if status === "next"}Next
    {:else}v{/if}
  </span>
  <span class="p right" class:win={w2} class:lose={w1} class:tbd={!match.p2} class:me={mine && match.p2 === followId}>
    {sideName(match, 2, names, groupCount)}
  </span>
</div>

<style>
  .row {
    --tier: transparent;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    column-gap: 8px;
    min-height: 48px;
    padding: 6px 12px 6px 8px;
    border-left: 6px solid var(--tier);
    border-top: 2px solid #e3e6f3;
  }
  .row:first-child {
    border-top: 0;
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
    --tier: var(--ink);
  }
  /* The followed blader's matches: a gold wash, their name underlined. */
  .row.mine {
    background: color-mix(in srgb, var(--gold) 26%, var(--paper));
  }
  .cap {
    grid-column: 1 / -1;
    font-size: 0.78rem;
    font-weight: 600;
    line-height: 1.2;
    color: var(--ink-soft);
    margin-bottom: 2px;
  }
  .p {
    font-family: var(--font-display);
    font-stretch: 62%;
    font-size: 1.2rem;
    line-height: 1.15;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: 3px; /* italic overhang */
  }
  .p.right {
    text-align: right;
  }
  .p.win {
    font-weight: 900;
  }
  .p.lose {
    color: #8a90ad;
  }
  /* A slot nobody is in yet: plain words, not a name, wrapping if long. */
  .p.tbd {
    white-space: normal;
    font-family: var(--font-text);
    font-stretch: 75%;
    font-size: 0.9rem;
    font-weight: 600;
    text-transform: none;
    color: var(--ink-soft);
  }
  .p.me {
    text-decoration: underline 3px var(--ink);
    text-underline-offset: 3px;
  }
  .mid {
    min-width: 52px;
    text-align: center;
    font-family: var(--font-display);
    font-size: 1.15rem;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    padding: 6px 8px 7px;
  }
  .later .mid {
    font-family: var(--font-text);
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--ink-soft);
  }
  .done .mid {
    background: var(--ink);
    color: var(--paper);
  }
  .live .mid {
    background: var(--red);
    color: var(--paper);
  }
  .next .mid {
    background: var(--gold);
    color: var(--ink);
    font-family: var(--font-text);
    font-weight: 800;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border: 2px solid var(--ink);
  }
</style>
