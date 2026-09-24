import type { PageServerLoad } from "./$types";
import { loadTournamentView, loadTvState } from "$lib/server/load";
import { loadNetwork } from "$lib/server/network";

export const load: PageServerLoad = async ({ locals }) => {
  const [view, tv, network] = await Promise.all([
    loadTournamentView(locals.pb),
    loadTvState(locals.pb),
    loadNetwork(),
  ]);
  return { ...view, tv, network };
};
