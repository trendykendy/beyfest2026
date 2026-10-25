import { pointsToWin } from "@beyfest/engine";
import type { PBMatch } from "./view";

// Betting odds for the phone page (/live). Shared by the page (to show them)
// and the server (which recomputes them before taking a bet), so both always
// agree.
//
// The idea: each blader gets a form rating from what they've done so far
// (wins, points diff). The gap between the two ratings sets the chance of
// winning any one point; from that and the live score we work out the chance
// of winning the race to the target (first to 5/7/9). So form moves the odds
// before a match, and every point scored moves them during it.

// ── Tuning ────────────────────────────────────────────────────────────
export const START_BALANCE = 10_000;
const WIN_WEIGHT = 1.0; // rating per match won
const DIFF_WEIGHT = 0.15; // rating per point of points diff
const SPREAD = 0.6; // how strongly a rating gap tilts each point
const POINT_MIN = 0.2; // a single point is never surer than 80/20
const POINT_MAX = 0.8;
const HOUSE_EDGE = 0.05; // odds are trimmed 5%, so the bank wins slowly
const ODDS_MIN = 1.05;
const ODDS_MAX = 20;

export type Form = { wins: number; pointDiff: number };

// Wins and points diff from finished matches, every stage. Walkovers don't
// count: nobody played, so they say nothing about form.
export function formOf(playerId: string, matches: PBMatch[]): Form {
  let wins = 0;
  let pointDiff = 0;
  for (const m of matches) {
    if (m.matchStatus !== "done" || m.walkover) continue;
    const side = m.p1 === playerId ? 1 : m.p2 === playerId ? 2 : 0;
    if (!side) continue;
    if (m.winner === playerId) wins++;
    const mine = (side === 1 ? m.p1Score : m.p2Score) ?? 0;
    const theirs = (side === 1 ? m.p2Score : m.p1Score) ?? 0;
    pointDiff += mine - theirs;
  }
  return { wins, pointDiff };
}

const rating = (f: Form) => f.wins * WIN_WEIGHT + f.pointDiff * DIFF_WEIGHT;

// Chance that blader 1 wins any one point.
export function pointChance(f1: Form, f2: Form): number {
  const q = 1 / (1 + Math.exp(-SPREAD * (rating(f1) - rating(f2))));
  return Math.min(POINT_MAX, Math.max(POINT_MIN, q));
}

// Chance of reaching `need1` more points before the other side reaches
// `need2`, winning each point with chance q. Blader 1 wins on their last
// point after losing k of the other's (k = 0 … need2-1) along the way.
export function raceChance(need1: number, need2: number, q: number): number {
  if (need1 <= 0) return 1;
  if (need2 <= 0) return 0;
  let total = 0;
  let ways = 1; // ways to arrange k lost points among the first need1-1+k: C(need1-1+k, k)
  for (let k = 0; k < need2; k++) {
    if (k > 0) ways = (ways * (need1 - 1 + k)) / k;
    total += ways * q ** need1 * (1 - q) ** k;
  }
  return total;
}

// Decimal odds for a chance: a $100 bet at 2.50 pays back $250.
export function oddsFor(chance: number): number {
  const raw = 1 / (Math.max(chance, 1e-9) * (1 + HOUSE_EDGE));
  return Math.round(Math.min(ODDS_MAX, Math.max(ODDS_MIN, raw)) * 100) / 100;
}

// Bets are taken until the last point: once either blader is one point
// short of the target (a finish is worth 1–3 points, so the next round may
// end it) the book closes.
export function bettingOpen(m: PBMatch): boolean {
  if (m.matchStatus !== "ready" || !m.p1 || !m.p2) return false;
  const target = pointsToWin(m.stage, m.roundLabel);
  return Math.max(m.liveP1, m.liveP2) < target - 1;
}

export type MatchOdds = { p1: number; p2: number; chance1: number };

// Both sides' odds for a match, from form and the live score.
export function matchOdds(m: PBMatch, matches: PBMatch[]): MatchOdds {
  const target = pointsToWin(m.stage, m.roundLabel);
  const q = pointChance(formOf(m.p1, matches), formOf(m.p2, matches));
  const chance1 = raceChance(target - m.liveP1, target - m.liveP2, q);
  return { p1: oddsFor(chance1), p2: oddsFor(1 - chance1), chance1 };
}
