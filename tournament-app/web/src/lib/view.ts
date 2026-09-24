import { computeStandings, type Match, type Slot, type Stage, type StandingRow } from "@beyfest/engine";

// Plain shapes as they arrive from PocketBase (superset of engine fields).
export interface PBPlayer {
  id: string;
  name: string;
  groupIndex: number | null;
  drawOrder: number | null;
  finalGroupRank: number | null;
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
  liveLog: LiveRound[]; // how each round so far was won (empty unless in progress)
  winner: string;
  loser: string;
  matchStatus: "pending" | "ready" | "done";
}

// One round of a match in progress, as logged by the admin scorer.
export interface LiveRound {
  who: 1 | 2;
  finish: string; // a key from FINISHES ("spin" | "knockout" | "dominant")
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

// A match is live once it's playable and someone has scored.
export const isLive = (m: PBMatch) => m.matchStatus === "ready" && (m.liveP1 > 0 || m.liveP2 > 0);

// Where a match sits, in words: "Group 3, match 2 of 6" or "Mid bracket round 2".
export function matchContext(m: PBMatch, matches: PBMatch[]): string {
  if (m.stage !== "group") return roundName(m.roundLabel);
  const list = matches
    .filter((x) => x.stage === "group" && x.groupIndex === m.groupIndex)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const n = list.findIndex((x) => x.code === m.code) + 1;
  return `${m.roundLabel}, match ${n} of ${list.length}`;
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

export type Scene = "standby" | "groups" | "rr" | "bracket" | "spotlight" | "champion";

export const SCENE_TITLE: Record<Scene, string> = {
  standby: "Beyfest 2026",
  groups: "Group stage",
  rr: "Mini round-robins",
  bracket: "Knockout bracket",
  spotlight: "Match centre",
  champion: "Champion",
};

// What the venue TV should be doing, as set from the admin page.
export interface TvState {
  id: string;
  mode: "auto" | "locked";
  scene: Scene;
}

// Scenes that have something to show right now, in rotation order.
export function availableScenes(hasTournament: boolean, matches: PBMatch[]): Scene[] {
  if (!hasTournament) return ["standby"];
  const s: Scene[] = ["groups"];
  if (hasStage(matches, "wb_rr") || hasStage(matches, "lb_rr")) s.push("rr");
  if (matches.some((m) => m.stage !== "group" && m.stage !== "wb_rr" && m.stage !== "lb_rr")) s.push("bracket");
  s.push("spotlight");
  if (matches.some((m) => m.stage === "gf" && m.matchStatus === "done")) s.push("champion");
  return s;
}
