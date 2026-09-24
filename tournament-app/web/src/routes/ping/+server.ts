import type { RequestHandler } from "./$types";

// Cheap "can I refresh?" check for the TV / admin / public pages: 204 when this
// server AND PocketBase are reachable, 503 when PocketBase isn't. The pages ask
// before every refresh, because a failed refresh makes the browser fall back to
// a full page load — and with the network down that strands the TV on the
// browser's own offline page, which never recovers by itself.
export const GET: RequestHandler = async ({ locals }) => {
  try {
    await locals.pb.health.check();
    return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  } catch {
    return new Response(null, { status: 503, headers: { "cache-control": "no-store" } });
  }
};
