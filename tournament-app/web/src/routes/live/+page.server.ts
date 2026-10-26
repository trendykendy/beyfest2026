import type { PageServerLoad } from "./$types";
import { loadLiveView } from "$lib/server/sharedView";
import { bettingEnabled } from "$lib/server/bookie";
import { pbUrlFor } from "$lib/config";

// The phone page. The load is shared between phones refreshing together (see
// sharedView.ts); pbUrl is worked out per request, since each phone may reach
// the Pi by a different address.
export const load: PageServerLoad = async ({ locals, url }) => {
  return { ...(await loadLiveView(locals.pb)), pbUrl: pbUrlFor(url), betting: bettingEnabled() };
};
