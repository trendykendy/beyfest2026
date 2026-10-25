<script lang="ts">
  import type { StandingRow } from "@beyfest/engine";

  // A standings table sized for a phone: place, name, W–L, point difference
  // and where that place goes next. Shared by the group tables and the mini
  // round-robins. The "goes to" chips are dashed while the table can still
  // change, solid once it's final (as on the TV).
  type Tier = "wb" | "mb" | "lb" | "gf" | "out";
  let {
    rows,
    names,
    fate,
    projected,
    followId = "",
  }: {
    rows: StandingRow[];
    names: Map<string, string>;
    fate: (rank: number) => { tier: Tier; label: string };
    projected: boolean;
    followId?: string;
  } = $props();
</script>

<div class="st">
  <div class="cols" aria-hidden="true">
    <span></span><span></span><span>W–L</span><span>+/−</span><span>Goes to</span>
  </div>
  {#each rows as row, i (row.playerId)}
    {@const f = fate(i + 1)}
    <div class="r tier-{f.tier}" class:mine={row.playerId === followId}>
      <span class="rank">{i + 1}</span>
      <span class="name">{names.get(row.playerId)}</span>
      <span class="wl">{row.wins}–{row.losses}</span>
      <span class="diff">{row.pointDiff > 0 ? "+" : ""}{row.pointDiff}</span>
      <span class="dest" class:projected>{f.label}</span>
    </div>
  {/each}
</div>

<style>
  .cols,
  .r {
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr) 40px 36px 78px;
    align-items: center;
    column-gap: 6px;
    padding: 0 10px 0 4px;
  }
  .cols {
    padding-top: 6px;
    padding-bottom: 2px;
    border-left: 6px solid transparent;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--ink-soft);
  }
  .cols span:nth-child(n + 3) {
    text-align: center;
  }
  .cols span:last-child {
    text-align: right;
  }
  .r {
    --tier: var(--neutral);
    min-height: 48px;
    border-left: 6px solid var(--tier);
    border-top: 2px solid #e3e6f3;
  }
  .tier-wb,
  .tier-gf {
    --tier: var(--wb);
  }
  .tier-mb {
    --tier: var(--mb);
  }
  .tier-lb,
  .tier-out {
    --tier: var(--lb);
  }
  .r.mine {
    background: color-mix(in srgb, var(--gold) 26%, var(--paper));
  }
  .rank {
    font-family: var(--font-display);
    font-size: 1.1rem;
    color: var(--ink-soft);
    text-align: center;
  }
  .name {
    font-family: var(--font-display);
    font-stretch: 62%;
    font-size: 1.35rem;
    line-height: 1.1;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: 3px; /* italic overhang */
  }
  .mine .name {
    text-decoration: underline 3px var(--ink);
    text-underline-offset: 3px;
  }
  .wl {
    font-family: var(--font-display);
    font-size: 1.15rem;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .diff {
    font-weight: 700;
    font-size: 0.9rem;
    color: var(--ink-soft);
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .dest {
    justify-self: end;
    font-stretch: 75%;
    font-weight: 800;
    font-size: 0.8rem;
    line-height: 1.2;
    white-space: nowrap;
    padding: 2px 6px 3px;
    background: var(--tier);
    color: var(--ink);
    border: 2px solid var(--ink);
  }
  .tier-lb .dest {
    color: var(--paper);
  }
  .tier-gf .dest {
    background: var(--ink);
    color: var(--gold);
  }
  .tier-out .dest {
    background: #dfe3f2;
    color: var(--ink-soft);
  }
  /* Only a projection until the table is final: outline, no fill. */
  .dest.projected {
    background: transparent;
    color: var(--ink-soft);
    border: 2px dashed var(--ink-soft);
  }
  .tier-lb .dest.projected,
  .tier-gf .dest.projected {
    color: var(--ink-soft);
    background: transparent;
  }
</style>
