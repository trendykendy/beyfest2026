import { describe, expect, test } from "bun:test";
import { championRun, type LiveRound, type PBMatch } from "../web/src/lib/view";

// A finished match with just the fields championRun reads.
function match(code: string, stage: string, p1: string, p2: string, s1: number, s2: number, log: LiveRound[] = [], walkover = false): PBMatch {
  return {
    id: code,
    code,
    stage,
    p1,
    p2,
    p1Score: s1,
    p2Score: s2,
    liveLog: log,
    walkover,
    winner: s1 > s2 ? p1 : p2,
    loser: s1 > s2 ? p2 : p1,
    matchStatus: "done",
  } as PBMatch;
}
const r = (who: 1 | 2, finish: string): LiveRound => ({ who, finish });

const MATCHES = [
  // Logged: A wins 5–2 with two knockouts and a spin; B scores a knockout.
  match("G1", "group", "A", "B", 5, 2, [r(1, "knockout"), r(2, "knockout"), r(1, "knockout"), r(1, "spin")]),
  // A (as p2) loses 3–5; no log.
  match("G2", "group", "C", "A", 5, 3),
  // Walkover win: counts as a win, not in the point difference.
  match("G3", "group", "A", "D", 5, 0, [], true),
  // Grand final, logged, A as p2 wins 7–4: one dominant, two knockouts.
  match("GF", "gf", "C", "A", 4, 7, [r(2, "dominant"), r(1, "knockout"), r(2, "knockout"), r(1, "knockout"), r(2, "knockout")]),
  // Someone else's match.
  match("G4", "group", "B", "C", 5, 1),
];

describe("championRun", () => {
  const run = championRun(MATCHES, "A");

  test("record counts walkovers as wins", () => {
    expect([run.wins, run.losses]).toEqual([3, 1]);
  });
  test("point difference leaves walkovers out", () => {
    expect(run.pointDiff).toBe(3 + -2 + 3);
  });
  test("rounds and favourite finish come from logged matches", () => {
    expect(run.roundsWon).toBe(6);
    expect(run.topFinish).toEqual({ key: "knockout", count: 4 });
  });
  test("grand final is from the champion's side", () => {
    expect(run.final).toEqual({ opponent: "C", score: [7, 4], walkover: false });
  });
  test("a tie on count goes to the bigger finish", () => {
    const m = [match("X", "gf", "A", "B", 4, 0, [r(1, "spin"), r(1, "dominant")])];
    expect(championRun(m, "A").topFinish).toEqual({ key: "dominant", count: 1 });
  });
  test("no logged rounds: no favourite finish", () => {
    const m = [match("X", "gf", "A", "B", 5, 0)];
    expect(championRun(m, "A")).toMatchObject({ roundsWon: 0, topFinish: null });
  });
});
