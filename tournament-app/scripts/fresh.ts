// Resets and creates a fresh, UNPLAYED group stage (for demoing the schedule
// + Fixtures panel). Usage: bun run scripts/fresh.ts [count]
import PocketBase from "pocketbase";
import { createTournament, getActiveTournament, resetTournament } from "../web/src/lib/server/tournament.ts";

const count = Number(process.argv[2] || 12);
const NAMES = [
  "Valtryek", "Spryzen", "Fafnir", "Achilles", "Longinus", "Roktavor", "Xcalius", "Kerbeus",
  "Wyvron", "Doomscizor", "Horusood", "Zeutron", "Luinor", "Cyclops", "Bahamut",
].slice(0, count);

const pb = new PocketBase("http://127.0.0.1:8090");
await pb.collection("organisers").authWithPassword("organiser@beyfest.local", "beyfest2026");
const existing = await getActiveTournament(pb);
if (existing) await resetTournament(pb, existing.id);
const id = await createTournament(pb, "Beyfest 2026 — Triple Threat", NAMES);
console.log(`Fresh ${count}-blader group stage created (unplayed).`);
