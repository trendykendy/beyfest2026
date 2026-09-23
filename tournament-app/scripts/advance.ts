// Advances the ACTIVE tournament: plays out the group stage, then generates the
// knockout (leaving it unplayed) so the Match Centre shows the mini-RR / bracket
// phases. Usage: bun run scripts/advance.ts
import PocketBase from "pocketbase";
import {
  enterScore,
  generateKnockoutStage,
  getActiveTournament,
  loadTournament,
} from "../web/src/lib/server/tournament.ts";
import { pointsToWin } from "../engine/src/index.ts";

const pb = new PocketBase("http://127.0.0.1:8090");
await pb.collection("organisers").authWithPassword("organiser@beyfest.local", "beyfest2026");
const t = await getActiveTournament(pb);
if (!t) throw new Error("no active tournament");

for (let g = 0; g < 400; g++) {
  const { state } = await loadTournament(pb, t.id);
  const m = state.matches
    .filter((x) => x.stage === "group" && x.status === "ready")
    .sort((a, b) => a.orderIndex - b.orderIndex)[0];
  if (!m) break;
  const target = pointsToWin(m.stage, m.roundLabel);
  const loser = Math.floor(Math.random() * target);
  const p1wins = Math.random() < 0.5;
  await enterScore(pb, t.id, m.code, p1wins ? target : loser, p1wins ? loser : target);
}
await generateKnockoutStage(pb, t.id);

// Pass "groups" to stop at the knockout start (unplayed); otherwise play it out.
if (process.argv[2] !== "groups") {
  for (let g = 0; g < 400; g++) {
    const { state } = await loadTournament(pb, t.id);
    const m = state.matches
      .filter((x) => x.stage !== "group" && x.status === "ready")
      .sort((a, b) => a.orderIndex - b.orderIndex)[0];
    if (!m) break;
    const target = pointsToWin(m.stage, m.roundLabel);
    const loser = Math.floor(Math.random() * target);
    const p1wins = Math.random() < 0.5;
    await enterScore(pb, t.id, m.code, p1wins ? target : loser, p1wins ? loser : target);
  }
  console.log("Group stage + knockout played to a champion.");
} else {
  console.log("Group stage played; knockout generated (unplayed).");
}
