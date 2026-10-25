import { START_BALANCE } from "./odds";
import type { PBMatch } from "./view";

// Bets as the phone page sees them. Balances are never stored: they're
// worked out from the bets and the match results every time, so entering,
// correcting or walking over a result settles bets with nothing else to run.

export interface PBBettor {
  id: string;
  name: string;
}
export interface PBBet {
  id: string;
  bettor: string;
  match: string;
  pick: string; // player id
  stake: number; // whole dollars
  odds: number; // decimal odds, fixed when the bet was placed
  created: string; // ISO
}

export type BetState = "open" | "won" | "lost" | "refund";

// How a bet stands. A walkover refunds it (nobody played). So does a match
// whose players changed under it (a corrected result upstream), since the
// pick isn't in that match any more.
export function betState(bet: PBBet, match: PBMatch | undefined): BetState {
  if (!match) return "refund";
  if (bet.pick !== match.p1 && bet.pick !== match.p2) return "refund";
  if (match.matchStatus !== "done") return "open";
  if (match.walkover) return "refund";
  return match.winner === bet.pick ? "won" : "lost";
}

// What a bet pays back (stake included): the full payout when won, the
// stake when refunded.
export function payout(bet: PBBet, state: BetState): number {
  if (state === "won") return Math.round(bet.stake * bet.odds);
  if (state === "refund") return bet.stake;
  return 0;
}

export type SettledBet = PBBet & { state: BetState; returns: number };
export type BettorBook = {
  bettor: PBBettor;
  balance: number; // money to bet with now (open stakes are out of it)
  atStake: number; // in open bets
  bets: SettledBet[]; // newest first
};

// Every bettor's balance and bets.
export function books(bettors: PBBettor[], bets: PBBet[], matches: PBMatch[]): BettorBook[] {
  const byId = new Map(matches.map((m) => [m.id, m]));
  const out = new Map<string, BettorBook>(
    bettors.map((b) => [b.id, { bettor: b, balance: START_BALANCE, atStake: 0, bets: [] }]),
  );
  for (const bet of bets) {
    const book = out.get(bet.bettor);
    if (!book) continue;
    const state = betState(bet, byId.get(bet.match));
    const returns = payout(bet, state);
    book.balance += returns - bet.stake;
    if (state === "open") book.atStake += bet.stake;
    book.bets.push({ ...bet, state, returns });
  }
  for (const book of out.values()) book.bets.sort((a, b) => b.created.localeCompare(a.created));
  return [...out.values()];
}

// The leaderboard: what each bettor would have if every open bet were
// refunded (balance + stakes still riding), richest first.
export function leaderboard(all: BettorBook[]): { bettor: PBBettor; worth: number; rank: number }[] {
  const rows = all
    .map((b) => ({ bettor: b.bettor, worth: b.balance + b.atStake, rank: 0 }))
    .sort((a, b) => b.worth - a.worth || a.bettor.name.localeCompare(b.bettor.name));
  // Equal worth shares a rank (1, 2, 2, 4).
  rows.forEach((r, i) => (r.rank = i > 0 && rows[i - 1].worth === r.worth ? rows[i - 1].rank : i + 1));
  return rows;
}

// Names are compared ignoring case and spaces, like followed bladers.
export const sameName = (a: string, b: string) =>
  a.replace(/\s+/g, "").toLowerCase() === b.replace(/\s+/g, "").toLowerCase();

// A betting name as typed: trimmed, inner spaces squashed, 2–16 characters.
export function cleanName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, " ");
  return name.length >= 2 && name.length <= 16 ? name : null;
}

// ── This phone's betting identity ─────────────────────────────────────
// The token proves the phone that joined is the one betting.
export type Bettor = { id: string; name: string; token: string };
const KEY = "beyfest.bettor";

export function loadBettor(): Bettor | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return v && typeof v.id === "string" && typeof v.token === "string" ? v : null;
  } catch {
    return null;
  }
}

export function saveBettor(b: Bettor | null) {
  try {
    if (b) localStorage.setItem(KEY, JSON.stringify(b));
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode: betting just won't survive a reload */
  }
}
