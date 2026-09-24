import type PocketBase from "pocketbase";
import type { RecordModel } from "pocketbase";
import type { PBGroup, PBMatch, PBPlayer, TvState } from "$lib/view";

export interface TournamentView {
  tournament: {
    id: string;
    name: string;
    playerCount: number;
    structureKey: number;
    status: "setup" | "group_stage" | "knockout" | "complete";
  } | null;
  groups: PBGroup[];
  players: PBPlayer[];
  matches: PBMatch[];
}

const toGroup = (r: RecordModel): PBGroup => ({
  id: r.id,
  index: r.index,
  name: r.name,
  size: r.size,
  format: r.format,
  complete: !!r.complete,
});

const toPlayer = (r: RecordModel): PBPlayer => ({
  id: r.id,
  name: r.name,
  groupIndex: r.groupIndex ?? null,
  drawOrder: r.drawOrder ?? null,
  finalGroupRank: r.finalGroupRank ?? null,
});

const toMatch = (r: RecordModel): PBMatch => {
  // Scores are only meaningful once the match is done (PB number fields default
  // to 0, not null, when unset).
  const done = r.matchStatus === "done";
  return {
    id: r.id,
    stage: r.stage,
    code: r.code,
    roundLabel: r.roundLabel,
    orderIndex: r.orderIndex,
    groupIndex: r.groupIndex ?? null,
    slot1: r.slot1 ?? null,
    slot2: r.slot2 ?? null,
    p1: r.p1 || "",
    p2: r.p2 || "",
    p1Score: done ? (r.p1Score ?? null) : null,
    p2Score: done ? (r.p2Score ?? null) : null,
    liveP1: r.liveP1 ?? 0,
    liveP2: r.liveP2 ?? 0,
    liveLog: !done && Array.isArray(r.liveLog) ? r.liveLog : [],
    winner: r.winner || "",
    loser: r.loser || "",
    matchStatus: r.matchStatus,
  };
};

// Load the active tournament and all its records as plain, serialisable
// objects for the page. Returns nulls/empties when no tournament exists yet.
export async function loadTournamentView(pb: PocketBase): Promise<TournamentView> {
  const tournaments = await pb.collection("tournaments").getFullList({ sort: "-createdAt" });
  const t = tournaments[0];
  if (!t) return { tournament: null, groups: [], players: [], matches: [] };

  const filter = pb.filter("tournament = {:id}", { id: t.id });
  const [groups, players, matches] = await Promise.all([
    pb.collection("groups").getFullList({ filter, sort: "index" }),
    pb.collection("players").getFullList({ filter }),
    pb.collection("matches").getFullList({ filter, sort: "orderIndex" }),
  ]);

  return {
    tournament: {
      id: t.id,
      name: t.name,
      playerCount: t.playerCount,
      structureKey: t.structureKey,
      status: t.status,
    },
    groups: groups.map(toGroup),
    players: players.map(toPlayer),
    matches: matches.map(toMatch),
  };
}

// The single TV-control record (see migration 1710000300_tv_state). Falls back
// to auto rotation if it's missing, so the TV never breaks over it.
export async function loadTvState(pb: PocketBase): Promise<TvState> {
  try {
    const r = await pb.collection("tv_state").getFirstListItem("");
    return { id: r.id, mode: r.mode === "locked" ? "locked" : "auto", scene: r.scene || "groups" };
  } catch {
    return { id: "", mode: "auto", scene: "groups" };
  }
}
