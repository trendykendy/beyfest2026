import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getActiveTournament } from "$lib/server/tournament";

// "Start match" from the admin scorer: stamps startedAt so the match is live
// straight away and the TV plays its launch countdown. { start: false } takes
// it back (pressed on the wrong match). Organiser-only, playable matches only.
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.organiser) throw error(403, "Not signed in");
  const { code, start = true } = await request.json();
  const t = await getActiveTournament(locals.pb);
  if (!t) throw error(400, "No active tournament");
  const match = await locals.pb
    .collection("matches")
    .getFirstListItem(locals.pb.filter("tournament = {:id} && code = {:code}", { id: t.id, code }));
  if (match.matchStatus !== "ready") throw error(400, `${code} can't be started now`);
  await locals.pb.collection("matches").update(match.id, { startedAt: start ? new Date().toISOString() : "" });
  return json({ ok: true });
};
