<script lang="ts">
  import { onMount } from "svelte";
  import { invalidateAll } from "$app/navigation";
  import { pb } from "$lib/pbBrowser";
  import { pickStructure, miniRRAdvancers, pointsToWin } from "@beyfest/engine";
  import {
    groupStandings,
    miniRRStandings,
    nameMap,
    slotLabel,
    destinationOf,
    ordinal,
    tierOf,
    hasStage,
    type PBMatch,
  } from "$lib/view";
  import BroadcastBracket from "$lib/components/tv/BroadcastBracket.svelte";
  import Trophy from "$lib/components/Trophy.svelte";

  let { data } = $props();

  const structure = $derived(data.tournament ? pickStructure(data.tournament.structureKey) : null);
  const groupCount = $derived(data.groups.length);
  const names = $derived(nameMap(data.players));

  const hasRR = $derived(hasStage(data.matches, "wb_rr") || hasStage(data.matches, "lb_rr"));
  const hasBracket = $derived(
    data.matches.some((m) => m.stage !== "group" && m.stage !== "wb_rr" && m.stage !== "lb_rr"),
  );
  const champ = $derived.by(() => {
    const gf = data.matches.find((m) => m.stage === "gf");
    return gf && gf.matchStatus === "done" ? gf.winner : "";
  });

  const SCENE_TITLE: Record<string, string> = {
    standby: "Beyfest 2026",
    groups: "Group stage",
    rr: "Mini round-robins",
    bracket: "Knockout bracket",
    spotlight: "Match centre",
    champion: "Champion",
  };
  // Katakana shown above each scene title. Every glyph here must exist in the
  // font subset (static/fonts/delagothic_kana.woff2) — see theme.css header.
  const SCENE_KANA: Record<string, string> = {
    standby: "スタンバイ",
    groups: "グループステージ",
    rr: "ラウンドロビン",
    bracket: "ノックアウト",
    spotlight: "マッチセンター",
    champion: "チャンピオン",
  };

  const scenes = $derived.by(() => {
    if (!data.tournament) return ["standby"];
    const s = ["groups"];
    if (hasRR) s.push("rr");
    if (hasBracket) s.push("bracket");
    s.push("spotlight");
    if (champ) s.push("champion");
    return s;
  });

  let scene = $state("groups");
  $effect(() => {
    if (!scenes.includes(scene)) scene = scenes[0];
  });

  // Locked to the Ascent look; the bracket runs left-to-right on 16:9 screens.
  const bracketOrientation = "horizontal";

  // ── Spotlight ───────────────────────────────────────────────────────
  const isLive = (m: PBMatch) => m.matchStatus === "ready" && (m.liveP1 > 0 || m.liveP2 > 0);
  const featured = $derived.by(() => {
    const live = data.matches.filter(isLive).sort((a, b) => a.orderIndex - b.orderIndex);
    const ready = data.matches
      .filter((m) => m.matchStatus === "ready" && !isLive(m))
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const done = data.matches
      .filter((m) => m.matchStatus === "done")
      .sort((a, b) => b.orderIndex - a.orderIndex);
    return [...live, ...ready, ...done];
  });
  let spotIndex = $state(0);
  const spotMatch = $derived(featured[Math.min(spotIndex, Math.max(0, featured.length - 1))] ?? null);

  const groupMatchesOf = (gi: number) =>
    data.matches
      .filter((m) => m.stage === "group" && m.groupIndex === gi)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  const groupNextCode = (gi: number) => groupMatchesOf(gi).find((m) => m.matchStatus !== "done")?.code ?? "";
  // The next fixture to be played (not the one currently live) — for the "prep" strip.
  const nextUp = $derived(
    data.matches
      .filter((m) => m.matchStatus === "ready" && !isLive(m))
      .sort((a, b) => a.orderIndex - b.orderIndex)[0] ?? null,
  );

  // What the Match Centre's top strip shows, following the featured match's phase.
  const mcContext = $derived.by(() => {
    const s = spotMatch?.stage;
    if (!s || s === "group") return "groups";
    if (s === "wb_rr" || s === "lb_rr") return "rr";
    return "bracket";
  });
  const bracketColumns = $derived.by(() => {
    const ko = data.matches
      .filter((m) => m.stage !== "group" && m.stage !== "wb_rr" && m.stage !== "lb_rr")
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const cols: { label: string; matches: PBMatch[] }[] = [];
    for (const m of ko) {
      let c = cols.find((x) => x.label === m.roundLabel);
      if (!c) {
        c = { label: m.roundLabel, matches: [] };
        cols.push(c);
      }
      c.matches.push(m);
    }
    return cols;
  });
  const shortLabel = (roundLabel: string) => {
    const i = roundLabel.indexOf("— ");
    return i >= 0 ? roundLabel.slice(i + 2) : roundLabel;
  };

  // ── Helpers ─────────────────────────────────────────────────────────
  function sideName(m: PBMatch, which: 1 | 2): string {
    const pid = which === 1 ? m.p1 : m.p2;
    if (pid) return names.get(pid) ?? "—";
    return slotLabel(which === 1 ? m.slot1 : m.slot2, groupCount);
  }
  function rrFate(stage: "wb_rr" | "lb_rr", rank: number, advancers: number) {
    if (stage === "wb_rr")
      return rank === 1 ? { text: "to Grand Final", adv: true } : { text: "to Mid Bracket", adv: true };
    return rank <= advancers ? { text: "to Mid Bracket", adv: true } : { text: "Eliminated", adv: false };
  }

  // ── Operator control ────────────────────────────────────────────────
  let barVisible = $state(true);
  let hideTimer: ReturnType<typeof setTimeout>;
  function poke() {
    barVisible = true;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => (barVisible = false), 3500);
  }
  function setScene(s: string) {
    scene = s;
    if (s === "spotlight") spotIndex = 0; // jump to the live / next match
    poke();
  }
  function cycleScene(d: number) {
    const i = scenes.indexOf(scene);
    scene = scenes[(i + d + scenes.length) % scenes.length];
  }
  function toggleFull() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }
  function onKey(e: KeyboardEvent) {
    if (e.key >= "1" && e.key <= "9") {
      const i = +e.key - 1;
      if (scenes[i]) setScene(scenes[i]);
    } else if (e.key === "ArrowRight") {
      if (scene === "spotlight") spotIndex = Math.min(spotIndex + 1, featured.length - 1);
      else cycleScene(1);
      poke();
    } else if (e.key === "ArrowLeft") {
      if (scene === "spotlight") spotIndex = Math.max(spotIndex - 1, 0);
      else cycleScene(-1);
      poke();
    } else if (e.key.toLowerCase() === "f") {
      toggleFull();
    } else {
      poke();
    }
  }

  onMount(() => {
    poke();
    const subs = ["tournaments", "groups", "players", "matches"].map((c) =>
      pb().collection(c).subscribe("*", () => invalidateAll()),
    );
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousemove", poke);
    return () => {
      subs.forEach((p) => p.then((u) => u()).catch(() => {}));
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousemove", poke);
      clearTimeout(hideTimer);
    };
  });
</script>

<div class="tv" class:cursor-hide={!barVisible} class:bar-open={barVisible}>
  <header class="strip">
    <div class="brand">
      <span class="bmain">Beyfest</span>
      <span class="bkana" lang="ja">トリプルスレット</span>
    </div>
    <div class="scene-name">
      <span class="scene-kana" lang="ja">{SCENE_KANA[scene]}</span>
      <span class="scene-en">{SCENE_TITLE[scene]}</span>
    </div>
    <div class="meta">{#if data.tournament}{data.tournament.playerCount} bladers{/if}</div>
  </header>

  <main class="stage">
    {#if scene === "standby"}
      <div class="standby">
        <div class="sb-main">Beyfest 2026</div>
        <div class="sb-sub">Triple Threat</div>
        <div class="sb-note">Waiting for the draw.</div>
      </div>

    {:else if scene === "groups"}
      <div class="grid groups-{groupCount}">
        {#each data.groups as g (g.id)}
          <section class="board">
            <div class="board-head">
              <h2>{g.name}</h2>
              <span class="sub">{g.size} bladers · {g.format} RR{g.complete ? " · final" : ""}</span>
            </div>
            <div class="thead">
              <span></span><span></span>
              <span class="c-n">P</span><span class="c-n w">W</span><span class="c-n">L</span>
              <span class="c-n">PF</span><span class="c-n">+/−</span><span></span>
            </div>
            {#each groupStandings(data.players, data.matches, g.index) as row, i (row.playerId)}
              {@const dest = destinationOf(i + 1, g.size, structure?.knockoutType ?? "")}
              <div class="trow tier-{dest.tier}">
                <span class="rank"><i>{i + 1}</i></span>
                <span class="name">{names.get(row.playerId)}</span>
                <span class="c-n">{row.wins + row.losses}</span>
                <span class="c-n w">{row.wins}</span>
                <span class="c-n">{row.losses}</span>
                <span class="c-n">{row.pointsFor}</span>
                <span class="c-n">{row.pointDiff > 0 ? "+" : ""}{row.pointDiff}</span>
                <span class="dest" class:dim={!g.complete}>{dest.label}</span>
              </div>
            {/each}
            <div class="gfix">
              {#each groupMatchesOf(g.index) as m (m.code)}
                {@const gdone = m.matchStatus === "done"}
                <div class="gfix-row" class:done={gdone} class:next={m.code === groupNextCode(g.index)}>
                  <span class="gfix-p" class:win={gdone && (m.p1Score ?? 0) > (m.p2Score ?? 0)}>{names.get(m.p1)}</span>
                  <span class="gfix-s">
                    {#if gdone}{m.p1Score}–{m.p2Score}{:else if m.code === groupNextCode(g.index)}next{:else}v{/if}
                  </span>
                  <span class="gfix-p right" class:win={gdone && (m.p2Score ?? 0) > (m.p1Score ?? 0)}>{names.get(m.p2)}</span>
                </div>
              {/each}
            </div>
          </section>
        {/each}
      </div>

    {:else if scene === "rr"}
      <div class="rr-wrap">
        {#each [{ st: "wb_rr", title: "Winners Mini-RR" }, { st: "lb_rr", title: "Losers Mini-RR" }] as def (def.st)}
          {#if structure && hasStage(data.matches, def.st)}
            {@const stage = def.st as "wb_rr" | "lb_rr"}
            {@const adv = miniRRAdvancers(structure, stage)}
            {@const total = data.matches.filter((m) => m.stage === stage).length}
            {@const played = data.matches.filter((m) => m.stage === stage && m.matchStatus === "done").length}
            <section class="board rr tier-{stage === 'wb_rr' ? 'wb' : 'lb'}">
              <div class="board-head">
                <h2>{def.title}</h2>
                <span class="sub">{played}/{total} played</span>
              </div>
              {#each miniRRStandings(data.matches, stage) as row, i (row.playerId)}
                {@const f = rrFate(stage, i + 1, adv)}
                <div class="trow-rr" class:out={!f.adv}>
                  <span class="seed">{stage === "wb_rr" ? "WB" : "LB"}-{ordinal(i + 1)}</span>
                  <span class="name">{names.get(row.playerId)}</span>
                  <span class="c-n">{row.wins}–{row.losses}</span>
                  <span class="c-n">{row.pointsFor}</span>
                  <span class="fate" class:adv={f.adv}>{f.text}</span>
                </div>
              {/each}
            </section>
          {/if}
        {/each}
      </div>

    {:else if scene === "bracket"}
      {#if structure}
        <BroadcastBracket
          matches={data.matches}
          players={data.players}
          {structure}
          {groupCount}
          orientation={bracketOrientation}
        />
      {/if}

    {:else if scene === "spotlight"}
      <div class="mc">
        <div class="mc-top">
          {#if mcContext === "groups"}
            {#each data.groups as g (g.id)}
              <div class="mini">
                <div class="mini-h">{g.name}</div>
                {#each groupStandings(data.players, data.matches, g.index) as row, i (row.playerId)}
                  {@const dest = destinationOf(i + 1, g.size, structure?.knockoutType ?? "")}
                  <div class="mini-row tier-{dest.tier}">
                    <span class="mini-r">{i + 1}</span>
                    <span class="mini-n">{names.get(row.playerId)}</span>
                    <span class="mini-w">{row.wins}</span>
                  </div>
                {/each}
              </div>
            {/each}
          {:else if mcContext === "rr"}
            {#each [{ st: "wb_rr", title: "Winners" }, { st: "lb_rr", title: "Losers" }] as def (def.st)}
              {#if structure && hasStage(data.matches, def.st)}
                {@const stage = def.st as "wb_rr" | "lb_rr"}
                {@const adv = miniRRAdvancers(structure, stage)}
                <div class="mini mrr tier-{stage === 'wb_rr' ? 'wb' : 'lb'}">
                  <div class="mini-h">{def.title} Mini-RR</div>
                  {#each miniRRStandings(data.matches, stage) as row, i (row.playerId)}
                    {@const f = rrFate(stage, i + 1, adv)}
                    <div class="mini-row mrr-row" class:out={!f.adv}>
                      <span class="mrr-seed">{stage === "wb_rr" ? "WB" : "LB"}-{ordinal(i + 1)}</span>
                      <span class="mini-n">{names.get(row.playerId)}</span>
                      <span class="mini-w">{row.wins}–{row.losses}</span>
                    </div>
                  {/each}
                </div>
              {/if}
            {/each}
          {:else}
            <div class="mc-bracket">
              {#each bracketColumns as col (col.label)}
                <div class="mcb-col">
                  <div class="mcb-h">{shortLabel(col.label)}</div>
                  {#each col.matches as m (m.code)}
                    {@const md = m.matchStatus === "done"}
                    <div class="mcb-m tier-{tierOf(m.stage)}" class:done={md} class:cur={m.code === spotMatch?.code}>
                      <span class="mcb-p" class:win={md && m.winner === m.p1}>{sideName(m, 1)}</span>
                      <span class="mcb-s">{#if md}{m.p1Score}–{m.p2Score}{:else}v{/if}</span>
                      <span class="mcb-p right" class:win={md && m.winner === m.p2}>{sideName(m, 2)}</span>
                    </div>
                  {/each}
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <div class="mc-hero">
          {#if spotMatch}
            {@const t = pointsToWin(spotMatch.stage, spotMatch.roundLabel)}
            {@const done = spotMatch.matchStatus === "done"}
            {@const live = isLive(spotMatch)}
            {@const av = (done ? spotMatch.p1Score : spotMatch.liveP1) ?? 0}
            {@const bv = (done ? spotMatch.p2Score : spotMatch.liveP2) ?? 0}
            {@const decided = done || (live && (av >= t || bv >= t))}
            {@const wonA = decided && av > bv}
            {@const wonB = decided && bv > av}
            <div class="hero tier-{tierOf(spotMatch.stage)}">
              <div class="hero-tag" class:live={live && !decided} class:decided>
                {#if done}Result{:else if decided}<span class="crown"><Trophy /></span>Match won{:else if live}<span class="live-dot"></span>Live{:else}Up Next{/if}
                — {spotMatch.roundLabel}
              </div>
              <div class="hero-body">
                <div class="hero-side" class:won={wonA}>
                  <div class="hero-name">{sideName(spotMatch, 1)}</div>
                  {#if done || live}<div class="hero-score">{av}</div>{/if}
                  {#if done || live}<div class="win-slot">{#if wonA}<div class="win-badge">Winner</div>{/if}</div>{/if}
                </div>
                <div class="hero-mid">
                  <div class="vs">vs</div>
                  <div class="hero-code">{spotMatch.code}</div>
                  <div class="hero-ft">first to {t}</div>
                </div>
                <div class="hero-side right" class:won={wonB}>
                  <div class="hero-name">{sideName(spotMatch, 2)}</div>
                  {#if done || live}<div class="hero-score">{bv}</div>{/if}
                  {#if done || live}<div class="win-slot">{#if wonB}<div class="win-badge">Winner</div>{/if}</div>{/if}
                </div>
              </div>
            </div>
          {:else}
            <div class="empty-scene">No matches to show yet.</div>
          {/if}
        </div>

        <div class="mc-bottom">
          {#if nextUp}
            <div class="nextup">
              <span class="nu-tag">Next Up</span>
              <span class="nu-code">{nextUp.code}</span>
              <span class="nu-match">{sideName(nextUp, 1)} <em>vs</em> {sideName(nextUp, 2)}</span>
              <span class="nu-ft">First to {pointsToWin(nextUp.stage, nextUp.roundLabel)}</span>
            </div>
          {/if}
        </div>
      </div>

    {:else if scene === "champion"}
      {@const gf = data.matches.find((m) => m.stage === "gf")}
      <div class="champ-scene">
        <div class="trophy"><Trophy size="1em" label="Trophy" /></div>
        <div class="champ-label">Tournament Champion</div>
        <div class="champ-name">{names.get(champ)}</div>
        {#if gf}
          <div class="champ-sub">
            beat {names.get(gf.winner === gf.p1 ? gf.p2 : gf.p1)}
            {Math.max(gf.p1Score ?? 0, gf.p2Score ?? 0)}–{Math.min(gf.p1Score ?? 0, gf.p2Score ?? 0)}
            in the Grand Final
          </div>
        {/if}
      </div>
    {/if}
  </main>

  <nav class="opbar" class:hidden={!barVisible}>
    <span class="grp">
      {#each scenes as s, i (s)}
        <button class:active={scene === s} onclick={() => setScene(s)}>{i + 1} {SCENE_TITLE[s]}</button>
      {/each}
    </span>
    {#if scene === "spotlight" && featured.length}
      <span class="spot-nav">
        <button onclick={() => (spotIndex = Math.max(spotIndex - 1, 0))}>‹</button>
        {Math.min(spotIndex, featured.length - 1) + 1}/{featured.length}
        <button onclick={() => (spotIndex = Math.min(spotIndex + 1, featured.length - 1))}>›</button>
      </span>
    {/if}
    <button class="full" onclick={toggleFull}>Full screen</button>
  </nav>
</div>

<style>
  /* Ultramarine field with static diagonal speed lines — painted once, no
     photo, blur or glow, so it stays smooth on a Raspberry Pi. */
  .tv {
    position: fixed;
    inset: 0;
    --accent: var(--gold);
    --accent-deep: var(--gold);
    --bg:
      repeating-linear-gradient(-62deg, transparent 0 46px, rgb(255 255 255 / 0.035) 46px 48px),
      var(--field);
    --tv-plate: var(--field-deep);
    --tv-plate2: var(--dark2);
    --tv-line: var(--field-line);
    --tv-dim: var(--on-field-soft);
    --disp: var(--font-display);
    --lbl: var(--font-text);
    --num: var(--font-display);
    --name-family: var(--font-display);
    --name-transform: uppercase;
    --name-weight: 700;
    --rank-skew: 0deg;
    --plate-radius: 2px;
    --plate-cut: 0px;

    background: var(--bg);
    color: var(--text);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-family: var(--font-text);
  }
  .cursor-hide {
    cursor: none;
  }
  .strip,
  .stage,
  .opbar {
    position: relative;
    z-index: 1;
  }

  .strip {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: 16px 46px;
    background: var(--field-deep);
    border-bottom: var(--outline) solid var(--ink);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .bmain {
    text-transform: uppercase;
    font-family: var(--disp);
    font-size: 1.9rem;
    line-height: 1;
    color: var(--ink);
    background: var(--gold);
    padding: 8px 30px 10px 18px;
    clip-path: polygon(0 0, 100% 0, calc(100% - var(--cut)) 100%, 0 100%);
  }
  .bkana {
    text-transform: uppercase;
    font-family: var(--disp);
    font-size: 1.05rem;
    color: var(--on-field-soft);
  }
  .scene-name {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    line-height: 1;
  }
  .scene-kana {
    text-transform: uppercase;
    font-family: var(--disp);
    font-size: 0.95rem;
    color: var(--gold);
  }
  .scene-en {
    text-transform: uppercase;
    font-family: var(--disp);
    font-size: 2.3rem;
    color: var(--paper);
  }
  .meta {
    font-family: var(--lbl);
    font-stretch: 75%;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--tv-dim);
    font-size: 0.95rem;
    text-align: right;
  }

  .stage {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 26px 46px;
    overflow: hidden;
    transition: padding-bottom 0.25s ease;
  }
  /* Keep content clear of the operator bar while it's on screen. */
  .tv.bar-open .stage {
    padding-bottom: 96px;
  }

  /* Groups — Burst-style speed-cut plates */
  .grid {
    display: grid;
    gap: 26px;
    width: 100%;
    max-width: 1640px;
  }
  .groups-2 {
    grid-template-columns: repeat(2, 1fr);
  }
  .groups-3 {
    grid-template-columns: repeat(3, 1fr);
  }
  .board {
    background: linear-gradient(180deg, var(--tv-plate2), var(--tv-plate));
    border: var(--outline) solid var(--ink);
    border-radius: 0;
    padding: 18px 20px;
    box-shadow: var(--shadow-offset) var(--shadow-offset) 0 var(--ink);
  }
  .board-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    border-bottom: 2px solid color-mix(in oklch, var(--accent) 55%, transparent);
    padding-bottom: 8px;
    margin-bottom: 12px;
  }
  .board-head h2 {
    font-family: var(--disp);
    font-size: 1.9rem;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }
  .sub {
    font-family: var(--lbl);
    font-stretch: 75%;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--tv-dim);
    font-size: 0.76rem;
  }
  .thead,
  .trow {
    display: grid;
    grid-template-columns: 42px 1fr 34px 40px 34px 42px 50px 92px;
    align-items: center;
    gap: 6px;
  }
  .thead {
    color: var(--tv-dim);
    font-family: var(--lbl);
    font-stretch: 75%;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-size: 0.66rem;
    padding: 0 8px 6px;
  }
  .trow {
    --row-tier: transparent;
    background: linear-gradient(90deg, oklch(1 0 0 / 0.07), oklch(1 0 0 / 0.02));
    border-left: 5px solid var(--row-tier);
    border-radius: var(--plate-radius);
    clip-path: polygon(0 0, 100% 0, calc(100% - var(--plate-cut)) 100%, 0 100%);
    padding: 8px;
    margin-bottom: 6px;
    font-size: 1.15rem;
  }
  .trow.tier-wb {
    --row-tier: var(--wb);
  }
  .trow.tier-mb {
    --row-tier: var(--mb);
  }
  .trow.tier-lb {
    --row-tier: var(--lb);
  }
  .rank {
    text-transform: uppercase;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    background: var(--accent);
    color: var(--ink);
    font-family: var(--disp);
    font-size: 1.25rem;
    border-radius: 4px;
    transform: skewX(var(--rank-skew));
  }
  .rank i {
    font-style: normal;
    transform: skewX(calc(-1 * var(--rank-skew)));
  }
  .name {
    font-family: var(--name-family);
    font-stretch: 62%;
    font-weight: var(--name-weight);
    font-size: 1.25rem;
    text-transform: var(--name-transform);
    letter-spacing: 0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .c-n {
    text-align: center;
    font-variant-numeric: tabular-nums;
    font-family: var(--font-text);
    font-stretch: 75%;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    font-size: 1.2rem;
  }
  .c-n.w {
    color: var(--accent);
    font-size: 1.4rem;
  }
  .dest {
    text-align: right;
    font-family: var(--lbl);
    font-stretch: 75%;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--row-tier);
    padding-right: 4px;
  }
  .dest.dim {
    opacity: 0.4;
    color: var(--tv-dim);
  }

  /* Mini-RR */
  .rr-wrap {
    display: flex;
    gap: 30px;
    align-items: flex-start;
    justify-content: center;
    width: 100%;
    max-width: 1320px;
  }
  .rr {
    flex: 1;
  }
  .rr.tier-wb {
    --rr-tier: var(--wb);
  }
  .rr.tier-lb {
    --rr-tier: var(--lb);
  }
  .trow-rr {
    display: grid;
    grid-template-columns: 92px 1fr 70px 44px 150px;
    align-items: center;
    gap: 8px;
    background: linear-gradient(90deg, oklch(1 0 0 / 0.06), oklch(1 0 0 / 0.02));
    border-radius: var(--plate-radius);
    clip-path: polygon(0 0, 100% 0, calc(100% - var(--plate-cut)) 100%, 0 100%);
    padding: 10px 8px;
    margin-bottom: 6px;
    font-size: 1.18rem;
  }
  .trow-rr.out {
    opacity: 0.55;
  }
  .seed {
    font-family: var(--lbl);
    font-stretch: 75%;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 800;
    color: var(--rr-tier);
  }
  .fate {
    text-align: right;
    font-family: var(--lbl);
    font-stretch: 75%;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.8rem;
    color: var(--tv-dim);
  }
  .fate.adv {
    color: var(--rr-tier);
    font-weight: 700;
  }

  /* Spotlight */
  .hero {
    --tier: var(--accent);
    width: 100%;
    max-width: 1600px;
  }
  .hero.tier-wb {
    --tier: var(--wb);
  }
  .hero.tier-mb {
    --tier: var(--mb);
  }
  .hero.tier-lb {
    --tier: var(--lb);
  }
  .hero.tier-gf {
    --tier: var(--gf);
  }
  .hero-tag {
    text-align: center;
    font-family: var(--lbl);
    font-stretch: 75%;
    text-transform: uppercase;
    letter-spacing: 0.22em;
    color: var(--accent);
    font-size: 1.3rem;
    margin-bottom: 40px;
  }
  .hero-tag.live {
    color: var(--lb);
  }
  .hero-tag.decided {
    color: var(--accent);
  }
  .crown {
    margin-right: 8px;
  }
  .win-slot {
    min-height: 30px;
    margin-top: 12px;
  }
  .win-badge {
    display: inline-block;
    font-family: var(--lbl);
    font-stretch: 75%;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    font-weight: 800;
    font-size: 0.95rem;
    color: var(--ink);
    background: var(--accent);
    padding: 4px 18px;
    border-radius: 4px;
  }
  .live-dot {
    display: inline-block;
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: var(--lb);
    margin-right: 8px;
    vertical-align: middle;
    box-shadow: 0 0 10px var(--lb);
    animation: livepulse 1.2s ease-in-out infinite;
  }
  @keyframes livepulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .live-dot {
      animation: none;
    }
  }
  .hero-body {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 48px;
  }
  .hero-side {
    text-align: right;
  }
  .hero-side.right {
    text-align: left;
  }
  .hero-name {
    text-transform: uppercase;
    font-family: var(--disp);
    font-size: clamp(3rem, 7.5vw, 7rem);
    letter-spacing: 0.02em;
    line-height: 0.98;
  }
  .hero-side.won .hero-name {
    color: var(--tier);
  }
  .hero-score {
    font-family: var(--font-text);
    font-stretch: 75%;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    font-size: clamp(4.5rem, 9vw, 8rem);
    line-height: 1;
    color: var(--tier);
    margin-top: 6px;
  }
  .hero-mid {
    text-align: center;
  }
  .vs {
    font-family: var(--disp);
    font-size: 4rem;
    color: var(--tv-dim);
    line-height: 1;
    text-transform: uppercase;
  }
  .hero-code {
    font-family: var(--lbl);
    font-stretch: 75%;
    letter-spacing: 0.16em;
    color: var(--accent);
    font-weight: 700;
    font-size: 1.2rem;
    margin-top: 12px;
    text-transform: uppercase;
  }
  .hero-ft {
    font-family: var(--lbl);
    font-stretch: 75%;
    letter-spacing: 0.14em;
    color: var(--tv-dim);
    font-size: 1rem;
    text-transform: uppercase;
  }
  .empty-scene {
    color: var(--tv-dim);
    font-size: 1.4rem;
  }

  /* Match Centre layout: mini groups on top, hero in the middle, next up below */
  .mc {
    width: 100%;
    flex: 1;
    align-self: stretch;
    display: flex;
    flex-direction: column;
    gap: 22px;
    min-height: 0;
  }
  .mc-top {
    display: flex;
    gap: 22px;
    justify-content: center;
    flex-wrap: wrap;
  }
  .mini {
    background: var(--tv-plate);
    border: 1px solid var(--tv-line);
    border-radius: 8px;
    padding: 12px 16px;
    min-width: 250px;
  }
  .mini-h {
    text-transform: uppercase;
    font-family: var(--disp);
    font-size: 1.5rem;
    color: var(--accent);
    margin-bottom: 7px;
  }
  .mini-row {
    --row-tier: transparent;
    display: grid;
    grid-template-columns: 22px 1fr 24px;
    gap: 8px;
    align-items: center;
    font-size: 1.05rem;
    padding: 3px 0 3px 8px;
    border-left: 3px solid var(--row-tier);
  }
  .mini-row.tier-wb {
    --row-tier: var(--wb);
  }
  .mini-row.tier-mb {
    --row-tier: var(--mb);
  }
  .mini-row.tier-lb {
    --row-tier: var(--lb);
  }
  .mini-r {
    color: var(--tv-dim);
    text-align: center;
  }
  .mini-n {
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mini-w {
    text-align: center;
    font-family: var(--font-text);
    font-stretch: 75%;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    color: var(--accent);
  }
  /* Mini round-robin variant of the top strip */
  .mrr .mini-row {
    grid-template-columns: 56px 1fr 44px;
  }
  .mrr.tier-wb {
    --rr: var(--wb);
  }
  .mrr.tier-lb {
    --rr: var(--lb);
  }
  .mrr-seed {
    font-family: var(--lbl);
    font-stretch: 75%;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 800;
    font-size: 0.74rem;
    color: var(--rr, var(--accent));
  }
  .mrr-row.out {
    opacity: 0.5;
  }
  .mrr .mini-w {
    color: var(--tv-dim);
    font-size: 0.9rem;
  }
  /* Compact bracket variant of the top strip */
  .mc-bracket {
    display: flex;
    gap: 14px;
    overflow-x: auto;
    max-width: 100%;
    padding-bottom: 4px;
    align-items: stretch;
  }
  .mcb-col {
    display: flex;
    flex-direction: column;
    gap: 8px;
    justify-content: center;
    min-width: 158px;
  }
  .mcb-h {
    font-family: var(--lbl);
    font-stretch: 75%;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 0.62rem;
    font-weight: 800;
    color: var(--tv-dim);
    text-align: center;
  }
  .mcb-m {
    --tier: var(--neutral);
    display: grid;
    grid-template-columns: 1fr 34px 1fr;
    gap: 4px;
    align-items: center;
    background: var(--tv-plate);
    border: 1px solid var(--tv-line);
    border-left: 3px solid var(--tier);
    border-radius: 5px;
    padding: 4px 7px;
    font-size: 0.74rem;
  }
  .mcb-m.tier-wb {
    --tier: var(--wb);
  }
  .mcb-m.tier-mb {
    --tier: var(--mb);
  }
  .mcb-m.tier-lb {
    --tier: var(--lb);
  }
  .mcb-m.tier-gf {
    --tier: var(--gf);
  }
  .mcb-m.cur {
    box-shadow: 0 0 0 2px var(--accent);
  }
  .mcb-p {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--tv-dim);
  }
  .mcb-m.done .mcb-p {
    color: var(--text);
  }
  .mcb-p.right {
    text-align: right;
  }
  .mcb-p.win {
    color: var(--accent);
    font-weight: 700;
  }
  .mcb-s {
    text-align: center;
    color: var(--tv-dim);
    font-family: var(--font-text);
    font-stretch: 75%;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    font-size: 0.85rem;
  }
  .mc-hero {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
  }
  .mc-bottom {
    display: flex;
    justify-content: center;
  }
  .nextup {
    display: flex;
    align-items: center;
    gap: 20px;
    background: var(--tv-plate);
    border: 1px solid var(--tv-line);
    border-left: 5px solid var(--accent);
    border-radius: 8px;
    padding: 14px 30px;
  }
  .nu-tag {
    font-family: var(--lbl);
    font-stretch: 75%;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: var(--accent);
    font-weight: 800;
    font-size: 0.95rem;
  }
  .nu-code {
    font-family: var(--lbl);
    font-stretch: 75%;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--tv-dim);
    font-weight: 700;
    font-size: 0.9rem;
  }
  .nu-match {
    font-family: var(--name-family);
    font-stretch: 62%;
    text-transform: uppercase;
    font-weight: 700;
    font-size: 1.55rem;
    letter-spacing: 0.02em;
  }
  .nu-match em {
    color: var(--tv-dim);
    font-style: normal;
    margin: 0 8px;
  }
  .nu-ft {
    font-family: var(--lbl);
    font-stretch: 75%;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--tv-dim);
    font-size: 0.76rem;
  }

  /* Per-group fixtures + results, shown under each group's table */
  .gfix {
    margin-top: 10px;
    border-top: 1px solid var(--tv-line);
    padding-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .gfix-row {
    display: grid;
    grid-template-columns: 1fr 62px 1fr;
    align-items: center;
    gap: 6px;
    font-size: 0.82rem;
    padding: 3px 6px;
    border-radius: 4px;
  }
  .gfix-row.next {
    background: color-mix(in oklch, var(--accent) 16%, transparent);
  }
  .gfix-p {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--tv-dim);
  }
  .gfix-row.done .gfix-p {
    color: var(--text);
  }
  .gfix-p.right {
    text-align: right;
  }
  .gfix-p.win {
    color: var(--accent);
    font-weight: 700;
  }
  .gfix-s {
    text-align: center;
    font-family: var(--font-text);
    font-stretch: 75%;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    color: var(--tv-dim);
    font-size: 0.95rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .gfix-row.done .gfix-s {
    color: var(--text);
  }

  /* Champion + standby */
  .champ-scene,
  .standby {
    text-align: center;
  }
  .trophy {
    font-size: clamp(4rem, 12vw, 9rem);
  }
  .champ-label {
    font-family: var(--lbl);
    font-stretch: 75%;
    text-transform: uppercase;
    letter-spacing: 0.35em;
    color: var(--accent);
    font-size: 1.2rem;
    margin-top: 10px;
  }
  .champ-name {
    text-transform: uppercase;
    font-family: var(--disp);
    font-size: clamp(4rem, 14vw, 10rem);
    letter-spacing: 0.02em;
    line-height: 1;
  }
  .champ-sub {
    color: var(--tv-dim);
    font-size: 1.15rem;
    margin-top: 10px;
  }
  .sb-main {
    text-transform: uppercase;
    font-family: var(--disp);
    font-size: clamp(4rem, 14vw, 11rem);
    letter-spacing: 0.03em;
    line-height: 1;
  }
  .sb-sub {
    font-family: var(--lbl);
    font-stretch: 75%;
    text-transform: uppercase;
    letter-spacing: 0.4em;
    color: var(--accent);
    font-size: 1.4rem;
    margin-top: 8px;
  }
  .sb-note {
    color: var(--tv-dim);
    margin-top: 24px;
    font-size: 1.2rem;
  }

  /* Operator bar */
  .opbar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    gap: 14px;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    padding: 12px;
    background: var(--field-deep);
    border-top: var(--outline) solid var(--ink);
    transition:
      transform 0.25s ease,
      opacity 0.25s ease;
  }
  .opbar.hidden {
    transform: translateY(120%);
    opacity: 0;
  }
  .grp {
    display: inline-flex;
    gap: 6px;
    align-items: center;
  }
  .opbar button {
    font-family: var(--lbl);
    font-stretch: 75%;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 700;
    font-size: 0.82rem;
    padding: 7px 12px;
    border-radius: 7px;
    border: 1px solid var(--tv-line);
    background: var(--dark3);
    color: var(--text);
    cursor: pointer;
  }
  .opbar button.active {
    background: var(--accent);
    color: var(--ink);
    border-color: var(--accent);
  }
  .spot-nav {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--tv-dim);
    font-variant-numeric: tabular-nums;
  }

  @media (prefers-reduced-motion: reduce) {
    .opbar {
      transition: none;
    }
  }
</style>
