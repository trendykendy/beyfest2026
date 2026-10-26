import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getActiveTournament } from "$lib/server/tournament";
import { loadBetting, loadTournamentRecords } from "$lib/server/load";
import { exportFileName, exportHtml } from "$lib/archive";

// A tournament's results as one web page to keep off the event PC (a phone,
// a USB stick): it opens offline and carries the raw records inside it (see
// lib/archive.ts). The current tournament, or an archived one with ?id=.
// PocketBase's own scheduled backups (pb_data/backups) are the thing to
// restore from; this is the copy you take home.
export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.organiser) throw error(403, "Not signed in");
  const id = url.searchParams.get("id");
  const t = id ? await locals.pb.collection("tournaments").getOne(id).catch(() => null) : await getActiveTournament(locals.pb);
  if (!t) throw error(404, "No such tournament");

  const [view, betting] = await Promise.all([loadTournamentRecords(locals.pb, t), loadBetting(locals.pb, t.id)]);
  const iso = (v: unknown) => (typeof v === "string" && v ? new Date(v.replace(" ", "T")).toISOString() : "");
  const createdAt = iso(t.createdAt);
  const html = exportHtml({
    exportedAt: new Date().toISOString(),
    tournament: { id: t.id, name: t.name, status: t.status, createdAt, archivedAt: iso(t.archivedAt) },
    groups: view.groups,
    players: view.players,
    matches: view.matches,
    fighters: view.fighters,
    royale: view.royale,
    bettors: betting.bettors,
    bets: betting.bets,
  });
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFileName(t.name, createdAt)}"`,
      "cache-control": "no-store",
    },
  });
};
