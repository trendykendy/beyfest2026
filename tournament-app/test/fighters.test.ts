import { describe, expect, test } from "bun:test";
import { fighterFor, fighterImageUrl, type PBFighter } from "../web/src/lib/fighters";

const f = (id: string, name: string, image = ""): PBFighter => ({ id, name, kana: "", image, mirror: false });
const library = [f("a1", "Rush", "rush.png"), f("b2", "Storm"), f("c3", "Ronan O'Brien")];

describe("fighterFor", () => {
  test("matches a name exactly", () => {
    expect(fighterFor("Rush", library)?.id).toBe("a1");
  });
  test("ignores case and surrounding spaces", () => {
    expect(fighterFor("  rUSH ", library)?.id).toBe("a1");
    expect(fighterFor("ronan o'brien", library)?.id).toBe("c3");
  });
  test("returns null when nobody matches", () => {
    expect(fighterFor("Blaze", library)).toBeNull();
    expect(fighterFor("Rus", library)).toBeNull(); // no partial matches
  });
  test("returns null for an empty name", () => {
    expect(fighterFor("   ", library)).toBeNull();
  });
});

describe("fighterImageUrl", () => {
  test("builds the thumb URL for a fighter with an image", () => {
    expect(fighterImageUrl("http://beyfest.local:8090", library[0])).toBe(
      "http://beyfest.local:8090/api/files/fighters/a1/rush.png?thumb=0x900",
    );
  });
  test("is empty without an image or a fighter", () => {
    expect(fighterImageUrl("http://x:8090", library[1])).toBe("");
    expect(fighterImageUrl("http://x:8090", null)).toBe("");
  });
});
