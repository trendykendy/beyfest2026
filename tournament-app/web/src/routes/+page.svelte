<script lang="ts">
  import { onMount } from "svelte";
  import { invalidateAll } from "$app/navigation";
  import { pb } from "$lib/pbBrowser";
  import { pickStructure, miniRRAdvancers } from "@beyfest/engine";
  import { nameMap, hasStage } from "$lib/view";
  import GroupCard from "$lib/components/GroupCard.svelte";
  import Bracket from "$lib/components/Bracket.svelte";
  import MiniRRTable from "$lib/components/MiniRRTable.svelte";
  import Trophy from "$lib/components/Trophy.svelte";

  let { data } = $props();

  const structure = $derived(data.tournament ? pickStructure(data.tournament.structureKey) : null);
  const groupCount = $derived(data.groups.length);
  const names = $derived(nameMap(data.players));
  const hasKnockout = $derived(data.matches.some((m) => m.stage !== "group"));
  const champion = $derived.by(() => {
    const gf = data.matches.find((m) => m.stage === "gf");
    return gf && gf.matchStatus === "done" ? names.get(gf.winner) : null;
  });
  const callout = $derived(structure && "callout" in structure ? (structure as { callout?: string }).callout : undefined);

  onMount(() => {
    const subs = ["tournaments", "groups", "players", "matches"].map((c) =>
      pb().collection(c).subscribe("*", () => invalidateAll()),
    );
    return () => subs.forEach((p) => p.then((unsub) => unsub()).catch(() => {}));
  });
</script>

<div class="container">
  {#if !data.tournament}
    <div class="empty">
      <h1>Beyfest 2026</h1>
      <p class="tag">Triple Threat</p>
      <p class="waiting">The tournament hasn't started yet. Standings and brackets will appear here live once the groups are drawn.</p>
    </div>
  {:else}
    <header class="hero">
      <h1>{data.tournament.name}</h1>
      <p class="meta tag">
        {data.tournament.playerCount} players · {structure?.groups.join(" / ")} groups ·
        {structure?.roundRobin} round robin
      </p>
    </header>

    {#if champion}
      <div class="champ">
        <span class="tag">Tournament Champion</span>
        <span class="champ-name"><Trophy /> {champion}</span>
      </div>
    {/if}

    <!-- How it works -->
    <section class="rules">
      <div class="rule"><b>Format.</b> Every match is 1&nbsp;v&nbsp;1. First to <b>5</b> points — rising to <b>7</b> from the semi-finals and <b>9</b> in the Grand Final.</div>
      <div class="rule"><b>Groups → knockout.</b> Group finishers split into three tiers: winners climb the <span class="wb">Winners</span> path, middles fight through the <span class="mb">Mid</span> bracket, last-placers get one more shot in the <span class="lb">Losers</span> bracket.</div>
      <div class="rule"><b>The advantage.</b> The Winners champion reaches the Grand Final undefeated — a shorter path, no elimination pressure.</div>
      {#if callout}
        <div class="rule callout">{@html callout}</div>
      {/if}
    </section>

    <!-- Groups -->
    <section>
      <h2>Groups</h2>
      <div class="groups-grid">
        {#each data.groups as group (group.id)}
          <GroupCard {group} players={data.players} matches={data.matches} knockoutType={structure?.knockoutType ?? ""} />
        {/each}
      </div>
    </section>

    <!-- Knockout -->
    {#if hasKnockout}
      {#if hasStage(data.matches, "wb_rr") || hasStage(data.matches, "lb_rr")}
        <section>
          <h2>Mini Round-Robins</h2>
          <p class="rr-note">The three group winners play off for the Winners seeds; the last-placers play off for a Losers-Bracket lifeline.</p>
          <div class="rr-row">
            {#if structure && hasStage(data.matches, "wb_rr")}
              <MiniRRTable matches={data.matches} players={data.players} stage="wb_rr" advancers={miniRRAdvancers(structure, "wb_rr")} />
            {/if}
            {#if structure && hasStage(data.matches, "lb_rr")}
              <MiniRRTable matches={data.matches} players={data.players} stage="lb_rr" advancers={miniRRAdvancers(structure, "lb_rr")} />
            {/if}
          </div>
        </section>
      {/if}

      <section>
        <h2>Knockout Bracket</h2>
        <div class="legend">
          <span class="lg wb">Winners</span>
          <span class="lg mb">Mid</span>
          <span class="lg lb">Losers</span>
          <span class="lg gf">Grand Final</span>
        </div>
        <Bracket matches={data.matches} players={data.players} {groupCount} />
      </section>
    {/if}
  {/if}
</div>

<style>
  .empty {
    text-align: center;
    padding: 80px 0;
  }
  .empty h1 {
    font-size: clamp(3rem, 10vw, 6rem);
  }
  .empty .tag {
    color: var(--gold);
    letter-spacing: 0.3em;
    margin-bottom: 24px;
  }
  .waiting {
    color: var(--muted);
    max-width: 520px;
    margin: 0 auto;
  }
  .hero {
    text-align: center;
    margin-bottom: 24px;
  }
  .hero h1 {
    font-size: clamp(2.6rem, 7vw, 4.6rem);
  }
  .meta {
    color: var(--muted);
    letter-spacing: 0.2em;
  }
  h2 {
    font-size: 2rem;
    margin-bottom: 14px;
  }
  section {
    margin-bottom: 40px;
  }
  .champ {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 18px;
    flex-wrap: wrap;
    background: var(--gf-soft);
    border: 1px solid var(--gf);
    border-radius: var(--radius);
    padding: 22px;
    margin-bottom: 30px;
  }
  .champ .tag {
    color: var(--gf);
  }
  .champ-name {
    text-transform: uppercase;
    font-family: var(--font-display);
    font-size: clamp(2rem, 6vw, 3.4rem);
    letter-spacing: 0.04em;
  }
  .rules {
    display: grid;
    gap: 8px;
    margin-bottom: 36px;
  }
  .rule {
    background: var(--surface);
    border: 1px solid var(--border);
    border-left: 3px solid var(--gold);
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 0.95rem;
    color: oklch(0.82 0.02 250);
  }
  .rule b {
    color: var(--text);
  }
  .rule.callout {
    border-left-color: var(--mb);
  }
  .wb {
    color: var(--wb);
    font-weight: 700;
  }
  .mb {
    color: var(--mb);
    font-weight: 700;
  }
  .lb {
    color: var(--lb);
    font-weight: 700;
  }
  .groups-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 16px;
  }
  .rr-row {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }
  .rr-note {
    color: var(--muted);
    margin-bottom: 14px;
    max-width: 640px;
  }
  .legend {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }
  .lg {
    font-family: var(--font-text);
    font-stretch: 75%;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-size: 0.7rem;
    font-weight: 700;
    padding-left: 16px;
    position: relative;
  }
  .lg::before {
    content: "";
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 10px;
    height: 10px;
    border-radius: 3px;
    background: currentColor;
  }
  .lg.wb {
    color: var(--wb);
  }
  .lg.mb {
    color: var(--mb);
  }
  .lg.lb {
    color: var(--lb);
  }
  .lg.gf {
    color: var(--gf);
  }
</style>
