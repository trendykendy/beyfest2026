import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getActiveTournament } from "$lib/server/tournament";
import { drawStadium } from "$lib/server/stadium";
import { STADIA, isStadiumKey } from "$lib/stadia";

// The scorer's stadium controls. Organiser-only.
//   { code, redraw: true } — draw again for the current round (the stadium is
//                            broken, say); never lands on the same one, and
//                            replays the shuffle on the TV
//   { off: ["motor"] }     — which stadia are out of the draw from now on;
//                            at least one always stays in
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.organiser) throw error(403, "Not signed in");
  const body = await request.json();
  const t = await getActiveTournament(locals.pb);
  if (!t) throw error(400, "No active tournament");

  if (Array.isArray(body.off)) {
    const off = [...new Set(body.off.filter(isStadiumKey))] as string[];
    if (off.length >= STADIA.length) throw error(400, "At least one stadium has to stay in the draw");
    await locals.pb.collection("tournaments").update(t.id, { stadiaOff: off });
    return json({ ok: true, off });
  }

  if (body.redraw) {
    const match = await locals.pb
      .collection("matches")
      .getFirstListItem(locals.pb.filter("tournament = {:id} && code = {:code}", { id: t.id, code: body.code }));
    if (match.matchStatus !== "ready") throw error(400, `${body.code} isn't being played`);
    const stadium = await drawStadium(locals.pb, t, match.id, {
      log: Array.isArray(match.liveLog) ? match.liveLog : [],
      avoid: match.stadium,
    });
    await locals.pb.collection("matches").update(match.id, { stadium, stadiumAt: new Date().toISOString() });
    return json({ ok: true, stadium });
  }

  throw error(400, "Nothing to do");
};
