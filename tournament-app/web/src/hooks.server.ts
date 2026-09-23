import PocketBase from "pocketbase";
import type { Handle } from "@sveltejs/kit";
import { PB_URL } from "$lib/config";

// Standard PocketBase + SvelteKit pattern: one PB client per request, its auth
// store hydrated from the `pb_auth` cookie and written back after the response.
export const handle: Handle = async ({ event, resolve }) => {
  const pb = new PocketBase(PB_URL);
  pb.authStore.loadFromCookie(event.request.headers.get("cookie") || "");

  try {
    if (pb.authStore.isValid) {
      await pb.collection("organisers").authRefresh();
    }
  } catch {
    pb.authStore.clear();
  }

  event.locals.pb = pb;
  event.locals.organiser = pb.authStore.isValid;

  const response = await resolve(event);

  // httpOnly cookie, lax same-site; not `secure` because this runs over plain
  // HTTP on the venue LAN (no TLS on the laptop).
  response.headers.append(
    "set-cookie",
    pb.authStore.exportToCookie({ httpOnly: true, secure: false, sameSite: "Lax" }),
  );
  return response;
};
