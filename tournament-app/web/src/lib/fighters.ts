// The fighter library (PocketBase `fighters`, migrations 1710001100,
// 1710001200, 1710001400, 1710001700, 1710001800 and 1710001900): the combat name, katakana, cut-out
// image (and where the face is in it) and announcer voice the TV's VS intro uses for a blader, and the victory pose
// the Champion scene shows. Fighters aren't tied to a tournament;
// a player is matched to one by the fighter's player name.

export interface PBFighter {
  id: string;
  name: string; // combat name, e.g. "The Breycist": shown and announced
  player: string; // the name typed in for the tournament, e.g. "Conor"
  kana: string;
  image: string; // file name in PocketBase storage, "" if none
  imageMirrored: string; // a hand-made mirror image of `image` (fixed lettering), "" if none
  victory: string; // victory pose for the Champion scene, "" if none
  royaleVictory: string; // the battle royale champion's pose, "" if none
  voice: string; // file name in PocketBase storage, "" if none
  mirror: boolean;
  face: Face | null; // where the face is in the image, null if not set
}

// Where the face is in a cut-out: its centre (x, y) and height (h), as
// fractions of the image's width and height. Found by scripts/find-faces.py
// for the starting fighters, or clicked in on the Fighters admin page.
export interface Face {
  x: number;
  y: number;
  h: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// A stored face as a Face, or null if it's missing or garbled.
export function toFace(v: unknown): Face | null {
  if (!v || typeof v !== "object") return null;
  const { x, y, h } = v as Record<string, unknown>;
  if (![x, y, h].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  return { x: clamp(x as number, 0, 1), y: clamp(y as number, 0, 1), h: clamp(h as number, 0.02, 1) };
}

// How far (in % of the picture's own width, for translateX) to slide a
// cut-out that's shown full height and centred in a narrow panel, so its
// face lands in the middle. `flip` is whether it's shown mirrored (the slide
// goes before the flip in the transform, so the mirrored face position counts).
// 0 without a face.
export function facePan(face: Face | null, flip = false): number {
  if (!face) return 0;
  const x = flip ? 1 - face.x : face.x;
  return Math.round((0.5 - x) * 1000) / 10;
}

// CSS for an <img> zoomed onto the face inside a box that hides overflow:
// the face's centre on the box's centre, the face `fill` of the box's height.
// Never zooms out past the picture filling the box's height. "" without a
// face, so the caller keeps its own crop.
export function faceCrop(face: Face | null, fill = 0.6, flip = false): string {
  if (!face) return "";
  const height = Math.max(100, (fill / face.h) * 100);
  const x = flip ? 1 - face.x : face.x;
  const pct = (n: number) => `${Math.round(n * 10) / 10}%`;
  return [
    "position: absolute",
    "left: 50%",
    "top: 50%",
    `height: ${pct(height)}`,
    "width: auto",
    "max-width: none",
    "object-fit: fill",
    `transform: translate(${pct(-x * 100)}, ${pct(-face.y * 100)})${flip ? " scaleX(-1)" : ""}`,
  ].join("; ");
}

// Names match ignoring case and surrounding spaces, so "  conor " finds "Conor".
const key = (name: string) => name.trim().toLowerCase();

// The player name decides. The combat name is a fallback, so a blader entered
// as "The Breycist" still gets their fighter.
export function fighterFor(name: string, fighters: PBFighter[]): PBFighter | null {
  const k = key(name);
  if (!k) return null;
  return fighters.find((f) => key(f.player) === k) ?? fighters.find((f) => key(f.name) === k) ?? null;
}

const fileUrl = (pbUrl: string, f: PBFighter, file: string) =>
  `${pbUrl}/api/files/fighters/${f.id}/${encodeURIComponent(file)}`;

// The cut-out's URL, at the 0x900 thumb size the TV uses (the field's only
// thumb), or "" if the fighter has no image. `pbUrl` is browserPbUrl().
export function fighterImageUrl(pbUrl: string, f: PBFighter | null, thumb = "0x900"): string {
  if (!f?.image) return "";
  const q = thumb ? `?thumb=${thumb}` : "";
  return fileUrl(pbUrl, f, f.image) + q;
}

// The hand-made mirror image's URL, at the cut-out's size, or "" if the
// fighter has none.
export function fighterMirroredUrl(pbUrl: string, f: PBFighter | null, thumb = "0x900"): string {
  if (!f?.imageMirrored) return "";
  return fileUrl(pbUrl, f, f.imageMirrored) + (thumb ? `?thumb=${thumb}` : "");
}

// What a screen shows for a cut-out it wants mirrored or not: the hand-made
// mirror image (as it is) when it wants it mirrored and there is one, else
// the cut-out, flipped with CSS if `flip`.
export function artFor(f: { img: string; imgMirrored?: string }, flip: boolean): { src: string; flip: boolean } {
  return flip && f.imgMirrored ? { src: f.imgMirrored, flip: false } : { src: f.img, flip };
}

// The victory pose's URL, or "" if the fighter has none. Full size by default
// (the Champion scene); the admin page asks for the 300x200 thumb.
export function fighterVictoryUrl(pbUrl: string, f: PBFighter | null, thumb = ""): string {
  if (!f?.victory) return "";
  return fileUrl(pbUrl, f, f.victory) + (thumb ? `?thumb=${thumb}` : "");
}

// The battle royale victory pose's URL, or "" if the fighter has none (the
// Champion scene then falls back to fighterVictoryUrl). Same sizes as that.
export function fighterRoyaleVictoryUrl(pbUrl: string, f: PBFighter | null, thumb = ""): string {
  if (!f?.royaleVictory) return "";
  return fileUrl(pbUrl, f, f.royaleVictory) + (thumb ? `?thumb=${thumb}` : "");
}

// The announcer clip's URL, or "" if the fighter has no voice.
export function fighterVoiceUrl(pbUrl: string, f: PBFighter | null): string {
  return f?.voice ? fileUrl(pbUrl, f, f.voice) : "";
}
