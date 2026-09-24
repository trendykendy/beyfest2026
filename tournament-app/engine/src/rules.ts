import type { Stage, StructureSpec } from "./types";

// Points required to win a match, ramping up toward the end:
//   • Grand Final                                   → first to 9
//   • the last rounds of the main path to it        → first to 7
//       – three-tier (9–15): Mid bracket semi-final(s) and final
//       – double-elim (8): Upper and Lower bracket finals (not their semis)
//   • everything else                               → first to 5
//       (groups, mini round-robins, early rounds, and the whole Winners
//        mini-bracket for 10 — its "semis" and "final" only decide seeding)
// Decided by stage first, so a round merely NAMED "semi" or "final" inside a
// side bracket doesn't get bumped up.
export function pointsToWin(stage: Stage, roundLabel: string): number {
  if (stage === "gf") return 9;
  if (stage === "mb" && (/\bsemi/i.test(roundLabel) || /\bfinal\b/i.test(roundLabel))) return 7;
  // "Upper Bracket — Final" / "Lower Bracket — Final"; the "— " keeps "Semifinal" out.
  if ((stage === "ub" || stage === "lb") && /— Final$/.test(roundLabel)) return 7;
  return 5;
}

// How many finishers of a mini round-robin advance (WB: all three continue;
// LB: only the top N reach the Mid Bracket — 1 for most counts, 2 for 14).
export function miniRRAdvancers(structure: StructureSpec, stage: "wb_rr" | "lb_rr"): number {
  let max = 0;
  for (const mt of structure.matches) {
    for (const slot of [mt.slot1, mt.slot2]) {
      if (slot.k === "rrRank" && slot.stage === stage) max = Math.max(max, slot.rank);
    }
  }
  return max;
}
