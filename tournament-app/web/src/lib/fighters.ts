// The fighter library (PocketBase `fighters`, migrations 1710001100 and
// 1710001200): the combat name, katakana, cut-out image and announcer voice
// the TV's VS intro uses for a blader. Fighters aren't tied to a tournament;
// a player is matched to one by the fighter's player name.

export interface PBFighter {
  id: string;
  name: string; // combat name, e.g. "The Breycist": shown and announced
  player: string; // the name typed in for the tournament, e.g. "Conor"
  kana: string;
  image: string; // file name in PocketBase storage, "" if none
  voice: string; // file name in PocketBase storage, "" if none
  mirror: boolean;
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

// The announcer clip's URL, or "" if the fighter has no voice.
export function fighterVoiceUrl(pbUrl: string, f: PBFighter | null): string {
  return f?.voice ? fileUrl(pbUrl, f, f.voice) : "";
}
