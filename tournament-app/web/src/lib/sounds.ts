// The TV's sounds: the match music and the announcer's calls for the VS intro
// (name, "versus", name, match title). The files are in static/sounds; each
// fighter's name clip comes from the fighter library instead (fighters.ts).
// Only the plain logic is here, so it can be tested; the playing is in
// components/tv/announcer.ts.

import type { Stage } from "@beyfest/engine";

export const MUSIC = [
  "/sounds/music/championship-theme-1.mp3",
  "/sounds/music/championship-theme-2.mp3",
  "/sounds/music/championship-mode.mp3",
];

export const VERSUS = ["/sounds/versus-1.mp3", "/sounds/versus-2.mp3"];

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
  const starts: number[] = [];
  let t = CALLS_START;
  for (const d of durations) {
    starts.push(t);
    t += d + CALLS_GAP;
  }
  const end = durations.length ? t - CALLS_GAP : 0;
  return { starts, out: Math.max(INTRO_OUT, Math.round(end + CALLS_TAIL)) };
}
