import type PocketBase from "pocketbase";
import type { RecordModel } from "pocketbase";
import {
  createGroupStage,
  generateKnockout,
  applyResult,
  champion,
  pickStructure,
  pointsToWin,
  type Match,
  type Player,
  type State,
  type PlayerInput,
} from "@beyfest/engine";

// ─── Loading ─────────────────────────────────────────────────────────
export interface LoadedTournament {
  tournament: RecordModel;
  state: State;
  matchIdByCode: Map<string, string>;
  groupIdByIndex: Map<number, string>;
  groups: RecordModel[];
}

export async function getActiveTournament(pb: PocketBase): Promise<RecordModel | null> {
  const list = await pb.collection("tournaments").getFullList({ sort: "-createdAt" });
  return list[0] ?? null;
}

function recToPlayer(r: RecordModel): Player {
  return {
    id: r.id,
    name: r.name,
    group: r.groupIndex ?? null,
    drawOrder: r.drawOrder ?? 0,
    finalGroupRank: r.finalGroupRank ?? null,
  };
}

function recToMatch(r: RecordModel): Match {
  // PocketBase number fields come back as 0 (not null) when unset, which the
  // engine would read as a played 0–0 match. Scores are only real once the
  // match is done — gate on matchStatus.
  const done = r.matchStatus === "done";
  return {
    code: r.code,
    stage: r.stage,
    roundLabel: r.roundLabel,
    orderIndex: r.orderIndex,
    group: r.groupIndex ?? null,
    slot1: r.slot1 ?? null,
    slot2: r.slot2 ?? null,
    p1: r.p1 || null,
    p2: r.p2 || null,
    p1Score: done ? (r.p1Score ?? null) : null,
    p2Score: done ? (r.p2Score ?? null) : null,
    winner: r.winner || null,
    loser: r.loser || null,
    status: r.matchStatus,
  };
}

export async function loadTournament(
  pb: PocketBase,
  tournamentId: string,
): Promise<LoadedTournament> {
  const tournament = await pb.collection("tournaments").getOne(tournamentId);
  const filter = pb.filter("tournament = {:id}", { id: tournamentId });
  const [groups, players, matches] = await Promise.all([
    pb.collection("groups").getFullList({ filter, sort: "index" }),
    pb.collection("players").getFullList({ filter }),
    pb.collection("matches").getFullList({ filter, sort: "orderIndex" }),
  ]);

  const state: State = {
    structure: pickStructure(tournament.structureKey),
    players: players.map(recToPlayer),
    matches: matches.map(recToMatch),
  };

  return {
    tournament,
    state,
    matchIdByCode: new Map(matches.map((r) => [r.code, r.id])),
    groupIdByIndex: new Map(groups.map((r) => [r.index, r.id])),
    groups,
  };
}

// ─── Serialisation helpers ───────────────────────────────────────────
function matchPayload(
  m: Match,
  tournamentId: string,
  groupIdByIndex: Map<number, string>,
): Record<string, unknown> {
  return {
    tournament: tournamentId,
    stage: m.stage,
    code: m.code,
    roundLabel: m.roundLabel,
    orderIndex: m.orderIndex,
    group: m.group != null ? groupIdByIndex.get(m.group) ?? null : null,
    groupIndex: m.group,
    slot1: m.slot1,
    slot2: m.slot2,
    p1: m.p1 ?? "",
    p2: m.p2 ?? "",
    p1Score: m.p1Score,
    p2Score: m.p2Score,
    winner: m.winner ?? "",
    loser: m.loser ?? "",
    matchStatus: m.status,
  };
}

// Fields that change as the bracket resolves — used to patch only what moved.
function mutableEqual(a: Match, b: Match): boolean {
  return (
    a.p1 === b.p1 &&
    a.p2 === b.p2 &&
    a.p1Score === b.p1Score &&
    a.p2Score === b.p2Score &&
    a.winner === b.winner &&
    a.loser === b.loser &&
    a.status === b.status &&
    JSON.stringify(a.slot1) === JSON.stringify(b.slot1) &&
    JSON.stringify(a.slot2) === JSON.stringify(b.slot2)
  );
}

// Persist the delta between a pre-mutation snapshot and the resolved state:
// create matches with new codes, patch changed matches, patch changed
// finalGroupRank, and roll the tournament status forward.
async function persistDelta(
  pb: PocketBase,
  loaded: LoadedTournament,
  before: State,
  beforeRanks: Map<string, number | null>,
): Promise<void> {
  const { state, matchIdByCode, groupIdByIndex, tournament } = loaded;
  const beforeByCode = new Map(before.matches.map((m) => [m.code, m]));

  for (const m of state.matches) {
    const id = matchIdByCode.get(m.code);
    if (!id) {
      const created = await pb
        .collection("matches")
        .create(matchPayload(m, tournament.id, groupIdByIndex));
      matchIdByCode.set(m.code, created.id);
      continue;
    }
    const prev = beforeByCode.get(m.code);
    if (!prev || !mutableEqual(prev, m)) {
      await pb.collection("matches").update(id, {
        slot1: m.slot1,
        slot2: m.slot2,
        p1: m.p1 ?? "",
        p2: m.p2 ?? "",
        p1Score: m.p1Score,
        p2Score: m.p2Score,
        winner: m.winner ?? "",
        loser: m.loser ?? "",
        matchStatus: m.status,
        // A match only changes here when it's resolved or recorded, never while
        // it's being live-scored — so clearing the running score is safe and
        // wipes the tally once the final result lands.
        liveP1: 0,
        liveP2: 0,
        liveLog: [],
      });
    }
  }

  for (const p of state.players) {
    if (beforeRanks.get(p.id) !== p.finalGroupRank) {
      const pid = state.players.find((x) => x.id === p.id)!.id;
      await pb.collection("players").update(pid, { finalGroupRank: p.finalGroupRank });
    }
  }

  const status = champion(state)
    ? "complete"
    : state.matches.some((m) => m.stage !== "group")
      ? "knockout"
      : "group_stage";
  if (status !== tournament.status) {
    await pb.collection("tournaments").update(tournament.id, { status });
  }
}

function snapshot(state: State): State {
  return JSON.parse(JSON.stringify(state));
}

function rankMap(state: State): Map<string, number | null> {
  return new Map(state.players.map((p) => [p.id, p.finalGroupRank]));
}

// ─── Actions ─────────────────────────────────────────────────────────

// Create the tournament from a list of names: random draw + group matches.
export async function createTournament(
  pb: PocketBase,
  name: string,
  playerNames: string[],
): Promise<string> {
  const names = playerNames.map((n) => n.trim()).filter(Boolean);
  const structure = pickStructure(names.length); // throws if not 8–15

  const tournament = await pb.collection("tournaments").create({
    name: name.trim() || "Beyfest 2026",
    playerCount: names.length,
    structureKey: names.length,
    status: "setup",
  });

  const groupIdByIndex = new Map<number, string>();
  for (let g = 0; g < structure.groups.length; g++) {
    const rec = await pb.collection("groups").create({
      tournament: tournament.id,
      index: g,
      name: `Group ${g + 1}`,
      size: structure.groups[g],
      format: structure.roundRobin,
      complete: false,
    });
    groupIdByIndex.set(g, rec.id);
  }

  const inputs: PlayerInput[] = [];
  for (const n of names) {
    const rec = await pb.collection("players").create({ tournament: tournament.id, name: n });
    inputs.push({ id: rec.id, name: n });
  }

  const stage = createGroupStage(inputs); // random draw (Math.random)

  for (const p of stage.players) {
    await pb.collection("players").update(p.id, {
      group: groupIdByIndex.get(p.group!),
      groupIndex: p.group,
      drawOrder: p.drawOrder,
    });
  }

  for (const m of stage.matches) {
    await pb.collection("matches").create(matchPayload(m, tournament.id, groupIdByIndex));
  }

  await pb.collection("tournaments").update(tournament.id, { status: "group_stage" });
  return tournament.id;
}

// Enter a score, advance the bracket, persist the delta.
export async function enterScore(
  pb: PocketBase,
  tournamentId: string,
  code: string,
  p1Score: number,
  p2Score: number,
): Promise<void> {
  const loaded = await loadTournament(pb, tournamentId);
  const match = loaded.state.matches.find((mt) => mt.code === code);
  if (match) {
    // Matches are played round-by-round; each round is worth 1–3 points (Spin /
    // Knockout / Dominant), accumulating until a blader REACHES the target. So
    // the winner's score is >= target and can overshoot by up to 2 (a 3-point
    // finish from target-1); the loser never reached the target.
    const target = pointsToWin(match.stage, match.roundLabel);
    const hi = Math.max(p1Score, p2Score);
    const lo = Math.min(p1Score, p2Score);
    if (hi < target) throw new Error(`${code} is first to ${target} — the winner must reach ${target}.`);
    if (lo >= target) throw new Error(`${code}: only one blader can reach ${target}.`);
    if (hi > target + 2) throw new Error(`${code}: a winning score can't exceed ${target + 2}.`);
  }
  const before = snapshot(loaded.state);
  const beforeRanks = rankMap(before);
  applyResult(loaded.state, code, p1Score, p2Score);
  await markGroupsComplete(pb, loaded);
  await persistDelta(pb, loaded, before, beforeRanks);
}

// Generate the knockout bracket once every group is complete.
export async function generateKnockoutStage(
  pb: PocketBase,
  tournamentId: string,
): Promise<void> {
  const loaded = await loadTournament(pb, tournamentId);
  const alreadyHasKnockout = loaded.state.matches.some((m) => m.stage !== "group");
  if (alreadyHasKnockout) return;
  if (!allGroupsComplete(loaded.state)) {
    throw new Error("Every group must be complete before generating the knockout bracket.");
  }
  const before = snapshot(loaded.state);
  const beforeRanks = rankMap(before);
  generateKnockout(loaded.state); // random pool draws (Math.random)
  await persistDelta(pb, loaded, before, beforeRanks);
}

async function markGroupsComplete(pb: PocketBase, loaded: LoadedTournament): Promise<void> {
  const { state, groups, groupIdByIndex } = loaded;
  for (const g of groups) {
    const gm = state.matches.filter((m) => m.stage === "group" && m.group === g.index);
    const done = gm.length > 0 && gm.every((m) => m.status === "done");
    if (done !== g.complete) {
      await pb.collection("groups").update(groupIdByIndex.get(g.index)!, { complete: done });
      g.complete = done;
    }
  }
}

export async function resetTournament(pb: PocketBase, tournamentId: string): Promise<void> {
  // cascadeDelete on the relations removes groups/players/matches too.
  await pb.collection("tournaments").delete(tournamentId);
}

// True when every group's matches are complete (ready to generate knockout).
export function allGroupsComplete(state: State): boolean {
  const byGroup = new Map<number, Match[]>();
  for (const m of state.matches) {
    if (m.stage !== "group" || m.group == null) continue;
    (byGroup.get(m.group) ?? byGroup.set(m.group, []).get(m.group)!).push(m);
  }
  if (byGroup.size === 0) return false;
  return [...byGroup.values()].every((ms) => ms.every((m) => m.status === "done"));
}
