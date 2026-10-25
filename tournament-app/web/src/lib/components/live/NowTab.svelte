<script lang="ts">
  import Trophy from "$lib/components/Trophy.svelte";
  import { liveMatches, matchContext, recentResults, upNext, type PBMatch } from "$lib/view";
  import LiveMatch from "./LiveMatch.svelte";
  import MatchRow from "./MatchRow.svelte";

  // Now & next: what's being played, the next few to be called (in the TV's
  // order) and the latest results. The champion on top once it's all over.
  let {
    matches,
    names,
    groupCount,
    followId = "",
    nextCode = "",
  }: {
    matches: PBMatch[];
    names: Map<string, string>;
    groupCount: number;
    followId?: string;
    nextCode?: string; // the organiser's "Score this" pick
  } = $props();

  const live = $derived(liveMatches(matches));
  const next = $derived(upNext(matches, nextCode).slice(0, 4));
  const recent = $derived(recentResults(matches, 6));
  const final = $derived(matches.find((m) => m.stage === "gf" && m.matchStatus === "done"));
</script>

{#if final}
  <section class="champ">
    <Trophy size="64px" />
    <div>
      <span class="champ-tag">Champion</span>
      <span class="champ-name">{names.get(final.winner)}</span>
    </div>
  </section>
{/if}

<section>
  <h2 class="lv-h">Live now</h2>
  {#each live as m (m.code)}
    <div class="gap"><LiveMatch match={m} {matches} {names} {groupCount} {followId} /></div>
  {:else}
    <p class="lv-note">{final ? "That's the tournament. Thanks for watching!" : "Nothing on the table right now."}</p>
  {/each}
</section>

{#if next.length}
  <section>
    <h2 class="lv-h">Up next</h2>
    <div class="lv-slab">
      {#each next as m (m.code)}
        <MatchRow match={m} {names} {groupCount} {followId} nextCode={next[0].code} label={matchContext(m, matches)} />
      {/each}
    </div>
  </section>
{:else if !final}
  <section>
    <h2 class="lv-h">Up next</h2>
    <p class="lv-note">The next matches are waiting on results still being played.</p>
  </section>
{/if}

{#if recent.length}
  <section>
    <h2 class="lv-h">Latest results</h2>
    <div class="lv-slab">
      {#each recent as m (m.code)}
        <MatchRow match={m} {names} {groupCount} {followId} label={matchContext(m, matches)} />
      {/each}
    </div>
  </section>
{/if}

<style>
  .gap + .gap {
    margin-top: 14px;
  }
  /* The Grand Final's inverted slab: black with gold. */
  .champ {
    display: flex;
    align-items: center;
    gap: 14px;
    background: var(--ink);
    color: var(--paper);
    border: var(--outline) solid var(--gold);
    box-shadow: 5px 5px 0 var(--gold);
    padding: 14px 16px;
  }
  .champ div {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .champ-tag {
    font-family: var(--font-text);
    font-stretch: 75%;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-size: 0.85rem;
    color: var(--gold);
  }
  .champ-name {
    font-family: var(--font-display);
    font-stretch: 62%;
    font-size: 2.4rem;
    line-height: 1;
    text-transform: uppercase;
    overflow-wrap: anywhere;
    padding-right: 4px;
  }
</style>
