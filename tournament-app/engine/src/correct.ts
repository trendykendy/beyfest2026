import type { Match, Stage } from "./types";
import { computeStandings } from "./standings";
import { resolve, type State } from "./knockout";

// ─── Correcting a recorded result ───────────────────────────────────
// Once a result resolves, the players it feeds are pinned into their next
// matches (the slot is cleared), so simply re-applying a score would leave the
// OLD winner in the next round. A correction therefore has to work out what
// the result feeds and either re-pin it or refuse:
//   • knockout match, same winner   → just the score changes
//   • knockout match, winner flips  → swap the new winner/loser into the next
//                                     matches, unless one of them was played
//   • group / mini round-robin      → fine until its table has been used; after
//                                     that only if the table order is unchanged
//                                     (seeds and pool draws were made from it)

export interface Repin {
  code: string; // the downstream match
  side: 1 | 2;
  player: string; // who goes in instead
}

export type CorrectionPlan = { ok: true; repins: Repin[] } | { ok: false; reason: string };

// Work out whether a correction is safe, without changing anything.
export function planCorrection(state: State, code: string, p1Score: number, p2Score: number): CorrectionPlan {
  const mt = state.matches.find((m) => m.code === code);
  if (!mt) return { ok: false, reason: `There's no match ${code}.` };
  if (mt.status !== "done" || !mt.p1 || !mt.p2) return { ok: false, reason: `${code} hasn't been played yet.` };
  if (p1Score === p2Score) return { ok: false, reason: "A match can't end in a draw." };

  const name = (id: string | null) => state.players.find((p) => p.id === id)?.name ?? "someone";
  const newWinner = p1Score > p2Score ? mt.p1 : mt.p2;
  const newLoser = newWinner === mt.p1 ? mt.p2 : mt.p1;

  // Group and mini round-robin results feed a table, not a single next match.
  if (mt.stage === "group" || mt.stage === "wb_rr" || mt.stage === "lb_rr") {
    const table = tableMatches(state.matches, mt);
    if (!tableUsed(state, mt)) return { ok: true, repins: [] };
    const ids = [...new Set(table.flatMap((m) => [m.p1!, m.p2!]))];
    const before = computeStandings(ids, table).map((r) => r.playerId);
    const after = computeStandings(
      ids,
      // A fixed score is a played result, even if it was a walkover before.
      table.map((m) => (m.code === code ? { ...m, p1Score, p2Score, walkover: false } : m)),
    ).map((r) => r.playerId);
    if (before.join() !== after.join()) {
      const where = mt.stage === "group" ? "group" : "round-robin";
      return {
        ok: false,
        reason: `That would change the ${where} table, and the knockout has already been drawn from it.`,
      };
    }
    return { ok: true, repins: [] };
  }

  // Knockout: same winner → the score is all that changes.
  if (newWinner === mt.winner) return { ok: true, repins: [] };

  const repins: Repin[] = [];
  for (const def of state.structure.matches) {
    const sides = [def.slot1, def.slot2] as const;
    for (let i = 0; i < 2; i++) {
      const slot = sides[i];
      if ((slot.k !== "winner" && slot.k !== "loser") || slot.match !== code) continue;
      const next = state.matches.find((m) => m.code === def.code);
      if (!next) continue;
      const oldPlayer = slot.k === "winner" ? mt.winner : mt.loser;
      if (next.status === "done") {
        return { ok: false, reason: `${next.code} has already been played with ${name(oldPlayer)} in it.` };
      }
      repins.push({ code: def.code, side: (i + 1) as 1 | 2, player: slot.k === "winner" ? newWinner : newLoser });
    }
  }
  return { ok: true, repins };
}

// Apply a correction (throws with the plain-words reason if it isn't safe).
export function applyCorrection(state: State, code: string, p1Score: number, p2Score: number): State {
  const plan = planCorrection(state, code, p1Score, p2Score);
  if (!plan.ok) throw new Error(plan.reason);
  const mt = state.matches.find((m) => m.code === code)!;
  mt.p1Score = p1Score;
  mt.p2Score = p2Score;
  mt.walkover = false; // a fixed score is a played result
  for (const r of plan.repins) {
    const next = state.matches.find((m) => m.code === r.code)!;
    if (r.side === 1) next.p1 = r.player;
    else next.p2 = r.player;
  }
  return resolve(state);
}

// The matches whose table this result counts towards.
function tableMatches(matches: Match[], mt: Match): Match[] {
  if (mt.stage === "group") return matches.filter((m) => m.stage === "group" && m.group === mt.group);
  return matches.filter((m) => m.stage === mt.stage);
}

// Has anything been built from this table yet? Groups feed the knockout the
// moment it's generated; a mini round-robin feeds it once all its matches are in.
function tableUsed(state: State, mt: Match): boolean {
  if (mt.stage === "group") return state.matches.some((m) => m.stage !== "group");
  const stage: Stage = mt.stage;
  return state.matches.filter((m) => m.stage === stage).every((m) => m.status === "done");
}
