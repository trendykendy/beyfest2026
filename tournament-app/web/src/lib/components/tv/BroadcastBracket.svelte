<script lang="ts">
  import type { PBMatch, PBPlayer } from "$lib/view";
  import { nameMap, tierOf } from "$lib/view";
  import type { StructureSpec } from "@beyfest/engine";
  import MatchPlate from "./MatchPlate.svelte";

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
    return { cols, edges };
  });

  function shortLabel(roundLabel: string): string {
    const i = roundLabel.indexOf("— ");
    return i >= 0 ? roundLabel.slice(i + 2) : roundLabel;
  }

  // ── Connectors (measured in unscaled layout space via offset*) + fit ──
  let boxEl = $state<HTMLElement>();
  let contentEl = $state<HTMLElement>();
  let nodeEls: Record<string, HTMLElement> = {};
  let connectors = $state<{ d: string; tier: string; type: string }[]>([]);
  let dims = $state({ w: 0, h: 0 });
  let scale = $state(1);

  const MAX_SCALE = 2; // allow small brackets to grow into the space

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
      return { left: n.offsetLeft, right: n.offsetLeft + n.offsetWidth, top: n.offsetTop, bottom: n.offsetTop + n.offsetHeight, w: n.offsetWidth, h: n.offsetHeight };
    };

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
          const stub = Math.max(6, Math.min(18, (tx - sx) / 3));
          out.push({
            d: `M${sx},${sy} H${sx + stub} L${tx - stub},${cy} H${tx}`,
            tier: tierOf(byCode.get(s.from)!.stage),
            type: s.type,
          });
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
      <div class="bb-cols">
        {#each layout.cols as col, ci (ci)}
          <div class="bb-col">
            {#if col.length}
              <div class="bb-col-head">{shortLabel(col[0].roundLabel)}</div>
            {/if}
            <div class="bb-col-body">
              {#each col as m (m.code)}
                <div class="bb-node" class:is-gf={m.stage === "gf"} bind:this={nodeEls[m.code]}>
                  {#if m.stage === "gf"}<div class="gf-crown">🏆</div>{/if}
                  <MatchPlate match={m} {names} {groupCount} />
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
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
    stroke-width: 2.5;
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
    font-family: var(--lbl, sans-serif);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 800;
    font-size: 0.9rem;
    color: var(--accent, oklch(0.8 0.15 85));
    opacity: 0.85;
    text-align: center;
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
  .bb-node.is-gf {
    transform: scale(1.06);
  }
  .gf-crown {
    position: absolute;
    top: -26px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 1.5rem;
    filter: drop-shadow(0 0 12px color-mix(in oklch, var(--gf) 60%, transparent));
  }
</style>
