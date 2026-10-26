import { describe, expect, test } from "bun:test";
import { bettingOpen, formOf, matchOdds, oddsFor, raceChance, START_BALANCE } from "../web/src/lib/odds";
import { betState, books, cleanName, leaderboard, sameName, type PBBet } from "../web/src/lib/betting";
import type { PBMatch } from "../web/src/lib/view";

// A match with just the fields the betting helpers read.
function match(code: string, p1: string, p2: string, extra: Partial<PBMatch> = {}): PBMatch {
  return {
    id: code,
    code,
    stage: "group",
    roundLabel: "Group 1",
    orderIndex: 0,
    groupIndex: 0,
    p1,
    p2,
    p1Score: null,
    p2Score: null,
    liveP1: 0,
    liveP2: 0,
    startedAt: "",
    resultAt: "",
    walkover: false,
    winner: "",
    loser: "",
    matchStatus: "ready",
    ...extra,
  } as PBMatch;
}
const done = (code: string, p1: string, p2: string, s1: number, s2: number, extra: Partial<PBMatch> = {}) =>
  match(code, p1, p2, { matchStatus: "done", p1Score: s1, p2Score: s2, winner: s1 > s2 ? p1 : p2, loser: s1 > s2 ? p2 : p1, ...extra });

function bet(id: string, bettor: string, m: string, pick: string, stake: number, odds: number): PBBet {
  return { id, bettor, match: m, pick, stake, odds, created: `2026-11-07T10:00:0${id.slice(-1)}Z` };
}

describe("raceChance", () => {
  test("even points make an even race", () => {
    expect(raceChance(5, 5, 0.5)).toBeCloseTo(0.5, 10);
  });
  test("a race already won or lost", () => {
    expect(raceChance(0, 3, 0.5)).toBe(1);
    expect(raceChance(3, 0, 0.5)).toBe(0);
  });
  test("one point each to go is the point chance", () => {
    expect(raceChance(1, 1, 0.7)).toBeCloseTo(0.7, 10);
  });
  test("the two sides add up to 1", () => {
    expect(raceChance(4, 2, 0.6) + raceChance(2, 4, 0.4)).toBeCloseTo(1, 10);
  });
});

describe("matchOdds", () => {
  const fresh = match("M", "A", "B");

  test("two bladers with no record get the same odds", () => {
    const o = matchOdds(fresh, [fresh]);
    expect(o.p1).toBe(o.p2);
    expect(o.p1).toBe(oddsFor(0.5));
  });

  test("more wins give shorter odds", () => {
    const all = [done("G1", "A", "C", 5, 4), done("G2", "B", "C", 4, 5), fresh];
    const o = matchOdds(fresh, all);
    expect(o.p1).toBeLessThan(o.p2);
  });

  test("a better points diff gives shorter odds on the same wins", () => {
    const all = [done("G1", "A", "C", 5, 0), done("G2", "B", "D", 5, 4), fresh];
    const o = matchOdds(fresh, all);
    expect(o.p1).toBeLessThan(o.p2);
  });

  test("walkovers don't count as form", () => {
    const all = [done("G1", "A", "C", 5, 0, { walkover: true }), fresh];
    expect(formOf("A", all)).toEqual({ wins: 0, pointDiff: 0 });
  });

  test("the odds move with the live score", () => {
    const leading = match("M", "A", "B", { liveP1: 3, liveP2: 0, startedAt: "x" });
    const before = matchOdds(fresh, [fresh]);
    const now = matchOdds(leading, [leading]);
    expect(now.p1).toBeLessThan(before.p1);
    expect(now.p2).toBeGreaterThan(before.p2);
  });

  test("odds stay between 1.05 and 20", () => {
    expect(oddsFor(1)).toBe(1.05);
    expect(oddsFor(0)).toBe(20);
  });
});

describe("bettingOpen", () => {
  test("open while both bladers are known and nobody is on match point", () => {
    expect(bettingOpen(match("M", "A", "B"))).toBe(true);
    expect(bettingOpen(match("M", "A", "B", { liveP1: 3, liveP2: 3 }))).toBe(true);
  });
  test("closed on match point (first to 5: at 4)", () => {
    expect(bettingOpen(match("M", "A", "B", { liveP2: 4 }))).toBe(false);
  });
  test("the grand final (first to 9) closes at 8", () => {
    const gf = { stage: "gf" as const, roundLabel: "Phase 7 — Grand Final" };
    expect(bettingOpen(match("GF", "A", "B", { ...gf, liveP1: 7 }))).toBe(true);
    expect(bettingOpen(match("GF", "A", "B", { ...gf, liveP1: 8 }))).toBe(false);
  });
  test("closed once done, or with a side still to be decided", () => {
    expect(bettingOpen(done("M", "A", "B", 5, 2))).toBe(false);
    expect(bettingOpen(match("M", "A", "", { matchStatus: "pending" }))).toBe(false);
  });
});

describe("books", () => {
  const bettors = [
    { id: "x", name: "Xena" },
    { id: "y", name: "Yuri" },
  ];

  test("everyone starts with the starting balance", () => {
    const b = books(bettors, [], []);
    expect(b.map((r) => r.balance)).toEqual([START_BALANCE, START_BALANCE]);
  });

  test("an open bet is taken out of the balance and counted as riding", () => {
    const m = match("M", "A", "B");
    const [x] = books(bettors, [bet("b1", "x", "M", "A", 500, 2)], [m]);
    expect(x.balance).toBe(START_BALANCE - 500);
    expect(x.atStake).toBe(500);
    expect(x.bets[0].state).toBe("open");
  });

  test("a winning bet pays stake × odds, a losing one nothing", () => {
    const m = done("M", "A", "B", 5, 3);
    const [x, y] = books(bettors, [bet("b1", "x", "M", "A", 500, 2.5), bet("b2", "y", "M", "B", 1000, 1.6)], [m]);
    expect(x.balance).toBe(START_BALANCE - 500 + 1250);
    expect(y.balance).toBe(START_BALANCE - 1000);
    expect(x.bets[0].state).toBe("won");
    expect(y.bets[0].state).toBe("lost");
  });

  test("a walkover refunds the stake", () => {
    const m = done("M", "A", "B", 5, 0, { walkover: true });
    const [x] = books(bettors, [bet("b1", "x", "M", "B", 700, 3)], [m]);
    expect(x.balance).toBe(START_BALANCE);
    expect(x.bets[0].state).toBe("refund");
  });

  test("a corrected result re-settles: the same bets, the other winner", () => {
    const bets = [bet("b1", "x", "M", "A", 500, 2)];
    const before = books(bettors, bets, [done("M", "A", "B", 5, 3)])[0];
    const after = books(bettors, bets, [done("M", "A", "B", 3, 5)])[0];
    expect(before.balance).toBe(START_BALANCE + 500);
    expect(after.balance).toBe(START_BALANCE - 500);
  });

  test("a bet on a blader no longer in the match is refunded", () => {
    expect(betState(bet("b1", "x", "M", "A", 100, 2), match("M", "C", "B"))).toBe("refund");
  });
});

describe("leaderboard", () => {
  test("richest first, open bets counted at their stake, ties share a rank", () => {
    const bettors = [
      { id: "x", name: "Xena" },
      { id: "y", name: "Yuri" },
      { id: "z", name: "Zed" },
    ];
    const ms = [done("M1", "A", "B", 5, 1), match("M2", "A", "C")];
    const bets = [bet("b1", "x", "M1", "A", 1000, 2), bet("b2", "y", "M2", "C", 4000, 3)];
    const rows = leaderboard(books(bettors, bets, ms));
    expect(rows.map((r) => [r.bettor.name, r.worth, r.rank])).toEqual([
      ["Xena", 11000, 1],
      ["Yuri", 10000, 2],
      ["Zed", 10000, 2],
    ]);
  });
});

describe("betting names", () => {
  test("trimmed and squashed, 2–16 characters", () => {
    expect(cleanName("  Spin   Doctor ")).toBe("Spin Doctor");
    expect(cleanName("A")).toBeNull();
    expect(cleanName("x".repeat(17))).toBeNull();
  });
  test("compared ignoring case and spaces", () => {
    expect(sameName("Spin Doctor", "spindoctor")).toBe(true);
  });
});
