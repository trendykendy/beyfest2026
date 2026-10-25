import { describe, expect, test } from "bun:test";
import {
  CALLS_GAP,
  CHAMPION_CALL_START,
  CHAMPION_FRESH_MS,
  callSequence,
  championCallFresh,
} from "../web/src/lib/sounds";

describe("championCallFresh", () => {
  const seen = 1_000_000;
  test("calls when the scene shows soon after the result", () => {
    expect(championCallFresh(seen, seen)).toBe(true);
    expect(championCallFresh(seen, seen + 20_000)).toBe(true);
  });
  test("still calls after a full rotation behind Match centre (about two minutes)", () => {
    expect(championCallFresh(seen, seen + 125_000)).toBe(true);
    expect(championCallFresh(seen, seen + CHAMPION_FRESH_MS)).toBe(true);
  });
  test("stays quiet once the result is old", () => {
    expect(championCallFresh(seen, seen + CHAMPION_FRESH_MS + 1)).toBe(false);
    expect(championCallFresh(seen, seen + 30 * 60_000)).toBe(false);
  });
  test("a clock that went backwards doesn't count as fresh", () => {
    expect(championCallFresh(seen, seen - 1)).toBe(false);
  });
});

describe("champion call timing", () => {
  test("name lands with the slam, the title after a breath", () => {
    const { starts, end } = callSequence([1200, 2000], CHAMPION_CALL_START);
    expect(starts).toEqual([CHAMPION_CALL_START, CHAMPION_CALL_START + 1200 + CALLS_GAP]);
    expect(end).toBe(CHAMPION_CALL_START + 1200 + CALLS_GAP + 2000);
  });
  test("no name clip: just the title, on the slam", () => {
    expect(callSequence([2000], CHAMPION_CALL_START)).toEqual({
      starts: [CHAMPION_CALL_START],
      end: CHAMPION_CALL_START + 2000,
    });
  });
  test("the slam is when ChampionScene's name slab lands", () => {
    expect(CHAMPION_CALL_START).toBe(450);
  });
});
