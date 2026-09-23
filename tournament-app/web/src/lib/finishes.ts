// The three ways to score a round (from the Beyfest 2026 rules brief).
// A match is played round by round; each round is won by one of these, and
// points accumulate until a blader reaches the match target (5 / 7 / 9).
export interface Finish {
  key: string;
  label: string;
  desc: string;
  pts: number;
}

export const FINISHES: Finish[] = [
  { key: "spin", label: "Spin", desc: "last bey spinning", pts: 1 },
  { key: "knockout", label: "Knockout", desc: "ring-out", pts: 2 },
  { key: "dominant", label: "Dominant", desc: "stadium finish", pts: 3 },
];

// Largest single-round swing — used to bound a valid final score.
export const MAX_FINISH = Math.max(...FINISHES.map((f) => f.pts));
