import { describe, expect, test } from "bun:test";
import {
  STRUCTURES,
  createGroupStage,
  makeRng,
  roundRobinRounds,
  type PlayerInput,
} from "../src/index";

const COUNTS = [8, 9, 10, 11, 12, 13, 14, 15];

function makePlayers(n: number): PlayerInput[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${String.fromCharCode(65 + i)}`,
  }));
}

// Key for an unordered pairing (group + the two member ids, order-independent).
function pairKey(g: number, a: string, b: string): string {
  return `${g}:${[a, b].sort().join("|")}`;
}

describe("round-robin rounds (circle method)", () => {
  for (const size of [3, 4, 5]) {
    test(`size ${size} single: every pair once, no repeat within a round`, () => {
      const rounds = roundRobinRounds(size, "single");
      const seen = new Set<string>();
      for (const round of rounds) {
        const inRound = new Set<number>();
        for (const [a, b] of round) {
          expect(inRound.has(a)).toBe(false);
          expect(inRound.has(b)).toBe(false);
          inRound.add(a);
          inRound.add(b);
          seen.add([a, b].sort((x, y) => x - y).join("|"));
        }
      }
      expect(seen.size).toBe((size * (size - 1)) / 2);
    });
  }

  for (const size of [3, 4]) {
    test(`size ${size} double: each pair appears in each leg`, () => {
      const rounds = roundRobinRounds(size, "double");
      const total = rounds.reduce((n, r) => n + r.length, 0);
      expect(total).toBe(size * (size - 1)); // twice C(size,2)
    });
  }
});

describe("group stage schedule keeps the right pairings", () => {
  for (const n of COUNTS) {
    test(`${n} players: every unordered pair the correct number of times`, () => {
      const stage = createGroupStage(makePlayers(n), makeRng(n * 13 + 3));
      const s = STRUCTURES[n];
      const times = s.roundRobin === "double" ? 2 : 1;

      // Count how often each unordered same-group pairing appears.
      const counts = new Map<string, number>();
      for (const m of stage.matches) {
        expect(m.stage).toBe("group");
        const key = pairKey(m.group!, m.p1!, m.p2!);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }

      // Expected total = sum over groups of C(size,2) * times.
      const expectedPairs = s.groups.reduce((sum, size) => sum + (size * (size - 1)) / 2, 0);
      expect(counts.size).toBe(expectedPairs);
      for (const c of counts.values()) expect(c).toBe(times);
      expect(stage.matches.length).toBe(s.groupMatches);

      // Codes are unique per group and follow the G{g+1}-{n} scheme.
      const codes = new Set(stage.matches.map((m) => m.code));
      expect(codes.size).toBe(stage.matches.length);
      for (const m of stage.matches) expect(m.code).toMatch(new RegExp(`^G${m.group! + 1}-\\d+$`));

      // orderIndex is a 1..N permutation.
      const orders = stage.matches.map((m) => m.orderIndex).sort((a, b) => a - b);
      expect(orders).toEqual(Array.from({ length: stage.matches.length }, (_, i) => i + 1));
    });
  }
});

describe("group stage schedule gives players rest (no back-to-back)", () => {
  for (const n of COUNTS) {
    test(`${n} players: no player in two globally-consecutive group matches`, () => {
      // Try several draws — the property must hold regardless of the random draw.
      for (let seed = 0; seed < 25; seed++) {
        const stage = createGroupStage(makePlayers(n), makeRng(seed * 17 + n));
        const ordered = stage.matches
          .filter((m) => m.stage === "group")
          .sort((a, b) => a.orderIndex - b.orderIndex);
        for (let i = 1; i < ordered.length; i++) {
          const prev = ordered[i - 1];
          const cur = ordered[i];
          const shared =
            prev.p1 === cur.p1 ||
            prev.p1 === cur.p2 ||
            prev.p2 === cur.p1 ||
            prev.p2 === cur.p2;
          expect(shared).toBe(false);
        }
      }
    });
  }
});
