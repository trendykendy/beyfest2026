import type { PageServerLoad } from "./$types";
import { loadTournamentView, loadTvState } from "$lib/server/load";

export const load: PageServerLoad = async ({ locals }) => {
  const [view, tv] = await Promise.all([loadTournamentView(locals.pb), loadTvState(locals.pb)]);
  return { ...view, tv };
};
