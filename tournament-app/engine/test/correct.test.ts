import { describe, expect, test } from "bun:test";
import {
  STRUCTURES,
  createGroupStage,
  generateKnockout,
  applyResult,
  champion,
  resolve,
  makeRng,
  planCorrection,
  applyCorrection,
  type PlayerInput,
  type State,
} from "../src/index";

const COUNTS = Object.keys(STRUCTURES).map(Number);

function makePlayers(n: number): PlayerInput[] {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `Player ${String.fromCharCode(65 + i)}` }));
}

// Winner reaches 5, loser 0–4 (rng-driven), same as the main simulation test.
function play(state: State, code: string, rng: () => number): void {
  const loser = Math.floor(rng() * 5);
  if (rng() < 0.5) applyResult(state, code, 5, loser);
  else applyResult(state, code, loser, 5);
}

function groupsDone(n: number): { state: State; rng: () => number } {
  const rng = makeRng(n * 53 + 7);
  const stage = createGroupStage(makePlayers(n), rng);
  const state: State = { structure: stage.structure, players: stage.players, matches: stage.matches };
  for (const gm of state.matches.filter((m) => m.stage === "group")) play(state, gm.code, rng);
  resolve(state);
  return { state, rng };
}

function playAll(state: State, rng: () => number): void {
  for (let guard = 0; guard < 200; guard++) {
    const next = state.matches.find((m) => m.stage !== "group" && m.status === "ready");
    if (!next) return;
    play(state, next.code, rng);
  }
}

// The same result with the winner swapped (winner keeps target, loser keeps theirs).
const flipped = (s1: number, s2: number) => [s2, s1] as const;
const byCode = (state: State, code: string) => state.matches.find((m) => m.code === code)!;
const feeds = (state: State, code: string) =>
  state.structure.matches.filter((d) =>
    [d.slot1, d.slot2].some((s) => (s.k === "winner" || s.k === "loser") && s.match === code),
  );

describe("correcting a finished tournament", () => {
  for (const n of COUNTS) {
    test(`${n} players: score-only fixes pass, winner flips only where nothing downstream was played`, () => {
      const { state, rng } = groupsDone(n);
      generateKnockout(state, rng);
      playAll(state, rng);
      const champ = champion(state);

      for (const m of state.matches.filter((x) => x.stage !== "group" && x.stage !== "wb_rr" && x.stage !== "lb_rr")) {
        const s1 = m.p1Score!;
        const s2 = m.p2Score!;
        // Same winner, loser's score nudged: always fine.
        const nudged: [number, number] = s1 > s2 ? [s1, s2 === 0 ? 1 : s2 - 1] : [s1 === 0 ? 1 : s1 - 1, s2];
        expect(planCorrection(state, m.code, ...nudged).ok).toBe(true);
        // Winner flipped: fine only when no later match it feeds exists (all are played here).
        const plan = planCorrection(state, m.code, ...flipped(s1, s2));
        expect(plan.ok).toBe(feeds(state, m.code).length === 0);
        if (!plan.ok) expect(plan.reason).toContain("has already been played with");
      }

      // Flipping the Grand Final changes the champion.
      const gf = state.matches.find((m) => m.stage === "gf")!;
      applyCorrection(state, gf.code, ...flipped(gf.p1Score!, gf.p2Score!));
      expect(champion(state)).not.toBe(champ);
      expect(champion(state)).toBe(gf.winner);
    });
  }
});

describe("correcting before the next round is played", () => {
  for (const n of COUNTS) {
    test(`${n} players: the new winner and loser move into the next matches`, () => {
      const { state, rng } = groupsDone(n);
      generateKnockout(state, rng);
      // First knockout match that feeds another one by winner/loser.
      const first = state.matches.find((m) => m.status === "ready" && feeds(state, m.code).length > 0);
      if (!first) return; // (every count has one; guard just in case)
      play(state, first.code, rng);
      const oldWinner = first.winner;
      const oldLoser = first.loser;

      applyCorrection(state, first.code, ...flipped(first.p1Score!, first.p2Score!));
      expect(first.winner).toBe(oldLoser);
      for (const def of feeds(state, first.code)) {
        const next = byCode(state, def.code);
        const players = [next.p1, next.p2];
        const tookWinner = [def.slot1, def.slot2].some((s) => s.k === "winner" && s.match === first.code);
        expect(players).toContain(tookWinner ? oldLoser : oldWinner);
        expect(players).not.toContain(tookWinner ? oldWinner : oldLoser);
      }
    });
  }
});

describe("correcting group results", () => {
  test("any group result can be fixed before the knockout is drawn", () => {
    const { state } = groupsDone(12);
    for (const m of state.matches.filter((x) => x.stage === "group")) {
      expect(planCorrection(state, m.code, ...flipped(m.p1Score!, m.p2Score!)).ok).toBe(true);
    }
    const m = state.matches.find((x) => x.stage === "group")!;
    const oldWinner = m.winner;
    applyCorrection(state, m.code, ...flipped(m.p1Score!, m.p2Score!));
    expect(m.winner).not.toBe(oldWinner);
  });

  test("after the knockout is drawn, only fixes that keep the table order are allowed", () => {
    const { state, rng } = groupsDone(12);
    generateKnockout(state, rng);
    let refused = 0;
    for (const m of state.matches.filter((x) => x.stage === "group")) {
      // Re-entering the same score never changes the table.
      expect(planCorrection(state, m.code, m.p1Score!, m.p2Score!).ok).toBe(true);
      const plan = planCorrection(state, m.code, ...flipped(m.p1Score!, m.p2Score!));
      if (!plan.ok) {
        refused++;
        expect(plan.reason).toContain("table");
      }
    }
    // Flipping results reorders at least some tables.
    expect(refused).toBeGreaterThan(0);
  });

  test("unplayed matches and draws are refused", () => {
    const { state, rng } = groupsDone(12);
    generateKnockout(state, rng);
    const ready = state.matches.find((m) => m.status === "ready")!;
    expect(planCorrection(state, ready.code, 5, 3).ok).toBe(false);
    const done = state.matches.find((m) => m.status === "done")!;
    expect(planCorrection(state, done.code, 4, 4).ok).toBe(false);
  });
});
