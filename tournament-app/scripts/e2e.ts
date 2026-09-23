// End-to-end check against a running PocketBase: exercises the exact server
// functions the admin panel calls. Usage: bun run scripts/e2e.ts [count]
import PocketBase from "pocketbase";
import {
  createTournament,
  enterScore,
  generateKnockoutStage,
  getActiveTournament,
  loadTournament,
  resetTournament,
} from "../web/src/lib/server/tournament.ts";
import { pointsToWin } from "../engine/src/index.ts";

const PB_URL = "http://127.0.0.1:8090";
const count = Number(process.argv[2] || 12);

const pb = new PocketBase(PB_URL);
await pb.collection("organisers").authWithPassword("organiser@beyfest.local", "beyfest2026");

// Clean any existing tournament first.
const existing = await getActiveTournament(pb);
if (existing) await resetTournament(pb, existing.id);

const names = Array.from({ length: count }, (_, i) => `Blader ${String.fromCharCode(65 + i)}`);
console.log(`Creating ${count}-player tournament…`);
const id = await createTournament(pb, "E2E Test", names);

// Helper: play every currently-ready match of a predicate until none remain.
async function playReady(kind: "group" | "knockout"): Promise<number> {
  let played = 0;
  for (let guard = 0; guard < 300; guard++) {
    const { state } = await loadTournament(pb, id);
    const ready = state.matches
      .filter((m) => (kind === "group" ? m.stage === "group" : m.stage !== "group"))
      .filter((m) => m.status === "ready")
      .sort((a, b) => a.orderIndex - b.orderIndex);
    if (!ready.length) break;
    const m = ready[0];
    const target = pointsToWin(m.stage, m.roundLabel);
    const loser = Math.floor(Math.random() * target); // 0..target-1
    const p1wins = Math.random() < 0.5;
    await enterScore(pb, id, m.code, p1wins ? target : loser, p1wins ? loser : target);
    played++;
  }
  return played;
}

const g = await playReady("group");
{
  const { state } = await loadTournament(pb, id);
  const groupMatches = state.matches.filter((m) => m.stage === "group");
  const groupDone = groupMatches.filter((m) => m.status === "done").length;
  console.log(`Played ${g} group matches; ${groupDone}/${groupMatches.length} group matches done.`);
  if (groupDone !== groupMatches.length) {
    console.log("\n❌ FAIL — group stage not fully played before knockout");
    process.exit(1);
  }
}

console.log("Generating knockout…");
await generateKnockoutStage(pb, id);

const k = await playReady("knockout");
console.log(`Played ${k} knockout matches.`);

const { state } = await loadTournament(pb, id);
const t = await pb.collection("tournaments").getOne(id);
const gf = state.matches.find((m) => m.stage === "gf");
const champ = gf?.status === "done" ? state.players.find((p) => p.id === gf.winner)?.name : null;
const stuck = state.matches.filter((m) => m.stage !== "group" && m.status !== "done").map((m) => m.code);
const doneCount = state.matches.filter((m) => m.status === "done").length;

console.log("─".repeat(40));
console.log(`tournament status : ${t.status}`);
console.log(`champion          : ${champ ?? "(none)"}`);
console.log(`matches done      : ${doneCount}`);
console.log(`unresolved KO     : ${stuck.length ? stuck.join(", ") : "none"}`);

const ok = t.status === "complete" && champ && stuck.length === 0;
console.log(ok ? "\n✅ PASS" : "\n❌ FAIL");
process.exit(ok ? 0 : 1);
