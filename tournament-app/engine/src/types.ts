// ─── Core domain types ───────────────────────────────────────────────
// The engine is storage-agnostic: it operates on plain objects. The
// SvelteKit server maps these to/from PocketBase records.

export type RoundRobin = "single" | "double";
export type KnockoutType = "double-elim" | "three-tier" | "three-tier-4wb";

export type Stage =
  | "group"
  | "wb_rr" // Winners Bracket mini round-robin (3-tier counts)
  | "lb_rr" // Losers Bracket mini round-robin (3-tier counts)
  | "ub" // Upper Bracket (8-player double-elim)
  | "lb" // Lower Bracket (8-player double-elim, or LB single match for 10)
  | "wb" // Winners Bracket single-elim matches (10-player)
  | "mb" // Mid Bracket ladder
  | "gf"; // Grand Final

export type MatchStatus = "pending" | "ready" | "done";

// A Slot describes where a match participant comes from. Slots are
// resolved to concrete players as results land.
export type Slot =
  | { k: "groupRank"; group: number; rank: number } // rank 1-based within a group's final standings
  | { k: "seed"; n: number } // overall bracket seed (8-player double-elim only)
  | { k: "winner"; match: string } // winner of another match (by code)
  | { k: "loser"; match: string } // loser of another match (by code)
  | { k: "rrRank"; stage: "wb_rr" | "lb_rr"; rank: number } // finisher of a mini round-robin
  | { k: "poolDraw"; pool: string }; // filled by constrained random draw at knockout generation

export interface Player {
  id: string;
  name: string;
  group: number | null; // group index (0-based), null until draw
  drawOrder: number; // order within the group after the draw
  finalGroupRank: number | null; // 1-based final placing within the group, null until group complete
}

export interface Match {
  code: string; // e.g. "G1-1", "WB1", "MB3", "GF1"
  stage: Stage;
  roundLabel: string; // human phase label, e.g. "Phase 3 — MB Round 1"
  orderIndex: number; // suggested play order across the whole tournament
  group: number | null; // group index for group-stage matches, else null
  slot1: Slot | null; // null once resolved to a concrete player
  slot2: Slot | null;
  p1: string | null; // resolved player id
  p2: string | null;
  p1Score: number | null;
  p2Score: number | null;
  winner: string | null;
  loser: string | null;
  status: MatchStatus;
}

// A pool of entrants (group middles) drawn randomly into poolDraw slots.
export interface PoolDef {
  pool: string;
  members: Slot[]; // groupRank sources; resolved to players then shuffled into the pool's slots
}

// The declarative, locked-in structure for one player count.
export interface StructureSpec {
  count: number;
  groups: number[]; // group sizes
  roundRobin: RoundRobin;
  knockoutType: KnockoutType;
  groupMatches: number; // expected group-stage match total (validation)
  knockoutMatches: number; // expected knockout match total (validation)
  callout?: string; // special-case explainer text (HTML)
  pools: PoolDef[];
  matches: KnockoutMatchDef[]; // all knockout matches, in play order
}

export interface KnockoutMatchDef {
  code: string;
  stage: Stage;
  roundLabel: string;
  slot1: Slot;
  slot2: Slot;
}

// Standings row produced by computeStandings().
export interface StandingRow {
  playerId: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  rank: number; // 1-based
  tiedWith: string[]; // other player ids still tied after all tiebreakers (needs a decider match)
}
