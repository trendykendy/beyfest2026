import type { PageServerLoad } from "./$types";
import { loadTournamentView } from "$lib/server/load";

export const load: PageServerLoad = async ({ locals }) => {
  return await loadTournamentView(locals.pb);
};
