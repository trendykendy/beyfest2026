import type { Match, Player, Slot, StandingRow, StructureSpec } from "./types";
import { computeStandings, roundRobinComplete } from "./standings";
import { shuffle, type Rng, defaultRng } from "./util";

export interface State {
  structure: StructureSpec;
  players: Player[];
  matches: Match[]; // group + knockout matches
}

// ─── Resolution context ─────────────────────────────────────────────
interface Ctx {
  byCode: Map<string, Match>;
  playersById: Map<string, Player>;
  groupComplete: boolean[];
  groupStandings: (StandingRow[] | null)[];
  seedTable: Map<number, string> | null; // 8-player double-elim seeds 1..8
  rrStandings: Record<"wb_rr" | "lb_rr", StandingRow[] | null>;
}

function groupPlayerIds(players: Player[], g: number): string[] {
  return players.filter((p) => p.group === g).map((p) => p.id);
}

// Order two finishers for 8-player seeding: better record first.
function betterFirst(a: StandingRow, b: StandingRow): [StandingRow, StandingRow] {
  if (a.wins !== b.wins) return a.wins > b.wins ? [a, b] : [b, a];
  if (a.pointDiff !== b.pointDiff) return a.pointDiff > b.pointDiff ? [a, b] : [b, a];
  if (a.pointsFor !== b.pointsFor) return a.pointsFor > b.pointsFor ? [a, b] : [b, a];
  return [a, b];
}

// Seeds 1..8 from two complete groups (8-player double-elim).
// Seed 1/2 = group winners (better = 1); 3/4 = 2nd places; 5/6 = 3rds; 7/8 = 4ths.
function buildSeedTable(g0: StandingRow[], g1: StandingRow[]): Map<number, string> {
  const table = new Map<number, string>();
  for (let pos = 0; pos < 4; pos++) {
    const [better, worse] = betterFirst(g0[pos], g1[pos]);
    table.set(pos * 2 + 1, better.playerId);
    table.set(pos * 2 + 2, worse.playerId);
  }
  return table;
}

function buildContext(state: State): Ctx {
  const { structure, players, matches } = state;
  const byCode = new Map(matches.map((mt) => [mt.code, mt]));
  const playersById = new Map(players.map((p) => [p.id, p]));

  const groupComplete = structure.groups.map((_, g) => {
    const gm = matches.filter((mt) => mt.stage === "group" && mt.group === g);
    return gm.length > 0 && gm.every((mt) => mt.status === "done");
  });
  const groupStandings = structure.groups.map((_, g) =>
    groupComplete[g] ? computeStandings(groupPlayerIds(players, g), matches) : null,
  );

  let seedTable: Map<number, string> | null = null;
  if (structure.knockoutType === "double-elim" && groupComplete[0] && groupComplete[1]) {
    seedTable = buildSeedTable(groupStandings[0]!, groupStandings[1]!);
  }

  const rrStandings = { wb_rr: null, lb_rr: null } as Ctx["rrStandings"];
  for (const stage of ["wb_rr", "lb_rr"] as const) {
    const stageMatches = matches.filter((mt) => mt.stage === stage);
    const ids = new Set<string>();
    stageMatches.forEach((mt) => {
      if (mt.p1) ids.add(mt.p1);
      if (mt.p2) ids.add(mt.p2);
    });
    const idList = [...ids];
    if (idList.length >= 2 && roundRobinComplete(idList, stageMatches)) {
      rrStandings[stage] = computeStandings(idList, stageMatches);
    }
  }

  return { byCode, playersById, groupComplete, groupStandings, seedTable, rrStandings };
}

// Resolve a single slot to a concrete player id, or null if not yet known.
function resolveSlot(slot: Slot | null, ctx: Ctx): string | null {
  if (!slot) return null;
  switch (slot.k) {
    case "groupRank": {
      const st = ctx.groupStandings[slot.group];
      if (!st || slot.rank < 1 || slot.rank > st.length) return null;
      return st[slot.rank - 1].playerId;
    }
    case "seed":
      return ctx.seedTable?.get(slot.n) ?? null;
    case "winner": {
      const mt = ctx.byCode.get(slot.match);
      return mt && mt.status === "done" ? mt.winner : null;
    }
    case "loser": {
      const mt = ctx.byCode.get(slot.match);
      return mt && mt.status === "done" ? mt.loser : null;
    }
    case "rrRank": {
      const st = ctx.rrStandings[slot.stage];
      if (!st || slot.rank < 1 || slot.rank > st.length) return null;
      return st[slot.rank - 1].playerId;
    }
    case "poolDraw":
      return null; // resolved once, at generation time
  }
}

function statusFor(mt: Match): Match["status"] {
  if (mt.p1Score != null && mt.p2Score != null) return "done";
  if (mt.p1 != null && mt.p2 != null) return "ready";
  return "pending";
}

// Walk the whole state to a fixpoint: fill resolvable participant slots,
// set winners/losers on scored matches, and recompute every status. Safe to
// run after any score change; idempotent.
export function resolve(state: State): State {
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 50) {
    changed = false;
    const ctx = buildContext(state);

    // Record finalGroupRank once a group is settled.
    ctx.groupStandings.forEach((st, g) => {
      if (!st) return;
      st.forEach((row) => {
        const p = ctx.playersById.get(row.playerId);
        if (p && p.finalGroupRank !== row.rank) {
          p.finalGroupRank = row.rank;
          changed = true;
        }
      });
    });

    for (const mt of state.matches) {
      if (mt.stage === "group") {
        const s = statusFor(mt);
        if (s !== mt.status) {
          mt.status = s;
          changed = true;
        }
        setWinnerLoser(mt);
        continue;
      }
      if (mt.p1 == null && mt.slot1) {
        const r = resolveSlot(mt.slot1, ctx);
        if (r) {
          mt.p1 = r;
          mt.slot1 = null;
          changed = true;
        }
      }
      if (mt.p2 == null && mt.slot2) {
        const r = resolveSlot(mt.slot2, ctx);
        if (r) {
          mt.p2 = r;
          mt.slot2 = null;
          changed = true;
        }
      }
      setWinnerLoser(mt);
      const s = statusFor(mt);
      if (s !== mt.status) {
        mt.status = s;
        changed = true;
      }
    }
  }
  return state;
}

function setWinnerLoser(mt: Match): void {
  if (mt.p1Score != null && mt.p2Score != null && mt.p1 && mt.p2) {
    const p1Wins = mt.p1Score > mt.p2Score;
    mt.winner = p1Wins ? mt.p1 : mt.p2;
    mt.loser = p1Wins ? mt.p2 : mt.p1;
  }
}

// ─── Knockout generation ────────────────────────────────────────────
// Called once the group stage is complete. Instantiates all knockout match
// shells, performs the constrained random pool draws for MB entrants, and
// resolves everything currently knowable. Returns the knockout matches.
export function generateKnockout(
  state: State,
  rng: Rng = defaultRng,
): Match[] {
  const { structure } = state;
  const groupMatchCount = state.matches.filter((mt) => mt.stage === "group").length;

  const knockout: Match[] = structure.matches.map((def, i) => ({
    code: def.code,
    stage: def.stage,
    roundLabel: def.roundLabel,
    orderIndex: groupMatchCount + i + 1,
    group: null,
    slot1: def.slot1,
    slot2: def.slot2,
    p1: null,
    p2: null,
    p1Score: null,
    p2Score: null,
    winner: null,
    loser: null,
    status: "pending",
  }));

  const knockoutByCode = new Map(knockout.map((mt) => [mt.code, mt]));
  const playersById = new Map(state.players.map((p) => [p.id, p]));

  // Constrained random pool draws (MB middles etc.).
  for (const poolDef of structure.pools) {
    const ctx = buildContext(state); // groups complete → groupRank members resolve
    const members = poolDef.members
      .map((slot) => resolveSlot(slot, ctx))
      .filter((id): id is string => id != null);

    // Gather this pool's slots in match order.
    const slots: Array<{ match: Match; which: 1 | 2 }> = [];
    for (const def of structure.matches) {
      const mt = knockoutByCode.get(def.code)!;
      if (def.slot1.k === "poolDraw" && def.slot1.pool === poolDef.pool)
        slots.push({ match: mt, which: 1 });
      if (def.slot2.k === "poolDraw" && def.slot2.pool === poolDef.pool)
        slots.push({ match: mt, which: 2 });
    }

    const queue = shuffle(members, rng);
    for (const s of slots) {
      // Avoid a same-group pairing when the match's other slot is an already
      // assigned pool player (spec: "avoiding same-group rematches where possible").
      const otherId = s.which === 1 ? s.match.p2 : s.match.p1;
      const partnerGroup = otherId ? playersById.get(otherId)?.group ?? null : null;
      let idx = queue.findIndex(
        (pid) => partnerGroup == null || playersById.get(pid)?.group !== partnerGroup,
      );
      if (idx < 0) idx = 0;
      const pid = queue.splice(idx, 1)[0];
      if (s.which === 1) {
        s.match.p1 = pid;
        s.match.slot1 = null;
      } else {
        s.match.p2 = pid;
        s.match.slot2 = null;
      }
    }
  }

  // Attach and resolve everything currently knowable.
  state.matches.push(...knockout);
  resolve(state);
  return knockout;
}

// Apply a score to a match (by code) then re-resolve the whole state.
export function applyResult(
  state: State,
  code: string,
  p1Score: number,
  p2Score: number,
): State {
  const mt = state.matches.find((x) => x.code === code);
  if (!mt) throw new Error(`No match with code ${code}`);
  if (mt.p1 == null || mt.p2 == null) throw new Error(`Match ${code} is not ready (participants unknown)`);
  if (p1Score === p2Score) throw new Error(`Match ${code} cannot end in a draw`);
  mt.p1Score = p1Score;
  mt.p2Score = p2Score;
  return resolve(state);
}

// Champion = winner of the Grand Final, if played.
export function champion(state: State): string | null {
  const gf = state.matches.find((mt) => mt.stage === "gf");
  return gf && gf.status === "done" ? gf.winner : null;
}
