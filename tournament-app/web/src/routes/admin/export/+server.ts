import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getActiveTournament } from "$lib/server/tournament";

// Everything about the current tournament as one JSON file, for the organiser
// to keep a copy off the laptop (a USB stick, a phone). PocketBase's own
// scheduled backups (pb_data/backups) are the thing to restore from; this is
// the human-readable spare.
export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.organiser) throw error(403, "Not signed in");
  const t = await getActiveTournament(locals.pb);
  if (!t) throw error(404, "No tournament yet");
  const filter = locals.pb.filter("tournament = {:id}", { id: t.id });
  const [groups, players, matches] = await Promise.all([
    locals.pb.collection("groups").getFullList({ filter, sort: "index" }),
    locals.pb.collection("players").getFullList({ filter, sort: "name" }),
    locals.pb.collection("matches").getFullList({ filter, sort: "orderIndex" }),
  ]);
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const body = JSON.stringify({ exportedAt: new Date().toISOString(), tournament: t, groups, players, matches }, null, 2);
  return new Response(body, {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="beyfest-results-${stamp}.json"`,
      "cache-control": "no-store",
    },
  });
};
