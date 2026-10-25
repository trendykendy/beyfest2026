<script lang="ts">
  import { pointsToWin } from "@beyfest/engine";
  import Trophy from "$lib/components/Trophy.svelte";
  import { fighterFor, fighterImageUrl, type PBFighter } from "$lib/fighters";
  import { matchContext, nextMatchFor, playerRecord, sideName, type PBMatch, type PBPlayer } from "$lib/view";

  // The followed blader's next match, kept at the top of every tab: playing
  // now, up next, how many matches before theirs, or waiting for an opponent.
  // Once they've nothing left: champion, or their final record.
  let {
    player,
    matches,
    names,
    groupCount,
    fighters,
    pbUrl,
    nextCode = "",
  }: {
    player: PBPlayer;
    matches: PBMatch[];
    names: Map<string, string>;
    groupCount: number;
    fighters: PBFighter[];
    pbUrl: string;
    nextCode?: string;
  } = $props();

  const next = $derived(nextMatchFor(player.id, matches, nextCode));
  const fighter = $derived(fighterFor(player.name, fighters));
  const image = $derived(fighterImageUrl(pbUrl, fighter));
  const champion = $derived(matches.some((m) => m.stage === "gf" && m.matchStatus === "done" && m.winner === player.id));
  const record = $derived(playerRecord(player.id, matches));

  // Their side of the match, so their score and the opponent read the right way round.
  const mySide = $derived(next?.match.p1 === player.id ? 1 : 2);
  const opponent = $derived(next ? sideName(next.match, mySide === 1 ? 2 : 1, names, groupCount) : "");

  const headline = $derived.by(() => {
    if (!next) return champion ? "Champion!" : player.withdrawn ? "Withdrew" : "No more matches";
    if (next.state === "live") return "Playing now";
    if (next.state === "waiting") return "Waiting for opponent";
    if (next.ahead === 0) return "You're up next";
    return `${next.ahead} match${next.ahead === 1 ? "" : "es"} before yours`;
  });
</script>

<aside class="yn" class:live={next?.state === "live"} class:soon={next?.state === "ready" && next.ahead === 0}>
  <header class="yn-top">
    <span class="yn-tag">Following</span>
    <span class="yn-name">{player.name}</span>
  </header>
  <div class="yn-body">
    {#if image}
      <img class="yn-img" src={image} alt="" loading="lazy" />
    {/if}
    <div class="yn-text">
      <div class="yn-head">
        {#if champion && !next}<Trophy size="1.1em" />{/if}
        {headline}
        {#if next?.state === "live"}
          <span class="yn-score">{mySide === 1 ? next.match.liveP1 : next.match.liveP2}–{mySide === 1 ? next.match.liveP2 : next.match.liveP1}</span>
        {/if}
      </div>
      {#if next}
        <div class="yn-vs">v <b class:tbd={!(mySide === 1 ? next.match.p2 : next.match.p1)}>{opponent}</b></div>
        <div class="yn-ctx">
          {matchContext(next.match, matches)} · First to {pointsToWin(next.match.stage, next.match.roundLabel)}
        </div>
      {:else}
        <div class="yn-ctx">Finished {record.wins}–{record.losses}</div>
      {/if}
    </div>
  </div>
</aside>

<style>
  .yn {
    background: var(--paper);
    color: var(--ink);
    border: var(--outline) solid var(--ink);
    box-shadow: 5px 5px 0 var(--gold);
    overflow: hidden;
  }
  .yn-top {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--ink);
    color: var(--paper);
    padding-right: 12px;
    min-height: 32px;
  }
  .yn-tag {
    align-self: stretch;
    display: grid;
    place-items: center;
    background: var(--gold);
    color: var(--ink);
    font-stretch: 75%;
    font-weight: 800;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    padding: 0 18px 0 10px;
    clip-path: polygon(0 0, 100% 0, calc(100% - 10px) 100%, 0 100%);
  }
  .yn-name {
    font-family: var(--font-display);
    font-stretch: 62%;
    font-size: 1.15rem;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: 4px;
  }
  .yn-body {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
  }
  /* The fighter cut-out, cropped to the head and shoulders. */
  .yn-img {
    flex: none;
    width: 64px;
    height: 72px;
    object-fit: cover;
    object-position: top;
    background: var(--field);
    border: 2px solid var(--ink);
  }
  .yn-text {
    min-width: 0;
    flex: 1;
  }
  .yn-head {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    font-family: var(--font-display);
    font-size: 1.35rem;
    line-height: 1.1;
    text-transform: uppercase;
  }
  .live .yn-head {
    color: var(--red);
  }
  .yn-score {
    font-variant-numeric: tabular-nums;
    background: var(--red);
    color: var(--paper);
    padding: 2px 8px 3px;
  }
  .yn-vs {
    font-size: 0.95rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .yn-vs b {
    font-family: var(--font-display);
    font-stretch: 62%;
    font-size: 1.15rem;
    text-transform: uppercase;
  }
  .yn-vs b.tbd {
    font-family: var(--font-text);
    font-stretch: 75%;
    font-size: 0.95rem;
    text-transform: none;
  }
  .yn-ctx {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--ink-soft);
    line-height: 1.3;
  }
  /* Called next: the whole card says so. */
  .soon {
    box-shadow: 5px 5px 0 var(--red);
  }
</style>
