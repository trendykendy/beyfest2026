import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getActiveTournament } from "$lib/server/tournament";
import { FINISHES } from "$lib/finishes";
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
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.organiser) throw error(403, "Not signed in");
  const { code, s1, s2, log } = await request.json();
  const t = await getActiveTournament(locals.pb);
  if (!t) throw error(400, "No active tournament");
  const match = await locals.pb
    .collection("matches")
    .getFirstListItem(locals.pb.filter("tournament = {:id} && code = {:code}", { id: t.id, code }));
  await locals.pb.collection("matches").update(match.id, {
    liveP1: Number(s1) || 0,
    liveP2: Number(s2) || 0,
    liveLog: cleanLog(log),
  });
  return json({ ok: true });
};
