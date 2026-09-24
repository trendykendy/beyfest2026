import { describe, expect, test } from "bun:test";
import { computeStandings, type Match } from "../src/index";

// A walkover is a win for the blader who turned up, but no points either way:
// a no-show shouldn't hand anyone a free 5–0 in a point-difference tiebreak.

function played(code: string, p1: string, p2: string, s1: number, s2: number, walkover = false): Match {
  return {
    code,
    stage: "group",
    roundLabel: "Group 1",
    orderIndex: 0,
    group: 0,
    slot1: null,
    slot2: null,
    p1,
    p2,
    p1Score: s1,
    p2Score: s2,
    winner: s1 > s2 ? p1 : p2,
    loser: s1 > s2 ? p2 : p1,
    status: "done",
    walkover,
  };
}

describe("walkovers in the tables", () => {
  test("count as a win and a loss, with no points", () => {
    const rows = computeStandings(["a", "b"], [played("G1-1", "a", "b", 5, 0, true)]);
    const a = rows.find((r) => r.playerId === "a")!;
    const b = rows.find((r) => r.playerId === "b")!;
    expect([a.wins, a.losses, a.pointsFor, a.pointsAgainst, a.pointDiff]).toEqual([1, 0, 0, 0, 0]);
    expect([b.wins, b.losses, b.pointsFor, b.pointsAgainst, b.pointDiff]).toEqual([0, 1, 0, 0, 0]);
    expect(a.rank).toBe(1);
  });

  test("don't decide a point-difference tiebreak", () => {
    // a, b and c each win once (a 3-way head-to-head loop), so point
    // difference decides: a +1, b +1 (b ahead on points scored), c −2.
    // Counting c's walkover as a 5–0 would put c top on +3.
    const rows = computeStandings(
      ["a", "b", "c"],
      [
        played("G1-1", "a", "b", 5, 4),
        played("G1-2", "b", "c", 5, 3),
        played("G1-3", "c", "a", 5, 0, true), // c didn't have to play: no points
      ],
    );
    expect(rows.map((r) => r.playerId)).toEqual(["b", "a", "c"]);
    expect(rows.find((r) => r.playerId === "c")!.pointDiff).toBe(-2);
  });
});
