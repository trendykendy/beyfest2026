import { describe, expect, test } from "bun:test";
import { knockoutTiers, liveMatches, nextMatchFor, recentResults, upNext, type PBMatch } from "../web/src/lib/view";
import { resolveFollow } from "../web/src/lib/follow";
import type { PBPlayer } from "../web/src/lib/view";

// A match with just the fields these helpers read.
function match(code: string, order: number, status: PBMatch["matchStatus"], p1 = "", p2 = "", extra: Partial<PBMatch> = {}): PBMatch {
  return {
    id: code,
    code,
    stage: "group",
    roundLabel: "Group 1",
    orderIndex: order,
    p1,
    p2,
    liveP1: 0,
    liveP2: 0,
    startedAt: "",
    resultAt: "",
    matchStatus: status,
    ...extra,
  } as PBMatch;
}

describe("what's on and what's next", () => {
  const ms = [
    match("G3", 3, "ready", "C", "D"),
    match("G1", 1, "done", "A", "B", { resultAt: "2026-10-25T10:05:00Z" }),
    match("G2", 2, "ready", "A", "C", { startedAt: "2026-10-25T10:10:00Z" }), // live
    match("G4", 4, "ready", "B", "D"),
    match("G0", 0, "done", "C", "D", { resultAt: "2026-10-25T10:20:00Z" }), // played late
  ];

  test("live matches are the started ones", () => {
    expect(liveMatches(ms).map((m) => m.code)).toEqual(["G2"]);
  });

  test("up next is play order, live and done left out", () => {
    expect(upNext(ms).map((m) => m.code)).toEqual(["G3", "G4"]);
  });

  test("the organiser's pick goes first", () => {
    expect(upNext(ms, "G4").map((m) => m.code)).toEqual(["G4", "G3"]);
  });

  test("recent results are newest recorded first, up to n", () => {
    expect(recentResults(ms, 5).map((m) => m.code)).toEqual(["G0", "G1"]);
    expect(recentResults(ms, 1).map((m) => m.code)).toEqual(["G0"]);
  });
});

describe("nextMatchFor", () => {
  const ms = [
    match("G1", 1, "ready", "A", "B", { liveP1: 2 }), // live
    match("G2", 2, "ready", "C", "D"),
    match("G3", 3, "ready", "E", "A"),
    match("WB1", 10, "pending", "D", "", { stage: "wb" }),
    match("G0", 0, "done", "F", "D"),
  ];

  test("a live match comes first", () => {
    expect(nextMatchFor("A", ms)).toMatchObject({ state: "live", ahead: 0, match: { code: "G1" } });
  });

  test("a playable one says how many are called before it", () => {
    expect(nextMatchFor("E", ms)).toMatchObject({ state: "ready", ahead: 1, match: { code: "G3" } });
    expect(nextMatchFor("E", ms, "G3")).toMatchObject({ state: "ready", ahead: 0 });
  });

  test("a playable match beats a knockout still waiting for its other side", () => {
    expect(nextMatchFor("D", ms)).toMatchObject({ state: "ready", match: { code: "G2" } });
    const later = ms.filter((m) => m.code !== "G2");
    expect(nextMatchFor("D", later)).toMatchObject({ state: "waiting", match: { code: "WB1" } });
  });

  test("nothing left to play is null", () => {
    expect(nextMatchFor("F", ms)).toBeNull();
  });
});

describe("knockoutTiers", () => {
  const ms = [
    match("G1", 0, "done"),
    match("GF", 40, "pending", "", "", { stage: "gf", roundLabel: "Phase 7 — Grand Final" }),
    match("LBRR1", 11, "ready", "", "", { stage: "lb_rr", roundLabel: "Phase 2 — LB Mini-RR" }),
    match("WBRR1", 10, "ready", "", "", { stage: "wb_rr", roundLabel: "Phase 2 — WB Mini-RR" }),
    match("MB1", 20, "pending", "", "", { stage: "mb", roundLabel: "Phase 3 — MB R1" }),
    match("MB2", 21, "pending", "", "", { stage: "mb", roundLabel: "Phase 3 — MB R1" }),
    match("MB3", 30, "pending", "", "", { stage: "mb", roundLabel: "Phase 4 — MB R2" }),
  ];
  const tiers = knockoutTiers(ms);

  test("tiers in winners, mid, losers, final order; group matches left out", () => {
    expect(tiers.map((t) => t.tier)).toEqual(["wb", "mb", "lb", "gf"]);
  });

  test("rounds in play order, matches grouped under them", () => {
    const mid = tiers.find((t) => t.tier === "mb")!;
    expect(mid.rounds.map((r) => [r.label, r.matches.map((m) => m.code)])).toEqual([
      ["Phase 3 — MB R1", ["MB1", "MB2"]],
      ["Phase 4 — MB R2", ["MB3"]],
    ]);
  });

  test("mini round-robins sit in their tier", () => {
    expect(tiers[0].rounds[0].matches[0].code).toBe("WBRR1");
    expect(tiers[2].rounds[0].matches[0].code).toBe("LBRR1");
  });
});

describe("resolveFollow", () => {
  const players = [
    { id: "p1", name: "Conor" },
    { id: "p2", name: "Sean" },
  ] as PBPlayer[];

  test("finds the player by id", () => {
    expect(resolveFollow({ id: "p2", name: "Someone" }, players)?.name).toBe("Sean");
  });

  test("falls back to the name when the tournament was recreated", () => {
    expect(resolveFollow({ id: "old", name: "  conor " }, players)?.id).toBe("p1");
  });

  test("null when they're not in this tournament, or nobody is followed", () => {
    expect(resolveFollow({ id: "old", name: "Mark" }, players)).toBeNull();
    expect(resolveFollow(null, players)).toBeNull();
  });
});
