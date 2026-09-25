import { describe, expect, test } from "bun:test";
import { STADIA, pickStadium } from "../web/src/lib/stadia";

// A seeded generator so the long-run checks are repeatable.
function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

describe("pickStadium", () => {
  test("keeps an event's worth of draws close to an even split", () => {
    const random = seeded(7);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 300; i++) {
      const k = pickStadium(counts, { random });
      counts[k] = (counts[k] ?? 0) + 1;
      const n = STADIA.map((s) => counts[s.key] ?? 0);
      // never more than a couple of draws apart at any point
      expect(Math.max(...n) - Math.min(...n)).toBeLessThanOrEqual(3);
    }
  });

  test("equal counts give every stadium a chance", () => {
    const seen = new Set<string>();
    const random = seeded(1);
    for (let i = 0; i < 50; i++) seen.add(pickStadium({}, { random }));
    expect(seen.size).toBe(3);
  });

  test("favours the stadium that's behind", () => {
    const random = seeded(3);
    let behind = 0;
    for (let i = 0; i < 1000; i++) {
      if (pickStadium({ xtreme: 5, motor: 5, drop: 4 }, { random }) === "drop") behind++;
    }
    // weights 1 : 1 : 4 → about two thirds
    expect(behind / 1000).toBeGreaterThan(0.6);
    expect(behind / 1000).toBeLessThan(0.73);
  });

  test("never picks a stadium that's out of the draw", () => {
    const random = seeded(11);
    for (let i = 0; i < 200; i++) expect(pickStadium({}, { off: ["motor"], random })).not.toBe("motor");
  });

  test("a redraw never repeats the stadium it replaces", () => {
    const random = seeded(5);
    for (let i = 0; i < 200; i++) expect(pickStadium({}, { avoid: "drop", random })).not.toBe("drop");
  });

  test("with only one stadium left in the draw, a redraw keeps it", () => {
    expect(pickStadium({}, { off: ["xtreme", "motor"], avoid: "drop" })).toBe("drop");
  });

  test("with every stadium out of the draw it still returns one", () => {
    expect(STADIA.map((s) => s.key)).toContain(pickStadium({}, { off: ["xtreme", "motor", "drop"] }));
  });
});
