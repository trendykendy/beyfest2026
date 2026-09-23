import { describe, expect, test } from "bun:test";
import {
  STRUCTURES,
  createGroupStage,
  generateKnockout,
  applyResult,
  champion,
  resolve,
  makeRng,
  type PlayerInput,
  type State,
} from "../src/index";

const COUNTS = [8, 9, 10, 11, 12, 13, 14, 15];

// Authoritative totals from tournament-spec.txt Part 2.
const EXPECTED: Record<number, { group: number; knockout: number; total: number }> = {
  8: { group: 24, knockout: 14, total: 38 },
  9: { group: 18, knockout: 12, total: 30 },
  10: { group: 20, knockout: 13, total: 33 },
  11: { group: 15, knockout: 14, total: 29 },
  12: { group: 18, knockout: 15, total: 33 },
  13: { group: 22, knockout: 16, total: 38 },
  14: { group: 26, knockout: 18, total: 44 },
  15: { group: 30, knockout: 18, total: 48 },
};

function makePlayers(n: number): PlayerInput[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${String.fromCharCode(65 + i)}`,
  }));
}

// Score a not-yet-played match: winner reaches 5, loser gets 0-4 (rng-driven).
function playMatch(state: State, code: string, rng: () => number): void {
  const mt = state.matches.find((x) => x.code === code)!;
  const loserScore = Math.floor(rng() * 5); // 0..4
  if (rng() < 0.5) applyResult(state, code, 5, loserScore);
  else applyResult(state, code, loserScore, 5);
}

describe("structure specs match the locked-in spec totals", () => {
  for (const n of COUNTS) {
    test(`${n} players: declared counts are consistent`, () => {
      const s = STRUCTURES[n];
      expect(s.matches.length).toBe(EXPECTED[n].knockout);
      expect(s.knockoutMatches).toBe(EXPECTED[n].knockout);
      expect(s.groupMatches).toBe(EXPECTED[n].group);
      const seats = s.groups.reduce((a, b) => a + b, 0);
      expect(seats).toBe(n);
    });
  }
});

describe("group stage generation", () => {
  for (const n of COUNTS) {
    test(`${n} players: draw fills groups and generates the right match count`, () => {
      const stage = createGroupStage(makePlayers(n), makeRng(n * 7 + 1));
      expect(stage.players.length).toBe(n);
      expect(stage.matches.length).toBe(EXPECTED[n].group);
      // Every player assigned to a group; group sizes correct.
      stage.structure.groups.forEach((size, g) => {
        expect(stage.players.filter((p) => p.group === g).length).toBe(size);
      });
      // Group matches are ready immediately.
      expect(stage.matches.every((m) => m.status === "ready")).toBe(true);
    });
  }
});

describe("full tournament simulation resolves to exactly one champion", () => {
  for (const n of COUNTS) {
    test(`${n} players: play group stage → knockout → Grand Final`, () => {
      const rng = makeRng(n * 101 + 13);
      const stage = createGroupStage(makePlayers(n), rng);
      const state: State = {
        structure: stage.structure,
        players: stage.players,
        matches: stage.matches,
      };

      // Play out the entire group stage.
      for (const gm of state.matches.filter((m) => m.stage === "group")) {
        playMatch(state, gm.code, rng);
      }
      resolve(state);
      expect(state.matches.filter((m) => m.stage === "group").every((m) => m.status === "done")).toBe(
        true,
      );

      // Generate the knockout bracket.
      const ko = generateKnockout(state, rng);
      expect(ko.length).toBe(EXPECTED[n].knockout);

      // Play every knockout match as it becomes ready.
      let guard = 0;
      while (guard++ < 200) {
        const next = state.matches.find((m) => m.stage !== "group" && m.status === "ready");
        if (!next) break;
        playMatch(state, next.code, rng);
      }

      // No knockout match left unresolved.
      const stuck = state.matches.filter((m) => m.stage !== "group" && m.status !== "done");
      expect(stuck.map((m) => m.code)).toEqual([]);

      // Exactly one champion, and it's a real player.
      const champ = champion(state);
      expect(champ).not.toBeNull();
      expect(state.players.some((p) => p.id === champ)).toBe(true);

      // Total matches played == group + knockout.
      const done = state.matches.filter((m) => m.status === "done").length;
      expect(done).toBe(EXPECTED[n].total);
    });
  }
});

describe("pool draw avoids same-group pairings where possible", () => {
  test("12 players: MB Round 1 pool-vs-pool matches are cross-group", () => {
    // 12 = 3 groups of 4, 6 middles across 3 groups → same-group avoidance is
    // always satisfiable for the pool-vs-pool matches.
    for (let seed = 0; seed < 20; seed++) {
      const rng = makeRng(seed * 31 + 5);
      const stage = createGroupStage(makePlayers(12), rng);
      const state: State = { structure: stage.structure, players: stage.players, matches: stage.matches };
      for (const gm of state.matches.filter((m) => m.stage === "group")) playMatch(state, gm.code, rng);
      resolve(state);
      generateKnockout(state, rng);
      const byId = new Map(state.players.map((p) => [p.id, p]));
      // MB1, MB2 are pool-vs-pool for 12 players.
      for (const code of ["MB1", "MB2"]) {
        const mt = state.matches.find((m) => m.code === code)!;
        expect(byId.get(mt.p1!)!.group).not.toBe(byId.get(mt.p2!)!.group);
      }
    }
  });
});
