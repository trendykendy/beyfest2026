import type { Match, StandingRow } from "./types";

// Compute standings for a round-robin among `playerIds`, using only the
// completed matches whose both participants are in that set (works for both
// group stages and the WB/LB mini round-robins).
//
// Ordering (spec Part 1): wins → head-to-head (within the tied cluster) →
// point differential → total points scored. A walkover counts as a win and a
// loss but adds no points, so a no-show can't decide a points tiebreak. Players still equal after all
// four are flagged in `tiedWith` (they need a decider match).
export function computeStandings(playerIds: string[], matches: Match[]): StandingRow[] {
  const set = new Set(playerIds);
  const base = new Map<string, StandingRow>();
  for (const id of playerIds) {
    base.set(id, {
      playerId: id,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDiff: 0,
      rank: 0,
      tiedWith: [],
    });
  }

  const relevant = matches.filter(
    (mt) =>
      mt.status === "done" &&
      mt.p1 != null &&
      mt.p2 != null &&
      set.has(mt.p1) &&
      set.has(mt.p2) &&
      mt.p1Score != null &&
      mt.p2Score != null,
  );

  for (const mt of relevant) {
    const r1 = base.get(mt.p1!)!;
    const r2 = base.get(mt.p2!)!;
    if (!mt.walkover) {
      r1.pointsFor += mt.p1Score!;
      r1.pointsAgainst += mt.p2Score!;
      r2.pointsFor += mt.p2Score!;
      r2.pointsAgainst += mt.p1Score!;
    }
    if (mt.p1Score! > mt.p2Score!) {
      r1.wins++;
      r2.losses++;
    } else {
      r2.wins++;
      r1.losses++;
    }
  }
  for (const row of base.values()) row.pointDiff = row.pointsFor - row.pointsAgainst;

  // Head-to-head wins restricted to a subset of players.
  const h2hWins = (id: string, cluster: Set<string>): number =>
    relevant.reduce((acc, mt) => {
      if (!cluster.has(mt.p1!) || !cluster.has(mt.p2!)) return acc;
      const winner = mt.p1Score! > mt.p2Score! ? mt.p1! : mt.p2!;
      return acc + (winner === id ? 1 : 0);
    }, 0);

  const rows = [...base.values()];

  // Sort by wins first; resolve within equal-wins clusters by H2H, then
  // point diff, then points for.
  rows.sort((a, b) => b.wins - a.wins);

  const ordered: StandingRow[] = [];
  let i = 0;
  while (i < rows.length) {
    let j = i;
    while (j < rows.length && rows[j].wins === rows[i].wins) j++;
    const cluster = rows.slice(i, j);
    const clusterIds = new Set(cluster.map((r) => r.playerId));
    cluster.sort((a, b) => {
      const h = h2hWins(b.playerId, clusterIds) - h2hWins(a.playerId, clusterIds);
      if (h !== 0) return h;
      if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
      return b.pointsFor - a.pointsFor;
    });
    // Flag residual ties (identical on all four criteria).
    for (let k = 0; k < cluster.length; k++) {
      const a = cluster[k];
      cluster.forEach((b, l) => {
        if (
          l !== k &&
          h2hWins(a.playerId, clusterIds) === h2hWins(b.playerId, clusterIds) &&
          a.pointDiff === b.pointDiff &&
          a.pointsFor === b.pointsFor
        ) {
          a.tiedWith.push(b.playerId);
        }
      });
    }
    ordered.push(...cluster);
    i = j;
  }

  ordered.forEach((r, idx) => (r.rank = idx + 1));
  return ordered;
}

// Whether every match in a round-robin among these players has been played.
export function roundRobinComplete(playerIds: string[], matches: Match[]): boolean {
  const set = new Set(playerIds);
  const rr = matches.filter(
    (mt) => mt.p1 != null && mt.p2 != null && set.has(mt.p1) && set.has(mt.p2),
  );
  return rr.length > 0 && rr.every((mt) => mt.status === "done");
}
