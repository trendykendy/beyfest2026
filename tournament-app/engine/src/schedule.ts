import type { Match, RoundRobin } from "./types";

// ─── Round-robin scheduling for the group stage ──────────────────────
// Two jobs live here:
//   1. Generate round-robin ROUNDS for one group (the circle method).
//   2. Interleave several groups' rounds match-by-match into one global play
//      order so matches are well mixed across groups and players get rest
//      between their matches (no back-to-back where it can be avoided).

// An unordered pairing of two group-member indexes (0-based within the group).
export type Pairing = [number, number];

// Circle method: rotate every seat but the first, reading off the pairs that sit
// opposite each other each round. Odd counts get a phantom "bye" seat (-1) so one
// player rests per round. Each returned round is a set of pairs with no repeated
// index — exactly what "rest between matches within a group" needs.
function circleRounds(n: number): Pairing[][] {
  const seats: number[] = [];
  for (let i = 0; i < n; i++) seats.push(i);
  if (n % 2 === 1) seats.push(-1); // bye seat
  const m = seats.length; // always even
  const half = m / 2;

  const rounds: Pairing[][] = [];
  let arr = seats.slice();
  for (let r = 0; r < m - 1; r++) {
    const round: Pairing[] = [];
    for (let i = 0; i < half; i++) {
      const a = arr[i];
      const b = arr[m - 1 - i];
      if (a !== -1 && b !== -1) round.push(a < b ? [a, b] : [b, a]);
    }
    rounds.push(round);
    // Keep seat 0 fixed, rotate the rest one step.
    const rest = arr.slice(1);
    rest.unshift(rest.pop()!);
    arr = [arr[0], ...rest];
  }
  return rounds;
}

// Round-robin rounds for `n` players. A double round-robin plays a second leg
// that mirrors the first with home/away swapped.
export function roundRobinRounds(n: number, format: RoundRobin): Pairing[][] {
  const firstLeg = circleRounds(n);
  if (format === "single") return firstLeg;
  const secondLeg = firstLeg.map((round) => round.map(([a, b]) => [b, a] as Pairing));
  return [...firstLeg, ...secondLeg];
}

function sharePlayer(a: Match, b: Match): boolean {
  return a.p1 === b.p1 || a.p1 === b.p2 || a.p2 === b.p1 || a.p2 === b.p2;
}

// Order one group's matches so consecutive matches share no player where possible,
// keeping the input (round) order as the tie-break preference. A depth-first search
// prefers a disjoint continuation and only accepts a shared-player one when no
// conflict-free ordering of the remainder exists. That fallback only ever fires for
// a 3-player group (every pair of its matches shares someone) — and such a group is
// always interleaved with others, so it never actually emits two matches in a row.
function linearize(matches: Match[]): Match[] {
  const n = matches.length;
  if (n <= 1) return matches.slice();

  const used = new Array<boolean>(n).fill(false);
  const out: Match[] = [];

  const dfs = (prev: Match | null): boolean => {
    if (out.length === n) return true;
    // pass 0: disjoint continuations only; pass 1: allow a shared-player one.
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < n; i++) {
        if (used[i]) continue;
        const conflict = prev !== null && sharePlayer(prev, matches[i]);
        if (pass === 0 ? conflict : !conflict) continue;
        used[i] = true;
        out.push(matches[i]);
        if (dfs(matches[i])) return true;
        out.pop();
        used[i] = false;
      }
    }
    return false;
  };

  dfs(null);
  return out;
}

// Interleave the groups' matches into one global play order. Each group is first
// linearized (conflict-free where possible), then we emit position 0 of every
// group, then position 1 of every group, and so on. Adjacent emissions are either
// from different groups (disjoint player pools) or — only once a group has outlasted
// all the others — consecutive matches of that single group, which linearize() has
// already made conflict-free. So no player lands in two back-to-back matches.
export function scheduleGroupStage(perGroup: Match[][]): Match[] {
  const seqs = perGroup.map(linearize);
  const maxLen = seqs.reduce((mx, s) => Math.max(mx, s.length), 0);

  const ordered: Match[] = [];
  for (let i = 0; i < maxLen; i++) {
    for (const seq of seqs) {
      if (i < seq.length) ordered.push(seq[i]);
    }
  }
  return ordered;
}
