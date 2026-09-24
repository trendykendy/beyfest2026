import type PocketBase from "pocketbase";
import type { RecordModel } from "pocketbase";
import {
  createGroupStage,
  generateKnockout,
  applyResult,
  applyCorrection,
  planCorrection,
  champion,
  pickStructure,
  pointsToWin,
  type Match,
  type Player,
  type State,
  type PlayerInput,
} from "@beyfest/engine";
import { FINISHES } from "../finishes"; // relative: scripts import this file outside SvelteKit

const FINISH_PTS: Record<string, number> = Object.fromEntries(FINISHES.map((f) => [f.key, f.pts]));

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
        // it's being live-scored — so clearing the running tally is safe. The
        // round log is KEPT once a match is done: it's the record of how every
        // round was won (Result recap, awards).
        liveP1: 0,
        liveP2: 0,
        ...(m.status === "done" ? {} : { liveLog: [] }),
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

// Matches are played round-by-round; each round is worth 1–3 points (Spin /
// Knockout / Dominant), accumulating until a blader REACHES the target. So the
// winner's score is >= target and can overshoot by up to 2 (a 3-point finish
// from target-1); the loser never reached the target.
function checkScore(match: Match, p1Score: number, p2Score: number): void {
  const code = match.code;
  const target = pointsToWin(match.stage, match.roundLabel);
  const hi = Math.max(p1Score, p2Score);
  const lo = Math.min(p1Score, p2Score);
  if (hi < target) throw new Error(`${code} is first to ${target} — the winner must reach ${target}.`);
  if (lo >= target) throw new Error(`${code}: only one blader can reach ${target}.`);
  if (hi > target + 2) throw new Error(`${code}: a winning score can't exceed ${target + 2}.`);
}

// Enter a score, advance the bracket, persist the delta.
export async function enterScore(
  pb: PocketBase,
  tournamentId: string,
  code: string,
  p1Score: number,
  p2Score: number,
): Promise<void> {
  await recordResult(pb, tournamentId, code, p1Score, p2Score, false);
  await autoWalkovers(pb, tournamentId);
}

// A no-show: the other blader wins at the match's target, 0 against. Recorded
// like any result so tables and the bracket carry on, but flagged, so screens
// say "W/O" and the awards leave it out.
export async function recordWalkover(
  pb: PocketBase,
  tournamentId: string,
  code: string,
  noShow: 1 | 2,
): Promise<void> {
  const loaded = await loadTournament(pb, tournamentId);
  const match = loaded.state.matches.find((mt) => mt.code === code);
  if (!match) throw new Error(`There's no match ${code}.`);
  if (match.status !== "ready") throw new Error(`${code} isn't ready to play.`);
  const target = pointsToWin(match.stage, match.roundLabel);
  const [s1, s2] = noShow === 1 ? [0, target] : [target, 0];
  await recordResult(pb, tournamentId, code, s1, s2, true);
  await autoWalkovers(pb, tournamentId);
}

async function recordResult(
  pb: PocketBase,
  tournamentId: string,
  code: string,
  p1Score: number,
  p2Score: number,
  walkover: boolean,
): Promise<void> {
  const loaded = await loadTournament(pb, tournamentId);
  const match = loaded.state.matches.find((mt) => mt.code === code);
  if (match) checkScore(match, p1Score, p2Score);
  const before = snapshot(loaded.state);
  const beforeRanks = rankMap(before);
  applyResult(loaded.state, code, p1Score, p2Score);
  await markGroupsComplete(pb, loaded);
  await persistDelta(pb, loaded, before, beforeRanks);
  await stampResult(pb, loaded, code, walkover);
}

// Walk over every playable match that involves a withdrawn blader. Repeats,
// because a walkover can drop a withdrawn blader straight into another ready
// match (or send their opponent on to meet one).
async function autoWalkovers(pb: PocketBase, tournamentId: string): Promise<void> {
  for (let guard = 0; guard < 100; guard++) {
    const gone = await pb.collection("players").getFullList({
      filter: pb.filter("tournament = {:id} && withdrawn = true", { id: tournamentId }),
    });
    if (gone.length === 0) return;
    const out = new Set(gone.map((p) => p.id));
    const { state } = await loadTournament(pb, tournamentId);
    const next = state.matches
      .filter((m) => m.status === "ready" && ((m.p1 && out.has(m.p1)) || (m.p2 && out.has(m.p2))))
      .sort((a, b) => a.orderIndex - b.orderIndex)[0];
    if (!next) return;
    const target = pointsToWin(next.stage, next.roundLabel);
    const noShow = next.p1 && out.has(next.p1) ? 1 : 2;
    const [s1, s2] = noShow === 1 ? [0, target] : [target, 0];
    await recordResult(pb, tournamentId, next.code, s1, s2, true);
  }
}

// A blader leaves (or comes back). Leaving walks over everything of theirs
// that's playable now, and anything that becomes playable later. Coming back
// stops that; walkovers already recorded stay (fix them with Fix if needed).
export async function setWithdrawn(
  pb: PocketBase,
  tournamentId: string,
  playerId: string,
  withdrawn: boolean,
): Promise<void> {
  await pb.collection("players").update(playerId, { withdrawn });
  if (withdrawn) await autoWalkovers(pb, tournamentId);
}

// Fix a typo in a name. Names must stay unique (ignoring case).
export async function renamePlayer(
  pb: PocketBase,
  tournamentId: string,
  playerId: string,
  name: string,
): Promise<void> {
  const clean = name.trim();
  if (!clean) throw new Error("A name can't be empty.");
  const players = await pb.collection("players").getFullList({
    filter: pb.filter("tournament = {:id}", { id: tournamentId }),
  });
  if (players.some((p) => p.id !== playerId && p.name.toLowerCase() === clean.toLowerCase())) {
    throw new Error(`There's already a blader called ${clean}.`);
  }
  await pb.collection("players").update(playerId, { name: clean });
}

// Fix a result that's already been recorded. The engine works out whether
// it's safe (see engine/src/correct.ts) and moves players in the next round if
// the winner changes. Also refused if one of those next matches is being
// scored right now, so a live tally is never handed to the wrong blader.
export async function correctScore(
  pb: PocketBase,
  tournamentId: string,
  code: string,
  p1Score: number,
  p2Score: number,
): Promise<void> {
  const loaded = await loadTournament(pb, tournamentId);
  const match = loaded.state.matches.find((mt) => mt.code === code);
  if (!match) throw new Error(`There's no match ${code}.`);
  checkScore(match, p1Score, p2Score);
  const plan = planCorrection(loaded.state, code, p1Score, p2Score);
  if (!plan.ok) throw new Error(plan.reason);
  for (const r of plan.repins) {
    const rec = await pb.collection("matches").getOne(loaded.matchIdByCode.get(r.code)!);
    if (rec.liveP1 > 0 || rec.liveP2 > 0) {
      throw new Error(`${r.code} is being played right now. Finish or undo it first.`);
    }
  }
  const before = snapshot(loaded.state);
  const beforeRanks = rankMap(before);
  applyCorrection(loaded.state, code, p1Score, p2Score);
  await markGroupsComplete(pb, loaded);
  await persistDelta(pb, loaded, before, beforeRanks);
  await stampResult(pb, loaded, code, false); // a fixed score is a played result
  await dropLogIfWrong(pb, loaded, code, p1Score, p2Score);
  await autoWalkovers(pb, tournamentId); // a re-route may reach a withdrawn blader
}

// After a correction the round log may no longer add up to the score (it
// describes the rounds as scored, not as fixed). A log that disagrees with the
// result would feed wrong awards, so it goes.
async function dropLogIfWrong(
  pb: PocketBase,
  loaded: LoadedTournament,
  code: string,
  p1Score: number,
  p2Score: number,
): Promise<void> {
  const id = loaded.matchIdByCode.get(code);
  if (!id) return;
  const rec = await pb.collection("matches").getOne(id);
  const log: { who: number; finish: string }[] = Array.isArray(rec.liveLog) ? rec.liveLog : [];
  if (log.length === 0) return;
  const pts = (who: number) => log.filter((r) => r.who === who).reduce((a, r) => a + (FINISH_PTS[r.finish] ?? 0), 0);
  if (pts(1) !== p1Score || pts(2) !== p2Score) await pb.collection("matches").update(id, { liveLog: [] });
}

// Remember when this match's result went in (for "Last result"), and whether
// it was a walkover. A walkover's partial round log (if any) doesn't count.
async function stampResult(pb: PocketBase, loaded: LoadedTournament, code: string, walkover: boolean): Promise<void> {
  const id = loaded.matchIdByCode.get(code);
  if (!id) return;
  await pb.collection("matches").update(id, {
    resultAt: new Date().toISOString(),
    walkover,
    ...(walkover ? { liveLog: [] } : {}),
  });
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
  await autoWalkovers(pb, tournamentId);
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
