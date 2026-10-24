import { describe, expect, test } from "bun:test";
import { mergeStarters, planStarters, splitNames, tickedStarters, type Starter } from "../web/src/lib/starters";
import type { PBFighter } from "../web/src/lib/fighters";

const fighter = (over: Partial<PBFighter>): PBFighter => ({
  id: "x",
  name: "",
  player: "",
  kana: "",
  image: "",
  voice: "",
  mirror: false,
  ...over,
});
const breycist: Starter = { name: "The Breycist", player: "Conor", kana: "ザ・ブレイシスト", image: "breycist.png", voice: "the-breycist.mp3" };
const buzzsaw: Starter = { name: "The Buzzsaw", player: "Sean", voice: "the-buzzsaw.mp3" };

describe("planStarters", () => {
  test("adds every starter to an empty library", () => {
    const steps = planStarters([breycist, buzzsaw], []);
    expect(steps.map((s) => s.kind)).toEqual(["add", "add"]);
  });

  test("does nothing when a starter is already complete", () => {
    const done = fighter({ id: "a", name: "The Breycist", player: "Conor", kana: "k", image: "i.png", voice: "v.mp3" });
    expect(planStarters([breycist], [done])).toEqual([]);
  });

  test("never overwrites what's there, only fills gaps", () => {
    const edited = fighter({ id: "a", name: "the breycist", player: "Con", kana: "", image: "mine.png" });
    expect(planStarters([breycist], [edited])).toEqual([
      { kind: "fill", id: "a", starter: breycist, fields: { kana: "ザ・ブレイシスト" }, files: ["voice"] },
    ]);
  });

  test("finds a fighter set up earlier under the player's name", () => {
    // Before combat names, a fighter was named after the player.
    const old = fighter({ id: "b", name: "Conor", player: "Conor", image: "conor.png" });
    const [step] = planStarters([breycist], [old]);
    expect(step).toMatchObject({ kind: "fill", id: "b", files: ["voice"] });
  });

  test("doesn't give a player name that another fighter already has", () => {
    const other = fighter({ id: "c", name: "Someone", player: "Sean" });
    const bare = fighter({ id: "d", name: "The Buzzsaw", voice: "v.mp3" });
    expect(planStarters([buzzsaw], [other, bare])).toEqual([]);
  });
});

const names = ["Conor", "Sean", "Vhar", "Mark"];

describe("tickedStarters", () => {
  test("ticks every starter when none are in the box", () => {
    expect(tickedStarters("", names)).toEqual(names);
    expect(tickedStarters("Walk In\nOther", names)).toEqual(names);
  });

  test("ticks only the starters already in the box, whatever the case", () => {
    expect(tickedStarters("sean\nWalk In, VHAR", names)).toEqual(["Sean", "Vhar"]);
  });
});

describe("mergeStarters", () => {
  test("fills an empty box with the picked starters, in list order", () => {
    expect(mergeStarters("", names, ["Mark", "Conor"])).toBe("Conor\nMark");
  });

  test("keeps walk-ins that were typed in, after the starters", () => {
    expect(mergeStarters("Walk In\n\n  Late One , ", names, ["Sean"])).toBe("Sean\nWalk In\nLate One");
  });

  test("drops a starter that's unticked, and doesn't double one already there", () => {
    expect(mergeStarters("conor\nSean\nWalk In", names, ["Conor", "Vhar"])).toBe("Conor\nVhar\nWalk In");
  });

  test("picking none leaves just the walk-ins", () => {
    expect(mergeStarters("Sean\nWalk In", names, [])).toBe("Walk In");
  });

  test("splitNames reads lines and commas, skipping blanks", () => {
    expect(splitNames(" A ,B\n\nC,")).toEqual(["A", "B", "C"]);
  });
});
