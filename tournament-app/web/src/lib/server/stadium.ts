import type PocketBase from "pocketbase";
import type { RecordModel } from "pocketbase";
import { isStadiumKey, pickStadium } from "../stadia";

// Stadia the organiser has taken out of the draw.
export const stadiaOff = (tournament: RecordModel): string[] =>
  Array.isArray(tournament.stadiaOff) ? tournament.stadiaOff.filter(isStadiumKey) : [];

// Draw the stadium for a match's next round. Weighted across the whole event
// (see pickStadium): every round played so far, from the round logs, plus the
// stadium already waiting on any other match in play. `avoid` is the stadium
// being redrawn, so a redraw never lands on it again. This match's own rounds
// come from `log` (the log about to be saved), not the stored copy.
export async function drawStadium(
  pb: PocketBase,
  tournament: RecordModel,
  matchId: string,
  { log = [], avoid = "" }: { log?: { stadium?: string }[]; avoid?: string } = {},
): Promise<string> {
  const matches = await pb.collection("matches").getFullList({
    filter: pb.filter("tournament = {:id}", { id: tournament.id }),
    fields: "id,liveLog,stadium,matchStatus",
  });
  const counts: Record<string, number> = {};
  const add = (key: unknown) => {
    if (isStadiumKey(key)) counts[key] = (counts[key] ?? 0) + 1;
  };
  for (const r of log) add(r.stadium);
  for (const m of matches) {
    if (m.id === matchId) continue;
    for (const r of Array.isArray(m.liveLog) ? m.liveLog : []) add(r?.stadium);
    if (m.matchStatus === "ready") add(m.stadium);
  }
  return pickStadium(counts, { off: stadiaOff(tournament), avoid });
}
