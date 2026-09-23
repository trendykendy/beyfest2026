// Drives a realistic sample tournament through the same server functions the
// admin panel uses, so it shows up live on the public display.
//   bun run scripts/sample.ts setup    # reset + create + play the group stage
//   bun run scripts/sample.ts finish   # generate + play the knockout to a champion
import PocketBase from "pocketbase";
import {
  createTournament,
  enterScore,
  generateKnockoutStage,
  getActiveTournament,
  loadTournament,
  resetTournament,
} from "../web/src/lib/server/tournament.ts";
import { computeStandings, pointsToWin } from "../engine/src/index.ts";

const ordinal = (n: number): string => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const PB_URL = "http://127.0.0.1:8090";
const phase = process.argv[2] || "setup";

const NAMES = [
  "Valtryek", "Spryzen", "Fafnir", "Achilles",
  "Longinus", "Roktavor", "Xcalius", "Kerbeus",
  "Wyvron", "Doomscizor", "Horusood", "Zeutron",
];

const pb = new PocketBase(PB_URL);
await pb.collection("organisers").authWithPassword("organiser@beyfest.local", "beyfest2026");

// Winner reaches the match target; loser gets a plausible 1..target-1.
function score(target: number): [number, number] {
  const loser = 1 + Math.floor(Math.random() * (target - 1));
  return Math.random() < 0.5 ? [target, loser] : [loser, target];
}

async function playReady(kind: "group" | "knockout"): Promise<number> {
  let n = 0;
  for (let g = 0; g < 300; g++) {
    const { state } = await loadTournament(pb, id);
    const ready = state.matches
      .filter((m) => (kind === "group" ? m.stage === "group" : m.stage !== "group"))
      .filter((m) => m.status === "ready")
      .sort((a, b) => a.orderIndex - b.orderIndex);
    if (!ready.length) break;
    const m = ready[0];
    const [s1, s2] = score(pointsToWin(m.stage, m.roundLabel));
    await enterScore(pb, id, m.code, s1, s2);
    n++;
  }
  return n;
}

let id: string;

if (phase === "setup") {
  const existing = await getActiveTournament(pb);
  if (existing) await resetTournament(pb, existing.id);
  console.log(`Creating a ${NAMES.length}-player tournament…`);
  id = await createTournament(pb, "Beyfest 2026 — Triple Threat", NAMES);
  const played = await playReady("group");
  console.log(`Played ${played} group matches.\n`);

  const { state } = await loadTournament(pb, id);
  const nameOf = (pid: string) => state.players.find((p) => p.id === pid)!.name;
  for (const grp of new Set(state.players.map((p) => p.group))) {
    const ids = state.players.filter((p) => p.group === grp).map((p) => p.id);
    const rows = computeStandings(ids, state.matches);
    console.log(`Group ${(grp as number) + 1}`);
    rows.forEach((r, i) => {
      const dest = i === 0 ? "→ Winners" : i === rows.length - 1 ? "→ Losers" : "→ Mid";
      console.log(
        `  ${ordinal(i + 1).padEnd(4)} ${nameOf(r.playerId).padEnd(12)} ` +
          `${r.wins}W-${r.losses}L  ${r.pointDiff >= 0 ? "+" : ""}${r.pointDiff}  ${dest}`,
      );
    });
    console.log("");
  }
  console.log("Group stage done. Refresh the public display to see the groups & standings.");
} else {
  const t = await getActiveTournament(pb);
  if (!t) throw new Error("No active tournament — run `setup` first.");
  id = t.id;
  console.log("Generating knockout bracket…");
  await generateKnockoutStage(pb, id);
  const played = await playReady("knockout");
  console.log(`Played ${played} knockout matches.\n`);

  const { state } = await loadTournament(pb, id);
  const nameOf = (pid: string) => state.players.find((p) => p.id === pid)?.name ?? "—";
  let lastLabel = "";
  for (const m of state.matches.filter((x) => x.stage !== "group").sort((a, b) => a.orderIndex - b.orderIndex)) {
    if (m.roundLabel !== lastLabel) {
      console.log(`\n${m.roundLabel}`);
      lastLabel = m.roundLabel;
    }
    const w = m.winner === m.p1 ? nameOf(m.p1!) : nameOf(m.p2!);
    console.log(`  ${m.code.padEnd(5)} ${nameOf(m.p1!).padEnd(12)} ${m.p1Score}–${m.p2Score} ${nameOf(m.p2!).padEnd(12)}  → ${w}`);
  }
  const gf = state.matches.find((m) => m.stage === "gf")!;
  console.log(`\n🏆 CHAMPION: ${nameOf(gf.winner)}`);
  console.log("\nRefresh the public display to see the full bracket & champion.");
}
