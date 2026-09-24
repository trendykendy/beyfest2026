import { describe, expect, test } from "bun:test";
import { STRUCTURES, pointsToWin } from "../src/index";

// The matches that are first to 7, per player count. The Grand Final is first
// to 9 and every other match (groups included) is first to 5.
//   • three-tier: the Mid bracket semi-final(s) and final.
//   • 10 players: its Winners mini-bracket (WSF1, WSF2, WBF) is a bracket
//     within the bracket that only decides seeding, so it stays at 5.
//   • 8 players (double-elim): only the Upper and Lower bracket finals.
const FIRST_TO_7: Record<number, string[]> = {
  8: ["UBF", "LBF"],
  9: ["MB3", "MB4", "MB5"],
  10: ["MB6", "MB7"],
  11: ["MB6", "MB7"],
  12: ["MB7", "MB8"],
  13: ["MB7", "MB8", "MB9"],
  14: ["MB9", "MB10", "MB11"],
  15: ["MB9", "MB10", "MB11"],
};

describe("points to win", () => {
  for (const [count, structure] of Object.entries(STRUCTURES)) {
    test(`${count} players`, () => {
      const got = structure.matches.map((m) => [m.code, pointsToWin(m.stage, m.roundLabel)] as const);
      const expected = structure.matches.map((m) => {
        const t = m.stage === "gf" ? 9 : FIRST_TO_7[Number(count)].includes(m.code) ? 7 : 5;
        return [m.code, t] as const;
      });
      expect(got).toEqual(expected);
    });
  }

  test("group matches are first to 5", () => {
    expect(pointsToWin("group", "Group 1")).toBe(5);
  });
});
