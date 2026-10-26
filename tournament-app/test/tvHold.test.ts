import { describe, expect, test } from "bun:test";
import { tvHold, type PBMatch, type Scene } from "../web/src/lib/view";

// A match with just the fields tvHold reads.
function match(code: string, stage: PBMatch["stage"], status: PBMatch["matchStatus"], extra: Partial<PBMatch> = {}): PBMatch {
  return { id: code, code, stage, matchStatus: status, liveP1: 0, liveP2: 0, startedAt: "", ...extra } as PBMatch;
}
const ALL: Scene[] = ["groups", "rr", "bracket", "spotlight"];

describe("tvHold", () => {
  test("no hold while group matches are still to play", () => {
    expect(tvHold([match("G1", "group", "done"), match("G2", "group", "ready")], ["groups", "spotlight"])).toBeNull();
  });

  test("every group match done, no knockout yet: hold on the groups", () => {
    expect(tvHold([match("G1", "group", "done"), match("G2", "group", "done")], ["groups", "spotlight"])).toBe("groups");
  });

  test("knockout generated, nothing played: hold on the bracket", () => {
    const ms = [match("G1", "group", "done"), match("MB1", "mb", "ready"), match("GF", "gf", "pending")];
    expect(tvHold(ms, ALL)).toBe("bracket");
  });

  test("the hold ends once a knockout match starts or is played", () => {
    const started = [match("G1", "group", "done"), match("MB1", "mb", "ready", { startedAt: "2026-11-07 12:00:00Z" })];
    const played = [match("G1", "group", "done"), match("MB1", "mb", "done")];
    expect(tvHold(started, ALL)).toBeNull();
    expect(tvHold(played, ALL)).toBeNull();
  });

  test("only mini round-robins so far: hold on those", () => {
    const ms = [match("G1", "group", "done"), match("WR1", "wb_rr", "ready")];
    expect(tvHold(ms, ["groups", "rr", "spotlight"])).toBe("rr");
  });

  test("no matches at all: no hold", () => {
    expect(tvHold([], ["groups", "spotlight"])).toBeNull();
  });
});
