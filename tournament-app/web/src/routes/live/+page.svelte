<script lang="ts">
  import { onMount, tick } from "svelte";
  import { invalidateAll, replaceState } from "$app/navigation";
  import { pickStructure } from "@beyfest/engine";
  import { liveUpdates } from "$lib/pbBrowser";
  import { EVENT } from "$lib/config";
  import { loadFollow, resolveFollow, saveFollow, type Follow } from "$lib/follow";
  import { nameMap, type PBPlayer } from "$lib/view";
  import NowTab from "$lib/components/live/NowTab.svelte";
  import GroupsTab from "$lib/components/live/GroupsTab.svelte";
  import BracketTab from "$lib/components/live/BracketTab.svelte";
  import FollowPicker from "$lib/components/live/FollowPicker.svelte";
  import YourNext from "$lib/components/live/YourNext.svelte";

  // The phone page, reached from the QR code on the TV. Spectators browse it
  // themselves (unlike the TV, which the organiser drives): what's on now,
  // the groups, the bracket, and one blader followed on this phone.
  let { data } = $props();

  const structure = $derived(data.tournament ? pickStructure(data.tournament.structureKey) : null);
  const names = $derived(nameMap(data.players));
  const groupCount = $derived(data.groups.length);
  const hasKnockout = $derived(data.matches.some((m) => m.stage !== "group"));

  // ── Tabs ────────────────────────────────────────────────────────────
  // Kept in the address (#groups), so a reload or a shared link lands on the
  // same tab. Bracket only appears once the knockout exists.
  type Tab = "now" | "groups" | "bracket" | "follow";
  const TABS: { key: Tab; label: string }[] = [
    { key: "now", label: "Now" },
    { key: "groups", label: "Groups" },
    { key: "bracket", label: "Bracket" },
    { key: "follow", label: "Follow" },
  ];
  const tabs = $derived(TABS.filter((t) => t.key !== "bracket" || hasKnockout));
  let tab = $state<Tab>("now");
  // A saved #bracket from before the knockout existed falls back to Now.
  const shownTab = $derived(tabs.some((t) => t.key === tab) ? tab : "now");

  async function pick(t: Tab) {
    if (t === tab) return;
    tab = t;
    // Replace rather than push, so Back leaves the page instead of stepping
    // through every tab tapped.
    replaceState(`#${t}`, {});
    await tick();
    window.scrollTo(0, 0);
  }

  // ── Follow a blader ─────────────────────────────────────────────────
  // Only the browser knows (localStorage), so it's read on mount.
  let follow = $state<Follow | null>(null);
  const followed = $derived(resolveFollow(follow, data.players));
  const followId = $derived(followed?.id ?? "");

  function setFollow(p: PBPlayer | null) {
    follow = p ? { id: p.id, name: p.name } : null;
    saveFollow(follow);
  }
  // Found by name after the tournament was recreated: remember the new id.
  $effect(() => {
    if (followed && follow && followed.id !== follow.id) setFollow(followed);
  });

  let online = $state(true);
  onMount(() => {
    follow = loadFollow();
    const fromHash = location.hash.slice(1);
    if (TABS.some((t) => t.key === fromHash)) tab = fromHash as Tab;
    return liveUpdates(
      ["tournaments", "groups", "players", "matches", "fighters", "tv_state"],
      () => invalidateAll(),
      { everyMs: 30_000, onStatus: (up) => (online = up) },
    );
  });
</script>

<svelte:head>
  <title>Beyfest 2026 · Live</title>
</svelte:head>

<div class="live">
  <header class="top">
    <div class="top-in">
      <span class="brand">Beyfest</span>
      <span class="brand-sub"><span>2026 Live</span><span class="kana">ライブ</span></span>
      {#if !online}<span class="offline" role="status">Reconnecting</span>{/if}
    </div>
  </header>

  <main class="body" class:with-tabs={!!data.tournament}>
    {#if !data.tournament}
      <section class="lv-slab waiting">
        <header class="lv-slab-head"><h2>Groups not drawn yet</h2></header>
        <p>
          Live scores, tables and the bracket appear here as soon as the groups are drawn. Keep this page open: it
          updates by itself.
        </p>
        <p class="when">{EVENT.date} · {EVENT.place}</p>
      </section>
    {:else}
      {#if followed}
        <YourNext
          player={followed}
          matches={data.matches}
          {names}
          {groupCount}
          fighters={data.fighters}
          pbUrl={data.pbUrl}
          nextCode={data.next}
        />
      {/if}

      <div class="tab">
        {#if shownTab === "now"}
          <NowTab matches={data.matches} {names} {groupCount} {followId} nextCode={data.next} />
        {:else if shownTab === "groups"}
          <GroupsTab
            groups={data.groups}
            players={data.players}
            matches={data.matches}
            {names}
            knockoutType={structure?.knockoutType ?? ""}
            {followId}
            nextCode={data.next}
          />
        {:else if shownTab === "bracket"}
          <BracketTab
            matches={data.matches}
            players={data.players}
            {names}
            {groupCount}
            {structure}
            {followId}
            nextCode={data.next}
          />
        {:else}
          <FollowPicker players={data.players} fighters={data.fighters} {followId} onpick={setFollow} />
        {/if}
      </div>
    {/if}
  </main>

  {#if data.tournament}
    <nav class="tabs" aria-label="Sections">
      <div class="tabs-in">
        {#each tabs as t (t.key)}
          <button class="tb" class:on={shownTab === t.key} aria-current={shownTab === t.key ? "page" : undefined} onclick={() => pick(t.key)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {#if t.key === "now"}
                <!-- A play mark: what's on -->
                <path d="M7 4.5v15l12-7.5z" />
              {:else if t.key === "groups"}
                <!-- A table -->
                <path d="M3 5h18v3H3zM3 10.5h18v3H3zM3 16h18v3H3z" />
              {:else if t.key === "bracket"}
                <!-- Bracket lines -->
                <path class="line" d="M2 5.5h7v13H2M9 12h6M15 7v10M15 7h7M15 17h7" />
              {:else}
                <!-- A star -->
                <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6-4.9-4.5 6.6-.8z" />
              {/if}
            </svg>
            <span>{t.label}</span>
          </button>
        {/each}
      </div>
    </nav>
  {/if}
</div>

<style>
  /* Phone first: designed at 360–430px wide, kept to a phone-width column
     (480px) on anything bigger. */
  .live {
    --col: 480px;
    --gutter: 16px;
    --tabs-h: 60px;
    min-height: 100dvh;
    background: var(--field);
    color: var(--paper);
  }

  /* ── Header ─────────────────────────────────────────────────────── */
  .top {
    position: sticky;
    top: 0;
    z-index: 20;
    background: var(--field-deep);
    border-bottom: var(--outline) solid var(--ink);
    padding-top: env(safe-area-inset-top);
  }
  .top-in {
    max-width: var(--col);
    margin: 0 auto;
    display: flex;
    align-items: center;
    gap: 10px;
    height: 52px;
    padding: 0 var(--gutter);
    padding-left: max(var(--gutter), env(safe-area-inset-left));
    padding-right: max(var(--gutter), env(safe-area-inset-right));
  }
  .brand {
    font-family: var(--font-display);
    text-transform: uppercase;
    font-size: 1.35rem;
    line-height: 1;
    color: var(--ink);
    background: var(--gold);
    padding: 6px 20px 8px 10px;
    margin-left: calc(-1 * var(--gutter));
    padding-left: var(--gutter);
    clip-path: polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%);
  }
  .brand-sub {
    display: flex;
    flex-direction: column;
    line-height: 1.05;
    font-stretch: 75%;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-size: 0.75rem;
  }
  .kana {
    font-family: var(--font-display);
    letter-spacing: 0.05em;
    color: var(--on-field-soft);
  }
  .offline {
    margin-left: auto;
    font-stretch: 75%;
    font-weight: 800;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    background: var(--red);
    color: var(--paper);
    padding: 4px 10px;
    border: 2px solid var(--ink);
  }

  /* ── Body ───────────────────────────────────────────────────────── */
  .body {
    max-width: var(--col);
    margin: 0 auto;
    padding: 16px var(--gutter) 32px;
    padding-left: max(var(--gutter), env(safe-area-inset-left));
    padding-right: max(var(--gutter), env(safe-area-inset-right));
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  /* Room for the tab bar (and the home bar under it) at the bottom. */
  .body.with-tabs {
    padding-bottom: calc(var(--tabs-h) + env(safe-area-inset-bottom) + 28px);
  }
  .tab {
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  .waiting p {
    padding: 12px 14px 0;
    color: var(--ink);
  }
  .waiting .when {
    padding-bottom: 14px;
    font-weight: 700;
    color: var(--ink-soft);
  }

  /* ── Tab bar ────────────────────────────────────────────────────── */
  .tabs {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 20;
    background: var(--ink);
    border-top: var(--outline) solid var(--gold);
    padding-bottom: env(safe-area-inset-bottom);
  }
  .tabs-in {
    max-width: var(--col);
    margin: 0 auto;
    display: flex;
  }
  .tb {
    flex: 1;
    min-height: var(--tabs-h);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    background: none;
    border: 0;
    color: var(--on-field-soft);
    font-stretch: 75%;
    font-weight: 800;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .tb svg {
    width: 22px;
    height: 22px;
    fill: currentColor;
  }
  .tb svg .line {
    fill: none;
    stroke: currentColor;
    stroke-width: 2.6;
  }
  .tb.on {
    color: var(--ink);
    background: var(--gold);
  }

  /* ── Shared by the tab components (lv- prefixed, so global is safe) ── */
  /* Section heading: a skewed ink tag on the field. */
  :global(.lv-h) {
    display: inline-flex;
    align-items: center;
    font-size: 1.25rem;
    color: var(--paper);
    background: var(--ink);
    padding: 6px 22px 7px 10px;
    margin-bottom: 10px;
    clip-path: polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%);
  }
  /* A white slab: ink outline, hard offset shadow (no blur: cheap to draw). */
  :global(.lv-slab) {
    background: var(--paper);
    color: var(--ink);
    border: var(--outline) solid var(--ink);
    box-shadow: 5px 5px 0 var(--ink);
  }
  :global(.lv-slab-head) {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    background: var(--ink);
    color: var(--paper);
    padding: 8px 12px 9px;
  }
  :global(.lv-slab-head h2) {
    font-size: 1.5rem;
  }
  :global(.lv-slab-head span) {
    font-size: 0.85rem;
    font-weight: 600;
    white-space: nowrap;
  }
  :global(.lv-note) {
    color: var(--on-field-soft);
    font-size: 0.95rem;
    line-height: 1.4;
    margin-bottom: 12px;
  }
  /* Chips to switch group / tier: they wrap rather than scroll sideways. */
  /* Up to four share one row, equal widths; they'd wrap rather than scroll. */
  :global(.lv-chips) {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  :global(.lv-chip) {
    flex: 1 1 0;
    min-width: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 6px;
    white-space: nowrap;
    font-family: var(--font-display);
    font-size: 1rem;
    text-transform: uppercase;
    color: var(--paper);
    background: var(--field-deep);
    border: 2px solid var(--field-line);
    transform: skewX(-8deg);
    cursor: pointer;
  }
  :global(.lv-chip.on) {
    color: var(--ink);
    background: var(--paper);
    border-color: var(--ink);
    box-shadow: 3px 3px 0 var(--gold);
  }
  :global(.lv-dot) {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--red);
    box-shadow: 0 0 0 2px var(--ink);
  }
  :global(.lv-star) {
    color: var(--gold);
    font-size: 0.9em;
    -webkit-text-stroke: 1px var(--ink);
  }
</style>
