<script lang="ts">
  import { miniRRAdvancers, type StructureSpec } from "@beyfest/engine";
  import { hasStage, isLive, miniRRStandings, openingMatch, rrFate, type PBMatch, type PBPlayer } from "$lib/view";
  import BroadcastBracket from "../tv/BroadcastBracket.svelte";
  import StandingsTable from "./StandingsTable.svelte";

  // The TV's bracket, drawn the same way (columns, colours, lines), swiped
  // one round at a time. The mini round-robins come first: they're played
  // first and feed the bracket.
  let {
    matches,
    players,
    names,
    groupCount,
    structure,
    followId = "",
    nextCode = "",
  }: {
    matches: PBMatch[];
    players: PBPlayer[];
    names: Map<string, string>;
    groupCount: number;
    structure: StructureSpec | null;
    followId?: string;
    nextCode?: string;
  } = $props();

  const RR = [
    { tier: "wb", stage: "wb_rr", title: "Winners round-robin", note: "Winner goes straight to the grand final" },
    { tier: "lb", stage: "lb_rr", title: "Losers round-robin", note: "Last chance to stay in" },
  ] as const;
  const rrs = $derived(RR.filter((r) => hasStage(matches, r.stage)));
  const rrPlayed = (stage: string) => {
    const list = matches.filter((m) => m.stage === stage);
    return { done: list.filter((m) => m.matchStatus === "done").length, total: list.length };
  };

  // Every page in swipe order: the round-robins, then the bracket's columns
  // (which the bracket reports through `columns`).
  let columns = $state<{ names: string[]; codes: string[] }[]>([]);
  const pages = $derived([
    ...rrs.map((r) => ({ names: [r.title], codes: matches.filter((m) => m.stage === r.stage).map((m) => m.code) })),
    ...columns,
  ]);
  const byCode = $derived(new Map(matches.map((m) => [m.code, m])));
  const pageLive = (codes: string[]) => codes.some((c) => byCode.has(c) && isLive(byCode.get(c)!));
  const pageMine = (codes: string[]) =>
    !!followId && codes.some((c) => byCode.get(c)?.p1 === followId || byCode.get(c)?.p2 === followId);

  // ── Swiping ─────────────────────────────────────────────────────────
  let strip = $state<HTMLElement>();
  let barEl = $state<HTMLElement>();
  let current = $state(0);

  // The page elements, left to right. (In double elimination the markers
  // aren't in column order in the DOM, so they're sorted by position.)
  function pageEls(): HTMLElement[] {
    if (!strip) return [];
    return [...strip.querySelectorAll<HTMLElement>("[data-page]")].sort(
      (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
    );
  }

  function go(i: number, behavior: ScrollBehavior = "smooth") {
    const el = pageEls()[i];
    if (!strip || !el) return;
    const pad = parseFloat(getComputedStyle(strip).scrollPaddingLeft) || 0;
    const left = el.getBoundingClientRect().left - strip.getBoundingClientRect().left + strip.scrollLeft - pad;
    strip.scrollTo({ left, behavior });
    current = i;
  }

  // The bracket's columns are centred top to bottom as on the TV, so a page's
  // plates can sit below the fold. If none of them is on screen, scroll down
  // to `code`'s plate, or the page's first one. (A round-robin page is its
  // own slab: its matches aren't drawn.)
  function showPage(i: number, code = "", behavior: ScrollBehavior = "smooth") {
    if (!strip) return;
    const plates = (pages[i]?.codes ?? [])
      .map((c) => strip!.querySelector<HTMLElement>(`[data-code="${c}"]`))
      .filter((el): el is HTMLElement => !!el);
    if (!plates.length) plates.push(pageEls()[i]);
    const top = barEl?.getBoundingClientRect().bottom ?? 0;
    const bottom = document.querySelector(".tabs")?.getBoundingClientRect().top ?? innerHeight;
    const onScreen = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return r.top < bottom && r.bottom > top;
    };
    if (!code && plates.some((el) => el && onScreen(el))) return;
    const el = (code && strip.querySelector<HTMLElement>(`[data-code="${code}"]`)) || plates[0];
    if (!el || (code && onScreen(el))) return;
    // 36px clears the Grand Final's trophy, which sits above its plate.
    window.scrollTo({ top: scrollY + el.getBoundingClientRect().top - top - 36, behavior });
  }

  // The current page is the one nearest the left edge, or the last one once
  // scrolled to the end (it may be too narrow to reach the left edge). Once
  // the swipe settles, its plates are brought into view.
  let ticking = false;
  let settle: ReturnType<typeof setTimeout>;
  function onscroll() {
    clearTimeout(settle);
    settle = setTimeout(() => showPage(current), 180);
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      if (!strip) return;
      const els = pageEls();
      if (strip.scrollLeft >= strip.scrollWidth - strip.clientWidth - 2) {
        current = els.length - 1;
        return;
      }
      const edge = strip.getBoundingClientRect().left + (parseFloat(getComputedStyle(strip).scrollPaddingLeft) || 0);
      let best = 0;
      els.forEach((el, i) => {
        if (Math.abs(el.getBoundingClientRect().left - edge) < Math.abs(els[best].getBoundingClientRect().left - edge)) best = i;
      });
      current = best;
    });
  }

  // Open once on the page that matters (the followed blader's next match, a
  // live one, the next one; the final once it's over). Only once, so live
  // updates never yank the page from under someone's thumb.
  let opened = false;
  $effect(() => {
    if (opened || !strip || !columns.length) return;
    opened = true;
    const m = openingMatch(matches, followId, nextCode);
    const i = m ? pages.findIndex((p) => p.codes.includes(m.code)) : -1;
    const target = i >= 0 ? i : pages.length - 1;
    requestAnimationFrame(() => {
      go(target, "instant");
      showPage(target, m?.code ?? "", "instant");
    });
  });
</script>

{#if structure}
  <div class="rb" bind:this={barEl}>
    <button class="rb-arrow" disabled={current === 0} onclick={() => go(current - 1)} aria-label="Previous round">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4l-8 8 8 8" /></svg>
    </button>
    <div class="rb-mid">
      <div class="rb-name">
        {#each pages[current]?.names ?? [] as n (n)}<span>{n}</span>{/each}
      </div>
      <div class="rb-dots">
        {#each pages as p, i (i)}
          <button
            class="rb-dot"
            class:on={i === current}
            class:live={pageLive(p.codes)}
            class:mine={pageMine(p.codes)}
            aria-label={p.names.join(" and ")}
            aria-current={i === current ? "true" : undefined}
            onclick={() => go(i)}
          ></button>
        {/each}
      </div>
    </div>
    <button
      class="rb-arrow"
      disabled={current >= pages.length - 1}
      onclick={() => go(current + 1)}
      aria-label="Next round"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4l8 8-8 8" /></svg>
    </button>
  </div>

  <div class="strip" bind:this={strip} {onscroll}>
    {#each rrs as r (r.stage)}
      {@const played = rrPlayed(r.stage)}
      <section class="rr-page lv-slab" data-page>
        <header class="lv-slab-head rr-{r.tier}">
          <h2>{r.title}</h2>
          <span>{played.done === played.total ? "Final standings" : `${played.done} of ${played.total} played`}</span>
        </header>
        <p class="rr-note">{r.note}</p>
        <StandingsTable
          rows={miniRRStandings(matches, r.stage)}
          {names}
          fate={(rank) => {
            const f = rrFate(r.stage, rank, miniRRAdvancers(structure, r.stage));
            return { tier: f.tier as "gf" | "mb" | "out", label: f.text };
          }}
          projected={played.done < played.total}
          {followId}
        />
      </section>
    {/each}
    <BroadcastBracket {matches} {players} {structure} {groupCount} {followId} fit="swipe" bind:pages={columns} />
  </div>
{/if}

<style>
  /* ── Round bar: where you are, and taps to get elsewhere ── */
  /* Sticks under the page header (52px + its outline), so it stays in view
     down a tall column. Full width, so plates scroll away behind it. */
  .rb {
    position: sticky;
    top: calc(52px + var(--outline) + env(safe-area-inset-top));
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--field);
    margin: -8px calc(-1 * var(--gutter)) 0;
    padding: 8px var(--gutter) 6px;
  }
  .rb-arrow {
    flex: none;
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    background: var(--field-deep);
    border: 2px solid var(--field-line);
    color: var(--paper);
    cursor: pointer;
  }
  .rb-arrow:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .rb-arrow svg {
    width: 20px;
    height: 20px;
    fill: none;
    stroke: currentColor;
    stroke-width: 3;
  }
  .rb-mid {
    flex: 1;
    min-width: 0;
    text-align: center;
  }
  .rb-name {
    display: flex;
    flex-direction: column;
    font-family: var(--font-display);
    text-transform: uppercase;
    font-size: 1.15rem;
    line-height: 1.1;
  }
  .rb-name span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .rb-dots {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
  }
  /* A 24px tap target around a 10px dot. */
  .rb-dot {
    width: 24px;
    height: 24px;
    padding: 0;
    background: none;
    border: 0;
    cursor: pointer;
    display: grid;
    place-items: center;
  }
  .rb-dot::after {
    content: "";
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--field-line);
    box-shadow: 0 0 0 2px var(--ink);
  }
  .rb-dot.mine::after {
    background: var(--gold);
  }
  .rb-dot.live::after {
    background: var(--red);
  }
  .rb-dot.on::after {
    width: 14px;
    height: 14px;
    outline: 2px solid var(--paper);
  }

  /* ── The swipe strip: full width of the screen, one page per snap ── */
  .strip {
    display: flex;
    align-items: flex-start;
    /* Wider than the gutter, so the page before's shadow stays off screen. */
    gap: 28px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scroll-padding-inline: var(--gutter);
    overscroll-behavior-x: contain;
    margin: -8px calc(-1 * var(--gutter)) 0;
    padding: 0 var(--gutter) 12px;
    scrollbar-width: none;
    /* Tighter than the TV: the lines still have room between plates. */
    --bb-gap: 40px;
    --bb-vgap: 28px;
  }
  .strip::-webkit-scrollbar {
    display: none;
  }
  .rr-page {
    flex: 0 0 100%;
    scroll-snap-align: start;
    margin-top: 8px;
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
</style>
