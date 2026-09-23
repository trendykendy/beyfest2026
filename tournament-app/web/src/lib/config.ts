// PocketBase runs as a sibling process on the same laptop. Override with the
// PUBLIC_PB_URL env var if you host it elsewhere.
import { env } from "$env/dynamic/public";

export const PB_URL = env.PUBLIC_PB_URL || "http://127.0.0.1:8090";

// Shown on the TV standby screen before the groups are drawn.
export const EVENT = {
  date: "7 November 2026",
  place: "Innishannon",
};
