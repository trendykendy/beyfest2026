import type PocketBase from "pocketbase";
import { loadBetting, loadTournamentView, loadTvState, type TournamentView } from "./load";
import type { PBBet, PBBettor } from "$lib/betting";

// Every phone on /live refreshes the moment a score is tapped, so 40 phones
// means 40 identical full loads hitting the Pi at once. Instead, at most one
// load runs at a time:
// - nothing running: start a load.
// - one running: it may have started before the change this request is
//   asking about, so don't hand out its (possibly stale) result. Wait for it,
//   then share ONE follow-up load among everyone who arrived meanwhile.
// So every request gets data read after it arrived, and a burst of 40 costs
// two loads. A failed load just fails the requests that shared it.
export function sharedLoader<A extends unknown[], T>(
  load: (...args: A) => Promise<T>,
): (...args: A) => Promise<T> {
  let running: Promise<T> | null = null;
  let queued: Promise<T> | null = null;

  function start(args: A): Promise<T> {
    const p = load(...args);
    running = p;
    const done = () => {
      if (running === p) running = null;
    };
    p.then(done, done);
    return p;
  }

  return (...args: A) => {
    if (!running) return start(args);
    if (!queued) {
      const settled = running.then(
        () => {},
        () => {},
      );
      queued = settled.then(() => {
        queued = null;
        return start(args);
      });
    }
    return queued;
  };
}

export type LiveView = TournamentView & { next: string; bettors: PBBettor[]; bets: PBBet[] };

// What /live shows: the tournament plus the organiser's "Score this" pick, so
// Up next lists matches in the same order as the TV, and the betting. Everything
// it reads is public, so whose request starts the load doesn't matter.
export const loadLiveView = sharedLoader(async (pb: PocketBase): Promise<LiveView> => {
  const [view, tv] = await Promise.all([loadTournamentView(pb), loadTvState(pb)]);
  const betting = view.tournament ? await loadBetting(pb, view.tournament.id) : { bettors: [], bets: [] };
  return { ...view, next: tv.next, ...betting };
});
