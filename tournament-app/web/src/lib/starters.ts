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
