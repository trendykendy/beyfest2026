import { describe, expect, test } from "bun:test";
import { faceCrop, facePan, fighterFor, fighterImageUrl, fighterVoiceUrl, toFace, type PBFighter } from "../web/src/lib/fighters";

const f = (id: string, name: string, player: string, image = "", voice = ""): PBFighter => ({
  id,
  name,
  player,
  kana: "",
  image,
  victory: "",
  voice,
  mirror: false,
  face: null,
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

describe("toFace", () => {
  test("reads a stored face point", () => {
    expect(toFace({ x: 0.27, y: 0.26, h: 0.29 })).toEqual({ x: 0.27, y: 0.26, h: 0.29 });
  });
  test("keeps it inside the picture", () => {
    expect(toFace({ x: 1.2, y: -0.1, h: 0 })).toEqual({ x: 1, y: 0, h: 0.02 });
  });
  test("is null when it's missing or garbled", () => {
    expect(toFace(null)).toBeNull();
    expect(toFace("")).toBeNull(); // PocketBase's empty json field
    expect(toFace({ x: 0.5, y: 0.5 })).toBeNull();
    expect(toFace({ x: "0.5", y: 0.5, h: 0.2 })).toBeNull();
  });
});

describe("facePan", () => {
  const breycist = { x: 0.266, y: 0.263, h: 0.286 }; // face left of centre
  test("slides the picture so the face is in the middle", () => {
    expect(facePan(breycist)).toBe(23.4);
    expect(facePan({ x: 0.5, y: 0.2, h: 0.2 })).toBe(0);
  });
  test("goes the other way when the picture is mirrored", () => {
    expect(facePan(breycist, true)).toBe(-23.4);
  });
  test("leaves it centred without a face", () => {
    expect(facePan(null)).toBe(0);
  });
});

describe("faceCrop", () => {
  const face = { x: 0.25, y: 0.2, h: 0.3 };
  test("centres the face and zooms so it fills the box", () => {
    const css = faceCrop(face, 0.6);
    expect(css).toContain("height: 200%");
    expect(css).toContain("transform: translate(-25%, -20%)");
  });
  test("mirrors the face's position along with the picture", () => {
    expect(faceCrop(face, 0.6, true)).toContain("transform: translate(-75%, -20%) scaleX(-1)");
  });
  test("never zooms out past the picture filling the box", () => {
    expect(faceCrop({ x: 0.5, y: 0.5, h: 0.9 }, 0.6)).toContain("height: 100%");
  });
  test("is empty without a face, so the old crop stays", () => {
    expect(faceCrop(null)).toBe("");
  });
});
