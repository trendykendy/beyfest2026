import type PocketBase from "pocketbase";
import { shuffle } from "@beyfest/engine";
import { laterBattles, planRoyale, royaleView, type BattleResult, type PBRoyale } from "$lib/royale";

// The battle royale's writes (the organiser's admin page). The rules and
// every battle's line-up are in lib/royale.ts; this checks each change
// against them and stores it on the tournament's one `royales` record.

export class RoyaleError extends Error {}

const now = () => new Date().toISOString();
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

async function getRoyale(pb: PocketBase, id: string): Promise<PBRoyale> {
  const r = await pb.collection("royales").getOne(id);
  return { id: r.id, spaces: r.spaces, entrants: r.entrants ?? [], battles: r.battles ?? {} };
}

// Start it: tidy and check the names, draw the heats at random.
export async function createRoyale(pb: PocketBase, tournamentId: string, rawNames: string[], spaces: number) {
  const names: string[] = [];
  for (const raw of rawNames) {
    const n = raw.trim().replace(/\s+/g, " ");
    if (!n) continue;
    if (names.some((x) => same(x, n))) throw new RoyaleError(`${n} is in the list twice.`);
    names.push(n);
  }
  const plan = planRoyale(names.length, spaces);
  if ("error" in plan) throw new RoyaleError(plan.error);
  const existing = await pb.collection("royales").getFullList({ filter: pb.filter("tournament = {:id}", { id: tournamentId }) });
  if (existing.length) throw new RoyaleError("The battle royale has already started.");
  await pb.collection("royales").create({ tournament: tournamentId, spaces, entrants: shuffle(names), battles: {} });
}

// Start (or un-start) a battle: the TV plays its intro.
export async function startBattle(pb: PocketBase, royaleId: string, key: string, start: boolean) {
  const r = await getRoyale(pb, royaleId);
  const b = royaleView(r)?.battles.find((x) => x.key === key);
  if (!b || (b.status !== "ready" && b.status !== "live")) throw new RoyaleError("That battle can't be started now.");
  const battles = { ...r.battles, [key]: { ...r.battles[key], startedAt: start ? now() : "" } };
  await pb.collection("royales").update(royaleId, { battles });
}

// Record (or fix) a battle's result. Fixing is only allowed while nothing
// after it has been started or played, so a result never silently vanishes.
export async function recordBattle(
  pb: PocketBase,
  royaleId: string,
  key: string,
  result: { winner?: string; runnerUp?: string; advancing?: string[] },
) {
  const r = await getRoyale(pb, royaleId);
  const view = royaleView(r);
  const b = view?.battles.find((x) => x.key === key);
  if (!view || !b || b.status === "waiting") throw new RoyaleError("That battle isn't ready yet.");
  if (b.status === "done" && laterBattles(view, key).some((x) => x.status === "done" || x.status === "live"))
    throw new RoyaleError("A later battle has already been played, so this result can't change now.");

  let stored: BattleResult;
  if (b.kind === "sudden") {
    const advancing = [...new Set(result.advancing ?? [])];
    if (advancing.length !== b.places || !advancing.every((n) => b.entrants.includes(n)))
      throw new RoyaleError(`Pick the ${b.places} who go through to the final.`);
    stored = { advancing };
  } else {
    const { winner = "", runnerUp = "" } = result;
    if (!b.entrants.includes(winner)) throw new RoyaleError("Pick the winner.");
    if (b.entrants.length > 1 && (!b.entrants.includes(runnerUp) || runnerUp === winner))
      throw new RoyaleError("Pick the runner-up (the last one out before the winner).");
    stored = { winner, runnerUp };
  }
  const battles = { ...r.battles, [key]: { startedAt: r.battles[key]?.startedAt || now(), ...stored, resultAt: now() } };
  await pb.collection("royales").update(royaleId, { battles });
}

export async function resetRoyale(pb: PocketBase, royaleId: string) {
  await pb.collection("royales").delete(royaleId);
}
