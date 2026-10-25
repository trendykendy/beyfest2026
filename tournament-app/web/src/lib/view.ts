import { computeStandings, type Match, type Slot, type Stage, type StandingRow } from "@beyfest/engine";

// Plain shapes as they arrive from PocketBase (superset of engine fields).
export interface PBPlayer {
  id: string;
  name: string;
  groupIndex: number | null;
  drawOrder: number | null;
  finalGroupRank: number | null;
  withdrawn: boolean; // left the tournament; their playable matches are walked over
}
export interface PBGroup {
  id: string;
  index: number;
  name: string;
  size: number;
  format: "single" | "double";
  complete: boolean;
}
export interface PBMatch {
  id: string;
  stage: Stage;
  code: string;
  roundLabel: string;
  orderIndex: number;
  groupIndex: number | null;
  slot1: Slot | null;
  slot2: Slot | null;
  p1: string;
  p2: string;
  p1Score: number | null;
  p2Score: number | null;
  liveP1: number; // running score while a match is in progress (0 when not started)
  liveP2: number;
  liveLog: LiveRound[]; // how each round was won, oldest first; kept once done (may be empty for old or corrected results)
  resultAt: string; // when the result was recorded/corrected (ISO), "" if not played
  startedAt: string; // when the organiser pressed Start match (ISO), "" if not
  stadium: string; // stadium key for the round about to be played (see stadia.ts), "" if none drawn
  stadiumAt: string; // when that stadium was drawn (ISO); a change cues the TV's draw animation
  walkover: boolean; // a no-show: stored as target–0, but a win with no points in the tables; shown as "W/O"
  winner: string;
  loser: string;
  matchStatus: "pending" | "ready" | "done";
}

// One round of a match in progress, as logged by the admin scorer.
export interface LiveRound {
  who: 1 | 2;
  finish: string; // a key from FINISHES ("spin" | "knockout" | "dominant")
  stadium?: string; // where the round was played (a key from STADIA); missing on older logs
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// The tier a stage belongs to, for colour-coding.
export function tierOf(stage: Stage): "wb" | "mb" | "lb" | "gf" | "group" {
  if (stage === "wb_rr" || stage === "wb" || stage === "ub") return "wb";
  if (stage === "lb_rr" || stage === "lb") return "lb";
  if (stage === "mb") return "mb";
  if (stage === "gf") return "gf";
  return "group";
}

// Plain-words round name for screens, from the engine's internal label:
// "Phase 4 — MB R2" → "Mid bracket round 2", "Phase 7 — Grand Final" → "Grand final".
export function roundName(roundLabel: string): string {
  let s = roundLabel.replace(/^Phase \w+ — /, "");
  if (s === "WB SF Losers Playoff") return "Winners 3rd-place play-off";
  s = s
    // 8 players (double elimination): "Upper Bracket — Quarterfinals" → "Upper bracket quarter-finals"
    .replace(/^(Upper|Lower) Bracket — /, "$1 bracket ")
    .replace(/\bQuarterfinals\b/, "quarter-finals")
    .replace(/\bSemifinals\b/, "semi-finals")
    .replace(/\bSemifinal\b/, "semi-final")
    .replace(/\bWB\b/, "Winners")
    .replace(/\bMB\b/, "Mid bracket")
    .replace(/\bLB\b/, "Losers")
    .replace(/\bMini-RR\b/, "mini round-robin")
    .replace(/\bR(\d)\b/, "round $1")
    .replace(/\bRound\b/, "round")
    .replace(/\bSemis\b/, "semi-finals")
    .replace(/\b(Semi|SF)\b/, "semi-final")
    .replace(/\bQuarters\b/, "quarter-finals")
    .replace(/\bFinal\b/, "final")
    .replace(/\bMatch\b/, "match");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// A match is live once it's playable and has been started or scored.
export const isLive = (m: PBMatch) =>
  m.matchStatus === "ready" && (m.liveP1 > 0 || m.liveP2 > 0 || !!m.startedAt);

// Where a match sits, in words: "Group 3, match 2 of 6" or "Mid bracket round 2".
export function matchContext(m: PBMatch, matches: PBMatch[]): string {
  if (m.stage !== "group") return roundName(m.roundLabel);
  const list = matches
    .filter((x) => x.stage === "group" && x.groupIndex === m.groupIndex)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const n = list.findIndex((x) => x.code === m.code) + 1;
  return `${m.roundLabel}, match ${n} of ${list.length}`;
}

// Group sizes in words: [4, 4, 4] → "3 groups of 4", [5, 4, 4] → "1 group of 5 and 2 of 4".
export function groupsInWords(sizes: number[]): string {
  const counts = new Map<number, number>();
  for (const n of sizes) counts.set(n, (counts.get(n) ?? 0) + 1);
  const parts = [...counts].sort((a, b) => b[0] - a[0]);
  return parts
    .map(([size, count], i) => (i === 0 ? `${count} group${count === 1 ? "" : "s"} of ${size}` : `${count} of ${size}`))
    .join(" and ");
}

// Human label for an unresolved participant slot (shown until a real player
// lands in it), e.g. "Group 1 winner", "Winner of MB1", "WB-2nd".
export function slotLabel(slot: Slot | null, groupCount: number): string {
  if (!slot) return "TBD";
  switch (slot.k) {
    case "groupRank": {
      const g = `Group ${slot.group + 1}`;
      if (slot.rank === 1) return `${g} winner`;
      return `${g} ${ordinal(slot.rank)}`;
    }
    case "seed":
      return `Seed ${slot.n}`;
    case "winner":
      return `Winner of ${slot.match}`;
    case "loser":
      return `Loser of ${slot.match}`;
    case "rrRank": {
      // Placement in a mini round-robin, in words people can read off a TV.
      const rr = slot.stage === "wb_rr" ? "Winners round-robin" : "Losers round-robin";
      return slot.rank === 1 ? `${rr} winner` : `${rr} ${ordinal(slot.rank)}`;
    }
    case "poolDraw":
      return "Drawn from group middles";
  }
}

// Where a group finisher goes in the knockout, for the colour-coded chips on
// group cards. Mirrors the engine's routing.
export function destinationOf(
  rank: number,
  groupSize: number,
  knockoutType: string,
): { tier: "wb" | "mb" | "lb"; label: string } {
  if (knockoutType === "double-elim") return { tier: "wb", label: "Seeded" };
  if (knockoutType === "three-tier-4wb") {
    if (rank <= 2) return { tier: "wb", label: "Winners" };
    if (rank === groupSize) return { tier: "lb", label: "Losers" };
    return { tier: "mb", label: "Mid" };
  }
  if (rank === 1) return { tier: "wb", label: "Winners" };
  if (rank === groupSize) return { tier: "lb", label: "Losers" };
  return { tier: "mb", label: "Mid" };
}

export const STATUS_ORDER: Record<string, number> = { ready: 0, pending: 1, done: 2 };

// Adapt a PocketBase match to the engine's Match shape (for computeStandings).
function toEngineMatch(m: PBMatch): Match {
  return {
    code: m.code,
    stage: m.stage,
    roundLabel: m.roundLabel,
    orderIndex: m.orderIndex,
    group: m.groupIndex,
    slot1: m.slot1,
    slot2: m.slot2,
    p1: m.p1 || null,
    p2: m.p2 || null,
    p1Score: m.p1Score,
    p2Score: m.p2Score,
    winner: m.winner || null,
    loser: m.loser || null,
    status: m.matchStatus,
    walkover: m.walkover,
  };
}

// Live standings for a group, computed from whatever has been played so far.
export function groupStandings(
  players: PBPlayer[],
  matches: PBMatch[],
  groupIndex: number,
): StandingRow[] {
  const ids = players.filter((p) => p.groupIndex === groupIndex).map((p) => p.id);
  // Group-stage matches only: a knockout rematch between group-mates must not
  // count towards the group table.
  const groupMatches = matches.filter((m) => m.stage === "group" && m.groupIndex === groupIndex);
  return computeStandings(ids, groupMatches.map(toEngineMatch));
}

export function nameMap(players: PBPlayer[]): Map<string, string> {
  return new Map(players.map((p) => [p.id, p.name]));
}

// Live standings for a WB/LB mini round-robin, computed from its 3 matches.
export function miniRRStandings(matches: PBMatch[], stage: "wb_rr" | "lb_rr"): StandingRow[] {
  const stageMatches = matches.filter((m) => m.stage === stage);
  const ids = new Set<string>();
  for (const m of stageMatches) {
    if (m.p1) ids.add(m.p1);
    if (m.p2) ids.add(m.p2);
  }
  if (ids.size === 0) return [];
  return computeStandings([...ids], stageMatches.map(toEngineMatch));
}

export function hasStage(matches: PBMatch[], stage: string): boolean {
  return matches.some((m) => m.stage === stage);
}


// ── TV scenes ─────────────────────────────────────────────────────────────
// Shared by the TV (what it can show) and the admin page (what it can pick).

export type Scene = "standby" | "groups" | "rr" | "bracket" | "spotlight" | "awards" | "champion";

export const SCENE_TITLE: Record<Scene, string> = {
  standby: "Beyfest 2026",
  groups: "Group stage",
  rr: "Mini round-robins",
  bracket: "Knockout bracket",
  spotlight: "Match centre",
  awards: "Awards",
  champion: "Champion",
};

// What the venue TV should be doing, as set from the admin page.
export interface TvState {
  id: string;
  mode: "auto" | "locked";
  scene: Scene;
  next: string; // code of the match picked with "Score this" ("" if none)
  soundOff: boolean; // no music or announcer on the TV
  musicLevel: number; // match music volume, 0–100
}

// The TV panel's music levels (tv_state.musicLevel).
export const MUSIC_LEVELS = [
  { label: "Off", value: 0 },
  { label: "Low", value: 30 },
  { label: "Medium", value: 60 },
  { label: "High", value: 100 },
];

// Scenes that have something to show right now, in rotation order.
export function availableScenes(hasTournament: boolean, matches: PBMatch[]): Scene[] {
  if (!hasTournament) return ["standby"];
  const s: Scene[] = ["groups"];
  if (hasStage(matches, "wb_rr") || hasStage(matches, "lb_rr")) s.push("rr");
  if (matches.some((m) => m.stage !== "group" && m.stage !== "wb_rr" && m.stage !== "lb_rr")) s.push("bracket");
  s.push("spotlight");
  if (loggedResults(matches).length >= AWARDS_AFTER) s.push("awards");
  if (matches.some((m) => m.stage === "gf" && m.matchStatus === "done")) s.push("champion");
  return s;
}

// ─── Awards ─────────────────────────────────────────────────────────
// Built from the round logs kept on finished matches. Only logs that add up to
// the recorded score count (a corrected result's log is dropped, and older
// results may have none). They're "so far" awards until the Grand Final.
const FINISH_POINTS: Record<string, number> = { spin: 1, knockout: 2, dominant: 3 };
const AWARDS_AFTER = 6; // logged results before the Awards scene appears

export interface Award {
  key: "knockout" | "dominant" | "wall" | "comeback";
  title: string;
  winners: string[]; // player ids (a tie lists everyone)
  detail: string; // plain words; {name} placeholders resolved by the caller
  opponent?: string; // comeback: who they came back against
}

// Finished matches whose round log adds up to the result.
export function loggedResults(matches: PBMatch[]): PBMatch[] {
  return matches.filter((m) => {
    if (m.matchStatus !== "done" || m.walkover || m.liveLog.length === 0) return false;
    const pts = (who: 1 | 2) => m.liveLog.filter((r) => r.who === who).reduce((a, r) => a + (FINISH_POINTS[r.finish] ?? 0), 0);
    return pts(1) === m.p1Score && pts(2) === m.p2Score;
  });
}

// Everyone tied on the best value (higher is better unless `lowest`).
function best(values: Map<string, number>, lowest = false): { ids: string[]; value: number } | null {
  if (values.size === 0) return null;
  const pick = lowest ? Math.min(...values.values()) : Math.max(...values.values());
  return { ids: [...values].filter(([, v]) => v === pick).map(([id]) => id), value: pick };
}

export function computeAwards(matches: PBMatch[]): Award[] {
  const logged = loggedResults(matches);
  const awards: Award[] = [];
  const side = (m: PBMatch, who: 1 | 2) => (who === 1 ? m.p1 : m.p2);

  // Most finishes of one kind.
  for (const [key, finish, title, min, word] of [
    ["knockout", "knockout", "Knockout king", 2, "knockouts"],
    ["dominant", "dominant", "Dominator", 1, "dominant finishes"],
  ] as const) {
    const count = new Map<string, number>();
    for (const m of logged) {
      for (const r of m.liveLog) {
        if (r.finish !== finish) continue;
        const id = side(m, r.who);
        count.set(id, (count.get(id) ?? 0) + 1);
      }
    }
    const top = best(count);
    if (top && top.value >= min) {
      awards.push({ key, title, winners: top.ids, detail: top.value === 1 ? `1 ${word.replace(/s$/, "")}` : `${top.value} ${word}` });
    }
  }

  // Iron wall: fewest points let in per match (every result counts; 3+ played).
  const against = new Map<string, { pts: number; n: number }>();
  for (const m of matches.filter((x) => x.matchStatus === "done" && !x.walkover)) {
    for (const [id, conceded] of [[m.p1, m.p2Score ?? 0], [m.p2, m.p1Score ?? 0]] as const) {
      const a = against.get(id) ?? { pts: 0, n: 0 };
      against.set(id, { pts: a.pts + conceded, n: a.n + 1 });
    }
  }
  const avg = new Map([...against].filter(([, a]) => a.n >= 3).map(([id, a]) => [id, Math.round((a.pts / a.n) * 10) / 10]));
  const wall = best(avg, true);
  if (wall) {
    awards.push({ key: "wall", title: "Iron wall", winners: wall.ids, detail: `Let in ${wall.value} points a match` });
  }

  // Comeback: the biggest deficit a winner came back from.
  let comeback: { id: string; opp: string; down: [number, number]; m: PBMatch } | null = null;
  let deepest = 0;
  for (const m of logged) {
    const winnerSide: 1 | 2 = (m.p1Score ?? 0) > (m.p2Score ?? 0) ? 1 : 2;
    let mine = 0;
    let theirs = 0;
    for (const r of m.liveLog) {
      if (r.who === winnerSide) mine += FINISH_POINTS[r.finish] ?? 0;
      else theirs += FINISH_POINTS[r.finish] ?? 0;
      if (theirs - mine > deepest) {
        deepest = theirs - mine;
        comeback = { id: side(m, winnerSide), opp: side(m, winnerSide === 1 ? 2 : 1), down: [mine, theirs], m };
      }
    }
  }
  if (comeback && deepest >= 2) {
    awards.push({
      key: "comeback",
      title: "Comeback",
      winners: [comeback.id],
      opponent: comeback.opp,
      detail: `Came back from ${comeback.down[0]}–${comeback.down[1]} down`,
    });
  }
  // A big tie isn't much of an award on the big screen: two names at most.
  return awards.filter((a) => a.winners.length <= 2);
}

// The champion's tournament, for the Champion scene.
export interface ChampionRun {
  wins: number;
  losses: number;
  pointDiff: number; // walkovers don't count, as in the tables
  roundsWon: number; // from round-by-round results only; 0 if none were logged
  topFinish: { key: string; count: number } | null; // their most used finish (a FINISHES key)
  final: { opponent: string; score: [number, number]; walkover: boolean } | null; // champion's score first
}

export function championRun(matches: PBMatch[], id: string): ChampionRun {
  const mine = matches.filter((m) => m.matchStatus === "done" && (m.p1 === id || m.p2 === id));
  const sideOf = (m: PBMatch): 1 | 2 => (m.p1 === id ? 1 : 2);
  const scores = (m: PBMatch): [number, number] => {
    const s: [number, number] = [m.p1Score ?? 0, m.p2Score ?? 0];
    return sideOf(m) === 1 ? s : [s[1], s[0]];
  };

  let pointDiff = 0;
  for (const m of mine.filter((x) => !x.walkover)) {
    const [a, b] = scores(m);
    pointDiff += a - b;
  }

  // Rounds won, by finish. A tie on count goes to the bigger finish.
  const byFinish = new Map<string, number>();
  for (const m of loggedResults(mine)) {
    for (const r of m.liveLog) if (r.who === sideOf(m)) byFinish.set(r.finish, (byFinish.get(r.finish) ?? 0) + 1);
  }
  let topFinish: ChampionRun["topFinish"] = null;
  for (const [key, count] of byFinish) {
    const better = !topFinish || count > topFinish.count ||
      (count === topFinish.count && (FINISH_POINTS[key] ?? 0) > (FINISH_POINTS[topFinish.key] ?? 0));
    if (better) topFinish = { key, count };
  }

  const gf = mine.find((m) => m.stage === "gf");
  return {
    wins: mine.filter((m) => m.winner === id).length,
    losses: mine.filter((m) => m.winner !== id).length,
    pointDiff,
    roundsWon: [...byFinish.values()].reduce((a, n) => a + n, 0),
    topFinish,
    final: gf ? { opponent: sideOf(gf) === 1 ? gf.p2 : gf.p1, score: scores(gf), walkover: gf.walkover } : null,
  };
}

// ── What's on, what's next ──────────────────────────────────────────
// Shared by the TV and the phone page (/live), so both agree on the order.

// Matches being played right now, in play order.
export function liveMatches(matches: PBMatch[]): PBMatch[] {
  return matches.filter(isLive).sort((a, b) => a.orderIndex - b.orderIndex);
}

// Playable matches not yet started, in the order they'll be called: the one
// the organiser picked with "Score this" (`preferCode`) first, then play order.
export function upNext(matches: PBMatch[], preferCode = ""): PBMatch[] {
  return matches
    .filter((m) => m.matchStatus === "ready" && !isLive(m))
    .sort((a, b) => Number(b.code === preferCode) - Number(a.code === preferCode) || a.orderIndex - b.orderIndex);
}

// The latest results, newest first. resultAt is when it was recorded, so a
// match played out of order still shows as recent; play order breaks ties.
export function recentResults(matches: PBMatch[], n: number): PBMatch[] {
  return matches
    .filter((m) => m.matchStatus === "done")
    .sort((a, b) => b.resultAt.localeCompare(a.resultAt) || b.orderIndex - a.orderIndex)
    .slice(0, n);
}

// A blader's next match, for the phone page's "your next match" card:
// - live: they're playing it now
// - ready: it's playable; `ahead` is how many matches will be called first
// - waiting: they're in it, but the other side isn't decided yet
// null when they have nothing left to play.
export type NextMatch = { match: PBMatch; state: "live" | "ready" | "waiting"; ahead: number };
export function nextMatchFor(playerId: string, matches: PBMatch[], preferCode = ""): NextMatch | null {
  const theirs = (m: PBMatch) => m.p1 === playerId || m.p2 === playerId;
  const live = liveMatches(matches).find(theirs);
  if (live) return { match: live, state: "live", ahead: 0 };
  const queue = upNext(matches, preferCode);
  const i = queue.findIndex(theirs);
  if (i >= 0) return { match: queue[i], state: "ready", ahead: i };
  const waiting = matches
    .filter((m) => m.matchStatus === "pending" && theirs(m))
    .sort((a, b) => a.orderIndex - b.orderIndex)[0];
  return waiting ? { match: waiting, state: "waiting", ahead: 0 } : null;
}

// The knockout for a phone screen: one list per tier (winners, mid, losers,
// final), each split into rounds in play order. Same grouping as Bracket.svelte.
export type KnockoutTier = { tier: "wb" | "mb" | "lb" | "gf"; rounds: { label: string; matches: PBMatch[] }[] };
export function knockoutTiers(matches: PBMatch[]): KnockoutTier[] {
  const order = ["wb", "mb", "lb", "gf"] as const;
  const tiers: KnockoutTier[] = order.map((tier) => ({ tier, rounds: [] }));
  const ko = matches.filter((m) => m.stage !== "group").sort((a, b) => a.orderIndex - b.orderIndex);
  for (const m of ko) {
    const t = tierOf(m.stage);
    if (t === "group") continue;
    const tier = tiers[order.indexOf(t)];
    let round = tier.rounds.find((r) => r.label === m.roundLabel);
    if (!round) {
      round = { label: m.roundLabel, matches: [] };
      tier.rounds.push(round);
    }
    round.matches.push(m);
  }
  return tiers.filter((t) => t.rounds.length);
}

// Where a mini round-robin finisher goes next. WB: the winner reaches the
// grand final, the rest drop to the mid bracket. LB: the top `advancers`
// reach the mid bracket, the rest are out.
export function rrFate(stage: "wb_rr" | "lb_rr", rank: number, advancers: number) {
  if (stage === "wb_rr")
    return rank === 1 ? { text: "Grand final", tier: "gf" } : { text: "Mid bracket", tier: "mb" };
  return rank <= advancers ? { text: "Mid bracket", tier: "mb" } : { text: "Out", tier: "out" };
}
