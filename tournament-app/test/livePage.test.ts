import { describe, expect, test } from "bun:test";
import {
  knockoutTiers,
  openingGroup,
  openingTier,
  playerRecord,
  sideName,
  type PBGroup,
  type PBMatch,
  type PBPlayer,
} from "../web/src/lib/view";
import { sharedLoader } from "../web/src/lib/server/sharedView";

// A match with just the fields these helpers read.
function match(code: string, order: number, status: PBMatch["matchStatus"], p1 = "", p2 = "", extra: Partial<PBMatch> = {}): PBMatch {
  return {
    id: code,
    code,
    stage: "group",
    roundLabel: "Group 1",
    orderIndex: order,
    groupIndex: 0,
    slot1: null,
    slot2: null,
    p1,
    p2,
    liveP1: 0,
    liveP2: 0,
    startedAt: "",
    resultAt: "",
    winner: "",
    matchStatus: status,
    ...extra,
  } as PBMatch;
}

describe("sideName", () => {
  const names = new Map([["A", "Conor"]]);

  test("the player's name once they're in the slot", () => {
    expect(sideName(match("G1", 1, "ready", "A", "B"), 1, names, 3)).toBe("Conor");
  });

  test("where they come from until then", () => {
    const m = match("MB1", 1, "pending", "", "", { slot2: { k: "groupRank", group: 0, rank: 1 } });
    expect(sideName(m, 2, names, 3)).toBe("Group 1 winner");
  });
});

describe("playerRecord", () => {
  test("counts finished matches only, walkovers included", () => {
    const ms = [
      match("G1", 1, "done", "A", "B", { winner: "A" }),
      match("G2", 2, "done", "C", "A", { winner: "C" }),
      match("G3", 3, "done", "A", "D", { winner: "A", walkover: true }),
      match("G4", 4, "ready", "A", "E"),
    ];
    expect(playerRecord("A", ms)).toEqual({ wins: 2, losses: 1 });
  });
});

describe("openingGroup", () => {
  const groups = [{ index: 0 }, { index: 1 }] as PBGroup[];
  const players = [
    { id: "A", groupIndex: 0 },
    { id: "C", groupIndex: 1 },
  ] as PBPlayer[];
  const ms = [
    match("G1", 1, "ready", "A", "B"),
    match("G2", 2, "ready", "C", "D", { groupIndex: 1, startedAt: "2026-10-25T10:00:00Z" }), // live
  ];

  test("the followed blader's group first", () => {
    expect(openingGroup(groups, players, ms, "A")).toBe(0);
  });

  test("else the group with a match on, else the one playing next", () => {
    expect(openingGroup(groups, players, ms)).toBe(1);
    expect(openingGroup(groups, players, [ms[0]])).toBe(0);
  });

  test("else the first group; null with no groups", () => {
    expect(openingGroup(groups, players, [])).toBe(0);
    expect(openingGroup([], [], [])).toBeNull();
  });
});

describe("openingTier", () => {
  const ms = [
    match("WB1", 10, "done", "A", "B", { stage: "wb", roundLabel: "WB R1", winner: "A" }),
    match("MB1", 20, "ready", "C", "D", { stage: "mb", roundLabel: "MB R1" }),
    match("LB1", 30, "ready", "E", "F", { stage: "lb", roundLabel: "LB R1" }),
    match("GF", 40, "pending", "A", "", { stage: "gf", roundLabel: "Grand Final" }),
  ];
  const tiers = knockoutTiers(ms);

  test("where the followed blader plays next", () => {
    expect(openingTier(tiers, ms, "E")).toBe("lb");
    expect(openingTier(tiers, ms, "A")).toBe("gf"); // waiting in the final
  });

  test("else where the next match is", () => {
    expect(openingTier(tiers, ms)).toBe("mb");
    expect(openingTier(tiers, ms, "", "LB1")).toBe("lb");
  });

  test("else the last tier", () => {
    const over = ms.map((m) => ({ ...m, matchStatus: "done" as const }));
    expect(openingTier(knockoutTiers(over), over)).toBe("gf");
    expect(openingTier([], [])).toBeNull();
  });
});

describe("sharedLoader", () => {
  // A load we finish by hand, to control what's in flight.
  function manual() {
    let loads = 0;
    const finish: (() => void)[] = [];
    const load = sharedLoader(
      () =>
        new Promise<number>((resolve) => {
          const n = ++loads;
          finish.push(() => resolve(n));
        }),
    );
    return { load, finish, count: () => loads };
  }

  test("a burst during a load shares one follow-up load, never the stale one", async () => {
    const { load, finish, count } = manual();
    const first = load();
    const burst = [load(), load(), load()];
    expect(count()).toBe(1); // the follow-up waits for the running load
    finish[0]();
    expect(await first).toBe(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(count()).toBe(2);
    finish[1]();
    expect(await Promise.all(burst)).toEqual([2, 2, 2]);
  });

  test("once idle, the next request starts a fresh load", async () => {
    const { load, finish } = manual();
    const a = load();
    finish[0]();
    expect(await a).toBe(1);
    const b = load();
    finish[1]();
    expect(await b).toBe(2);
  });

  test("a failed load is retried by the next request", async () => {
    let fail = true;
    const load = sharedLoader(async () => {
      if (fail) throw new Error("down");
      return "ok";
    });
    await expect(load()).rejects.toThrow("down");
    fail = false;
    expect(await load()).toBe("ok");
  });
});
