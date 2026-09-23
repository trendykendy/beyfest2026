import type { Stage, StructureSpec } from "./types";

// Points required to win a match, ramping up toward the end:
//   • Grand Final                          → first to 9
//   • Semi-final stage onward (semis + all → first to 7
//     bracket finals before the Grand Final)
//   • everything earlier (groups, mini-RRs, → first to 5
//     early bracket rounds)
// Driven off the round label so it applies uniformly to every structure.
export function pointsToWin(stage: Stage, roundLabel: string): number {
  if (stage === "gf") return 9;
  if (/\bsemi/i.test(roundLabel) || /\bfinal\b/i.test(roundLabel)) return 7;
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
