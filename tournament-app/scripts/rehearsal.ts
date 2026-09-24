// A full dress rehearsal: plays a whole tournament through the real server,
// round by round at a watchable pace, exactly as the admin scorer would. Leave
// the TV (and the Pi, and the projector…) running and watch it cope for an
// entire event: call-outs, cuts to Match centre, rotation, the knockout
// appearing, the champion.
//
// Usage: bun run scripts/rehearsal.ts [players] [secondsPerRound]
//   players          8–15 (default 12)
//   secondsPerRound  pause after each round (default 4; try 1 for a quick run)
//
// WARNING: resets whatever tournament is in the database it talks to
// (127.0.0.1:8090). Point it at a test data folder, not the real event.
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

const count = Number(process.argv[2] || 12);
const pace = Number(process.argv[3] || 4) * 1000;
const NAMES = [
  "Valtryek", "Spryzen", "Fafnir", "Achilles", "Longinus", "Roktavor", "Xcalius", "Kerbeus",
  "Wyvron", "Doomscizor", "Horusood", "Zeutron", "Luinor", "Cyclops", "Bahamut",
].slice(0, count);

// How rounds tend to go: mostly spin finishes, some knockouts, the odd dominant.
const FINISHES = [
  { key: "spin", pts: 1, weight: 6 },
  { key: "knockout", pts: 2, weight: 3 },
  { key: "dominant", pts: 3, weight: 1 },
];
function randomFinish() {
  let r = Math.random() * FINISHES.reduce((a, f) => a + f.weight, 0);
  for (const f of FINISHES) if ((r -= f.weight) < 0) return f;
  return FINISHES[0];
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const pb = new PocketBase("http://127.0.0.1:8090");
await pb.collection("organisers").authWithPassword("organiser@beyfest.local", "beyfest2026");
const existing = await getActiveTournament(pb);
if (existing) await resetTournament(pb, existing.id);
const id = await createTournament(pb, "Beyfest 2026 — Triple Threat", NAMES);
console.log(`Rehearsal: ${count} bladers, ${pace / 1000}s per round. Ctrl+C to stop.\n`);

const started = Date.now();
for (;;) {
  const { state, matchIdByCode } = await loadTournament(pb, id);
  const next = state.matches
    .filter((m) => m.status === "ready")
    .sort((a, b) => a.orderIndex - b.orderIndex)[0];

  if (!next) {
    const knockoutExists = state.matches.some((m) => m.stage !== "group");
    if (!knockoutExists) {
      console.log("\nGroups finished. Generating the knockout bracket…\n");
      await generateKnockoutStage(pb, id);
      await sleep(pace * 3);
      continue;
    }
    break; // nothing left to play
  }

  const name = (pid: string | null) => state.players.find((p) => p.id === pid)?.name ?? "?";
  const target = pointsToWin(next.stage, next.roundLabel);
  const recId = matchIdByCode.get(next.code)!;
  const log: { who: 1 | 2; finish: string }[] = [];
  let s1 = 0;
  let s2 = 0;
  // One side is a bit stronger each match, so scores aren't always close.
  const edge = 0.35 + Math.random() * 0.3;
  while (s1 < target && s2 < target) {
    const who: 1 | 2 = Math.random() < edge ? 1 : 2;
    const f = randomFinish();
    log.push({ who, finish: f.key });
    if (who === 1) s1 += f.pts;
    else s2 += f.pts;
    // Same fields the admin scorer posts to /admin/live.
    await pb.collection("matches").update(recId, { liveP1: s1, liveP2: s2, liveLog: log });
    await sleep(pace);
  }
  await enterScore(pb, id, next.code, s1, s2);
  console.log(`${next.code.padEnd(6)} ${name(next.p1)} ${s1}–${s2} ${name(next.p2)}`);
  await sleep(pace * 2); // a breather between matches, like the real thing
}

const { state } = await loadTournament(pb, id);
const gf = state.matches.find((m) => m.stage === "gf");
const champ = state.players.find((p) => p.id === gf?.winner)?.name;
console.log(`\nChampion: ${champ}. Took ${Math.round((Date.now() - started) / 60000)} minutes.`);
