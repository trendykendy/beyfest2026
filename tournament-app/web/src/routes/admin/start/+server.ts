import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getActiveTournament } from "$lib/server/tournament";
import { drawStadium } from "$lib/server/stadium";

// "Start match" from the admin scorer: stamps startedAt so the match is live
// straight away, and draws the first round's stadium, which cues the TV's
// launch (stadium draw, then LET IT RIP). { start: false } takes it back
// (pressed on the wrong match). Organiser-only, playable matches only.
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.organiser) throw error(403, "Not signed in");
  const { code, start = true } = await request.json();
  const t = await getActiveTournament(locals.pb);
  if (!t) throw error(400, "No active tournament");
  const match = await locals.pb
    .collection("matches")
    .getFirstListItem(locals.pb.filter("tournament = {:id} && code = {:code}", { id: t.id, code }));
  if (match.matchStatus !== "ready") throw error(400, `${code} can't be started now`);
  const now = new Date().toISOString();
  const stadium = start ? await drawStadium(locals.pb, t, match.id) : "";
  await locals.pb.collection("matches").update(match.id, {
    startedAt: start ? now : "",
    stadium,
    stadiumAt: start ? now : "",
  });
  return json({ ok: true, stadium });
};
