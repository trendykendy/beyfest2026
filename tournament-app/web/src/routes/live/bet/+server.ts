import { error, json } from "@sveltejs/kit";
import { randomBytes } from "node:crypto";
import type { RequestHandler } from "./$types";
import type PocketBase from "pocketbase";
import { bookie } from "$lib/server/bookie";
import { loadBetting, loadTournamentView } from "$lib/server/load";
import { books, cleanName, sameName } from "$lib/betting";
import { bettingOpen, matchOdds } from "$lib/odds";

// The phone page's betting (play money, see lib/odds.ts and lib/betting.ts).
//   { action: "join", name }                               → { id, name, token }
//   { action: "bet", id, token, match, pick, stake, odds } → { ok: true }
// Everything is checked here against fresh data, never trusted from the
// phone. If the odds moved since the phone showed them, nothing is placed and
// the reply (409) carries the new odds for the phone to offer instead.

// One request at a time: PocketBase has no transactions over its API, and
// two quick taps must not both spend the same money. Bets are rare enough
// that a single queue is plenty.
let queue: Promise<unknown> = Promise.resolve();
function oneAtATime<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(work, work);
  queue = run.catch(() => {});
  return run;
}

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") error(400, "Bad request");
  const pb = await bookie();
  if (!pb) error(503, "Betting is closed right now.");
  return oneAtATime(() => (body.action === "join" ? join(pb, body) : bet(pb, body)));
};

async function join(pb: PocketBase, body: { name?: unknown }) {
  const name = cleanName(String(body.name ?? ""));
  if (!name) error(400, "Pick a name of 2 to 16 letters.");
  const view = await loadTournamentView(pb);
  if (!view.tournament) error(409, "Betting opens once the groups are drawn.");
  const { bettors } = await loadBetting(pb, view.tournament.id);
  const taken = bettors.find((b) => sameName(b.name, name));
  if (taken) error(409, `Someone is already betting as ${taken.name}. Try another name.`);
  const token = randomBytes(16).toString("hex");
  const rec = await pb.collection("bettors").create({ tournament: view.tournament.id, name, token });
  return json({ id: rec.id, name, token });
}

async function bet(
  pb: PocketBase,
  body: { id?: unknown; token?: unknown; match?: unknown; pick?: unknown; stake?: unknown; odds?: unknown },
) {
  const id = String(body.id ?? "");
  const me = await pb
    .collection("bettors")
    .getOne(id)
    .catch(() => null);
  // A lost bettor (the tournament was reset) is told to join again.
  if (!me) error(410, "Join again to bet in this tournament.");
  if (me.token !== body.token) error(403, "This phone can't bet as that name.");

  const view = await loadTournamentView(pb);
  if (!view.tournament || view.tournament.id !== me.tournament) error(410, "Join again to bet in this tournament.");
  const m = view.matches.find((x) => x.id === body.match);
  if (!m || !bettingOpen(m)) error(409, "Betting on that match has closed.");
  const pick = String(body.pick ?? "");
  if (pick !== m.p1 && pick !== m.p2) error(400, "Pick one of the two bladers.");

  const { bettors, bets } = await loadBetting(pb, view.tournament.id);
  const mine = books(bettors, bets, view.matches).find((b) => b.bettor.id === id);
  const balance = mine?.balance ?? 0;
  const stake = Number(body.stake);
  if (!Number.isInteger(stake) || stake < 1) error(400, "Bet a whole number of dollars.");
  if (stake > balance) error(400, `You only have $${balance.toLocaleString("en-IE")}.`);

  const odds = matchOdds(m, view.matches);
  const now = pick === m.p1 ? odds.p1 : odds.p2;
  if (now !== Number(body.odds)) return json({ odds: now, message: "The odds just changed." }, { status: 409 });

  await pb.collection("bets").create({ tournament: view.tournament.id, bettor: id, match: m.id, pick, stake, odds: now });
  return json({ ok: true });
}
