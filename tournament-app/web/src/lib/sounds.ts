// The TV's sounds: the match music, the announcer's calls for the VS intro
// (name, "versus", name, match title), each round's finish, "[name] wins!",
// and the stinger that ends a match. The files are in static/sounds; each
// fighter's name clip comes from the fighter library instead (fighters.ts).
// Only the plain logic is here, so it can be tested; the playing is in
// components/tv/announcer.ts.

import type { Stage } from "@beyfest/engine";
import { FINISHES } from "./finishes";

export const MUSIC = [
  "/sounds/music/championship-theme-1.mp3",
  "/sounds/music/championship-theme-2.mp3",
  "/sounds/music/championship-mode.mp3",
  "/sounds/music/championship-theme-3.mp3",
  "/sounds/music/championship-theme-4.mp3",
];

export const VERSUS = ["/sounds/versus-1.mp3", "/sounds/versus-2.mp3"];
export const WINS = "/sounds/wins.mp3"; // said straight after the winner's name
export const STINGER = "/sounds/stinger.mp3"; // ends a match in place of a fade-out
// The stinger is the last 5.25 s of the Suno piece (which won't generate
// anything shorter), ending on its own final hit; the raw file is in
// tournament-app/music/. The end fade is only a safety net now: the clip
// has finished by the time it fires.
export const STINGER_END_MS = 5_400;
export const STINGER_END_FADE_MS = 150;
// The stinger eases in rather than cutting in: it starts at the ducked
// music's level and rises to full over this long, while the match music
// fades out underneath (a crossfade).
export const STINGER_IN_MS = 600;

// The call for a round's finish ("Knockout!"), named after its key in
// finishes.ts; "" for a key it doesn't know.
export function finishClip(key: string): string {
  return FINISHES.some((f) => f.key === key) ? `/sounds/finishes/${key}.mp3` : "";
}

// "[name] wins!" when a result goes in. A walkover wasn't a fight, so nobody
// is called; nor is a winner with no name clip ("wins!" alone says nothing).
export function winsCall(voice: string, walkover: boolean): string[] {
  return voice && !walkover ? [voice, WINS] : [];
}

// The match title clip, or "" when there isn't one. Group matches say their
// group; knockout matches say their bracket. The 8-player upper and lower
// brackets borrow the winners and losers clips.
export function titleClip(m: { stage: Stage; roundLabel: string }): string {
  const clip = (name: string) => `/sounds/titles/${name}.mp3`;
  switch (m.stage) {
    case "group": {
      const n = Number(/^Group (\d+)/.exec(m.roundLabel)?.[1]);
      return n >= 1 && n <= 5 ? clip(`group-${n}`) : "";
    }
    case "wb_rr":
      return clip("winners-round-robin");
    case "lb_rr":
      return clip("losers-round-robin");
    case "wb":
    case "ub":
      return clip("winners-bracket");
    case "lb":
      return clip("losers-bracket");
    case "mb":
      return clip("mid-bracket");
    case "gf":
      return clip("grand-final");
    default:
      return "";
  }
}

// A random pick that isn't the same as last time (when there's a choice).
export function pickOther<T>(list: T[], last: T | null, random = Math.random): T {
  const pool = list.length > 1 ? list.filter((x) => x !== last) : list;
  return pool[Math.floor(random() * pool.length)];
}

// When each call starts during the VS intro (ms from the intro's start), and
// when the banners should split apart. The first call lands with the banners'
// slam; the intro holds until the last call has finished, and never leaves
// sooner than it used to.
export const CALLS_START = 450; // the banners slam together
export const CALLS_GAP = 150; // breath between calls
export const CALLS_TAIL = 400; // hold after the last call
export const INTRO_OUT = 4200; // VsIntro's own exit time

export function callTimes(durations: number[]): { starts: number[]; out: number } {
  const { starts, end } = callSequence(durations, CALLS_START);
  return { starts, out: Math.max(INTRO_OUT, Math.round((durations.length ? end : 0) + CALLS_TAIL)) };
}

// Calls one after another from `from` (ms), with a breath between: when each
// starts, and when the last one has finished (`from` itself if there are none).
export function callSequence(durations: number[], from: number): { starts: number[]; end: number } {
  const starts: number[] = [];
  let t = from;
  for (const d of durations) {
    starts.push(t);
    t += d + CALLS_GAP;
  }
  return { starts, end: durations.length ? t - CALLS_GAP : from };
}

// When the stinger hits, in ms from now, given how long the announcer has
// left to talk: a breath after the last call, or straight away if it's quiet.
export function stingerDelay(talkingFor: number): number {
  return talkingFor > 0 ? talkingFor + CALLS_GAP : 0;
}

// ── Winner screen ────────────────────────────────────────────────────
// The TV's winner screen (WinnerScreen.svelte) plays on every result but the
// grand final's. The "[name] wins!" call starts with its slam; the stinger
// follows the call as usual (Announcer.endMatch). The screen then holds until
// the next match starts.
export const WINNER_SLAM = 450; // the winner's banner lands

// ── Battle royale ────────────────────────────────────────────────────
// Clips the organiser provides, dropped into static/sounds/royale/. Until a
// file is there its call is simply skipped (the intro's timing allows for it).
//   battle-royale.mp3    "Battle royale!" (each battle's intro, first)
//   heat-1.mp3 … heat-4  "Heat one!" … (then the battle's name)
//   sudden-death.mp3     "Sudden death!"
//   final.mp3            "The final!"
//   royale-champion.mp3  "Battle royale champion!" (after the champion's name)
export const ROYALE = "/sounds/royale/battle-royale.mp3";
export const ROYALE_CHAMPION = "/sounds/royale/royale-champion.mp3";

// The call for a battle's name, from its key (H1…H4, SD, F); "" for none.
export function royaleLabelClip(key: string): string {
  const heat = /^H([1-4])$/.exec(key);
  if (heat) return `/sounds/royale/heat-${heat[1]}.mp3`;
  if (key === "SD") return "/sounds/royale/sudden-death.mp3";
  if (key === "F") return "/sounds/royale/final.mp3";
  return "";
}

// ── Champion ─────────────────────────────────────────────────────────
// The Champion scene's music, and its one-off call: the champion's name
// clip, then "Beyfest 2026 Grand Champion!".
export const CHAMPION_THEME = "/sounds/champion-theme.mp3";
export const GRAND_CHAMPION = "/sounds/grand-champion.mp3";

// The call lands with the scene's big reveal: ChampionScene slams the name
// slab in (with its flash and confetti) 450 ms after it comes up. The title
// follows the name a breath later (callSequence).
export const CHAMPION_CALL_START = 450;

// The call is only made if the scene first shows within this long of the TV
// seeing the grand final's result. After the result the TV holds Match centre
// for 20 s, then the rotation can still run through every other scene before
// it gets to Champion (groups 25 + round-robin 20 + bracket 25 + Match centre
// 15 + awards 20 s), so up to about two minutes. Three minutes covers that,
// with room for a slow data refresh, while a TV that comes back to the scene
// much later (or reloads, which never sees the result go in) stays quiet.
export const CHAMPION_FRESH_MS = 3 * 60_000;

export function championCallFresh(resultSeenAt: number, now: number): boolean {
  return now >= resultSeenAt && now - resultSeenAt <= CHAMPION_FRESH_MS;
}
