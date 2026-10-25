<script lang="ts">
  import { miniRRAdvancers, pointsToWin, type StructureSpec } from "@beyfest/engine";
  import {
    hasStage,
    isLive,
    knockoutTiers,
    miniRRStandings,
    openingTier,
    roundName,
    rrFate,
    upNext,
    type KnockoutTier,
    type PBMatch,
  } from "$lib/view";
  import MatchRow from "./MatchRow.svelte";
  import StandingsTable from "./StandingsTable.svelte";

  // The knockout as lists, not a tree: a tree doesn't fit a phone without
  // sideways scrolling. Chips pick a tier; each tier lists its rounds top to
  // bottom in play order, with its mini round-robin table first.
  let {
    matches,
    names,
    groupCount,
    structure,
    followId = "",
    nextCode = "",
  }: {
    matches: PBMatch[];
    names: Map<string, string>;
    groupCount: number;
    structure: StructureSpec | null;
    followId?: string;
    nextCode?: string;
  } = $props();

  // 8 players is a plain double elimination (upper / lower), not three tiers.
  const doubleElim = $derived(structure?.knockoutType === "double-elim");
  const TIER_NAME: Record<KnockoutTier["tier"], string> = { wb: "Winners", mb: "Mid", lb: "Losers", gf: "Final" };
  const tierName = (t: KnockoutTier["tier"]) =>
    doubleElim && t === "wb" ? "Upper" : doubleElim && t === "lb" ? "Lower" : TIER_NAME[t];

  const tiers = $derived(knockoutTiers(matches));
  let picked = $state<KnockoutTier["tier"] | null>(null); // a chip tapped; until then, the opening tier
  const shown = $derived(
    tiers.find((t) => t.tier === picked) ?? tiers.find((t) => t.tier === openingTier(tiers, matches, followId, nextCode)) ?? tiers[0],
  );
  const nextUp = $derived(upNext(matches, nextCode)[0]?.code ?? "");

  // The mini round-robin heading this tier, if it has one.
  const RR = {
    wb: { stage: "wb_rr", title: "Winners round-robin", note: "Winner goes straight to the grand final" },
    lb: { stage: "lb_rr", title: "Losers round-robin", note: "Last chance to stay in" },
  } as const;
  const rr = $derived(shown && (shown.tier === "wb" || shown.tier === "lb") && hasStage(matches, RR[shown.tier].stage) ? RR[shown.tier] : null);
  const rrPlayed = $derived.by(() => {
    const list = rr ? matches.filter((m) => m.stage === rr.stage) : [];
    return { done: list.filter((m) => m.matchStatus === "done").length, total: list.length };
  });

  const hasMine = (list: PBMatch[]) => !!followId && list.some((m) => m.p1 === followId || m.p2 === followId);
</script>

{#if shown}
  <div class="lv-chips" role="tablist" aria-label="Bracket tiers">
    {#each tiers as t (t.tier)}
      {@const all = t.rounds.flatMap((r) => r.matches)}
      <button
        class="lv-chip tier-{t.tier}"
        class:on={t.tier === shown.tier}
        role="tab"
        aria-selected={t.tier === shown.tier}
        onclick={() => (picked = t.tier)}
      >
        {tierName(t.tier)}
        {#if all.some(isLive)}<span class="lv-dot" title="Match on now"></span>{/if}
        {#if hasMine(all)}<span class="lv-star" title="Followed blader plays here">★</span>{/if}
      </button>
    {/each}
  </div>

  {#if rr && structure}
    {@const stage = rr.stage}
    <section class="lv-slab">
      <header class="lv-slab-head rr-{shown.tier}">
        <h2>{rr.title}</h2>
        <span>{rrPlayed.done === rrPlayed.total ? "Final standings" : `${rrPlayed.done} of ${rrPlayed.total} played`}</span>
      </header>
      <p class="rr-note">{rr.note}</p>
      <StandingsTable
        rows={miniRRStandings(matches, stage)}
        {names}
        fate={(rank) => {
          const f = rrFate(stage, rank, miniRRAdvancers(structure, stage));
          return { tier: f.tier as "gf" | "mb" | "out", label: f.text };
        }}
        projected={rrPlayed.done < rrPlayed.total}
        {followId}
      />
    </section>
  {/if}

  {#each shown.rounds as round (round.label)}
    {@const target = pointsToWin(round.matches[0].stage, round.label)}
    <section>
      <h2 class="lv-h">
        {roundName(round.label)}
        {#if target > 5}<span class="ft">First to {target}</span>{/if}
      </h2>
      <div class="lv-slab">
        {#each round.matches as m (m.code)}
          <!-- The code as a caption: later rounds read "Winner of MB1". -->
          <MatchRow match={m} {names} {groupCount} {followId} nextCode={nextUp} label={m.code} />
        {/each}
      </div>
    </section>
  {/each}
{/if}

<style>
  /* A tier chip carries its colour as a bar along the bottom. */
  button.lv-chip {
    border-bottom: 5px solid var(--tier);
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
    --tier: var(--paper);
  }
  .rr-wb {
    background: var(--wb);
    color: var(--ink);
  }
  .rr-lb {
    background: var(--lb);
    color: var(--paper);
  }
  .rr-note {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--ink-soft);
    padding: 6px 12px 0;
  }
  .ft {
    font-family: var(--font-text);
    font-stretch: 75%;
    font-weight: 800;
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    background: var(--gold);
    color: var(--ink);
    padding: 3px 7px;
    margin-left: 8px;
    vertical-align: 0.15em;
  }
</style>
