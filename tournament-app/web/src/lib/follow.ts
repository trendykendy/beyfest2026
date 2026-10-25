// "Follow a blader" on the phone page: who this phone follows, remembered in
// the browser. Storage can be missing or blocked (private mode, a strict
// browser), so every read and write is guarded and failing just means nobody
// is followed. Read it in the browser only (onMount): the server doesn't know.

import type { PBPlayer } from "./view";

export type Follow = { id: string; name: string };

const KEY = "beyfest.follow";

export function loadFollow(): Follow | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return v && typeof v.id === "string" && typeof v.name === "string" ? v : null;
  } catch {
    return null;
  }
}

export function saveFollow(f: Follow | null) {
  try {
    if (f) localStorage.setItem(KEY, JSON.stringify(f));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: the follow lasts until the page closes */
  }
}

// The saved follow's player in this tournament. Same id first; then the same
// name (ignoring case and spaces), since recreating the tournament gives
// everyone new ids. null if they're not in it.
export function resolveFollow(saved: Follow | null, players: PBPlayer[]): PBPlayer | null {
  if (!saved) return null;
  const key = (s: string) => s.trim().toLowerCase();
  return players.find((p) => p.id === saved.id) ?? players.find((p) => key(p.name) === key(saved.name)) ?? null;
}
