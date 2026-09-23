import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.organiser) throw redirect(303, "/admin");
  return {};
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    const data = await request.formData();
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    try {
      await locals.pb.collection("organisers").authWithPassword(email, password);
    } catch {
      return fail(401, { email, error: "Wrong email or password." });
    }
    throw redirect(303, "/admin");
  },
};
