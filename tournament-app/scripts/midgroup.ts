// Sets up a group stage PART-WAY through, for checking the TV mid-event:
// some results in, one match live, the rest to come.
// Usage: bun run scripts/midgroup.ts [count] [played]
//   count  — players, 8..15 (default 12)
//   played — group matches already finished (default 7)
import PocketBase from "pocketbase";
import {
  createTournament,
  enterScore,
  getActiveTournament,
  loadTournament,
  resetTournament,
} from "../web/src/lib/server/tournament.ts";
import { pointsToWin } from "../engine/src/index.ts";

const count = Number(process.argv[2] || 12);
const toPlay = Number(process.argv[3] || 7);
const NAMES = [
  "Valtryek", "Spryzen", "Fafnir", "Achilles", "Longinus", "Roktavor", "Xcalius", "Kerbeus",
  "Wyvron", "Doomscizor", "Horusood", "Zeutron", "Luinor", "Cyclops", "Bahamut",
].slice(0, count);

const pb = new PocketBase("http://127.0.0.1:8090");
await pb.collection("organisers").authWithPassword("organiser@beyfest.local", "beyfest2026");
const existing = await getActiveTournament(pb);
if (existing) await resetTournament(pb, existing.id);
const id = await createTournament(pb, "Beyfest 2026 — Triple Threat", NAMES);

async function readyGroupMatches() {
  const { state } = await loadTournament(pb, id);
  return state.matches
    .filter((m) => m.stage === "group" && m.status === "ready")
    .sort((a, b) => a.orderIndex - b.orderIndex);
}

for (let i = 0; i < toPlay; i++) {
  const [m] = await readyGroupMatches();
  if (!m) break;
  const t = pointsToWin(m.stage, m.roundLabel);
  const loser = 1 + Math.floor(Math.random() * (t - 1));
  const [s1, s2] = Math.random() < 0.5 ? [t, loser] : [loser, t];
  await enterScore(pb, id, m.code, s1, s2);
}

// Put the next match on the table with a running score.
const [live] = await readyGroupMatches();
if (live) {
  const rec = await pb
    .collection("matches")
    .getFirstListItem(pb.filter("tournament = {:id} && code = {:code}", { id, code: live.code }));
  // The round log must add up to the score, as the real scorer's does, or
  // admin's scorer (which rebuilds from the log) would show 0–0.
  await pb.collection("matches").update(rec.id, {
    liveP1: 3,
    liveP2: 2,
    liveLog: [
      { who: 1, finish: "spin" }, // 1–0
      { who: 2, finish: "knockout" }, // 1–2
      { who: 1, finish: "knockout" }, // 3–2
    ],
  });
}
console.log(`${count} players, ${toPlay} group matches played, ${live?.code ?? "none"} live at 3–2.`);
