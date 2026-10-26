import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  CALLS_GAP,
  CALLS_START,
  INTRO_OUT,
  MUSIC,
  STINGER,
  VERSUS,
  WINS,
  AND,
  QUALIFIED,
  qualifiedCall,
  callSequence,
  callTimes,
  finishClip,
  pickOther,
  stingerDelay,
  titleClip,
  winsCall,
} from "../web/src/lib/sounds";
import { FINISHES } from "../web/src/lib/finishes";

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
      ...FINISHES.map((f) => finishClip(f.key)),
      WINS,
      STINGER,
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

describe("finishClip", () => {
  test("each finish has its own call, named after its key", () => {
    expect(finishClip("spin")).toBe("/sounds/finishes/spin.mp3");
    expect(finishClip("knockout")).toBe("/sounds/finishes/knockout.mp3");
    expect(finishClip("dominant")).toBe("/sounds/finishes/dominant.mp3");
  });
  test("an unknown finish says nothing", () => {
    expect(finishClip("burst")).toBe("");
    expect(finishClip("")).toBe("");
  });
});

describe("winsCall", () => {
  test("the winner's name, then \"wins!\"", () => {
    expect(winsCall("/voice/ace.mp3", false)).toEqual(["/voice/ace.mp3", WINS]);
  });
  test("a walkover isn't called", () => {
    expect(winsCall("/voice/ace.mp3", true)).toEqual([]);
  });
  test("no name clip, no call", () => {
    expect(winsCall("", false)).toEqual([]);
  });
});

describe("callSequence", () => {
  test("calls follow each other from the start, with a breath between", () => {
    // the winning round: finish (1202 ms), then name (1000) and "wins!" (879) queued after it
    const { starts, end } = callSequence([1202, 1000, 879], 0);
    expect(starts).toEqual([0, 1202 + CALLS_GAP, 1202 + 1000 + 2 * CALLS_GAP]);
    expect(end).toBe(1202 + 1000 + 879 + 2 * CALLS_GAP);
  });
  test("no calls end where they would have started", () => {
    expect(callSequence([], 500)).toEqual({ starts: [], end: 500 });
  });
});

describe("stingerDelay", () => {
  test("hits a breath after the announcer finishes", () => {
    expect(stingerDelay(2000)).toBe(2000 + CALLS_GAP);
  });
  test("hits straight away when nobody's talking", () => {
    expect(stingerDelay(0)).toBe(0);
  });
});

describe("qualifiedCall", () => {
  test("one name, then qualified", () => {
    expect(qualifiedCall(["a.mp3"])).toEqual(["a.mp3", QUALIFIED]);
  });
  test("two names with 'and' between", () => {
    expect(qualifiedCall(["a.mp3", "b.mp3"])).toEqual(["a.mp3", AND, "b.mp3", QUALIFIED]);
  });
  test("three names: 'and' before the last only", () => {
    expect(qualifiedCall(["a.mp3", "b.mp3", "c.mp3"])).toEqual(["a.mp3", "b.mp3", AND, "c.mp3", QUALIFIED]);
  });
  test("names without a voice clip are left out; none at all is just 'qualified'", () => {
    expect(qualifiedCall(["", "b.mp3"])).toEqual(["b.mp3", QUALIFIED]);
    expect(qualifiedCall(["", ""])).toEqual([QUALIFIED]);
  });
  test("the clips are in static/", () => {
    for (const u of [AND, QUALIFIED]) expect(existsSync(join(STATIC, u))).toBe(true);
  });
});
