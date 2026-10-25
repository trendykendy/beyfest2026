<script lang="ts">
  import { pointsToWin } from "@beyfest/engine";
  import { FINISHES } from "$lib/finishes";
  import { stadiumOf } from "$lib/stadia";
  import { matchContext, sideName, tierOf, type PBMatch } from "$lib/view";

  // A match being played, as a phone-sized Match centre: both bladers stacked
  // with their running score, a pill for every round each has won, the target
  // between them, and this round's stadium once it's drawn.
  let {
    match,
    matches,
    names,
    groupCount,
    followId = "",
  }: {
    match: PBMatch;
    matches: PBMatch[];
    names: Map<string, string>;
    groupCount: number;
    followId?: string;
  } = $props();

  const FINISH_BY_KEY = new Map(FINISHES.map((f) => [f.key, f]));

  const target = $derived(pointsToWin(match.stage, match.roundLabel));
  // Reaching the target ends it, even before the organiser saves the result.
  const decided = $derived(match.liveP1 >= target || match.liveP2 >= target);
  const stadium = $derived(decided ? null : stadiumOf(match.stadium));
  // Each side's rounds won, oldest first (rounds with an unknown finish skipped).
  const pills = $derived.by(() => {
    const out: Record<1 | 2, { i: number; label: string; pts: number }[]> = { 1: [], 2: [] };
    match.liveLog.forEach((r, i) => {
      const f = FINISH_BY_KEY.get(r.finish);
      if (f) out[r.who].push({ i, label: f.label, pts: f.pts });
    });
    return out;
  });

  const sides = $derived([
    { who: 1 as const, id: match.p1, score: match.liveP1 },
    { who: 2 as const, id: match.p2, score: match.liveP2 },
  ]);
</script>

<article class="lm tier-{tierOf(match.stage)}">
  <header class="lm-top">
    {#if decided}<span class="tag won">Match won</span>{:else}<span class="tag live">Live</span>{/if}
    <span class="ctx">{matchContext(match, matches)}</span>
  </header>

  {#if stadium}
    <div class="stadium" data-stadium={stadium.key}>
      <span class="rd">Round {match.liveLog.length + 1}</span>
      <span class="num">{stadium.num}</span>
      <span class="nm">{stadium.name}</span>
    </div>
  {/if}

  {#each sides as s, i (s.who)}
    {#if i === 1}
      <!-- The target, between the two scores it's read against. -->
      <div class="ft"><span>First to <b>{target}</b></span></div>
    {/if}
    {@const other = sides[1 - i].score}
    <div class="side" class:won={decided && s.score > other} class:lost={decided && s.score < other} class:me={!!followId && s.id === followId}>
      <span class="name">{sideName(match, s.who, names, groupCount)}</span>
      <span class="score">{s.score}</span>
      {#if pills[s.who].length}
        <div class="pills">
          {#each pills[s.who] as p (p.i)}
            <span class="pill">{p.label} <b>+{p.pts}</b></span>
          {/each}
        </div>
      {/if}
    </div>
  {/each}
</article>

<style>
  .lm {
    --tier: var(--gold);
    background: var(--paper);
    color: var(--ink);
    border: var(--outline) solid var(--ink);
    box-shadow: 5px 5px 0 var(--ink);
    border-left: 10px solid var(--tier);
  }
  .tier-wb {
    --tier: var(--wb);
  }
  .tier-lb {
    --tier: var(--lb);
  }
  .tier-gf {
    --tier: var(--ink);
  }
  .lm-top {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--ink);
    color: var(--paper);
    padding-right: 10px;
    min-height: 36px;
  }
  .tag {
    font-family: var(--font-display);
    text-transform: uppercase;
    font-size: 1.05rem;
    line-height: 1;
    align-self: stretch;
    display: grid;
    place-items: center;
    padding: 0 18px 0 10px;
    clip-path: polygon(0 0, 100% 0, calc(100% - 10px) 100%, 0 100%);
  }
  .tag.live {
    background: var(--red);
    color: var(--paper);
  }
  .tag.won {
    background: var(--gold);
    color: var(--ink);
  }
  .ctx {
    font-size: 0.85rem;
    font-weight: 600;
    line-height: 1.2;
    min-width: 0;
  }
  /* Round tag, numeral block in the stadium's colour, name: the TV's chip. */
  .stadium {
    display: flex;
    align-items: stretch;
    width: fit-content;
    max-width: calc(100% - 20px);
    margin: 10px 10px 2px;
    border: 2px solid var(--ink);
    box-shadow: 3px 3px 0 var(--st);
    font-family: var(--font-display);
    text-transform: uppercase;
    font-size: 0.95rem;
    line-height: 1;
    transform: skewX(-8deg);
  }
  .stadium > span {
    display: grid;
    place-items: center;
    padding: 5px 10px 6px;
    white-space: nowrap;
  }
  .stadium .rd {
    background: var(--ink);
    color: var(--paper);
    font-family: var(--font-text);
    font-stretch: 75%;
    font-weight: 700;
    letter-spacing: 0.08em;
    font-size: 0.8rem;
  }
  .stadium .num {
    background: var(--st);
    color: var(--st-ink);
    border-right: 2px solid var(--ink);
    min-width: 2.2em;
  }
  .stadium .nm {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .side {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    column-gap: 10px;
    padding: 8px 12px 8px 12px;
  }
  .side.me {
    background: color-mix(in srgb, var(--gold) 26%, var(--paper));
  }
  .name {
    font-family: var(--font-display);
    font-stretch: 62%;
    font-size: 1.7rem;
    line-height: 1.05;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: 4px; /* italic overhang */
  }
  .me .name {
    text-decoration: underline 3px var(--ink);
    text-underline-offset: 4px;
  }
  .score {
    font-family: var(--font-display);
    font-size: 2.6rem;
    line-height: 1;
    min-width: 1.4em;
    text-align: center;
    font-variant-numeric: tabular-nums;
    padding-right: 4px;
  }
  .won .score {
    color: var(--ink);
    background: var(--gold);
    border: 2px solid var(--ink);
  }
  .lost {
    color: #8a90ad;
  }
  .pills {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 6px;
  }
  .pill {
    font-size: 0.75rem;
    font-weight: 700;
    line-height: 1;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 4px 7px 5px;
    background: var(--ink);
    color: var(--paper);
    transform: skewX(-8deg);
  }
  .pill b {
    color: var(--gold);
  }
  /* "First to 5" sits on the line between the two sides. */
  .ft {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--ink-soft);
  }
  .ft::before,
  .ft::after {
    content: "";
    flex: 1;
    border-top: 2px solid #e3e6f3;
  }
  .ft b {
    color: var(--ink);
  }
</style>
