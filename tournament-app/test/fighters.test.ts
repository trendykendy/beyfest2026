import { describe, expect, test } from "bun:test";
import { fighterFor, fighterImageUrl, fighterVoiceUrl, type PBFighter } from "../web/src/lib/fighters";

const f = (id: string, name: string, player: string, image = "", voice = ""): PBFighter => ({
  id,
  name,
  player,
  kana: "",
  image,
  voice,
  mirror: false,
});
const library = [
  f("a1", "The Breycist", "Conor", "breycist.png", "the-breycist.mp3"),
  f("b2", "Storm", "Storm"),
  f("c3", "Ronan O'Brien", ""),
  f("d4", "Sean", "Moss"), // a combat name that's someone else's player name
  f("e5", "The Buzzsaw", "Sean"),
];

describe("fighterFor", () => {
  test("matches the player name", () => {
    expect(fighterFor("Conor", library)?.id).toBe("a1");
  });
  test("ignores case and surrounding spaces", () => {
    expect(fighterFor("  cONOR ", library)?.id).toBe("a1");
  });
  test("falls back to the combat name", () => {
    expect(fighterFor("the breycist", library)?.id).toBe("a1");
    expect(fighterFor("ronan o'brien", library)?.id).toBe("c3");
  });
  test("a player name wins over another fighter's combat name", () => {
    expect(fighterFor("Sean", library)?.id).toBe("e5");
  });
  test("returns null when nobody matches", () => {
    expect(fighterFor("Blaze", library)).toBeNull();
    expect(fighterFor("Con", library)).toBeNull(); // no partial matches
  });
  test("returns null for an empty name", () => {
    expect(fighterFor("   ", library)).toBeNull();
  });
});

describe("fighterImageUrl", () => {
  test("builds the thumb URL for a fighter with an image", () => {
    expect(fighterImageUrl("http://beyfest.local:8090", library[0])).toBe(
      "http://beyfest.local:8090/api/files/fighters/a1/breycist.png?thumb=0x900",
    );
  });
  test("is empty without an image or a fighter", () => {
    expect(fighterImageUrl("http://x:8090", library[1])).toBe("");
    expect(fighterImageUrl("http://x:8090", null)).toBe("");
  });
});

describe("fighterVoiceUrl", () => {
  test("builds the file URL for a fighter with a voice", () => {
    expect(fighterVoiceUrl("http://x:8090", library[0])).toBe("http://x:8090/api/files/fighters/a1/the-breycist.mp3");
  });
  test("is empty without a voice or a fighter", () => {
    expect(fighterVoiceUrl("http://x:8090", library[1])).toBe("");
    expect(fighterVoiceUrl("http://x:8090", null)).toBe("");
  });
});
