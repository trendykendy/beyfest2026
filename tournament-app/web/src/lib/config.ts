// PocketBase runs as a sibling process on the same machine as the app server.
// Set the PUBLIC_PB_URL env var only if you host it elsewhere.
import { env } from "$env/dynamic/public";

// Where the app server reaches PocketBase.
export const PB_URL = env.PUBLIC_PB_URL || "http://127.0.0.1:8090";

// Where a browser reaches PocketBase: port 8090 on whichever address served the
// page. So the TV and phones follow the machine through any network change
// (venue wifi, the Pi's own hotspot, beyfest.local) with nothing to configure.
export function browserPbUrl(): string {
  return env.PUBLIC_PB_URL || `${location.protocol}//${location.hostname}:8090`;
}

// Shown on the TV standby screen before the groups are drawn.
export const EVENT = {
  date: "7 November 2026",
  place: "Innishannon",
};
