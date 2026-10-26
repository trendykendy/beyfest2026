// The starting fighters: a list shipped with the app (static/starter-fighters/
// fighters.json, plus the images and voices it names) that the Fighters admin
// page can load into the library in one go.
//
// It never overwrites: a starter that's missing is added, and one that's
// already there (same combat name or player name) only gets the fields it's
// missing filled in. So it's safe to press again, e.g. after an update ships
// more starters, and edits made on the admin page are kept.

import type { Face, PBFighter } from "./fighters";

export interface Starter {
  name: string;
  player?: string;
  kana?: string;
  image?: string; // file name in static/starter-fighters/
  victory?: string; // file name in static/starter-fighters/
  royaleVictory?: string; // file name in static/starter-fighters/
  voice?: string; // file name in static/starter-fighters/
  mirror?: boolean;
  face?: Face; // where the face is in `image` (scripts/find-faces.py)
}

export type StarterStep =
  | { kind: "add"; starter: Starter }
  // fields: the text fields to set; files: which files to upload
  | { kind: "fill"; id: string; starter: Starter; fields: Partial<Pick<PBFighter, "player" | "kana" | "face">>; files: StarterFile[] };

export type StarterFile = "image" | "victory" | "royaleVictory" | "voice";

const key = (s: string | undefined) => (s ?? "").trim().toLowerCase();

// PocketBase stores an upload as "<name>_<random>.<ext>", so "breycist.png"
// comes back as e.g. "breycist_x8k2p9q1zz.png".
function sameFile(stored: string, original: string | undefined): boolean {
  if (!original) return false;
  const dot = original.lastIndexOf(".");
  const base = (dot < 0 ? original : original.slice(0, dot)).toLowerCase();
  const ext = dot < 0 ? "" : original.slice(dot).toLowerCase();
  const s = stored.toLowerCase();
  return s === base + ext || (s.startsWith(base + "_") && s.endsWith(ext));
}

// `pictures`: fighters whose image is byte-for-byte a starter's picture,
// fighter id → that picture's file name (the Fighters page works it out,
// since a picture uploaded by hand keeps its own file name).
export function planStarters(starters: Starter[], library: PBFighter[], pictures = new Map<string, string>()): StarterStep[] {
  const steps: StarterStep[] = [];
  for (const s of starters) {
    const f =
      library.find((x) => key(x.name) === key(s.name)) ??
      (s.player ? library.find((x) => key(x.player) === key(s.player)) : undefined);
    if (!f) {
      steps.push({ kind: "add", starter: s });
      continue;
    }
    const fields: Partial<Pick<PBFighter, "player" | "kana" | "face">> = {};
    // A player name only goes in if nobody else has it already.
    if (!f.player && s.player && !library.some((x) => key(x.player) === key(s.player))) fields.player = s.player;
    if (!f.kana && s.kana) fields.kana = s.kana;
    // The face point belongs to the starter's own picture, so it only goes in
    // with that picture, or onto it if it's still the starter's.
    const ownPicture = !f.image || sameFile(f.image, s.image) || (!!s.image && pictures.get(f.id) === s.image);
    if (!f.face && s.face && ownPicture) fields.face = s.face;
    const files: StarterFile[] = [];
    if (!f.image && s.image) files.push("image");
    if (!f.victory && s.victory) files.push("victory");
    if (!f.royaleVictory && s.royaleVictory) files.push("royaleVictory");
    if (!f.voice && s.voice) files.push("voice");
    if (Object.keys(fields).length || files.length) steps.push({ kind: "fill", id: f.id, starter: s, fields, files });
  }
  return steps;
}

// ── Picking starters for a new tournament ──
// The create form's "Use the starting fighters" pop-up lets the organiser
// tick which starters are here today. These work on the Bladers box's text,
// where a starter appears under its player name (or combat name if it has
// no player).

// One starter as the pop-up shows it.
export interface StarterPick {
  player: string; // what goes in the Bladers box: the player name, else the combat name
  name: string; // combat name
  image: string; // file name in /starter-fighters/, "" if it has none
}

// The names in the Bladers box: one per line, commas work too.
export function splitNames(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((n) => n.trim())
    .filter(Boolean);
}

// Which starters to tick when the pop-up opens: the ones already in the box,
// or all of them if none are (the usual first press).
export function tickedStarters(text: string, starterNames: string[]): string[] {
  const typed = new Set(splitNames(text).map(key));
  const there = starterNames.filter((n) => typed.has(key(n)));
  return there.length ? there : [...starterNames];
}

// The box's new text once the organiser confirms: the picked starters (in
// list order), then any names they'd typed that aren't starters, e.g.
// walk-ins. A starter that was typed in but is now unticked is dropped.
export function mergeStarters(text: string, starterNames: string[], picked: string[]): string {
  const isStarter = new Set(starterNames.map(key));
  const isPicked = new Set(picked.map(key));
  const starters = starterNames.filter((n) => isPicked.has(key(n)));
  const others = splitNames(text).filter((n) => !isStarter.has(key(n)));
  // A walk-in typed twice stays twice: the create form reports duplicates.
  return [...starters, ...others].join("\n");
}
