// The fighter library (PocketBase `fighters`, migration 1710001100): the
// katakana and cut-out image the TV's VS intro shows for a blader. Fighters
// aren't tied to a tournament; a player is matched to one by name.

export interface PBFighter {
  id: string;
  name: string;
  kana: string;
  image: string; // file name in PocketBase storage, "" if none
  mirror: boolean;
}

// Names match ignoring case and surrounding spaces, so "  rush " finds "Rush".
const key = (name: string) => name.trim().toLowerCase();

export function fighterFor(name: string, fighters: PBFighter[]): PBFighter | null {
  const k = key(name);
  if (!k) return null;
  return fighters.find((f) => key(f.name) === k) ?? null;
}

// The cut-out's URL, at the 0x900 thumb size the TV uses (the field's only
// thumb), or "" if the fighter has no image. `pbUrl` is browserPbUrl().
export function fighterImageUrl(pbUrl: string, f: PBFighter | null, thumb = "0x900"): string {
  if (!f?.image) return "";
  const q = thumb ? `?thumb=${thumb}` : "";
  return `${pbUrl}/api/files/fighters/${f.id}/${encodeURIComponent(f.image)}${q}`;
}
