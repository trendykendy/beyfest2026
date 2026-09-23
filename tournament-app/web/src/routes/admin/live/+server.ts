import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getActiveTournament } from "$lib/server/tournament";

// Push the running score of an in-progress match so the public/TV displays can
// show it live. Organiser-only; writes just the liveP1/liveP2 fields (never the
// final result — that goes through the ?/score action).
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.organiser) throw error(403, "Not signed in");
  const { code, s1, s2 } = await request.json();
  const t = await getActiveTournament(locals.pb);
  if (!t) throw error(400, "No active tournament");
  const match = await locals.pb
    .collection("matches")
    .getFirstListItem(locals.pb.filter("tournament = {:id} && code = {:code}", { id: t.id, code }));
  await locals.pb.collection("matches").update(match.id, {
    liveP1: Number(s1) || 0,
    liveP2: Number(s2) || 0,
  });
  return json({ ok: true });
};
