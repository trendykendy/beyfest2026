import type { Match, Player, StructureSpec } from "./types";
import { pickStructure } from "./structures";
import { roundRobinRounds, scheduleGroupStage } from "./schedule";
import { shuffle, type Rng, defaultRng } from "./util";

export interface PlayerInput {
  id: string;
  name: string;
}

export interface GroupStage {
  structure: StructureSpec;
  players: Player[];
  matches: Match[]; // group-stage matches only, all "ready" (participants known)
}

// Randomly draw the entered players into the groups for their count, then
// generate every group-stage match. This is the "on the day" draw.
export function createGroupStage(inputs: PlayerInput[], rng: Rng = defaultRng): GroupStage {
  const structure = pickStructure(inputs.length);
  const drawn = shuffle(inputs, rng);

  const players: Player[] = [];
  const byGroup: Player[][] = structure.groups.map(() => []);
  let cursor = 0;
  structure.groups.forEach((size, g) => {
    for (let i = 0; i < size; i++) {
      const src = drawn[cursor++];
      const player: Player = {
        id: src.id,
        name: src.name,
        group: g,
        drawOrder: i,
        finalGroupRank: null,
      };
      players.push(player);
      byGroup[g].push(player);
    }
  });

  // Build each group's matches in round-robin ROUND order (circle method), then
  // interleave the groups match-by-match so the schedule is well mixed and players
  // get rest between their matches. orderIndex + per-group codes are assigned in the
  // final global emission order.
  const perGroup: Match[][] = structure.groups.map((size, g) => {
    const matches: Match[] = [];
    for (const round of roundRobinRounds(size, structure.roundRobin)) {
      for (const [a, b] of round) {
        matches.push({
          code: "", // assigned after scheduling (unique per group, in play order)
          stage: "group",
          roundLabel: `Group ${g + 1}`,
          orderIndex: 0, // assigned after scheduling
          group: g,
          slot1: null,
          slot2: null,
          p1: byGroup[g][a].id,
          p2: byGroup[g][b].id,
          p1Score: null,
          p2Score: null,
          winner: null,
          loser: null,
          status: "ready",
        });
      }
    }
    return matches;
  });

  const matches = scheduleGroupStage(perGroup);
  const codeCounter = structure.groups.map(() => 0);
  matches.forEach((m, i) => {
    const g = m.group!;
    m.orderIndex = i + 1;
    m.code = `G${g + 1}-${++codeCounter[g]}`;
  });

  return { structure, players, matches };
}
