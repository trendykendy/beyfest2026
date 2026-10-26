import { describe, expect, test } from "bun:test";
import { laterBattles, planInWords, planRoyale, qualifiers, royaleView, type PBRoyale, type RoyalePlan } from "../web/src/lib/royale";

const names = (n: number) => Array.from({ length: n }, (_, i) => `P${i + 1}`);
const royale = (n: number, spaces: number, battles: PBRoyale["battles"] = {}): PBRoyale => ({
  id: "r",
  spaces,
  entrants: names(n),
  battles,
});
const plan = (n: number, s: number) => planRoyale(n, s) as RoyalePlan;

describe("planRoyale", () => {
  test("12 players, 5 spaces: 3 heats of 4, final of 5 with a sudden death of 3 for 2 places", () => {
    expect(planRoyale(12, 5)).toEqual({ heats: [4, 4, 4], finalSize: 5, sudden: 3, suddenPlaces: 2 });
  });
  test("uneven heats put the extra players in the first heats", () => {
    expect(plan(7, 5).heats).toEqual([4, 3]);
    expect(plan(15, 4).heats).toEqual([4, 4, 4, 3]);
  });
  test("runners-up who all fit go straight through (no sudden death)", () => {
    expect(planRoyale(7, 5)).toEqual({ heats: [4, 3], finalSize: 4, sudden: 0, suddenPlaces: 0 });
  });
  test("heat winners filling every space: no runners-up, no sudden death", () => {
    expect(planRoyale(9, 3)).toEqual({ heats: [3, 3, 3], finalSize: 3, sudden: 0, suddenPlaces: 0 });
  });
  test("everyone fits: a single battle", () => {
    expect(planRoyale(5, 5)).toEqual({ heats: [], finalSize: 5, sudden: 0, suddenPlaces: 0 });
  });
  test("too few spaces for the heat winners to fit in one final", () => {
    expect(planRoyale(26, 5)).toEqual({ error: expect.stringContaining("at least 6 spaces") });
  });
  test("out-of-range spaces and too few players", () => {
    expect("error" in planRoyale(10, 1)).toBe(true);
    expect("error" in planRoyale(10, 9)).toBe(true);
    expect("error" in planRoyale(1, 4)).toBe(true);
    expect("error" in planRoyale(3, 2)).toBe(true); // a heat of 1
  });
  test("every plan from 4 to 16 players and 2 to 8 spaces fits", () => {
    for (let n = 4; n <= 16; n++)
      for (let s = 2; s <= 8; s++) {
        const p = planRoyale(n, s);
        if ("error" in p) continue;
        expect(p.heats.reduce((a, b) => a + b, 0) || p.finalSize).toBe(n);
        expect(Math.max(...p.heats, 0)).toBeLessThanOrEqual(s);
        expect(p.finalSize).toBeLessThanOrEqual(s);
        expect(p.sudden).toBeLessThanOrEqual(s);
      }
  });
});

describe("planInWords", () => {
  test("the admin preview", () => {
    expect(planInWords(plan(12, 5))).toBe("3 heats of 4 → final of 5 (3 heat winners + 2 from a sudden death of 3).");
    expect(planInWords(plan(7, 5))).toBe("1 heat of 4 and 1 heat of 3 → final of 4 (2 heat winners + 2 runners-up).");
    expect(planInWords(plan(5, 5))).toBe("One battle of 5: last bey standing wins.");
  });
});

describe("royaleView", () => {
  test("a fresh 12/5: three heats ready, sudden death and final waiting", () => {
    const v = royaleView(royale(12, 5))!;
    expect(v.battles.map((b) => [b.key, b.status, b.entrants.length])).toEqual([
      ["H1", "ready", 4],
      ["H2", "ready", 4],
      ["H3", "ready", 4],
      ["SD", "waiting", 0],
      ["F", "waiting", 0],
    ]);
    expect(v.battles[1].entrants).toEqual(["P5", "P6", "P7", "P8"]);
    expect(v.next?.key).toBe("H1");
  });

  test("a started heat is live and comes first as next", () => {
    const v = royaleView(royale(12, 5, { H2: { startedAt: "t" } }))!;
    expect(v.battles[1].status).toBe("live");
    expect(v.next?.key).toBe("H2");
  });

  test("all the way through: heats → sudden death → final → champion", () => {
    const battles: PBRoyale["battles"] = {
      H1: { winner: "P1", runnerUp: "P2" },
      H2: { winner: "P5", runnerUp: "P6" },
      H3: { winner: "P9", runnerUp: "P10" },
    };
    let v = royaleView(royale(12, 5, battles))!;
    const sd = v.battles.find((b) => b.key === "SD")!;
    expect(sd.status).toBe("ready");
    expect(sd.entrants).toEqual(["P2", "P6", "P10"]);
    expect(sd.places).toBe(2);

    battles.SD = { advancing: ["P6", "P10"] };
    v = royaleView(royale(12, 5, battles))!;
    expect(v.battles.find((b) => b.key === "F")!.entrants).toEqual(["P1", "P5", "P9", "P6", "P10"]);

    battles.F = { winner: "P10", runnerUp: "P1" };
    v = royaleView(royale(12, 5, battles))!;
    expect(v.champion).toBe("P10");
    expect(v.runnerUp).toBe("P1");
    expect(v.next).toBeNull();
  });

  test("runners-up go straight to the final when they all fit", () => {
    const v = royaleView(
      royale(7, 5, { H1: { winner: "P1", runnerUp: "P2" }, H2: { winner: "P7", runnerUp: "P6" } }),
    )!;
    expect(v.battles.map((b) => b.key)).toEqual(["H1", "H2", "F"]);
    expect(v.battles[2].entrants).toEqual(["P1", "P7", "P2", "P6"]);
    expect(v.battles[2].status).toBe("ready");
  });

  test("a single battle is the final, ready at once", () => {
    const v = royaleView(royale(4, 5))!;
    expect(v.battles.map((b) => [b.key, b.status, b.entrants])).toEqual([["F", "ready", ["P1", "P2", "P3", "P4"]]]);
  });

  test("fixing a heat re-flows: a final result naming someone no longer in it doesn't count", () => {
    const battles: PBRoyale["battles"] = {
      H1: { winner: "P1", runnerUp: "P2" },
      H2: { winner: "P7", runnerUp: "P6" },
      F: { winner: "P2", runnerUp: "P1" },
    };
    expect(royaleView(royale(7, 5, battles))!.champion).toBe("P2");
    battles.H1 = { winner: "P1", runnerUp: "P3" }; // P2 wasn't really the runner-up
    const v = royaleView(royale(7, 5, battles))!;
    expect(v.champion).toBe("");
    expect(v.battles[2].status).toBe("ready");
    expect(v.battles[2].result).toEqual({});
  });

  test("a sudden death needs exactly its number of places", () => {
    const base = { H1: { winner: "P1", runnerUp: "P2" }, H2: { winner: "P5", runnerUp: "P6" }, H3: { winner: "P9", runnerUp: "P10" } };
    const v = royaleView(royale(12, 5, { ...base, SD: { advancing: ["P2"] } }))!;
    expect(v.battles.find((b) => b.key === "SD")!.status).toBe("ready");
  });
});

describe("laterBattles", () => {
  test("a heat feeds the sudden death and final; the sudden death feeds the final", () => {
    const v = royaleView(royale(12, 5))!;
    expect(laterBattles(v, "H1").map((b) => b.key)).toEqual(["SD", "F"]);
    expect(laterBattles(v, "SD").map((b) => b.key)).toEqual(["F"]);
    expect(laterBattles(v, "F")).toEqual([]);
  });
});

describe("qualifiers", () => {
  const heat = (v: ReturnType<typeof royaleView>, key: string) => v!.battles.find((b) => b.key === key)!;
  test("with a sudden death to come, a heat sends its winner through and its runner-up to the sudden death", () => {
    const v = royaleView(royale(12, 5, { H1: { winner: "P1", runnerUp: "P2" } }));
    expect(qualifiers(v!.plan, heat(v, "H1"))).toEqual({ through: ["P1"], toSudden: "P2" });
  });
  test("runners-up who all fit go through with the winner", () => {
    const v = royaleView(royale(7, 5, { H1: { winner: "P1", runnerUp: "P2" } }));
    expect(qualifiers(v!.plan, heat(v, "H1"))).toEqual({ through: ["P1", "P2"], toSudden: "" });
  });
  test("heat winners filling the final: only the winner", () => {
    const v = royaleView(royale(9, 3, { H1: { winner: "P1", runnerUp: "P2" } }));
    expect(qualifiers(v!.plan, heat(v, "H1"))).toEqual({ through: ["P1"], toSudden: "" });
  });
  test("the sudden death sends through who it advances", () => {
    const base = { H1: { winner: "P1", runnerUp: "P2" }, H2: { winner: "P5", runnerUp: "P6" }, H3: { winner: "P9", runnerUp: "P10" } };
    const v = royaleView(royale(12, 5, { ...base, SD: { advancing: ["P2", "P10"] } }));
    expect(qualifiers(v!.plan, heat(v, "SD"))).toEqual({ through: ["P2", "P10"], toSudden: "" });
  });
  test("an unfinished heat, or the final: nobody", () => {
    const v = royaleView(royale(7, 5));
    expect(qualifiers(v!.plan, heat(v, "H1"))).toEqual({ through: [], toSudden: "" });
    expect(qualifiers(v!.plan, heat(v, "F"))).toEqual({ through: [], toSudden: "" });
  });
});
