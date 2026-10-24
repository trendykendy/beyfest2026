// The starting fighters: a list shipped with the app (static/starter-fighters/
// fighters.json, plus the images and voices it names) that the Fighters admin
// page can load into the library in one go.
//
// It never overwrites: a starter that's missing is added, and one that's
// already there (same combat name or player name) only gets the fields it's
// missing filled in. So it's safe to press again, e.g. after an update ships
// more starters, and edits made on the admin page are kept.

import type { PBFighter } from "./fighters";

export interface Starter {
  name: string;
  player?: string;
  kana?: string;
  image?: string; // file name in static/starter-fighters/
  voice?: string; // file name in static/starter-fighters/
  mirror?: boolean;
}

export type StarterStep =
  | { kind: "add"; starter: Starter }
  // fields: the text fields to set; files: which files to upload
  | { kind: "fill"; id: string; starter: Starter; fields: Partial<Pick<PBFighter, "player" | "kana">>; files: ("image" | "voice")[] };

const key = (s: string | undefined) => (s ?? "").trim().toLowerCase();

export function planStarters(starters: Starter[], library: PBFighter[]): StarterStep[] {
  const steps: StarterStep[] = [];
  for (const s of starters) {
    const f =
      library.find((x) => key(x.name) === key(s.name)) ??
      (s.player ? library.find((x) => key(x.player) === key(s.player)) : undefined);
    if (!f) {
      steps.push({ kind: "add", starter: s });
      continue;
    }
    const fields: Partial<Pick<PBFighter, "player" | "kana">> = {};
    // A player name only goes in if nobody else has it already.
    if (!f.player && s.player && !library.some((x) => key(x.player) === key(s.player))) fields.player = s.player;
    if (!f.kana && s.kana) fields.kana = s.kana;
    const files: ("image" | "voice")[] = [];
    if (!f.image && s.image) files.push("image");
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
