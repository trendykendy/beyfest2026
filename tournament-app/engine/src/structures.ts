import type { Slot, StructureSpec, KnockoutMatchDef } from "./types";

// ─── Slot constructors (keep the specs terse) ───────────────────────
const gRank = (group: number, rank: number): Slot => ({ k: "groupRank", group, rank });
const seed = (n: number): Slot => ({ k: "seed", n });
const win = (match: string): Slot => ({ k: "winner", match });
const lose = (match: string): Slot => ({ k: "loser", match });
const wbRR = (rank: number): Slot => ({ k: "rrRank", stage: "wb_rr", rank });
const lbRR = (rank: number): Slot => ({ k: "rrRank", stage: "lb_rr", rank });
const pool = (name: string): Slot => ({ k: "poolDraw", pool: name });

const m = (
  code: string,
  stage: KnockoutMatchDef["stage"],
  roundLabel: string,
  slot1: Slot,
  slot2: Slot,
): KnockoutMatchDef => ({ code, stage, roundLabel, slot1, slot2 });

// Round-robin match list for a mini-RR among three group finishers at `rank`.
// Produces codes like WB1/WB2/WB3 or LB1/LB2/LB3.
function miniRR(
  prefix: string,
  stage: "wb_rr" | "lb_rr",
  label: string,
  ranks: [Slot, Slot, Slot],
): KnockoutMatchDef[] {
  const [a, b, c] = ranks;
  return [
    m(`${prefix}1`, stage, label, a, b),
    m(`${prefix}2`, stage, label, a, c),
    m(`${prefix}3`, stage, label, b, c),
  ];
}

// ─── The eight locked-in structures ─────────────────────────────────
export const STRUCTURES: Record<number, StructureSpec> = {
  // ---------------------------------------------------------------- 8
  8: {
    count: 8,
    groups: [4, 4],
    roundRobin: "double",
    knockoutType: "double-elim",
    groupMatches: 24,
    knockoutMatches: 14,
    callout:
      "For 8 players the knockout is a <strong>standard double-elimination bracket</strong> — every player has two lives. The group stage purely seeds the bracket (better finish = easier opening match). There is no three-tier WB/MB/LB system.",
    pools: [],
    matches: [
      m("QF1", "ub", "Upper Bracket — Quarterfinals", seed(1), seed(8)),
      m("QF2", "ub", "Upper Bracket — Quarterfinals", seed(4), seed(5)),
      m("QF3", "ub", "Upper Bracket — Quarterfinals", seed(3), seed(6)),
      m("QF4", "ub", "Upper Bracket — Quarterfinals", seed(2), seed(7)),
      m("SF1", "ub", "Upper Bracket — Semifinals", win("QF1"), win("QF2")),
      m("SF2", "ub", "Upper Bracket — Semifinals", win("QF3"), win("QF4")),
      m("LR1a", "lb", "Lower Bracket — Round 1", lose("QF1"), lose("QF2")),
      m("LR1b", "lb", "Lower Bracket — Round 1", lose("QF3"), lose("QF4")),
      m("LR2a", "lb", "Lower Bracket — Round 2", win("LR1a"), lose("SF2")),
      m("LR2b", "lb", "Lower Bracket — Round 2", win("LR1b"), lose("SF1")),
      m("UBF", "ub", "Upper Bracket — Final", win("SF1"), win("SF2")),
      m("LSF", "lb", "Lower Bracket — Semifinal", win("LR2a"), win("LR2b")),
      m("LBF", "lb", "Lower Bracket — Final", win("LSF"), lose("UBF")),
      m("GF1", "gf", "Grand Final", win("UBF"), win("LBF")),
    ],
  },

  // ---------------------------------------------------------------- 9
  9: {
    count: 9,
    groups: [3, 3, 3],
    roundRobin: "double",
    knockoutType: "three-tier",
    groupMatches: 18,
    knockoutMatches: 12,
    pools: [{ pool: "mid", members: [gRank(0, 2), gRank(1, 2), gRank(2, 2)] }],
    matches: [
      ...miniRR("WB", "wb_rr", "Phase 1A — WB Mini-RR", [gRank(0, 1), gRank(1, 1), gRank(2, 1)]),
      ...miniRR("LB", "lb_rr", "Phase 1B — LB Mini-RR", [gRank(0, 3), gRank(1, 3), gRank(2, 3)]),
      m("MB1", "mb", "Phase 3 — MB Round 1", pool("mid"), pool("mid")),
      m("MB2", "mb", "Phase 3 — MB Round 1", pool("mid"), lbRR(1)),
      m("MB3", "mb", "Phase 4 — MB Semi", win("MB1"), wbRR(3)),
      m("MB4", "mb", "Phase 4 — MB Semi", win("MB2"), wbRR(2)),
      m("MB5", "mb", "Phase 5 — MB Final", win("MB3"), win("MB4")),
      m("GF1", "gf", "Phase 6 — Grand Final", wbRR(1), win("MB5")),
    ],
  },

  // --------------------------------------------------------------- 10
  10: {
    count: 10,
    groups: [5, 5],
    roundRobin: "single",
    knockoutType: "three-tier-4wb",
    groupMatches: 20,
    knockoutMatches: 13,
    callout:
      "For 10 players the Winners Bracket takes the <strong>top two from each group</strong> (a 4-player WB) plus an SF Losers Playoff, producing four differentiated ranks (WB-1st…4th) that drop into the Mid Bracket at four different points.",
    pools: [{ pool: "mid", members: [gRank(0, 3), gRank(0, 4), gRank(1, 3), gRank(1, 4)] }],
    matches: [
      m("WSF1", "wb", "Phase 1A — WB Semis", gRank(0, 1), gRank(1, 2)),
      m("WSF2", "wb", "Phase 1A — WB Semis", gRank(1, 1), gRank(0, 2)),
      m("LB1", "lb", "Phase 1B — LB Match", gRank(0, 5), gRank(1, 5)),
      m("WBF", "wb", "Phase 2A — WB Final", win("WSF1"), win("WSF2")),
      m("SFLP", "wb", "Phase 2B — WB SF Losers Playoff", lose("WSF1"), lose("WSF2")),
      // MB R1: 4 middles + LB winner + WB-4th (loser of SFLP)
      m("MB1", "mb", "Phase 4 — MB Round 1", pool("mid"), lose("SFLP")),
      m("MB2", "mb", "Phase 4 — MB Round 1", pool("mid"), win("LB1")),
      m("MB3", "mb", "Phase 4 — MB Round 1", pool("mid"), pool("mid")),
      // MB R2: 3 R1 winners + WB-3rd (winner of SFLP)
      m("MB4", "mb", "Phase 5 — MB R2", win("MB1"), win("SFLP")),
      m("MB5", "mb", "Phase 5 — MB R2", win("MB2"), win("MB3")),
      m("MB6", "mb", "Phase 6 — MB Semi", win("MB4"), win("MB5")),
      m("MB7", "mb", "Phase 7 — MB Final", win("MB6"), lose("WBF")),
      m("GF1", "gf", "Phase 8 — Grand Final", win("WBF"), win("MB7")),
    ],
  },

  // --------------------------------------------------------------- 11
  11: {
    count: 11,
    groups: [4, 4, 3],
    roundRobin: "single",
    knockoutType: "three-tier",
    groupMatches: 15,
    knockoutMatches: 14,
    pools: [
      { pool: "mid", members: [gRank(0, 2), gRank(0, 3), gRank(1, 2), gRank(1, 3), gRank(2, 2)] },
    ],
    matches: [
      ...miniRR("WB", "wb_rr", "Phase 1A — WB Mini-RR", [gRank(0, 1), gRank(1, 1), gRank(2, 1)]),
      ...miniRR("LB", "lb_rr", "Phase 1B — LB Mini-RR", [gRank(0, 4), gRank(1, 4), gRank(2, 3)]),
      m("MB1", "mb", "Phase 3 — MB Round 1", pool("mid"), pool("mid")),
      m("MB2", "mb", "Phase 3 — MB Round 1", pool("mid"), pool("mid")),
      m("MB3", "mb", "Phase 3 — MB Round 1", pool("mid"), lbRR(1)),
      m("MB4", "mb", "Phase 4 — MB R2", win("MB1"), wbRR(3)),
      m("MB5", "mb", "Phase 4 — MB R2", win("MB2"), win("MB3")),
      m("MB6", "mb", "Phase 5 — MB Semi", win("MB4"), win("MB5")),
      m("MB7", "mb", "Phase 6 — MB Final", win("MB6"), wbRR(2)),
      m("GF1", "gf", "Phase 7 — Grand Final", wbRR(1), win("MB7")),
    ],
  },

  // --------------------------------------------------------------- 12
  12: {
    count: 12,
    groups: [4, 4, 4],
    roundRobin: "single",
    knockoutType: "three-tier",
    groupMatches: 18,
    knockoutMatches: 15,
    pools: [
      {
        pool: "mid",
        members: [gRank(0, 2), gRank(0, 3), gRank(1, 2), gRank(1, 3), gRank(2, 2), gRank(2, 3)],
      },
    ],
    matches: [
      ...miniRR("WB", "wb_rr", "Phase 1A — WB Mini-RR", [gRank(0, 1), gRank(1, 1), gRank(2, 1)]),
      ...miniRR("LB", "lb_rr", "Phase 1B — LB Mini-RR", [gRank(0, 4), gRank(1, 4), gRank(2, 4)]),
      m("MB1", "mb", "Phase 3 — MB Round 1", pool("mid"), pool("mid")),
      m("MB2", "mb", "Phase 3 — MB Round 1", pool("mid"), pool("mid")),
      m("MB3", "mb", "Phase 3 — MB Round 1", pool("mid"), lbRR(1)),
      m("MB4", "mb", "Phase 3 — MB Round 1", pool("mid"), wbRR(3)),
      m("MB5", "mb", "Phase 4 — MB R2", win("MB1"), win("MB2")),
      m("MB6", "mb", "Phase 4 — MB R2", win("MB3"), win("MB4")),
      m("MB7", "mb", "Phase 5 — MB Semi", win("MB5"), win("MB6")),
      m("MB8", "mb", "Phase 6 — MB Final", win("MB7"), wbRR(2)),
      m("GF1", "gf", "Phase 7 — Grand Final", wbRR(1), win("MB8")),
    ],
  },

  // --------------------------------------------------------------- 13
  13: {
    count: 13,
    groups: [5, 4, 4],
    roundRobin: "single",
    knockoutType: "three-tier",
    groupMatches: 22,
    knockoutMatches: 16,
    callout:
      "For 13 players, <strong>both WB-2nd and WB-3rd enter together at the Semis</strong> (Phase 5) rather than at different stages — the special case that keeps the bracket free of merit byes with 8 natural MB entrants.",
    pools: [
      {
        pool: "mid",
        members: [
          gRank(0, 2), gRank(0, 3), gRank(0, 4),
          gRank(1, 2), gRank(1, 3),
          gRank(2, 2), gRank(2, 3),
        ],
      },
    ],
    matches: [
      ...miniRR("WB", "wb_rr", "Phase 1A — WB Mini-RR", [gRank(0, 1), gRank(1, 1), gRank(2, 1)]),
      ...miniRR("LB", "lb_rr", "Phase 1B — LB Mini-RR", [gRank(0, 5), gRank(1, 4), gRank(2, 4)]),
      m("MB1", "mb", "Phase 3 — MB Round 1", pool("mid"), pool("mid")),
      m("MB2", "mb", "Phase 3 — MB Round 1", pool("mid"), pool("mid")),
      m("MB3", "mb", "Phase 3 — MB Round 1", pool("mid"), pool("mid")),
      m("MB4", "mb", "Phase 3 — MB Round 1", pool("mid"), lbRR(1)),
      m("MB5", "mb", "Phase 4 — Quarters", win("MB1"), win("MB2")),
      m("MB6", "mb", "Phase 4 — Quarters", win("MB3"), win("MB4")),
      m("MB7", "mb", "Phase 5 — Semis", win("MB5"), wbRR(3)),
      m("MB8", "mb", "Phase 5 — Semis", win("MB6"), wbRR(2)),
      m("MB9", "mb", "Phase 6 — MB Final", win("MB7"), win("MB8")),
      m("GF1", "gf", "Phase 7 — Grand Final", wbRR(1), win("MB9")),
    ],
  },

  // --------------------------------------------------------------- 14
  14: {
    count: 14,
    groups: [5, 5, 4],
    roundRobin: "single",
    knockoutType: "three-tier",
    groupMatches: 26,
    knockoutMatches: 18,
    callout:
      "For 14 players the LB Mini-RR sends <strong>two advancers</strong> (LB-1st and LB-2nd) into the Mid Bracket instead of one; only LB-3rd is eliminated outright. This keeps the MB math clean with zero merit byes.",
    pools: [
      {
        pool: "mid",
        members: [
          gRank(0, 2), gRank(0, 3), gRank(0, 4),
          gRank(1, 2), gRank(1, 3), gRank(1, 4),
          gRank(2, 2), gRank(2, 3),
        ],
      },
    ],
    matches: [
      ...miniRR("WB", "wb_rr", "Phase 1A — WB Mini-RR", [gRank(0, 1), gRank(1, 1), gRank(2, 1)]),
      ...miniRR("LB", "lb_rr", "Phase 1B — LB Mini-RR", [gRank(0, 5), gRank(1, 5), gRank(2, 4)]),
      m("MB1", "mb", "Phase 3 — MB Round 1", pool("mid"), pool("mid")),
      m("MB2", "mb", "Phase 3 — MB Round 1", pool("mid"), pool("mid")),
      m("MB3", "mb", "Phase 3 — MB Round 1", pool("mid"), lbRR(1)),
      m("MB4", "mb", "Phase 3 — MB Round 1", pool("mid"), lbRR(2)),
      m("MB5", "mb", "Phase 3 — MB Round 1", pool("mid"), pool("mid")),
      m("MB6", "mb", "Phase 4 — MB R2", win("MB1"), wbRR(3)),
      m("MB7", "mb", "Phase 4 — MB R2", win("MB2"), win("MB3")),
      m("MB8", "mb", "Phase 4 — MB R2", win("MB4"), win("MB5")),
      m("MB9", "mb", "Phase 5 — MB Semi", win("MB6"), wbRR(2)),
      m("MB10", "mb", "Phase 5 — MB Semi", win("MB7"), win("MB8")),
      m("MB11", "mb", "Phase 6 — MB Final", win("MB9"), win("MB10")),
      m("GF1", "gf", "Phase 7 — Grand Final", wbRR(1), win("MB11")),
    ],
  },

  // --------------------------------------------------------------- 15
  15: {
    count: 15,
    groups: [5, 5, 5],
    roundRobin: "single",
    knockoutType: "three-tier",
    groupMatches: 30,
    knockoutMatches: 18,
    pools: [
      {
        pool: "mid",
        members: [
          gRank(0, 2), gRank(0, 3), gRank(0, 4),
          gRank(1, 2), gRank(1, 3), gRank(1, 4),
          gRank(2, 2), gRank(2, 3), gRank(2, 4),
        ],
      },
    ],
    matches: [
      ...miniRR("WB", "wb_rr", "Phase 1A — WB Mini-RR", [gRank(0, 1), gRank(1, 1), gRank(2, 1)]),
      ...miniRR("LB", "lb_rr", "Phase 1B — LB Mini-RR", [gRank(0, 5), gRank(1, 5), gRank(2, 5)]),
      m("MB1", "mb", "Phase 3 — MB Round 1", pool("mid"), pool("mid")),
      m("MB2", "mb", "Phase 3 — MB Round 1", pool("mid"), pool("mid")),
      m("MB3", "mb", "Phase 3 — MB Round 1", pool("mid"), pool("mid")),
      m("MB4", "mb", "Phase 3 — MB Round 1", pool("mid"), pool("mid")),
      m("MB5", "mb", "Phase 3 — MB Round 1", pool("mid"), lbRR(1)),
      m("MB6", "mb", "Phase 4 — MB R2", win("MB1"), wbRR(3)),
      m("MB7", "mb", "Phase 4 — MB R2", win("MB2"), win("MB3")),
      m("MB8", "mb", "Phase 4 — MB R2", win("MB4"), win("MB5")),
      m("MB9", "mb", "Phase 5 — MB Semi", win("MB6"), wbRR(2)),
      m("MB10", "mb", "Phase 5 — MB Semi", win("MB7"), win("MB8")),
      m("MB11", "mb", "Phase 6 — MB Final", win("MB9"), win("MB10")),
      m("GF1", "gf", "Phase 7 — Grand Final", wbRR(1), win("MB11")),
    ],
  },
};

export function pickStructure(count: number): StructureSpec {
  const s = STRUCTURES[count];
  if (!s) throw new Error(`No tournament structure for ${count} players (supported: 8–15).`);
  return s;
}
