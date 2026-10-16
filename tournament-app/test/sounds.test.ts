import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { CALLS_START, INTRO_OUT, MUSIC, VERSUS, callTimes, pickOther, titleClip } from "../web/src/lib/sounds";

const STATIC = join(import.meta.dir, "../web/static");

describe("titleClip", () => {
  test("group matches say their group", () => {
    expect(titleClip({ stage: "group", roundLabel: "Group 1" })).toBe("/sounds/titles/group-1.mp3");
    expect(titleClip({ stage: "group", roundLabel: "Group 5" })).toBe("/sounds/titles/group-5.mp3");
  });
  test("a group with no clip says nothing", () => {
    expect(titleClip({ stage: "group", roundLabel: "Group 6" })).toBe("");
  });
  test("knockout matches say their bracket", () => {
    expect(titleClip({ stage: "wb", roundLabel: "Phase 1A — WB Semis" })).toBe("/sounds/titles/winners-bracket.mp3");
    expect(titleClip({ stage: "mb", roundLabel: "Phase 4 — MB R2" })).toBe("/sounds/titles/mid-bracket.mp3");
    expect(titleClip({ stage: "lb", roundLabel: "Phase 1B — LB Match" })).toBe("/sounds/titles/losers-bracket.mp3");
    expect(titleClip({ stage: "wb_rr", roundLabel: "Phase 1A — WB Mini-RR" })).toBe(
      "/sounds/titles/winners-round-robin.mp3",
    );
    expect(titleClip({ stage: "lb_rr", roundLabel: "Phase 1B — LB Mini-RR" })).toBe(
      "/sounds/titles/losers-round-robin.mp3",
    );
    expect(titleClip({ stage: "gf", roundLabel: "Phase 7 — Grand Final" })).toBe("/sounds/titles/grand-final.mp3");
  });
  test("8 players: upper and lower borrow the winners and losers clips", () => {
    expect(titleClip({ stage: "ub", roundLabel: "Upper Bracket — Final" })).toBe("/sounds/titles/winners-bracket.mp3");
    expect(titleClip({ stage: "lb", roundLabel: "Lower Bracket — Round 1" })).toBe("/sounds/titles/losers-bracket.mp3");
  });
  test("every clip it can name exists", () => {
    const stages = ["wb", "ub", "lb", "mb", "wb_rr", "lb_rr", "gf"] as const;
    const urls = [
      ...[1, 2, 3, 4, 5].map((n) => titleClip({ stage: "group", roundLabel: `Group ${n}` })),
      ...stages.map((stage) => titleClip({ stage, roundLabel: "" })),
      ...MUSIC,
      ...VERSUS,
    ];
    for (const u of urls) expect(existsSync(join(STATIC, u))).toBe(true);
  });
});

describe("pickOther", () => {
  test("never repeats the last pick when there's a choice", () => {
    for (let i = 0; i < 50; i++) expect(pickOther(["a", "b", "c"], "b")).not.toBe("b");
  });
  test("a single option is always picked", () => {
    expect(pickOther(["a"], "a")).toBe("a");
  });
});

describe("callTimes", () => {
  test("calls follow each other from the slam, with a breath between", () => {
    const { starts } = callTimes([1200, 700, 1100, 1000]);
    expect(starts).toEqual([CALLS_START, CALLS_START + 1350, CALLS_START + 2200, CALLS_START + 3450]);
  });
  test("the intro holds until the last call is done", () => {
    // 450 + 1200+150 + 700+150 + 1100+150 + 1000 = 4900, plus a 400 tail
    expect(callTimes([1200, 700, 1100, 1000]).out).toBe(5300);
  });
  test("short calls never make the intro shorter than it was", () => {
    expect(callTimes([300]).out).toBe(INTRO_OUT);
    expect(callTimes([]).out).toBe(INTRO_OUT);
  });
});
