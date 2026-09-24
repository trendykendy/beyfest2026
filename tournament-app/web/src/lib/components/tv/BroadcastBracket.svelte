<script lang="ts">
  import type { PBMatch, PBPlayer } from "$lib/view";
  import { nameMap, tierOf, roundName } from "$lib/view";
  import type { StructureSpec } from "@beyfest/engine";
  import MatchPlate from "./MatchPlate.svelte";
  import Trophy from "../Trophy.svelte";

  let {
    matches,
    players,
    structure,
    groupCount,
    orientation = "horizontal",
  }: {
    matches: PBMatch[];
    players: PBPlayer[];
    structure: StructureSpec;
    groupCount: number;
    orientation?: "horizontal" | "vertical";
  } = $props();

  const names = $derived(nameMap(players));

  // Knockout matches only — the round-robins have their own scene.
  const shown = $derived(
    matches.filter((m) => m.stage !== "group" && m.stage !== "wb_rr" && m.stage !== "lb_rr"),
  );

  // 8 players play double elimination. Its upper and lower brackets get a row
  // each (the usual way to draw one), and only winner lines are drawn: the
  // lower bracket's plates already say "Loser of QF1", and drop lines from the
  // upper row would cross everything.
  const doubleElim = $derived(structure.knockoutType === "double-elim" && orientation === "horizontal");

  // Columns by graph depth. Edges come from the STRUCTURE (live slots get
  // nulled once resolved, so the spec is the durable source of the flow).
  const layout = $derived.by(() => {
    const codes = new Set(shown.map((n) => n.code));
    const edges: { from: string; to: string; type: "winner" | "loser" }[] = [];
    const incoming = new Map<string, string[]>();
    for (const def of structure.matches) {
      if (!codes.has(def.code)) continue;
      for (const slot of [def.slot1, def.slot2]) {
        if ((slot.k === "winner" || slot.k === "loser") && codes.has(slot.match)) {
          if (doubleElim && slot.k === "loser") continue;
          edges.push({ from: slot.match, to: def.code, type: slot.k });
          if (!incoming.has(def.code)) incoming.set(def.code, []);
          incoming.get(def.code)!.push(slot.match);
        }
      }
    }
    const depth = new Map<string, number>();
    const d = (code: string): number => {
      if (depth.has(code)) return depth.get(code)!;
      const inc = incoming.get(code) ?? [];
      const v = inc.length === 0 ? 0 : 1 + Math.max(...inc.map(d));
      depth.set(code, v);
      return v;
    };
    shown.forEach((n) => d(n.code));
    const maxD = Math.max(0, ...depth.values());
    const cols: PBMatch[][] = Array.from({ length: maxD + 1 }, () => []);
    shown
      .slice()
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .forEach((n) => cols[depth.get(n.code)!].push(n));
    // Double elimination: the same columns, split into the two rows.
    const rows = doubleElim
      ? {
          upper: cols.map((col) => col.filter((m) => m.stage === "ub")),
          lower: cols.map((col) => col.filter((m) => m.stage === "lb")),
          gf: cols.flat().filter((m) => m.stage === "gf"),
        }
      : null;
    return { cols, edges, rows };
  });


  // ── Connectors (measured in unscaled layout space via offset*) + fit ──
  let boxEl = $state<HTMLElement>();
  let contentEl = $state<HTMLElement>();
  let nodeEls: Record<string, HTMLElement> = {};
  let connectors = $state<{ d: string; tier: string; type: string }[]>([]);
  let dims = $state({ w: 0, h: 0 });
  let scale = $state(1);

  const MAX_SCALE = 2; // allow small brackets to grow into the space
  const CARD_CLEARANCE = 14; // min space between a routed line and any card edge
  const LANE_SPACING = 12; // keeps parallel routed lines visibly apart
  const GAP_STUB = 10; // flat run into / out of a column gap before slanting
  const GF_SCALE = 1.06; // must match .bb-node.is-gf below
  type Lane = { y: number; x1: number; x2: number };

  function recompute() {
    const content = contentEl;
    const box = boxEl;
    if (!content || !box) return;

    // offsetLeft/Top are layout coords, unaffected by the CSS scale we apply —
    // so measurement never fights the transform.
    const natW = content.offsetWidth;
    const natH = content.offsetHeight;
    dims = { w: natW, h: natH };
    const byCode = new Map(shown.map((m) => [m.code, m]));
    const rect = (code: string) => {
      const n = nodeEls[code];
      if (!n) return null;
      // The Grand Final card is drawn at GF_SCALE around its centre (see .is-gf);
      // offset* is unscaled, so grow the box to match what's on screen.
      const k = n.classList.contains("is-gf") ? GF_SCALE : 1;
      const w = n.offsetWidth * k;
      const h = n.offsetHeight * k;
      const left = n.offsetLeft - (w - n.offsetWidth) / 2;
      const top = n.offsetTop - (h - n.offsetHeight) / 2;
      return { left, right: left + w, top, bottom: top + h, w, h };
    };

    // Column geometry for routing lines that skip columns (see corridorY).
    const colOf = new Map<string, number>();
    layout.cols.forEach((col, ci) => col.forEach((m) => colOf.set(m.code, ci)));
    const colRects = layout.cols.map((col) =>
      col.map((m) => rect(m.code)).filter((r): r is NonNullable<ReturnType<typeof rect>> => r != null),
    );
    const colLeft = colRects.map((rs) => Math.min(...rs.map((r) => r.left)));
    const colRight = colRects.map((rs) => Math.max(...rs.map((r) => r.right)));
    const head = box.querySelector<HTMLElement>(".bb-col-head");
    const topBound = head ? head.offsetTop + head.offsetHeight + CARD_CLEARANCE : 0;
    const lanes: Lane[] = [];

    // The height at which a column-skipping line runs flat. It must clear every
    // card in the columns it passes (free = the gaps between/around cards), and
    // prefers heights between its two ends so it travels as little as possible.
    // Lines sharing a stretch are nudged apart so they don't draw on top of each other.
    function corridorY(fromCol: number, toCol: number, sy: number, cy: number, used: Lane[]): number {
      let free: [number, number][] = [[topBound, natH - CARD_CLEARANCE]];
      for (let c = fromCol + 1; c < toCol; c++) {
        for (const r of colRects[c]) {
          const lo = r.top - CARD_CLEARANCE;
          const hi = r.bottom + CARD_CLEARANCE;
          free = free.flatMap(([a, b]): [number, number][] =>
            hi <= a || lo >= b ? [[a, b]] : [[a, Math.min(b, lo)], [Math.max(a, hi), b]].filter(([x, y]) => y - x > 0) as [number, number][],
          );
        }
      }
      if (!free.length) return (sy + cy) / 2; // nowhere clear (shouldn't happen): fall back to straight-ish
      const x1 = colLeft[fromCol + 1];
      const x2 = colRight[toCol - 1];
      const clashes = (y: number) => used.some((l) => Math.abs(l.y - y) < LANE_SPACING && l.x1 < x2 && x1 < l.x2);
      const lo = Math.min(sy, cy);
      const hi = Math.max(sy, cy);
      let best = (sy + cy) / 2;
      let bestCost = Infinity;
      for (const [a, b] of free) {
        // Candidates: the point nearest the ideal band, then small nudges for lane spacing.
        const base = Math.max(a, Math.min(b, Math.max(lo, Math.min(hi, (sy + cy) / 2))));
        for (let k = 0; k <= 6; k++) {
          for (const sign of k === 0 ? [0] : [1, -1]) {
            const y = base + sign * k * LANE_SPACING;
            if (y < a || y > b || clashes(y)) continue;
            // Vertical travel outside [lo, hi] is the real cost; distance from
            // the midpoint only breaks ties.
            const cost = Math.max(0, lo - y) + Math.max(0, y - hi) + Math.abs(y - (sy + cy) / 2) * 0.01;
            if (cost < bestCost) {
              bestCost = cost;
              best = y;
            }
          }
        }
      }
      return best;
    }

    const byTarget = new Map<string, { from: string; type: string }[]>();
    for (const e of layout.edges) {
      if (!byTarget.has(e.to)) byTarget.set(e.to, []);
      byTarget.get(e.to)!.push({ from: e.from, type: e.type });
    }

    const out: { d: string; tier: string; type: string }[] = [];
    for (const [to, srcRaw] of byTarget) {
      const tr = rect(to);
      if (!tr) continue;
      const srcs = srcRaw
        .map((s) => ({ ...s, r: rect(s.from) }))
        .filter((s): s is typeof s & { r: NonNullable<typeof s.r> } => s.r != null);
      if (!srcs.length) continue;
      const n = srcs.length;
      // Each feed lands on a DISTINCT point along the target edge, so two
      // feeds arrive at different heights and their diagonals never touch.
      const frac = (i: number) => (n === 1 ? 0.5 : 0.28 + 0.44 * (i / (n - 1)));

      if (orientation === "horizontal") {
        srcs.sort((a, b) => a.r.top - b.r.top);
        const tx = tr.left;
        srcs.forEach((s, i) => {
          const sy = s.r.top + s.r.h / 2;
          const sx = s.r.right;
          const cy = tr.top + tr.h * frac(i);
          const fromCol = colOf.get(s.from)!;
          const toCol = colOf.get(to)!;
          let d: string;
          if (toCol - fromCol <= 1) {
            // Neighbouring columns: the slanted stub–diagonal–stub lives entirely
            // in the gap between them, so it can't pass behind a card.
            const stub = Math.max(6, Math.min(18, (tx - sx) / 3));
            d = `M${sx},${sy} H${sx + stub} L${tx - stub},${cy} H${tx}`;
          } else {
            // Skips one or more columns (e.g. Winners final → Grand final): a
            // straight diagonal would run behind the cards in between. Instead,
            // slant into a free horizontal corridor inside the first gap, run
            // flat past the in-between columns, and slant out in the last gap.
            const y = corridorY(fromCol, toCol, sy, cy, lanes);
            const g1a = colRight[fromCol] + GAP_STUB; // first gap: after the source column…
            const g1b = colLeft[fromCol + 1] - GAP_STUB; // …before the next one
            const g2a = colRight[toCol - 1] + GAP_STUB; // last gap, before the target
            const g2b = Math.min(tx, colLeft[toCol]) - GAP_STUB;
            lanes.push({ y, x1: g1b, x2: g2a });
            d = `M${sx},${sy} H${g1a} L${g1b},${y} H${g2a} L${g2b},${cy} H${tx}`;
          }
          out.push({ d, tier: tierOf(byCode.get(s.from)!.stage), type: s.type });
        });
      } else {
        srcs.sort((a, b) => a.r.left - b.r.left);
        const ty = tr.bottom;
        srcs.forEach((s, i) => {
          const sx = s.r.left + s.r.w / 2;
          const sy = s.r.top;
          const cx = tr.left + tr.w * frac(i);
          const stub = Math.max(6, Math.min(18, (sy - ty) / 3));
          out.push({
            d: `M${sx},${sy} V${sy - stub} L${cx},${ty + stub} V${ty}`,
            tier: tierOf(byCode.get(s.from)!.stage),
            type: s.type,
          });
        });
      }
    }
    connectors = out;

    // Fit the whole bracket into the available box (fills space; never scrolls).
    const availW = box.clientWidth;
    const availH = box.clientHeight;
    if (natW > 0 && natH > 0 && availW > 0 && availH > 0) {
      scale = Math.min(availW / natW, availH / natH, MAX_SCALE);
    }
  }

  $effect(() => {
    void matches;
    void orientation;
    const raf = requestAnimationFrame(recompute);
    return () => cancelAnimationFrame(raf);
  });

  $effect(() => {
    if (!boxEl) return;
    const ro = new ResizeObserver(() => recompute());
    ro.observe(boxEl);
    window.addEventListener("resize", recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
  });
</script>

<div class="bb {orientation}" bind:this={boxEl}>
  <div class="bb-scale" style="transform: scale({scale})">
    <div class="bb-content" bind:this={contentEl}>
      <svg class="bb-links" width={dims.w} height={dims.h} viewBox="0 0 {dims.w} {dims.h}">
        {#each connectors as c, i (i)}
          <path class="link tier-{c.tier} {c.type}" d={c.d} />
        {/each}
      </svg>
      {#if layout.rows}
        {@const rows = layout.rows}
        <div class="bb-de" style="--de-cols: {layout.cols.length}">
          {#each [rows.upper, rows.lower] as row, ri (ri)}
            {#each row as col, ci (ci)}
              {#if col.length}
                <div class="bb-col-head" style="grid-row: {ri * 2 + 1}; grid-column: {ci + 1}">
                  {roundName(col[0].roundLabel)}
                </div>
                <div class="bb-col-body" class:de-upper={ri === 0} style="grid-row: {ri * 2 + 2}; grid-column: {ci + 1}">
                  {#each col as m (m.code)}
                    <div class="bb-node" bind:this={nodeEls[m.code]}>
                      <MatchPlate match={m} {names} {groupCount} />
                    </div>
                  {/each}
                </div>
              {/if}
            {/each}
          {/each}
          {#if rows.gf.length}
            <div class="de-gf" style="grid-column: {layout.cols.length}">
              <div class="bb-col-head">{roundName(rows.gf[0].roundLabel)}</div>
              {#each rows.gf as m (m.code)}
                <div class="bb-node is-gf" bind:this={nodeEls[m.code]}>
                  <div class="gf-crown"><Trophy /></div>
                  <MatchPlate match={m} {names} {groupCount} />
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {:else}
      <div class="bb-cols">
        {#each layout.cols as col, ci (ci)}
          <div class="bb-col">
            {#if col.length}
              <div class="bb-col-head">{roundName(col[0].roundLabel)}</div>
            {/if}
            <div class="bb-col-body">
              {#each col as m (m.code)}
                <div class="bb-node" class:is-gf={m.stage === "gf"} bind:this={nodeEls[m.code]}>
                  {#if m.stage === "gf"}<div class="gf-crown"><Trophy /></div>{/if}
                  <MatchPlate match={m} {names} {groupCount} />
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .bb {
    width: 100%;
    height: 100%;
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .bb-scale {
    transform-origin: center center;
  }
  .bb-content {
    position: relative;
    width: max-content;
  }
  .bb-links {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    z-index: 0;
    overflow: visible;
  }
  .link {
    fill: none;
    stroke-width: 4;
    stroke-linejoin: round;
    stroke: var(--bb-link, oklch(0.7 0.03 250));
    opacity: 0.9;
  }
  .link.tier-wb {
    stroke: var(--wb);
  }
  .link.tier-mb {
    stroke: var(--mb);
  }
  .link.tier-lb {
    stroke: var(--lb);
  }
  .link.loser {
    stroke-dasharray: 3 6;
    opacity: 0.65;
  }

  .bb-cols {
    position: relative;
    z-index: 1;
    display: flex;
    gap: var(--bb-gap, 60px);
    align-items: stretch;
    width: max-content;
    padding: 8px 4px;
  }
  .horizontal .bb-cols {
    flex-direction: row;
  }
  .vertical .bb-cols {
    flex-direction: column-reverse;
    gap: 40px;
  }
  .vertical .bb-col-body {
    flex-direction: row;
  }

  .bb-col {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 230px;
  }
  .vertical .bb-col {
    min-width: 0;
  }
  .bb-col-head {
    font-family: var(--font-display);
    text-transform: uppercase;
    font-size: 1.5rem;
    line-height: 1;
    color: var(--paper);
    text-align: center;
    white-space: nowrap;
  }
  .bb-col-body {
    display: flex;
    flex-direction: column;
    gap: var(--bb-vgap, 74px);
    justify-content: center;
    align-items: center;
    flex: 1;
  }
  .bb-node {
    position: relative;
  }

  /* Double elimination: upper row on top, lower row underneath, Grand Final
     at the end between them. Same coordinate origin as .bb-cols, so the
     connector maths is unchanged. */
  .bb-de {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: repeat(var(--de-cols), minmax(230px, auto));
    grid-template-rows: auto auto auto auto;
    column-gap: var(--bb-gap, 60px);
    row-gap: 12px;
    width: max-content;
    padding: 8px 4px;
  }
  .bb-de > .bb-col-head {
    align-self: end;
  }
  .bb-de .bb-col-body {
    gap: 28px;
  }
  /* Room between the upper row's plates and the lower row's headings. */
  .bb-de .de-upper {
    margin-bottom: 44px;
  }
  .de-gf {
    grid-row: 1 / 5;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 36px;
  }
  .bb-node.is-gf {
    transform: scale(1.06); /* GF_SCALE in the script */
  }
  .gf-crown {
    position: absolute;
    top: -26px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 1.5rem;
  }
</style>
