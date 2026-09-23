import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";

// Guard: everything under /admin (except the login page) requires an organiser.
export const load: LayoutServerLoad = async ({ locals, url }) => {
  if (!locals.organiser && !url.pathname.startsWith("/admin/login")) {
    throw redirect(303, "/admin/login");
  }
  return {};
};
