<script lang="ts">
  import { onMount, tick as svelteTick } from "svelte";
  import { invalidateAll } from "$app/navigation";
  import { pb } from "$lib/pbBrowser";
  import { EVENT } from "$lib/config";
  import { FINISHES } from "$lib/finishes";
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
    roundName,
    availableScenes,
    SCENE_TITLE,
    type PBMatch,
    type Scene,
  } from "$lib/view";
  import BroadcastBracket from "$lib/components/tv/BroadcastBracket.svelte";
  import Trophy from "$lib/components/Trophy.svelte";

  let { data } = $props();

  const structure = $derived(data.tournament ? pickStructure(data.tournament.structureKey) : null);
  const groupCount = $derived(data.groups.length);
  const names = $derived(nameMap(data.players));

  const champ = $derived.by(() => {
    const gf = data.matches.find((m) => m.stage === "gf");
    return gf && gf.matchStatus === "done" ? gf.winner : "";
  });

  // Katakana shown above each scene title. Every glyph here must exist in the
  // font subset (static/fonts/zenkaku_kana.woff2) — see theme.css header.
  const SCENE_KANA: Record<Scene, string> = {
    standby: "スタンバイ",
    groups: "グループステージ",
    rr: "ラウンドロビン",
    bracket: "ノックアウト",
    spotlight: "マッチセンター",
    champion: "チャンピオン",
  };

  const scenes = $derived(availableScenes(!!data.tournament, data.matches));

  // ── Which scene is on screen ────────────────────────────────────────
  // First match wins:
  //   1. a key pressed at the TV itself (holds for LOCAL_SECONDS)
  //   2. the organiser locked a scene from the admin page
  //   3. a score just changed / a result went in → Match centre (REACT_SECONDS)
  //   4. auto rotation, each scene for its DWELL
  const DWELL: Record<Scene, number> = { standby: 60, groups: 25, rr: 20, bracket: 25, spotlight: 15, champion: 30 };
  const REACT_SECONDS = 20;
  const LOCAL_SECONDS = 60;

  let now = $state(Date.now());
  let autoScene = $state<Scene>("groups");
  let autoUntil = Date.now() + DWELL.groups * 1000;
  let react = $state<{ code: string; until: number } | null>(null);
  let local = $state<{ scene: Scene; until: number } | null>(null);

  const localActive = $derived(!!local && local.until > now && scenes.includes(local.scene));
  const reacting = $derived(!!react && react.until > now && scenes.includes("spotlight"));
  const scene = $derived.by<Scene>(() => {
    if (localActive) return local!.scene;
    if (!data.tournament) return "standby";
    if (data.tv.mode === "locked" && scenes.includes(data.tv.scene)) return data.tv.scene;
    if (reacting) return "spotlight";
    return scenes.includes(autoScene) ? autoScene : scenes[0];
  });

  // Advance the rotation. Runs every second; cheap.
  function tick() {
    now = Date.now();
    if (now >= autoUntil || !scenes.includes(autoScene)) {
      const i = scenes.indexOf(autoScene); // -1 → starts again at scenes[0]
      autoScene = scenes[(i + 1) % scenes.length];
      autoUntil = now + DWELL[autoScene] * 1000;
    }
  }

  // Watch for a running score changing or a result being recorded, and cut to
  // that match. Knockout slots filling in (pending → ready) don't count.
  let lastSeen = new Map<string, string>();
  let primed = false;
  $effect(() => {
    const snap = new Map(
      data.matches.map((m) => [m.code, `${m.matchStatus}|${m.liveP1}-${m.liveP2}|${m.p1Score}-${m.p2Score}`]),
    );
    if (primed) {
      let hit: PBMatch | null = null;
      for (const m of data.matches) {
        const before = lastSeen.get(m.code);
        if (before === undefined || before === snap.get(m.code)) continue;
        const justDone = m.matchStatus === "done" && !before.startsWith("done");
        if (isLive(m) || justDone) hit = m;
      }
      if (hit) react = { code: hit.code, until: Date.now() + REACT_SECONDS * 1000 };
    }
    lastSeen = snap;
    primed = true;
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
  // While reacting to a score, Match centre shows THAT match; otherwise the
  // live / next / latest list, browsable with the arrow keys at the TV.
  const spotMatch = $derived(
    (reacting && scene === "spotlight" ? data.matches.find((m) => m.code === react!.code) : null) ??
      featured[Math.min(spotIndex, Math.max(0, featured.length - 1))] ??
      null,
  );

  const groupMatchesOf = (gi: number) =>
    data.matches
      .filter((m) => m.stage === "group" && m.groupIndex === gi)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  // Tallest fixture list on screen (two groups → fixtures split into 2 columns).
  // Short lists get the bigger "roomy" sizing so the slabs fill the screen;
  // only 3 groups of 5 (13–15 players) needs the compact sizes.
  const fixtureRows = $derived(
    Math.max(0, ...data.groups.map((g) => {
      const n = groupMatchesOf(g.index).length;
      return groupCount === 2 ? Math.ceil(n / 2) : n;
    })),
  );
  const groupPlayed = (gi: number) => groupMatchesOf(gi).filter((m) => m.matchStatus === "done").length;
  // How a fixture row reads on the Group stage scene. Only ONE row is "next":
  // the next match due that isn't already being played.
  function fixtureState(m: PBMatch): "done" | "live" | "next" | "later" {
    if (m.matchStatus === "done") return "done";
    if (isLive(m)) return "live";
    if (m.code === nextUp?.code) return "next";
    return "later";
  }
  // The next fixture to be played (not the one currently live) — for the "prep" strip.
  const nextUp = $derived(
    data.matches
      .filter((m) => m.matchStatus === "ready" && !isLive(m))
      .sort((a, b) => a.orderIndex - b.orderIndex)[0] ?? null,
  );

  // The match on the table right now (first live one), for the "On now" band.
  const onNow = $derived(
    data.matches.filter(isLive).sort((a, b) => a.orderIndex - b.orderIndex)[0] ?? null,
  );

  // Where the featured match sits, in plain words: "Group 2, match 4 of 6"
  // for group games, "Mid bracket semi-final" for knockout ones.
  function matchContext(m: PBMatch): string {
    if (m.stage !== "group") return roundName(m.roundLabel);
    const list = groupMatchesOf(m.groupIndex ?? 0);
    const n = list.findIndex((x) => x.code === m.code) + 1;
    return `${m.roundLabel}, match ${n} of ${list.length}`;
  }

  // ── Helpers ─────────────────────────────────────────────────────────
  function sideName(m: PBMatch, which: 1 | 2): string {
    const pid = which === 1 ? m.p1 : m.p2;
    if (pid) return names.get(pid) ?? "—";
    return slotLabel(which === 1 ? m.slot1 : m.slot2, groupCount);
  }
  function rrFate(stage: "wb_rr" | "lb_rr", rank: number, advancers: number) {
    if (stage === "wb_rr")
      return rank === 1 ? { text: "Grand final", tier: "gf" } : { text: "Mid bracket", tier: "mb" };
    return rank <= advancers ? { text: "Mid bracket", tier: "mb" } : { text: "Out", tier: "out" };
  }
  const rrMatchesOf = (stage: string) =>
    data.matches.filter((m) => m.stage === stage).sort((a, b) => a.orderIndex - b.orderIndex);

  // ── Finish call-out ─────────────────────────────────────────────────
  // When a round is logged, Match centre calls the finish out big across the
  // top ("KNOCKOUT +2"), then flies it down into a pill under the scorer's
  // card, where it stays until the next round. Undo (the log shrinks) just
  // updates the pill — no animation. Only transform/opacity animate (Pi).
  const FINISH_BY_KEY = new Map(FINISHES.map((f) => [f.key, f]));
  const CALLOUT_FRESH_MS = 6000; // don't replay a call-out the rotation lands on later

  let logSeen = new Map<string, number>();
  let logPrimed = false;
  let latestRound = $state<{ code: string; n: number; at: number } | null>(null);
  $effect(() => {
    for (const m of data.matches) {
      const n = m.liveLog.length;
      const before = logSeen.get(m.code);
      if (logPrimed && before !== undefined && n > before) latestRound = { code: m.code, n, at: Date.now() };
      logSeen.set(m.code, n);
    }
    logPrimed = true;
  });

  // The round shown in the pill: the latest one of the match on screen.
  const lastRound = $derived.by(() => {
    const log = spotMatch?.liveLog ?? [];
    const r = log[log.length - 1];
    const f = r ? FINISH_BY_KEY.get(r.finish) : undefined;
    return r && f ? { who: r.who, label: f.label, pts: f.pts } : null;
  });

  let fx = $state<{ label: string; pts: number } | null>(null);
  let fxEl = $state<HTMLElement>();
  let pillEl = $state<HTMLElement>();
  let fxAnim: Animation | null = null;
  let played = "";

  $effect(() => {
    const ev = latestRound;
    if (!ev || scene !== "spotlight" || spotMatch?.code !== ev.code) return;
    const key = `${ev.code}#${ev.n}`;
    if (key === played) return;
    played = key;
    if (Date.now() - ev.at > CALLOUT_FRESH_MS) return;
    if (spotMatch.liveLog.length !== ev.n || !lastRound) return; // undone since
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; // pill only
    void playCallout(lastRound.label, lastRound.pts);
  });

  async function playCallout(label: string, pts: number) {
    fxAnim?.cancel();
    fx = { label, pts };
    await svelteTick();
    const big = fxEl;
    const pill = pillEl;
    if (!big || !pill) {
      fx = null;
      return;
    }
    // Fly from the big slab's resting place onto the pill (centre to centre),
    // shrinking to the pill's height.
    const b = big.getBoundingClientRect();
    const t = pill.getBoundingClientRect();
    const dx = t.left + t.width / 2 - (b.left + b.width / 2);
    const dy = t.top + t.height / 2 - (b.top + b.height / 2);
    const sc = t.height / b.height;
    const anim = big.animate(
      [
        // slam in from above, oversized
        { offset: 0, opacity: 0, transform: "translate(0, -70px) scale(1.5)", easing: "cubic-bezier(.2, .9, .3, 1.25)" },
        { offset: 0.16, opacity: 1, transform: "translate(0, 0) scale(0.97)", easing: "ease-out" },
        { offset: 0.22, opacity: 1, transform: "translate(0, 0) scale(1)", easing: "linear" },
        // hold so the room can read it
        { offset: 0.58, opacity: 1, transform: "translate(0, 0) scale(1)", easing: "cubic-bezier(.65, 0, .25, 1)" },
        // fly down onto the pill
        { offset: 1, opacity: 1, transform: `translate(${dx}px, ${dy}px) scale(${sc})` },
      ],
      { duration: 1500, fill: "forwards" },
    );
    fxAnim = anim;
    // Safety net: a hidden/throttled tab can pause animations indefinitely,
    // which would leave the pill hidden. Force the landing if it overruns.
    setTimeout(() => {
      if (fxAnim === anim && anim.playState !== "finished") anim.finish();
    }, 1900);
    anim.onfinish = () => {
      if (fxAnim !== anim) return;
      fx = null;
      fxAnim = null;
      pill.animate([{ transform: "scale(1.18)" }, { transform: "scale(1)" }], {
        duration: 220,
        easing: "cubic-bezier(.2, .9, .3, 1.3)",
      });
    };
  }

  // ── Operator control (keyboard / mouse at the TV) ───────────────────
  let barVisible = $state(true);
  let hideTimer: ReturnType<typeof setTimeout>;
  function poke() {
    barVisible = true;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => (barVisible = false), 3500);
  }
  // Picking a scene at the TV overrides everything for LOCAL_SECONDS.
  function setScene(s: Scene) {
    local = { scene: s, until: Date.now() + LOCAL_SECONDS * 1000 };
    react = null;
    if (s === "spotlight") spotIndex = 0; // jump to the live / next match
    poke();
  }
  function cycleScene(d: number) {
    const i = scenes.indexOf(scene);
    setScene(scenes[(i + d + scenes.length) % scenes.length]);
  }
  function browseSpot(d: number) {
    spotIndex = Math.max(0, Math.min(spotIndex + d, featured.length - 1));
    setScene("spotlight");
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
      if (scene === "spotlight") browseSpot(1);
      else cycleScene(1);
    } else if (e.key === "ArrowLeft") {
      if (scene === "spotlight") browseSpot(-1);
      else cycleScene(-1);
    } else if (e.key.toLowerCase() === "f") {
      toggleFull();
    } else {
      poke();
    }
  }

  // Who is driving the screen, in words, for the operator bar.
  const modeLabel = $derived.by(() => {
    const fallback = data.tv.mode === "locked" ? "the organiser's choice" : "auto";
    if (localActive) return `Picked here, back to ${fallback} in ${Math.ceil((local!.until - now) / 1000)}s`;
    if (data.tv.mode === "locked") return "Locked by the organiser";
    if (reacting) return "Auto, showing the latest score";
    return "Auto rotation";
  });

  onMount(() => {
    poke();
    const subs = ["tournaments", "groups", "players", "matches", "tv_state"].map((c) =>
      pb().collection(c).subscribe("*", () => invalidateAll()),
    );
    const clock = setInterval(tick, 1000);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousemove", poke);
    return () => {
      subs.forEach((p) => p.then((u) => u()).catch(() => {}));
      clearInterval(clock);
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
      <!-- Standby and Champion carry their own giant title; don't repeat it. -->
      {#if scene !== "standby" && scene !== "champion"}
        <span class="scene-kana" lang="ja">{SCENE_KANA[scene]}</span>
        <span class="scene-en">{SCENE_TITLE[scene]}</span>
      {/if}
    </div>
    <div class="meta">{#if data.tournament}{data.tournament.playerCount} bladers{/if}</div>
  </header>

  <main class="stage">
    {#if scene === "standby"}
      <div class="finale">
        <div class="finale-kana" lang="ja">ベイフェスト</div>
        <div class="big-slab"><span>Beyfest 2026</span></div>
        <div class="finale-title">Triple Threat</div>
        <div class="finale-sub">{EVENT.date}, {EVENT.place}</div>
        <div class="finale-note">The groups are drawn once everyone has checked in.</div>
      </div>

    {:else if scene === "groups"}
      <div class="gs" class:roomy={fixtureRows <= 6}>
        <div class="gs-grid gs-{groupCount}">
          {#each data.groups as g (g.id)}
            {@const total = groupMatchesOf(g.index).length}
            <section class="gs-slab">
              <header class="gs-head">
                <h2>{g.name}</h2>
                <span class="gs-progress">
                  {#if g.complete}Final standings{:else}{groupPlayed(g.index)} of {total} played{/if}
                </span>
              </header>

              <div class="gs-cols" aria-hidden="true">
                <span></span><span></span><span>W–L</span><span>+/−</span><span>Goes to</span>
              </div>
              {#each groupStandings(data.players, data.matches, g.index) as row, i (row.playerId)}
                {@const dest = destinationOf(i + 1, g.size, structure?.knockoutType ?? "")}
                <div class="gs-row tier-{dest.tier}">
                  <span class="gs-rank">{i + 1}</span>
                  <span class="gs-name">{names.get(row.playerId)}</span>
                  <span class="gs-wl">{row.wins}–{row.losses}</span>
                  <span class="gs-diff">{row.pointDiff > 0 ? "+" : ""}{row.pointDiff}</span>
                  <span class="gs-dest" class:projected={!g.complete}>{dest.label}</span>
                </div>
              {/each}

              <ol class="gs-fixtures" class:wide={groupCount === 2}>
                {#each groupMatchesOf(g.index) as m (m.code)}
                  {@const st = fixtureState(m)}
                  {@const w1 = st === "done" && (m.p1Score ?? 0) > (m.p2Score ?? 0)}
                  {@const w2 = st === "done" && (m.p2Score ?? 0) > (m.p1Score ?? 0)}
                  <li class="gs-fx {st}">
                    <span class="gs-fx-p" class:win={w1} class:lose={w2}>{names.get(m.p1)}</span>
                    <span class="gs-fx-mid">
                      {#if st === "done"}{m.p1Score}–{m.p2Score}
                      {:else if st === "live"}{m.liveP1}–{m.liveP2}
                      {:else if st === "next"}Next
                      {:else}v{/if}
                    </span>
                    <span class="gs-fx-p right" class:win={w2} class:lose={w1}>{names.get(m.p2)}</span>
                  </li>
                {/each}
              </ol>
            </section>
          {/each}
        </div>

        {#if onNow || nextUp}
          <div class="onnow">
            {#if onNow}
              <span class="onnow-tag live">On now</span>
              <span class="onnow-match">
                {sideName(onNow, 1)} <b>{onNow.liveP1}–{onNow.liveP2}</b> {sideName(onNow, 2)}
              </span>
            {/if}
            {#if nextUp}
              <span class="onnow-tag">Next up</span>
              <span class="onnow-match soft">{sideName(nextUp, 1)} <em>v</em> {sideName(nextUp, 2)}</span>
            {/if}
          </div>
        {/if}
      </div>

    {:else if scene === "rr"}
      <div class="gs roomy">
        <div class="gs-grid rr-grid">
          {#each [{ st: "wb_rr", title: "Winners round-robin", note: "Winner goes straight to the grand final" }, { st: "lb_rr", title: "Losers round-robin", note: "Last chance to stay in" }] as def (def.st)}
            {#if structure && hasStage(data.matches, def.st)}
              {@const stage = def.st as "wb_rr" | "lb_rr"}
              {@const adv = miniRRAdvancers(structure, stage)}
              {@const list = rrMatchesOf(stage)}
              {@const played = list.filter((m) => m.matchStatus === "done").length}
              <section class="gs-slab rr-slab rr-{stage === 'wb_rr' ? 'wb' : 'lb'}">
                <header class="gs-head">
                  <h2>{def.title}</h2>
                  <span class="gs-progress">{played === list.length ? "Final standings" : `${played} of ${list.length} played`}</span>
                </header>
                <p class="rr-note">{def.note}</p>
                <div class="gs-cols" aria-hidden="true">
                  <span></span><span></span><span>W–L</span><span>+/−</span><span>Goes to</span>
                </div>
                {#each miniRRStandings(data.matches, stage) as row, i (row.playerId)}
                  {@const f = rrFate(stage, i + 1, adv)}
                  <div class="gs-row tier-{f.tier === 'out' ? 'lb' : f.tier === 'gf' ? 'wb' : 'mb'}">
                    <span class="gs-rank">{i + 1}</span>
                    <span class="gs-name">{names.get(row.playerId)}</span>
                    <span class="gs-wl">{row.wins}–{row.losses}</span>
                    <span class="gs-diff">{row.pointDiff > 0 ? "+" : ""}{row.pointDiff}</span>
                    <span class="gs-dest rr-dest-{f.tier}" class:projected={played < list.length}>{f.text}</span>
                  </div>
                {/each}
                <ol class="gs-fixtures">
                  {#each list as m (m.code)}
                    {@const st = fixtureState(m)}
                    {@const w1 = st === "done" && (m.p1Score ?? 0) > (m.p2Score ?? 0)}
                    {@const w2 = st === "done" && (m.p2Score ?? 0) > (m.p1Score ?? 0)}
                    <li class="gs-fx {st}">
                      <span class="gs-fx-p" class:win={w1} class:lose={w2}>{sideName(m, 1)}</span>
                      <span class="gs-fx-mid">
                        {#if st === "done"}{m.p1Score}–{m.p2Score}
                        {:else if st === "live"}{m.liveP1}–{m.liveP2}
                        {:else if st === "next"}Next
                        {:else}v{/if}
                      </span>
                      <span class="gs-fx-p right" class:win={w2} class:lose={w1}>{sideName(m, 2)}</span>
                    </li>
                  {/each}
                </ol>
              </section>
            {/if}
          {/each}
        </div>

        {#if onNow || nextUp}
          <div class="onnow">
            {#if onNow}
              <span class="onnow-tag live">On now</span>
              <span class="onnow-match">
                {sideName(onNow, 1)} <b>{onNow.liveP1}–{onNow.liveP2}</b> {sideName(onNow, 2)}
              </span>
            {/if}
            {#if nextUp}
              <span class="onnow-tag">Next up</span>
              <span class="onnow-match soft">{sideName(nextUp, 1)} <em>v</em> {sideName(nextUp, 2)}</span>
            {/if}
          </div>
        {/if}
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
        {#if spotMatch}
          {@const t = pointsToWin(spotMatch.stage, spotMatch.roundLabel)}
          {@const done = spotMatch.matchStatus === "done"}
          {@const live = isLive(spotMatch)}
          {@const av = (done ? spotMatch.p1Score : spotMatch.liveP1) ?? 0}
          {@const bv = (done ? spotMatch.p2Score : spotMatch.liveP2) ?? 0}
          {@const decided = done || (live && (av >= t || bv >= t))}
          {@const wonA = decided && av > bv}
          {@const wonB = decided && bv > av}
          {@const showScore = done || live}
          <div class="mc-status">
            {#if done}<span class="mc-tag result">Result</span>
            {:else if decided}<span class="mc-tag won"><Trophy /> Match won</span>
            {:else if live}<span class="mc-tag live">Live</span>
            {:else}<span class="mc-tag next">Up next</span>{/if}
            <span class="mc-context">{matchContext(spotMatch)}</span>
            <span class="mc-ft">First to {t}</span>
          </div>

          {#if fx}
            <div class="fx-wrap" aria-hidden="true">
              <div class="fx" bind:this={fxEl}>
                <span class="fx-card"><span class="fx-label"><b>{fx.label}</b></span><span class="fx-pts"><b>+{fx.pts}</b></span></span>
              </div>
            </div>
          {/if}

          <div class="mc-duel tier-{tierOf(spotMatch.stage)}">
            <div class="mc-side left" class:won={wonA} class:lost={wonB}>
              <div class="mc-slab">
                <div class="mc-name">{sideName(spotMatch, 1)}</div>
                <div class="mc-score">{showScore ? av : "–"}</div>
              </div>
              {#if wonA}<span class="mc-winner">Winner</span>{/if}
              {#if lastRound?.who === 1 && !done}
                <span class="mc-finish" class:waiting={fx} bind:this={pillEl}>
                  <span class="fx-card"><span class="fx-label"><b>{lastRound.label}</b></span><span class="fx-pts"><b>+{lastRound.pts}</b></span></span>
                </span>
              {/if}
            </div>
            <div class="mc-vs" aria-label="versus">VS</div>
            <div class="mc-side right" class:won={wonB} class:lost={wonA}>
              <div class="mc-slab">
                <div class="mc-score">{showScore ? bv : "–"}</div>
                <div class="mc-name">{sideName(spotMatch, 2)}</div>
              </div>
              {#if wonB}<span class="mc-winner">Winner</span>{/if}
              {#if lastRound?.who === 2 && !done}
                <span class="mc-finish" class:waiting={fx} bind:this={pillEl}>
                  <span class="fx-card"><span class="fx-label"><b>{lastRound.label}</b></span><span class="fx-pts"><b>+{lastRound.pts}</b></span></span>
                </span>
              {/if}
            </div>
          </div>

          {@const otherLive = onNow && onNow.code !== spotMatch.code ? onNow : null}
          {@const otherNext = nextUp && nextUp.code !== spotMatch.code ? nextUp : null}
          {#if otherLive || otherNext}
            <div class="onnow">
              {#if otherLive}
                <span class="onnow-tag live">On now</span>
                <span class="onnow-match">
                  {sideName(otherLive, 1)} <b>{otherLive.liveP1}–{otherLive.liveP2}</b> {sideName(otherLive, 2)}
                </span>
              {/if}
              {#if otherNext}
                <span class="onnow-tag">Next up</span>
                <span class="onnow-match soft">{sideName(otherNext, 1)} <em>v</em> {sideName(otherNext, 2)}</span>
              {/if}
            </div>
          {/if}
        {:else}
          <div class="empty-scene">No matches yet. They'll appear here once the groups are drawn.</div>
        {/if}
      </div>

    {:else if scene === "champion"}
      {@const gf = data.matches.find((m) => m.stage === "gf")}
      <div class="finale">
        <div class="finale-kana" lang="ja">チャンピオン</div>
        <div class="champ-row">
          <Trophy size="15rem" label="Trophy" />
          <div class="big-slab"><span>{names.get(champ)}</span></div>
        </div>
        <div class="finale-title">Beyfest 2026 champion</div>
        {#if gf}
          <div class="finale-sub">
            Beat {names.get(gf.winner === gf.p1 ? gf.p2 : gf.p1)}
            {Math.max(gf.p1Score ?? 0, gf.p2Score ?? 0)}–{Math.min(gf.p1Score ?? 0, gf.p2Score ?? 0)}
            in the grand final
          </div>
        {/if}
      </div>
    {/if}
  </main>

  <nav class="opbar" class:hidden={!barVisible}>
    <span class="op-mode">{modeLabel}</span>
    <span class="grp">
      {#each scenes as s, i (s)}
        <button class:active={scene === s} onclick={() => setScene(s)}>{i + 1} {SCENE_TITLE[s]}</button>
      {/each}
    </span>
    {#if scene === "spotlight" && featured.length}
      <span class="spot-nav">
        <button onclick={() => browseSpot(-1)} aria-label="Previous match">‹</button>
        {Math.min(spotIndex, featured.length - 1) + 1} of {featured.length}
        <button onclick={() => browseSpot(1)} aria-label="Next match">›</button>
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
    font-family: var(--font-text);
    font-weight: 600;
    font-size: 1.3rem;
    color: var(--on-field-soft);
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


  /* ── Group stage ─────────────────────────────────────────────────
     White telop slabs on the field. Sized for reading across a hall at
     1920×1080: names ~40px, fixtures ~22px, nothing under 18px. */
  .gs {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  .gs-grid {
    flex: 1;
    min-height: 0;
    display: grid;
    gap: 30px;
    align-items: center;
  }
  .gs-2 {
    grid-template-columns: repeat(2, 1fr);
  }
  .gs-3 {
    grid-template-columns: repeat(3, 1fr);
  }
  .gs-slab {
    background: var(--paper);
    color: var(--ink);
    border: var(--outline) solid var(--ink);
    box-shadow: 8px 8px 0 var(--ink);
  }
  .gs-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    background: var(--ink);
    color: var(--paper);
    padding: 10px 20px 12px;
  }
  .gs-head h2 {
    font-size: 2.6rem;
    line-height: 1;
  }
  .gs-progress {
    font-family: var(--font-text);
    font-weight: 600;
    font-size: 1.2rem;
    color: var(--on-field-soft);
  }
  .gs-cols,
  .gs-row {
    display: grid;
    grid-template-columns: 44px 1fr 88px 64px 108px;
    align-items: center;
    column-gap: 10px;
    padding: 0 16px 0 10px;
  }
  .gs-cols {
    padding-top: 8px;
    padding-bottom: 2px;
    border-left: 10px solid transparent;
    font-family: var(--font-text);
    font-weight: 600;
    font-size: 1.1rem;
    color: var(--ink-soft);
  }
  .gs-cols span:nth-child(n + 3) {
    text-align: center;
  }
  .gs-cols span:last-child {
    text-align: right;
  }
  .gs-row {
    --tier: var(--neutral);
    height: 60px;
    border-left: 10px solid var(--tier);
    border-top: 2px solid #e3e6f3;
  }
  .gs-row.tier-wb {
    --tier: var(--wb);
  }
  .gs-row.tier-mb {
    --tier: var(--mb);
  }
  .gs-row.tier-lb {
    --tier: var(--lb);
  }
  .gs-rank {
    font-family: var(--font-display);
    font-size: 1.9rem;
    color: var(--ink-soft);
    text-align: center;
  }
  .gs-name {
    font-family: var(--font-display);
    font-stretch: 62%;
    font-size: 2.5rem;
    line-height: 1;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: 4px; /* italic overhang */
  }
  .gs-wl {
    font-family: var(--font-display);
    font-size: 2.2rem;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .gs-diff {
    font-family: var(--font-text);
    font-weight: 700;
    font-size: 1.5rem;
    color: var(--ink-soft);
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  /* Destination chip: solid arena colour once the group is decided,
     dashed outline while it's only a projection. */
  .gs-dest {
    justify-self: end;
    font-family: var(--font-text);
    font-weight: 800;
    font-size: 1.15rem;
    padding: 3px 12px 4px;
    background: var(--tier);
    color: var(--ink);
    border: 2px solid var(--ink);
  }
  .tier-lb .gs-dest {
    color: var(--paper);
  }
  .gs-dest.projected {
    background: transparent;
    color: var(--ink-soft);
    border: 2px dashed var(--ink-soft);
  }
  .gs-fixtures {
    list-style: none;
    margin: 0;
    padding: 10px 12px 12px;
    background: #eef0f8;
    border-top: var(--outline) solid var(--ink);
  }
  /* Two groups → wide slabs: fixtures flow down one column, then the next. */
  .gs-fixtures.wide {
    columns: 2;
    column-gap: 16px;
  }
  .gs-fx {
    break-inside: avoid;
    display: grid;
    grid-template-columns: 1fr 76px 1fr;
    align-items: center;
    gap: 8px;
    padding: 3px 10px;
    font-family: var(--font-text);
    font-weight: 500;
    font-size: 1.4rem;
    line-height: 1.3;
    color: var(--ink-soft);
  }
  .gs-fx-p {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .gs-fx-p.right {
    text-align: right;
  }
  .gs-fx-mid {
    text-align: center;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .gs-fx.done {
    color: var(--ink);
  }
  .gs-fx .win {
    font-weight: 800;
  }
  .gs-fx .lose {
    color: var(--ink-soft);
  }
  .gs-fx.live {
    background: var(--red);
    color: var(--paper);
    font-weight: 700;
  }
  .gs-fx.next {
    background: var(--gold);
    color: var(--ink);
    font-weight: 700;
  }

  /* Roomy: bigger rows and type when the fixture lists are short. */
  .gs.roomy .gs-row {
    height: 74px;
  }
  .gs.roomy .gs-head h2 {
    font-size: 3rem;
  }
  .gs.roomy .gs-name {
    font-size: 3rem;
  }
  .gs.roomy .gs-wl {
    font-size: 2.6rem;
  }
  .gs.roomy .gs-rank {
    font-size: 2.2rem;
  }
  .gs.roomy .gs-fx {
    font-size: 1.65rem;
    padding: 4px 10px;
  }

  /* ── On now / Next up band (bottom of the non-match scenes) ─────── */
  .onnow {
    align-self: center;
    display: flex;
    align-items: center;
    gap: 18px;
    background: var(--ink);
    color: var(--paper);
    padding: 10px 34px 10px 0;
    clip-path: polygon(0 0, 100% 0, calc(100% - var(--cut)) 100%, 0 100%);
    font-family: var(--font-display);
    font-size: 1.9rem;
    line-height: 1;
    text-transform: uppercase;
  }
  .onnow-tag {
    font-family: var(--font-text);
    font-weight: 800;
    font-size: 1.2rem;
    text-transform: none;
    background: var(--gold);
    color: var(--ink);
    padding: 12px 18px;
    margin: -10px 0;
  }
  .onnow-tag.live {
    background: var(--red);
    color: var(--paper);
  }
  .onnow-match b {
    color: var(--gold);
    margin: 0 6px;
  }
  .onnow-match em {
    font-style: normal;
    color: var(--on-field-soft);
    margin: 0 6px;
  }
  .onnow-match.soft {
    color: var(--on-field-soft);
  }

  /* ── Mini round-robins: the group slabs, with a tier-coloured header ── */
  .rr-grid {
    grid-template-columns: repeat(auto-fit, minmax(0, 780px));
    justify-content: center;
  }
  .rr-slab .gs-cols,
  .rr-slab .gs-row {
    grid-template-columns: 44px 1fr 88px 64px 150px;
  }
  .rr-wb .gs-head {
    background: var(--green);
    color: var(--ink);
  }
  .rr-lb .gs-head {
    background: var(--red);
  }
  .rr-wb .gs-progress {
    color: var(--ink);
  }
  .rr-lb .gs-progress {
    color: var(--paper);
  }
  .rr-note {
    margin: 0;
    padding: 10px 20px 0;
    font-family: var(--font-text);
    font-weight: 600;
    font-size: 1.3rem;
    color: var(--ink-soft);
  }
  .gs-dest.rr-dest-gf {
    background: var(--ink);
    color: var(--gold);
  }
  .gs-dest.rr-dest-mb {
    background: var(--gold);
  }
  .gs-dest.rr-dest-out {
    background: #dfe3f2;
    color: var(--ink-soft);
  }
  /* Projected (round-robin not finished) beats the outcome colours above. */
  .rr-slab .gs-dest.projected {
    background: transparent;
    color: var(--ink-soft);
  }

  /* ── Match centre: anime face-off ──────────────────────────────────
     Two slanted white slabs (skewX, so the border and hard shadow survive —
     clip-path would cut them), scores facing the gold VS in the middle. */
  .mc {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 48px;
  }
  .mc-status {
    display: flex;
    align-items: center;
    gap: 22px;
    font-family: var(--font-text);
    font-size: 1.9rem;
    font-weight: 600;
  }
  .mc-tag {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-family: var(--font-display);
    text-transform: uppercase;
    font-size: 2.2rem;
    line-height: 1;
    padding: 10px 26px 12px 20px;
    clip-path: polygon(0 0, 100% 0, calc(100% - var(--cut)) 100%, 0 100%);
  }
  .mc-tag.live {
    background: var(--red);
    color: var(--paper);
  }
  .mc-tag.next,
  .mc-tag.won {
    background: var(--gold);
    color: var(--ink);
  }
  .mc-tag.result {
    background: var(--ink);
    color: var(--paper);
  }
  .mc-context {
    color: var(--paper);
  }
  .mc-ft {
    color: var(--on-field-soft);
  }

  .mc-duel {
    --tier: var(--gold);
    width: 100%;
    max-width: 1720px;
    display: grid;
    grid-template-columns: 1fr 200px 1fr;
    align-items: center;
  }
  .mc-duel.tier-wb {
    --tier: var(--wb);
  }
  .mc-duel.tier-lb {
    --tier: var(--lb);
  }
  .mc-side {
    position: relative;
    min-width: 0;
  }
  .mc-slab {
    transform: skewX(-10deg);
    background: var(--paper);
    color: var(--ink);
    border: 4px solid var(--ink);
    border-top: 16px solid var(--tier);
    box-shadow: 12px 12px 0 var(--ink);
    display: flex;
    flex-direction: column;
    padding: 26px 48px 20px;
    min-width: 0;
  }
  /* Un-skew the text so letters stay true italic, not sheared twice. */
  .mc-slab > * {
    transform: skewX(10deg);
  }
  .mc-name {
    font-family: var(--font-display);
    font-stretch: 62%;
    text-transform: uppercase;
    font-size: 7.5rem;
    line-height: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: 8px;
  }
  /* Name on top, huge score underneath pushed toward the VS. */
  .right .mc-name {
    order: -1;
    text-align: right;
  }
  .mc-score {
    font-family: var(--font-display);
    font-size: 17rem;
    line-height: 0.82;
    font-variant-numeric: tabular-nums;
    align-self: flex-end;
    padding-right: 12px;
  }
  .right .mc-score {
    align-self: flex-start;
  }
  .mc-side.lost .mc-slab {
    background: #dfe3f2;
    color: var(--ink-soft);
  }
  .mc-winner {
    position: absolute;
    bottom: -28px;
    font-family: var(--font-display);
    text-transform: uppercase;
    font-size: 1.9rem;
    line-height: 1;
    background: var(--gold);
    color: var(--ink);
    border: 3px solid var(--ink);
    padding: 8px 22px 10px;
  }
  .left .mc-winner {
    left: 40px;
  }
  .right .mc-winner {
    right: 40px;
  }
  /* Finish call-out: one gold telop slab. The big one (.fx) slams in across
     the top, then flies down and shrinks onto the pill (.mc-finish) — same
     build at two sizes, so the hand-off reads as one object. */
  .mc {
    position: relative;
  }
  .fx-wrap {
    position: absolute;
    top: -22px; /* sits in the gap above the status line, not over it */
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    z-index: 5;
    pointer-events: none;
  }
  /* .fx / .mc-finish are the boxes that move (transform is animated); the
     skewed .fx-card inside carries the slab look, text straightened back up. */
  .fx,
  .mc-finish {
    display: inline-flex;
    transform-origin: center center;
  }
  .fx {
    font-size: 8rem;
    will-change: transform, opacity;
  }
  .fx-card {
    display: inline-flex;
    align-items: stretch;
    transform: skewX(-10deg);
    background: var(--gold);
    color: var(--ink);
    border: var(--outline) solid var(--ink);
    font-family: var(--font-display);
    text-transform: uppercase;
    line-height: 1;
    white-space: nowrap;
  }
  .fx .fx-card {
    border-width: 6px;
    box-shadow: 16px 16px 0 var(--ink);
  }
  .fx-label,
  .fx-pts {
    display: grid;
    place-items: center;
  }
  /* Straighten only the letters; the blocks stay slanted with the card. */
  .fx-card b {
    display: block;
    font-weight: inherit;
    transform: skewX(10deg);
  }
  .fx-label {
    padding: 0.06em 0.34em 0.1em 0.3em;
  }
  .fx-pts {
    background: var(--red);
    color: var(--paper);
    padding: 0.06em 0.3em 0.1em;
  }
  /* Slanted ink divider between the finish and its points. */
  .fx-pts {
    border-left: var(--outline) solid var(--ink);
  }
  .fx .fx-pts {
    border-left-width: 6px;
  }
  .mc-finish {
    position: absolute;
    bottom: -30px;
    font-size: 1.9rem;
    z-index: 2;
  }
  .mc-finish .fx-card {
    box-shadow: 5px 5px 0 var(--ink);
  }
  /* Sits at the VS end of the card, under the score; the Winner chip keeps
     the outer end. */
  .left .mc-finish {
    right: 80px;
  }
  .right .mc-finish {
    left: 80px;
  }
  /* In place (for measuring) but hidden while the big call-out flies to it. */
  .mc-finish.waiting {
    opacity: 0;
  }

  /* Outlined gold VS — a text stroke, not a blur/glow filter, so it's cheap. */
  .mc-vs {
    text-align: center;
    font-family: var(--font-display);
    font-size: 8rem;
    line-height: 1;
    color: var(--gold);
    -webkit-text-stroke: 4px var(--ink);
    paint-order: stroke fill;
  }
  .empty-scene {
    color: var(--on-field-soft);
    font-size: 1.8rem;
  }

  /* ── Champion + standby: one big gold slab, the loudest thing in the app ── */
  .finale {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 22px;
  }
  .finale-kana {
    font-family: var(--font-display);
    font-size: 3rem;
    line-height: 1;
    color: var(--gold);
  }
  .big-slab {
    transform: skewX(-10deg);
    background: var(--gold);
    color: var(--ink);
    border: 5px solid var(--ink);
    box-shadow: 16px 16px 0 var(--ink);
    padding: 10px 70px 18px;
    max-width: 1500px;
  }
  .big-slab > span {
    display: block;
    transform: skewX(10deg);
    font-family: var(--font-display);
    font-stretch: 62%;
    text-transform: uppercase;
    font-size: 12rem;
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    /* The italic last letter leans past its box; pad both sides so it isn't
       clipped and the name stays centred. */
    padding-inline: 0.1em;
  }
  .champ-row {
    display: flex;
    align-items: center;
    gap: 40px;
  }
  .finale-title {
    font-family: var(--font-display);
    text-transform: uppercase;
    font-size: 4rem;
    line-height: 1;
    color: var(--paper);
    margin-top: 18px;
  }
  .finale-sub {
    font-family: var(--font-text);
    font-weight: 600;
    font-size: 2.2rem;
    color: var(--paper);
  }
  .finale-note {
    font-family: var(--font-text);
    font-weight: 500;
    font-size: 1.7rem;
    color: var(--on-field-soft);
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
    font-family: var(--font-text);
    font-weight: 700;
    font-size: 1rem;
    padding: 7px 14px;
    border-radius: 0;
    border: 2px solid var(--ink);
    background: var(--dark3);
    color: var(--paper);
    cursor: pointer;
  }
  .opbar button.active {
    background: var(--gold);
    color: var(--ink);
  }
  .opbar button:focus-visible {
    outline: 3px solid var(--gold);
    outline-offset: 2px;
  }
  .op-mode {
    font-family: var(--font-text);
    font-weight: 600;
    font-size: 1rem;
    color: var(--on-field-soft);
    margin-right: 8px;
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
