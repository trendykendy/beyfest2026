import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { pointsToWin } from "@beyfest/engine";
import { getActiveTournament } from "$lib/server/tournament";
import { drawStadium } from "$lib/server/stadium";
import { FINISHES } from "$lib/finishes";
import { isStadiumKey } from "$lib/stadia";
import type { LiveRound } from "$lib/view";

const FINISH_KEYS = new Set(FINISHES.map((f) => f.key));

// Keep only well-formed rounds; a bad entry is dropped rather than failing the
// whole update (the running score still matters more than the call-out).
function cleanLog(raw: unknown): LiveRound[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 60)
    .filter((r) => r && (r.who === 1 || r.who === 2) && FINISH_KEYS.has(r.finish))
    .map((r) => ({ who: r.who, finish: r.finish }));
}

// Push the running score (and how each round was won) of an in-progress match
// so the public/TV displays can show it live. Organiser-only; writes just the
// live fields (never the final result — that goes through the ?/score action).
//
// It also runs the stadium draw. The scorer doesn't send stadia, so:
//   • rounds already saved keep the stadium they were played in;
//   • a new round was played in the match's current stadium;
//   • a new round that doesn't win the match draws the next round's stadium
//     (which cues the TV's shuffle); one that wins it clears it;
//   • Undo puts the undone round's stadium back as the current one.
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.organiser) throw error(403, "Not signed in");
  const { code, s1, s2, log } = await request.json();
  const t = await getActiveTournament(locals.pb);
  if (!t) throw error(400, "No active tournament");
  const match = await locals.pb
    .collection("matches")
    .getFirstListItem(locals.pb.filter("tournament = {:id} && code = {:code}", { id: t.id, code }));

  const saved: LiveRound[] = Array.isArray(match.liveLog) ? match.liveLog : [];
  const rounds = cleanLog(log);
  rounds.forEach((r, i) => {
    const where = i < saved.length ? saved[i].stadium : match.stadium;
    if (isStadiumKey(where)) r.stadium = where;
  });

  const p1 = Number(s1) || 0;
  const p2 = Number(s2) || 0;
  let stadium: Record<string, string> = {};
  if (rounds.length > saved.length) {
    const target = pointsToWin(match.stage, match.roundLabel);
    stadium =
      p1 >= target || p2 >= target
        ? { stadium: "" }
        : { stadium: await drawStadium(locals.pb, t, match.id, { log: rounds }), stadiumAt: new Date().toISOString() };
  } else if (rounds.length < saved.length) {
    const undone = saved[rounds.length]?.stadium;
    if (isStadiumKey(undone)) stadium = { stadium: undone };
  }

  await locals.pb.collection("matches").update(match.id, {
    liveP1: p1,
    liveP2: p2,
    liveLog: rounds,
    ...stadium,
  });
  return json({ ok: true });
};
