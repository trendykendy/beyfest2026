<script lang="ts">
  import { onMount, tick as svelteTick, untrack } from "svelte";
  import { invalidateAll } from "$app/navigation";
  import { liveUpdates } from "$lib/pbBrowser";
  import { EVENT, browserPbUrl } from "$lib/config";
  import { fighterFor, fighterImageUrl, fighterVictoryUrl, fighterVoiceUrl, type Face } from "$lib/fighters";
  import {
    AND,
    GRAND_CHAMPION,
    QUALIFIED,
    QUALIFIED_CALL,
    ROYALE,
    ROYALE_CHAMPION,
    STINGER,
    VERSUS,
    WINNER_SLAM,
    WINS,
    championCallFresh,
    finishClip,
    qualifiedCall,
    royaleLabelClip,
    titleClip,
    winsCall,
  } from "$lib/sounds";
  import { qualifiers, royaleView, type Battle } from "$lib/royale";
  import { Announcer } from "$lib/components/tv/announcer";
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
    tvHold,
    isLive,
    liveMatches,
    upNext,
    rrFate,
    matchContext,
    computeAwards,
    championRun,
    SCENE_TITLE,
    type PBMatch,
    type Scene,
  } from "$lib/view";
  import { stadiumOf } from "$lib/stadia";
  import BroadcastBracket from "$lib/components/tv/BroadcastBracket.svelte";
  import StadiumDraw from "$lib/components/tv/StadiumDraw.svelte";
  import VsIntro from "$lib/components/tv/VsIntro.svelte";
  import ChampionScene from "$lib/components/tv/ChampionScene.svelte";
  import WinnerScreen from "$lib/components/tv/WinnerScreen.svelte";
  import RoyaleBoard from "$lib/components/tv/RoyaleBoard.svelte";
  import RoyaleIntro from "$lib/components/tv/RoyaleIntro.svelte";
  import QualifiedScreen from "$lib/components/tv/QualifiedScreen.svelte";
  import Trophy from "$lib/components/Trophy.svelte";
  import LiveQr from "$lib/components/tv/LiveQr.svelte";

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
    awards: "アワード",
    champion: "チャンピオン",
    royale: "バトルロイヤル",
    royaleChampion: "チャンピオン",
  };

  const scenes = $derived(availableScenes(!!data.tournament, data.matches, data.royale));
  const awards = $derived(computeAwards(data.matches));
  const tournamentOver = $derived(data.matches.some((m) => m.stage === "gf" && m.matchStatus === "done"));

  // ── Which scene is on screen ────────────────────────────────────────
  // First match wins:
  //   1. a key pressed at the TV itself (holds for LOCAL_SECONDS)
  //   2. the organiser locked a scene from the admin page
  //   3. a match started or its score changed → Match centre (REACT_SECONDS)
  //   4. between stages, a held scene (tvHold: the final groups, then the
  //      new bracket until its first match starts; Champion once the grand
  //      final is done)
  //   5. auto rotation, each scene for its DWELL
  // A result doesn't cut to Match centre: the winner screen plays over
  // whatever is on (WINNER_SECONDS), then the rotation carries on.
  const DWELL: Record<Scene, number> = { standby: 60, groups: 25, rr: 20, bracket: 25, spotlight: 15, awards: 20, champion: 30, royale: 25, royaleChampion: 30 };
  const REACT_SECONDS = 20;
  const LOCAL_SECONDS = 60;
  const WINNER_SECONDS = 15;

  let now = $state(Date.now());
  let autoScene = $state<Scene>("groups");
  let autoUntil = Date.now() + DWELL.groups * 1000;
  let react = $state<{ code: string; until: number } | null>(null);
  let local = $state<{ scene: Scene; until: number } | null>(null);

  const localActive = $derived(!!local && local.until > now && scenes.includes(local.scene));
  const reacting = $derived(!!react && react.until > now && scenes.includes("spotlight"));
  const hold = $derived(tvHold(data.matches, scenes, data.royale));
  const scene = $derived.by<Scene>(() => {
    if (localActive) return local!.scene;
    if (!data.tournament) return "standby";
    if (data.tv.mode === "locked" && scenes.includes(data.tv.scene)) return data.tv.scene;
    if (reacting) return "spotlight";
    if (hold) return hold;
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

  // Watch for a match starting or its running score changing, and cut to
  // that match. A result doesn't (the winner screen has it), nor do knockout
  // slots filling in (pending → ready).
  let lastSeen = new Map<string, string>();
  let primed = false;
  $effect(() => {
    const snap = new Map(
      data.matches.map((m) => [m.code, `${m.matchStatus}|${m.liveP1}-${m.liveP2}|${m.p1Score}-${m.p2Score}|${m.startedAt}|${m.stadiumAt}`]),
    );
    if (primed) {
      let hit: PBMatch | null = null;
      for (const m of data.matches) {
        const before = lastSeen.get(m.code);
        if (before === undefined || before === snap.get(m.code)) continue;
        if (isLive(m)) hit = m;
      }
      if (hit) react = { code: hit.code, until: Date.now() + REACT_SECONDS * 1000 };
    }
    lastSeen = snap;
    primed = true;
  });

  // Locked to the Ascent look; the bracket runs left-to-right on 16:9 screens.
  const bracketOrientation = "horizontal";

  // ── Spotlight ───────────────────────────────────────────────────────
  // Live, then up next (the organiser's "Score this" pick first), then done.
  const featured = $derived.by(() => {
    const live = liveMatches(data.matches);
    const ready = upNext(data.matches, data.tv.next);
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
  const nextUp = $derived(upNext(data.matches, data.tv.next)[0] ?? null);

  // The match on the table right now (first live one), for the "On now" band.
  const onNow = $derived(liveMatches(data.matches)[0] ?? null);

  // Where the featured match sits, in plain words: "Group 2, match 4 of 6"
  // for group games, "Mid bracket semi-final" for knockout ones.
  // ── Helpers ─────────────────────────────────────────────────────────
  function sideName(m: PBMatch, which: 1 | 2): string {
    const pid = which === 1 ? m.p1 : m.p2;
    if (pid) return names.get(pid) ?? "—";
    return slotLabel(which === 1 ? m.slot1 : m.slot2, groupCount);
  }
  const rrMatchesOf = (stage: string) =>
    data.matches.filter((m) => m.stage === stage).sort((a, b) => a.orderIndex - b.orderIndex);

  // ── Finish call-out ─────────────────────────────────────────────────
  // When a round is logged, Match centre calls the finish out big across the
  // top ("KNOCKOUT +2"), then flies it down into a new pill under the scorer's
  // card. Every round won stays as a pill for the rest of the match. Undo (the
  // log shrinks) just drops the last pill — no animation. Only
  // transform/opacity animate (Pi).
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

  // Every round of the match on screen, in order. `i` is the round's place in
  // the whole log, so each side's pills can still find the newest one.
  type Round = { i: number; who: number; label: string; pts: number };
  const rounds = $derived.by(() => {
    const out: Round[] = [];
    (spotMatch?.liveLog ?? []).forEach((r, i) => {
      const f = FINISH_BY_KEY.get(r.finish);
      if (f) out.push({ i, who: r.who, label: f.label, pts: f.pts });
    });
    return out;
  });
  const lastRound = $derived(rounds[rounds.length - 1] ?? null);

  let fx = $state<{ label: string; pts: number } | null>(null);
  let fxEl = $state<HTMLElement>();
  let pillEls = $state<HTMLElement[]>([]); // by round index
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
    const pill = lastRound ? pillEls[lastRound.i] : undefined;
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
        { offset: 0, opacity: 0, transform: "translate(0, -70px) scale(1.5)", easing: "cubic-bezier(.2, .9, .3, 1.1)" },
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

  // ── Stadium draw ────────────────────────────────────────────────────
  // The server draws a stadium (on Start match, after each round that doesn't
  // win the match, and on Redraw) and stamps stadiumAt. The cut above brings
  // Match centre up on that match; once it's showing, play the draw: Start
  // match gets the launch (draw, then ゴーシュート / LET IT RIP), anything later
  // the ~3s shuffle. One of three looks, at random, never the same twice running.
  const LOOKS = ["reel", "spotlight", "spin"] as const;
  const AFTER_CALLOUT_MS = 1700; // a round's finish call-out lands first
  type Draw = { code: string; at: number; stadium: string; kind: "launch" | "next"; round: number; afterRound: boolean };
  let drawSeen = new Map<string, { at: string; rounds: number }>();
  let drawPrimed = false;
  let latestDraw = $state<Draw | null>(null);
  $effect(() => {
    for (const m of data.matches) {
      const before = drawSeen.get(m.code);
      const rounds = m.liveLog.length;
      if (drawPrimed && m.stadiumAt && m.stadium && before && before.at !== m.stadiumAt) {
        latestDraw = {
          code: m.code,
          at: Date.now(),
          stadium: m.stadium,
          kind: rounds === 0 ? "launch" : "next",
          round: rounds + 1,
          afterRound: rounds > before.rounds,
        };
      }
      drawSeen.set(m.code, { at: m.stadiumAt, rounds });
    }
    drawPrimed = true;
  });

  // The draw on screen, and the match whose stadium chip is held back until
  // it finishes (so the chip doesn't give the answer away first).
  type DrawShow = Draw & { id: string; look: (typeof LOOKS)[number] };
  let drawShow = $state<DrawShow | null>(null);
  let drawHold = $state("");
  // Start match's build-up (intro, draw, LET IT RIP) plays on a blank page:
  // the header and Match centre's own parts stay hidden until it's over.
  let blank = $state(false);
  let drawTimer: ReturnType<typeof setTimeout> | undefined;
  let lastLook = "";
  let drawn = "";

  // ── VS intro ────────────────────────────────────────────────────────
  // Start match plays the fighter intro first (VsIntro), then the launch
  // draw. Each blader's katakana and cut-out come from the fighter library,
  // matched by name; anyone not in it gets the mystery silhouette.
  type IntroFighter = { name: string; kana: string; img: string; mirror: boolean; face: Face | null };
  type IntroShow = {
    id: string;
    p1: IntroFighter;
    p2: IntroFighter;
    title: string;
    tier: ReturnType<typeof tierOf>;
    out: number; // when the banners split apart: after the announcer's last call
    then: DrawShow; // the launch draw that follows
  };
  let introShow = $state<IntroShow | null>(null);
  function introFighter(name: string): IntroFighter {
    const f = fighterFor(name, data.fighters);
    // The intro shows the combat name; players without a fighter keep their own.
    return { name: f?.name || name, kana: f?.kana ?? "", img: fighterImageUrl(browserPbUrl(), f), mirror: !!f?.mirror, face: f?.face ?? null };
  }
  function endIntro() {
    const next = introShow?.then ?? null;
    introShow = null;
    winnerShow = null; // it held under the intro until now
    if (next) drawShow = next;
  }
  // The Champion scene's fighters: the intro's combat name, katakana and
  // picture, plus the name they played under and their victory pose.
  function sceneFighter(id: string) {
    const player = names.get(id) ?? "";
    const victory = fighterVictoryUrl(browserPbUrl(), fighterFor(player, data.fighters));
    return { ...introFighter(player), player, victory };
  }
  // ── Winner screen ───────────────────────────────────────────────────
  // Every result but the grand final's (the Champion scene has that) gets the
  // winner screen (WinnerScreen) over the whole screen, started from the sound
  // effect below so it's timed with "[name] wins!". Not while the organiser
  // has locked a scene, or one was picked at the TV. It stays up for
  // WINNER_SECONDS over whatever was on, then the rotation (or a hold)
  // carries on underneath; the next match starting (a match going live that
  // wasn't live when it came up) ends it sooner, its intro playing over it.
  // Picking a scene at the TV or the Champion scene ends it at once. A
  // reload drops it (it's only seen as news).
  type WinnerShow = {
    id: string;
    winner: IntroFighter; // the cut-out, never the victory pose (the Champion scene's)
    loser: { name: string };
    score: [number, number];
    side: "red" | "blue"; // the side the winner had in the intro: p1 red, p2 blue
    title: string;
    tier: ReturnType<typeof tierOf>;
    walkover: boolean;
    live: string[]; // the matches already live when it came up (another table)
  };
  let winnerShow = $state<WinnerShow | null>(null);
  let winnerLeaving = $state(false);
  const liveKey = (m: PBMatch) => `${m.code}@${m.startedAt}`;
  let winnerTimer: ReturnType<typeof setTimeout>;
  function showWinner(m: PBMatch) {
    const p1Won = m.winner === m.p1;
    winnerLeaving = false;
    react = null; // the final point's cut to Match centre mustn't show up after it
    clearTimeout(winnerTimer);
    winnerTimer = setTimeout(() => (winnerLeaving = true), WINNER_SECONDS * 1000);
    winnerShow = {
      id: `${m.code}@${Date.now()}`,
      winner: introFighter(names.get(m.winner) ?? ""),
      loser: { name: introFighter(names.get(m.loser) ?? "").name || "—" },
      score: p1Won ? [m.p1Score ?? 0, m.p2Score ?? 0] : [m.p2Score ?? 0, m.p1Score ?? 0],
      side: p1Won ? "red" : "blue",
      title: matchContext(m, data.matches),
      tier: tierOf(m.stage),
      walkover: m.walkover,
      live: liveMatches(data.matches).map(liveKey),
    };
  }
  // The next match starting: play the exit (ondone clears it).
  $effect(() => {
    const w = winnerShow;
    if (!w || untrack(() => winnerLeaving)) return;
    if (liveMatches(data.matches).some((m) => !w.live.includes(liveKey(m)))) winnerLeaving = true;
  });
  $effect(() => {
    if (winnerShow && scene === "champion") winnerShow = null;
  });
  // Its "Up next": the fixture the TV calls next (the organiser's "Score
  // this" pick first, as the Next up strip and /live order it), live from
  // the data, so a new pick or a slot this result fills in shows straight away.
  const winnerNext = $derived(
    nextUp
      ? {
          p1: sideName(nextUp, 1),
          p2: sideName(nextUp, 2),
          title: matchContext(nextUp, data.matches),
          tier: tierOf(nextUp.stage),
        }
      : null,
  );

  const champRun = $derived(champ ? championRun(data.matches, champ) : null);
  // When this TV saw the grand final's result go in (a reload after the fact
  // never does), so the champion call is only made while it's news.
  let champBefore = "";
  let champPrimed = false;
  let champSeen = $state<{ id: string; at: number } | null>(null);
  $effect(() => {
    const c = champ;
    if (champPrimed && c && c !== champBefore) champSeen = { id: c, at: Date.now() };
    champBefore = c;
    champPrimed = true;
    if (c) announcer.preloadChampion();
    // The victory pose is full size, so fetch it before the scene needs it.
    const pose = c ? sceneFighter(c).victory : "";
    if (pose) new Image().src = pose;
  });
  // Load every fighter's cut-out ahead of time, so an intro never shows a
  // half-loaded image. (Browsers cache them; the list is at most a few dozen.)
  $effect(() => {
    for (const f of data.fighters) {
      const url = fighterImageUrl(browserPbUrl(), f);
      if (url) new Image().src = url;
    }
  });

  // ── Sound ───────────────────────────────────────────────────────────
  // The intro's announcer (name, versus, name, match title) over the match
  // music, which plays from Start match until the result is in; then each
  // round's finish, "[name] wins!" and the stinger that ends the match.
  const announcer = new Announcer();
  // The match code the music is playing for. State, so the effect below that
  // fades it out on the result re-runs once it's set.
  let musicFor = $state("");
  let soundBlocked = $state(false); // the browser wants a click first
  announcer.onblocked = () => (soundBlocked = true);
  function unlockSound() {
    if (!soundBlocked) return;
    soundBlocked = false;
    announcer.unlock();
  }
  // Load every clip the next intros could need, so each one's length is known
  // when an intro is timed and it plays on cue.
  onMount(() =>
    [...VERSUS, ...FINISHES.map((f) => finishClip(f.key)), WINS, STINGER, ROYALE, AND, QUALIFIED].forEach((u) => announcer.preload(u)),
  );
  // The admin page's TV panel sets these, live.
  $effect(() => {
    announcer.setEnabled(!data.tv.soundOff);
    announcer.setLevel(data.tv.musicLevel / 100);
  });
  $effect(() => {
    for (const f of data.fighters) announcer.preload(fighterVoiceUrl(browserPbUrl(), f));
    for (const m of data.matches) announcer.preload(titleClip(m));
  });

  // A round's finish is called as soon as it's logged, whatever is on screen:
  // the TV cuts to that match anyway, and the music plays on every scene too.
  // It doesn't wait for the call-out animation, so reduced motion still hears
  // it, and since it isn't tied to a scene the rotation can't replay it.
  let called = "";
  $effect(() => {
    const ev = latestRound;
    if (!ev) return;
    const key = `${ev.code}@${ev.at}`; // by time, so undo-then-redo calls again
    if (key === called) return;
    called = key;
    if (Date.now() - ev.at > CALLOUT_FRESH_MS) return;
    const r = data.matches.find((m) => m.code === ev.code)?.liveLog[ev.n - 1];
    if (r) announcer.call([finishClip(r.finish)]);
  });

  // A result going in: "[name] wins!" (after the finish call, if that's still
  // going), then, if the music is this match's, the stinger in its place.
  // Seen the same way as the cut to Match centre, by comparing reloads, so a
  // page load never calls an old result.
  let statusSeen = new Map<string, string>();
  let statusPrimed = false;
  $effect(() => {
    const playingFor = musicFor;
    for (const m of data.matches) {
      const before = statusSeen.get(m.code);
      statusSeen.set(m.code, m.matchStatus);
      if (!statusPrimed || before === undefined || before === "done" || m.matchStatus !== "done") continue;
      const withMusic = m.code === playingFor;
      if (withMusic) musicFor = "";
      // The grand final going straight to the Champion scene: that scene's
      // theme and "[name]… Grand Champion!" call take over the sound (and
      // fade the match music out), so no "[name] wins!" or stinger under it.
      if (m.stage === "gf" && untrack(() => scene === "champion")) continue;
      const voice = fighterVoiceUrl(browserPbUrl(), fighterFor(names.get(m.winner) ?? "", data.fighters));
      // With the winner screen, the call starts with its slam (a walkover gets
      // the screen but no call). Without it (the grand final, or a scene
      // locked by the organiser or picked at the TV), as before.
      const screen =
        !!m.winner && m.stage !== "gf" && untrack(() => !localActive && data.tv.mode !== "locked");
      announcer.endMatch(winsCall(voice, m.walkover), withMusic, screen ? WINNER_SLAM : 0);
      if (screen) showWinner(m);
    }
    statusPrimed = true;
    // The music's match has gone (a reset), or finished without being seen
    // to: just fade the music out.
    if (musicFor && !musicFor.startsWith("royale:") && !data.matches.some((x) => x.code === musicFor && x.matchStatus !== "done")) {
      musicFor = "";
      announcer.stopMusic();
    }
  });
  // Champion: the theme while the Champion scene is on screen, and the first
  // time it comes up after the result, the champion's name then "Beyfest 2026
  // Grand Champion!" (if it's still news, see CHAMPION_FRESH_MS). Only the
  // scene and the champion re-run this, so a data reload doesn't restart it.
  let champCalled = "";
  $effect(() => {
    if (scene !== "champion" || !champ) return;
    const id = champ;
    untrack(() => {
      const seen = champSeen;
      let calls: string[] = [];
      if (seen && seen.id === id && `${seen.id}@${seen.at}` !== champCalled) {
        champCalled = `${seen.id}@${seen.at}`; // the first showing: now or never
        if (championCallFresh(seen.at, Date.now())) {
          const voice = fighterVoiceUrl(browserPbUrl(), fighterFor(names.get(id) ?? "", data.fighters));
          calls = [voice, GRAND_CHAMPION];
        }
      }
      announcer.startChampion(calls);
    });
    return () => announcer.stopChampion();
  });

  // ── Battle royale ───────────────────────────────────────────────────
  // After the main event (lib/royale.ts). Start on the admin page plays the
  // battle's intro over the match music ("Battle royale!", then its name);
  // a heat or sudden death result gets the Qualified screen (even with a
  // scene locked), "[A] and [B]… qualified!" and the stinger. The final's
  // result brings up the battle royale champion scene (held), with the
  // champion theme and the champion's call.
  const royale = $derived(data.royale ? royaleView(data.royale) : null);
  const royaleChamp = $derived(royale?.champion ?? "");
  const royaleRunnerUp = $derived(royale?.runnerUp ?? "");
  type RoyaleIntroShow = { id: string; fighters: IntroFighter[]; label: string; out: number };
  let royaleIntro = $state<RoyaleIntroShow | null>(null);
  // The champion scene's fighters by name (battle royale entrants needn't be
  // tournament players): combat name, katakana, picture and victory pose.
  function royaleSceneFighter(name: string) {
    return { ...introFighter(name), player: name, victory: fighterVictoryUrl(browserPbUrl(), fighterFor(name, data.fighters)) };
  }

  function startRoyaleIntro(b: Battle) {
    if (Date.now() - Date.parse(b.result.startedAt ?? "") > CALLOUT_FRESH_MS) return; // old news
    if (qualifiedShow) qualifiedLeaving = true; // the next battle's build-up takes over
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const out = announcer.intro([ROYALE, royaleLabelClip(b.key)]);
    musicFor = `royale:${b.key}`;
    royaleIntro = { id: `${b.key}@${b.result.startedAt}`, fighters: b.entrants.map(introFighter), label: b.label, out };
  }

  // The Qualified screen, after a heat or the sudden death: who's through to
  // the final. Held like the winner screen: until the next battle starts or
  // WINNER_SECONDS is up.
  type QualifiedShow = { id: string; fighters: IntroFighter[]; label: string; toSudden: string };
  let qualifiedShow = $state<QualifiedShow | null>(null);
  let qualifiedLeaving = $state(false);
  let qualifiedTimer: ReturnType<typeof setTimeout>;

  function royaleResult(b: Battle) {
    const withMusic = musicFor === `royale:${b.key}`;
    if (withMusic) musicFor = "";
    royaleIntro = null;
    // The final: the champion scene (held) has the sound from here.
    if (b.kind === "final") {
      royaleChampSeen = { name: b.result.winner ?? "", at: Date.now() };
      return;
    }
    const { through, toSudden } = qualifiers(royale!.plan, b);
    const voices = through.map((name) => fighterVoiceUrl(browserPbUrl(), fighterFor(name, data.fighters)));
    // Unlike a match, a scene locked from the admin page doesn't stop it: the
    // board is the only thing worth locking to now, and the result belongs over it.
    const screen = !localActive;
    announcer.endMatch(qualifiedCall(voices), withMusic, screen ? QUALIFIED_CALL : 0);
    if (!screen) return;
    if (winnerShow) winnerShow = null;
    qualifiedLeaving = false;
    react = null;
    clearTimeout(qualifiedTimer);
    qualifiedTimer = setTimeout(() => (qualifiedLeaving = true), WINNER_SECONDS * 1000);
    qualifiedShow = {
      id: `${b.key}@${Date.now()}`,
      fighters: through.map(introFighter),
      label: b.label,
      toSudden: toSudden ? introFighter(toSudden).name : "",
    };
  }

  // Seen by comparing reloads, like the match results, so a page load never
  // replays an old start or result.
  let royaleSeen = new Map<string, string>();
  $effect(() => {
    const battles = royale?.battles ?? [];
    untrack(() => {
      for (const b of battles) {
        const was = royaleSeen.get(b.key);
        const is = `${b.status}|${b.result.startedAt ?? ""}|${b.result.resultAt ?? ""}`;
        royaleSeen.set(b.key, is);
        if (was === undefined || was === is) continue;
        if (b.status === "live" && !was.startsWith("live")) startRoyaleIntro(b);
        else if (b.status === "done" && !was.startsWith("done")) royaleResult(b);
        else if (b.status === "ready" && was.startsWith("live") && musicFor === `royale:${b.key}`) {
          // Start cancelled: no music for a battle that isn't on.
          musicFor = "";
          royaleIntro = null;
          announcer.stopMusic();
        }
      }
    });
  });

  // The battle royale champion scene: the theme while it's up, and the
  // first time after the final's result, the champion's name then "Battle
  // royale champion!" (while it's news, as for the main champion).
  let royaleChampSeen = $state<{ name: string; at: number } | null>(null);
  let royaleChampCalled = "";
  $effect(() => {
    if (scene !== "royaleChampion" || !royaleChamp) return;
    const name = royaleChamp;
    untrack(() => {
      const seen = royaleChampSeen;
      let calls: string[] = [];
      if (seen && seen.name === name && `${seen.name}@${seen.at}` !== royaleChampCalled) {
        royaleChampCalled = `${seen.name}@${seen.at}`;
        if (championCallFresh(seen.at, Date.now())) {
          calls = [fighterVoiceUrl(browserPbUrl(), fighterFor(name, data.fighters)), ROYALE_CHAMPION];
        }
      }
      winnerShow = null;
      qualifiedShow = null;
      announcer.startChampion(calls);
    });
    return () => announcer.stopChampion();
  });

  // The Pi gets the lite intro (no blur or drop-shadow filters): its Chromium
  // reports an ARM Linux machine. ?fx=full or ?fx=lite on the TV URL overrides.
  let fxLite = $state(false);
  let mounted = $state(false); // running in the browser
  onMount(() => {
    const fx = new URLSearchParams(location.search).get("fx");
    fxLite = fx ? fx === "lite" : /aarch64|armv7|armv8/i.test(navigator.userAgent);
    mounted = true;
  });

  function endDraw() {
    clearTimeout(drawTimer);
    drawShow = null;
    introShow = null;
    drawHold = "";
    blank = false;
  }
  $effect(() => {
    const ev = latestDraw;
    if (!ev || scene !== "spotlight" || spotMatch?.code !== ev.code) return;
    const key = `${ev.code}@${ev.at}`;
    if (key === drawn) return;
    drawn = key;
    if (Date.now() - ev.at > CALLOUT_FRESH_MS) return; // stale by the time it showed
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; // chip only
    const pool = LOOKS.filter((l) => l !== lastLook);
    const look = pool[Math.floor(Math.random() * pool.length)];
    lastLook = look;
    endDraw();
    if (winnerShow) winnerLeaving = true; // a new match's build-up takes over
    drawHold = ev.code;
    blank = ev.kind === "launch";
    const show: DrawShow = { ...ev, id: key, look };
    const m = spotMatch;
    drawTimer = setTimeout(
      () => {
        if (ev.kind !== "launch") return void (drawShow = show);
        const voice = (side: 1 | 2) => fighterVoiceUrl(browserPbUrl(), fighterFor(sideName(m, side), data.fighters));
        const out = announcer.intro([voice(1), announcer.nextVersus(), voice(2), titleClip(m)]);
        musicFor = m.code;
        introShow = {
          id: key,
          p1: introFighter(sideName(m, 1)),
          p2: introFighter(sideName(m, 2)),
          title: matchContext(m, data.matches),
          tier: tierOf(m.stage),
          out,
          then: show,
        };
      },
      ev.afterRound ? AFTER_CALLOUT_MS : 0,
    );
  });
  // Moving off the match (or off Match centre) drops a draw in progress.
  $effect(() => {
    if (drawHold && (scene !== "spotlight" || spotMatch?.code !== drawHold)) endDraw();
  });

  // The phone page's QR in the corner: not on Standby (it has a big one),
  // Champion, or while the intro / stadium draw / blank build-up is on.
  const cornerQr = $derived(
    scene !== "standby" &&
      scene !== "champion" &&
      scene !== "royaleChampion" &&
      !introShow &&
      !royaleIntro &&
      !drawShow &&
      !blank &&
      !winnerShow &&
      !qualifiedShow,
  );

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
    winnerShow = null;
    qualifiedShow = null;
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
    if (hold === "royale") return "Holding on the battle royale";
    if (hold === "royaleChampion") return "Holding on the battle royale champion";
    if (hold === "champion") return "Holding on the champion: the tournament is over";
    if (hold === "groups") return "Holding on the groups until the bracket is generated";
    if (hold) return "Holding on the bracket until the first match starts";
    return "Auto rotation";
  });

  // False while the realtime connection is down; shows a small corner mark so
  // the operator knows the screen may be behind (it catches up on reconnect).
  let online = $state(true);

  onMount(() => {
    poke();
    const stopLive = liveUpdates(["tournaments", "groups", "players", "matches", "tv_state", "fighters", "royales"], () => invalidateAll(), {
      onStatus: (up) => (online = up),
      everyMs: 30_000,
    });
    const clock = setInterval(tick, 1000);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousemove", poke);
    // Any click or key press at the TV counts as allowing sound.
    window.addEventListener("pointerdown", unlockSound);
    window.addEventListener("keydown", unlockSound);
    return () => {
      stopLive();
      clearInterval(clock);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousemove", poke);
      window.removeEventListener("pointerdown", unlockSound);
      window.removeEventListener("keydown", unlockSound);
      announcer.setEnabled(false);
      clearTimeout(hideTimer);
    };
  });
</script>

<div class="tv" class:cursor-hide={!barVisible} class:bar-open={barVisible} class:blank class:qr-corner={cornerQr}>
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
      <div class="standby">
      <div class="finale">
        <div class="finale-kana" lang="ja">ベイフェスト</div>
        <div class="big-slab"><span>Beyfest 2026</span></div>
        <div class="finale-title">Triple Threat</div>
        <div class="finale-sub">{EVENT.date}, {EVENT.place}</div>
        <div class="finale-note">The groups are drawn once everyone has checked in.</div>
        {#if data.network}
          {@const n = data.network}
          <!-- Only on the Raspberry Pi: how to reach the app on the day. -->
          <div class="join">
            <span class="join-step"><span>
              {#if n.mode === "ethernet"}On the venue network{:else}Join wifi <b>{n.ssid}</b>{/if}
            </span></span>
            <span class="join-step"><span>Live results <b>{n.host}</b>{#if n.ip}<span class="join-ip">({n.ip})</span>{/if}</span></span>
            <span class="join-step"><span>Organiser <b>{n.host}/admin</b></span></span>
          </div>
        {/if}
      </div>
      <!-- Beside the title, not under it: the column is already tall at 1080p. -->
      <div class="live-card">
        <div class="live-card-head"><span>Live results on your phone</span></div>
        <LiveQr size={data.liveQr.size} path={data.liveQr.path} px={260} />
        <div class="live-card-url">{data.liveQr.url.replace(/^https?:\/\//, "")}</div>
      </div>
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
                <span></span><span></span><span>W–L</span><span>Point diff.</span><span>Goes to</span>
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
                      {#if st === "done"}{m.walkover ? "W/O" : `${m.p1Score}–${m.p2Score}`}
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
                  <span></span><span></span><span>W–L</span><span>Point diff.</span><span>Goes to</span>
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
                        {#if st === "done"}{m.walkover ? "W/O" : `${m.p1Score}–${m.p2Score}`}
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
      <!-- Under each card: the Winner chip at the outer end, then one pill per
           round this side has won, oldest first. Kept on the Result too, as a recap. -->
      {#snippet sideFoot(who: number, won: boolean, showPills: boolean)}
        {@const mine = showPills ? rounds.filter((r) => r.who === who) : []}
        {#if won || mine.length}
          <div class="mc-finishes" class:compact={mine.length > 4} class:tiny={mine.length > 7}>
            {#if won}<span class="mc-winner">Winner</span>{/if}
            {#each mine as r (r.i)}
              <span class="mc-finish" class:waiting={fx && r.i === lastRound?.i} bind:this={pillEls[r.i]}>
                <span class="fx-card"><span class="fx-label"><b>{r.label}</b></span><span class="fx-pts"><b>+{r.pts}</b></span></span>
              </span>
            {/each}
          </div>
        {/if}
      {/snippet}
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
          {@const walkover = done && spotMatch.walkover}
          {@const showScore = (done && !walkover) || live}
          <div class="mc-status">
            {#if walkover}<span class="mc-tag result">Walkover</span>
            {:else if done}<span class="mc-tag result">Result</span>
            {:else if decided}<span class="mc-tag won"><Trophy /> Match won</span>
            {:else if live}<span class="mc-tag live">Live</span>
            {:else}<span class="mc-tag next">Up next</span>{/if}
            <span class="mc-context">{matchContext(spotMatch, data.matches)}</span>
            <!-- This round's stadium, held back while its draw is playing. -->
            {#if live && !decided && drawHold !== spotMatch.code && stadiumOf(spotMatch.stadium)}
              {@const st = stadiumOf(spotMatch.stadium)!}
              {#key spotMatch.stadiumAt}
                <span class="mc-stadium" data-stadium={st.key}>
                  <span class="rd"><b>Round {spotMatch.liveLog.length + 1}</b></span>
                  <span class="num"><b>{st.num}</b></span>
                  <span><b>{st.name}</b></span>
                </span>
              {/key}
            {/if}
            <!-- The finish call-out hangs above this line (see .fx-wrap). -->
            {#if fx}
              <div class="fx-wrap" aria-hidden="true">
                <div class="fx" bind:this={fxEl}>
                  <span class="fx-card"><span class="fx-label"><b>{fx.label}</b></span><span class="fx-pts"><b>+{fx.pts}</b></span></span>
                </div>
              </div>
            {/if}
          </div>


          {#if drawShow}
            {#key drawShow.id}
              <StadiumDraw
                stadium={drawShow.stadium}
                kind={drawShow.kind}
                round={drawShow.round}
                look={drawShow.look}
                ondone={endDraw}
              />
            {/key}
          {/if}

          <div class="mc-duel tier-{tierOf(spotMatch.stage)}">
            <div class="mc-side left" class:won={wonA} class:lost={wonB}>
              <div class="mc-slab">
                <div class="mc-name">{sideName(spotMatch, 1)}</div>
                <div class="mc-score">{showScore ? av : "–"}</div>
              </div>
              {@render sideFoot(1, wonA, true)}
            </div>
            <div class="mc-mid">
              <div class="mc-vs" aria-label="versus">VS</div>
              <!-- The target, between the two scores it's read against. -->
              <div class="mc-ft">First to <b>{t}</b></div>
            </div>
            <div class="mc-side right" class:won={wonB} class:lost={wonA}>
              <div class="mc-slab">
                <div class="mc-score">{showScore ? bv : "–"}</div>
                <div class="mc-name">{sideName(spotMatch, 2)}</div>
              </div>
              {@render sideFoot(2, wonB, true)}
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

    {:else if scene === "awards"}
      <!-- Built from how every round was won. "So far" until the grand final. -->
      <div class="aw">
        <div class="aw-grid">
          {#each awards as a (a.key)}
            <section class="aw-card aw-{a.key}">
              <header class="aw-title">{a.title}</header>
              <div class="aw-name">{a.winners.map((id) => names.get(id)).join(" & ")}</div>
              <div class="aw-detail">{a.opponent ? `${a.detail} against ${names.get(a.opponent)}` : a.detail}</div>
            </section>
          {/each}
        </div>
        {#if !tournamentOver}<p class="aw-note">Awards so far. They're settled after the grand final.</p>{/if}
      </div>

    {:else if scene === "champion"}
      <!-- Browser only: the picture's address and the Pi's lite mode are
           worked out from the browser, and the reveal plays on mount anyway. -->
      {#if champ && champRun && mounted}
        <ChampionScene
          champion={sceneFighter(champ)}
          runnerUp={champRun.final ? sceneFighter(champRun.final.opponent) : null}
          run={champRun}
          awards={awards.map((a) => ({
            key: a.key,
            title: a.title,
            name: a.winners.map((id) => names.get(id)).join(" & "),
            detail: a.opponent ? `${a.detail} against ${names.get(a.opponent)}` : a.detail,
          }))}
          lite={fxLite}
        />
      {/if}

    {:else if scene === "royale"}
      {#if data.royale && mounted}
        <RoyaleBoard royale={data.royale} fighter={introFighter} />
      {/if}

    {:else if scene === "royaleChampion"}
      {#if royaleChamp && mounted}
        <ChampionScene
          champion={royaleSceneFighter(royaleChamp)}
          runnerUp={royaleRunnerUp ? royaleSceneFighter(royaleRunnerUp) : null}
          kicker="Battle royale champion"
          lite={fxLite}
        />
      {/if}
    {/if}
  </main>

  <!-- The winner screen covers the whole screen after a result, and holds
       until the next match starts; that match's intro plays over it. -->
  {#if winnerShow}
    {#key winnerShow.id}
      <div class="intro-layer">
        <WinnerScreen
          winner={winnerShow.winner}
          loser={winnerShow.loser}
          score={winnerShow.score}
          side={winnerShow.side}
          title={winnerShow.title}
          tier={winnerShow.tier}
          walkover={winnerShow.walkover}
          leaving={winnerLeaving}
          next={winnerNext}
          lite={fxLite}
          ondone={() => (winnerShow = null)}
        />
      </div>
    {/key}
  {/if}

  <!-- The battle royale's Qualified screen, after a heat or the sudden death. -->
  {#if qualifiedShow}
    {#key qualifiedShow.id}
      <div class="intro-layer">
        <QualifiedScreen
          fighters={qualifiedShow.fighters}
          label={qualifiedShow.label}
          toSudden={qualifiedShow.toSudden}
          leaving={qualifiedLeaving}
          lite={fxLite}
          ondone={() => (qualifiedShow = null)}
        />
      </div>
    {/key}
  {/if}

  <!-- The VS intro covers the whole screen (header and all) before a launch. -->
  {#if introShow}
    {#key introShow.id}
      <div class="intro-layer">
        <VsIntro
          p1={introShow.p1}
          p2={introShow.p2}
          title={introShow.title}
          tier={introShow.tier}
          out={introShow.out}
          lite={fxLite}
          ondone={endIntro}
        />
      </div>
    {/key}
  {/if}

  <!-- The battle royale's intro: everyone in the battle, over everything. -->
  {#if royaleIntro}
    {#key royaleIntro.id}
      <div class="intro-layer">
        <RoyaleIntro
          fighters={royaleIntro.fighters}
          label={royaleIntro.label}
          out={royaleIntro.out}
          lite={fxLite}
          ondone={() => {
            royaleIntro = null;
            qualifiedShow = null; // it held under the intro until now
          }}
        />
      </div>
    {/key}
  {/if}

  <!-- Small, fixed and static: the phone page's QR for the busy scenes. -->
  {#if cornerQr}
    <div class="corner-qr" class:lifted={soundBlocked}>
      <span>Scan for<br />live results</span>
      <LiveQr size={data.liveQr.size} path={data.liveQr.path} px={100} />
    </div>
  {/if}

  <!-- Small and in the corner: for the operator, not the room. -->
  {#if !online}<div class="offline" role="status">Reconnecting</div>{/if}
  {#if soundBlocked}
    <button class="offline sound" onclick={unlockSound}>Sound is blocked: click to allow</button>
  {/if}

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

  .intro-layer {
    position: absolute;
    inset: 0;
    z-index: 40;
  }
  /* Blank page for Start match's build-up. Hidden by opacity, so the layout
     (and the draw's place in it) doesn't move; gone at once, back with a fade
     once LET IT RIP has folded away. */
  .strip,
  .mc-status,
  .mc-duel,
  .onnow {
    transition: opacity 0.3s ease-out;
  }
  .tv.blank .strip,
  .tv.blank .mc-status,
  .tv.blank .mc-duel,
  .tv.blank .onnow {
    opacity: 0;
    transition: none;
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
    /* "Point diff." wraps to two lines in its narrow column; keep every
       header sitting on the same bottom line. */
    align-items: end;
    line-height: 1.05;
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
    position: relative; /* for the call-out above it */
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

  .mc-duel {
    --tier: var(--gold);
    width: 100%;
    max-width: 1720px;
    display: grid;
    grid-template-columns: 1fr 200px 1fr;
    align-items: center;
    /* Room below the cards for two rows of finish pills, always reserved so
       the band underneath doesn't jump when a second row appears. */
    padding-bottom: 72px;
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
    font-family: var(--font-display);
    text-transform: uppercase;
    font-size: 1.9rem;
    line-height: 1;
    background: var(--gold);
    color: var(--ink);
    border: 3px solid var(--ink);
    padding: 8px 22px 10px;
  }
  /* First in the row and pushed to the card's outer end; the pills take the
     rest of the row. */
  .left .mc-winner {
    order: -1;
    margin-right: auto;
  }
  .right .mc-winner {
    order: 1;
    margin-left: auto;
  }
  /* Finish call-out: one gold telop slab. The big one (.fx) slams in across
     the top, then flies down and shrinks onto the pill (.mc-finish) — same
     build at two sizes, so the hand-off reads as one object. */
  .mc {
    position: relative;
  }
  .fx-wrap {
    position: absolute;
    /* Hangs above the status line it sits in, bottom-anchored and clear of
       it by the slab's 16px shadow plus 8px, so neither the slam-in nor the
       hold ever covers LIVE. */
    bottom: calc(100% + 24px);
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
    font-size: 6.75rem; /* fits the 152px between the header and the status line */
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
  /* The row straddles the card's bottom edge: pills gather at the VS end,
     under the score, and wrap downward as rounds pile up. It's absolutely
     placed (in room .mc-duel reserves) so a new row never nudges anything. */
  .mc-finishes {
    position: absolute;
    top: calc(100% - 26px);
    left: 40px;
    right: 80px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 14px;
    justify-content: flex-end;
    font-size: 1.9rem;
    z-index: 2;
  }
  .right .mc-finishes {
    left: 80px;
    right: 40px;
    justify-content: flex-start;
  }
  /* A long match (up to 9 rounds a side in the grand final) steps down in
     size so it stays within two rows. */
  .mc-finishes.compact {
    font-size: 1.45rem;
    gap: 10px;
  }
  .mc-finishes.tiny {
    font-size: 1.2rem;
    gap: 8px;
  }
  .mc-finish .fx-card {
    box-shadow: 5px 5px 0 var(--ink);
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
  .mc-mid {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
  }
  /* Black telop slab under the VS: "FIRST TO" in white, the number in gold. */
  .mc-ft {
    font-family: var(--font-display);
    text-transform: uppercase;
    font-size: 1.7rem;
    line-height: 1;
    white-space: nowrap;
    background: var(--ink);
    color: var(--paper);
    padding: 8px 14px 10px;
  }
  .mc-ft b {
    color: var(--gold);
    font-size: 2.3rem;
    margin-left: 4px;
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
  /* Standby only, on the Pi: which wifi to join and where to go. */
  .join {
    display: flex;
    gap: 18px;
    margin-top: 10px;
  }
  .join-step {
    background: var(--ink);
    color: var(--paper);
    border: 3px solid var(--paper);
    padding: 8px 22px;
    font-family: var(--font-text);
    font-weight: 500;
    font-size: 1.6rem;
    transform: skewX(-10deg);
  }
  .join-step > span {
    display: block;
    transform: skewX(10deg);
  }
  .join-step b {
    color: var(--gold);
    font-weight: 800;
  }
  .join-ip {
    color: var(--on-field-soft);
    margin-left: 0.4em;
  }
  /* Standby: the title column with the phone-page QR card beside it. */
  .standby {
    display: flex;
    align-items: center;
    gap: 70px;
  }
  .live-card {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }
  .live-card-head {
    background: var(--ink);
    color: var(--paper);
    border: 3px solid var(--paper);
    padding: 8px 22px;
    font-family: var(--font-text);
    font-weight: 700;
    font-size: 1.5rem;
    transform: skewX(-10deg);
  }
  .live-card-head > span {
    display: block;
    transform: skewX(10deg);
  }
  .live-card :global(svg) {
    border: 5px solid var(--ink);
    box-shadow: 12px 12px 0 var(--ink);
  }
  .live-card-url {
    margin-top: 8px;
    font-family: var(--font-text);
    font-weight: 800;
    font-size: 1.6rem;
    color: var(--gold);
  }

  /* Corner QR on the other scenes. Below the intro (40) and the operator's
     marks (60); fixed, no animation, so it costs the Pi nothing. */
  .corner-qr {
    position: fixed;
    right: 14px;
    bottom: 14px;
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--ink);
    padding: 6px 6px 6px 12px;
  }
  /* Caption beside the code, not under it: the card stays short enough to sit
     below the group slabs, level with the "On now" strip. */
  .corner-qr span {
    font-family: var(--font-text);
    font-weight: 700;
    font-size: 1rem;
    line-height: 1.2;
    text-align: right;
    color: var(--paper);
  }
  /* Clear of the "sound is blocked" button and the operator bar, which share
     this corner. The button sits on top of the bar, so above the bar clears
     both. */
  .corner-qr.lifted {
    bottom: 50px;
  }
  .tv.bar-open .corner-qr {
    bottom: 76px;
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
  .offline {
    position: fixed;
    left: 14px;
    bottom: 14px;
    z-index: 60;
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-text);
    font-weight: 700;
    font-size: 0.9rem;
    color: var(--paper);
    background: var(--ink);
    padding: 4px 10px 4px 8px;
  }
  .offline::before {
    content: "";
    width: 10px;
    height: 10px;
    background: var(--red);
  }
  .offline.sound {
    left: auto;
    right: 14px;
    border: 0;
    cursor: pointer;
  }
  .offline.sound::before {
    background: var(--gold);
  }
  /* Awards: four gold telop slabs, black title bar on each. */
  .aw {
    width: 100%;
    max-width: 1640px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 34px;
  }
  .aw-grid {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px 48px;
  }
  .aw-card {
    background: var(--gold);
    color: var(--ink);
    border: 5px solid var(--ink);
    box-shadow: 12px 12px 0 var(--ink);
    min-width: 0;
  }
  /* An odd one out sits centred on its own row. */
  .aw-card:last-child:nth-child(odd) {
    grid-column: 1 / -1;
    justify-self: center;
    width: calc(50% - 24px);
  }
  .aw-title {
    font-family: var(--font-display);
    text-transform: uppercase;
    font-size: 2.2rem;
    line-height: 1;
    background: var(--ink);
    color: var(--gold);
    padding: 10px 24px 12px;
  }
  .aw-name {
    font-family: var(--font-display);
    font-stretch: 62%;
    text-transform: uppercase;
    font-size: 6rem;
    line-height: 1;
    padding: 18px 24px 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: 0.3em; /* italic overhang */
  }
  .aw-detail {
    font-family: var(--font-text);
    font-weight: 700;
    font-size: 1.9rem;
    padding: 0 24px 18px;
  }
  .aw-note {
    color: var(--on-field-soft);
    font-size: 1.6rem;
  }
  /* This round's stadium, in the status line: round tag, numeral block in the
     stadium's colour, name. Pops in when a draw lands (it's keyed on the draw). */
  .mc-stadium {
    display: inline-flex;
    align-items: stretch;
    font-family: var(--font-display);
    text-transform: uppercase;
    font-size: 2.2rem;
    line-height: 1;
    transform: skewX(-10deg);
    background: var(--paper);
    color: var(--ink);
    border: var(--outline) solid var(--ink);
    box-shadow: 6px 6px 0 var(--st);
    animation: chip-pop 320ms cubic-bezier(0.2, 0.9, 0.3, 1.4);
  }
  .mc-stadium > span {
    display: grid;
    place-items: center;
    padding: 8px 18px 10px;
  }
  .mc-stadium b {
    display: block;
    font-weight: inherit;
    transform: skewX(10deg);
    padding-right: 0.12em; /* italic overhang */
  }
  .mc-stadium .rd {
    background: var(--ink);
    color: var(--paper);
    font-family: var(--font-text);
    font-weight: 700;
    font-stretch: 75%;
    letter-spacing: 0.12em;
    font-size: 1.5rem;
  }
  .mc-stadium .num {
    background: var(--st);
    color: var(--st-ink);
    border-right: var(--outline) solid var(--ink);
    min-width: 2.2em;
  }
  @keyframes chip-pop {
    from {
      transform: skewX(-10deg) scale(1.25);
    }
    to {
      transform: skewX(-10deg) scale(1);
    }
  }
</style>
