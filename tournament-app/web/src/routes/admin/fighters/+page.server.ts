import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { loadFighters, loadTournamentView } from "$lib/server/load";
import { pbUrlFor } from "$lib/config";

// The fighter library: who the TV's VS intro shows, with their katakana and
// cut-out. Not tied to a tournament (see migration 1710001100_fighters).

export const load: PageServerLoad = async ({ locals, url }) => {
  const view = await loadTournamentView(locals.pb);
  return { fighters: view.fighters, players: view.players.map((p) => p.name), pbUrl: pbUrlFor(url) };
};

// An uploaded image, or null when the file input was left empty.
function fileFrom(data: FormData, field: string): File | null {
  const f = data.get(field);
  return f instanceof File && f.size > 0 ? f : null;
}

// Names must stay unique (ignoring case), since players are matched by name.
async function nameTaken(pb: App.Locals["pb"], name: string, exceptId = ""): Promise<boolean> {
  const all = await loadFighters(pb);
  return all.some((f) => f.id !== exceptId && f.name.trim().toLowerCase() === name.toLowerCase());
}

export const actions: Actions = {
  add: async ({ request, locals }) => {
    const data = await request.formData();
    const name = String(data.get("name") || "").trim();
    if (!name) return fail(400, { error: "A fighter needs a name." });
    if (await nameTaken(locals.pb, name)) return fail(400, { error: `There's already a fighter called ${name}.` });
    const image = fileFrom(data, "image");
    try {
      await locals.pb.collection("fighters").create({
        name,
        kana: String(data.get("kana") || "").trim(),
        mirror: data.get("mirror") === "on",
        ...(image ? { image } : {}),
      });
    } catch (e) {
      return fail(400, { error: `Couldn't add ${name}: ${(e as Error).message}` });
    }
    return { saved: name };
  },

  update: async ({ request, locals }) => {
    const data = await request.formData();
    const id = String(data.get("id") || "");
    const name = String(data.get("name") || "").trim();
    if (!name) return fail(400, { error: "A fighter needs a name.", editing: id });
    if (await nameTaken(locals.pb, name, id)) {
      return fail(400, { error: `There's already a fighter called ${name}.`, editing: id });
    }
    const image = fileFrom(data, "image");
    try {
      await locals.pb.collection("fighters").update(id, {
        name,
        kana: String(data.get("kana") || "").trim(),
        mirror: data.get("mirror") === "on",
        // a new upload replaces the image; "remove" clears it
        ...(image ? { image } : data.get("removeImage") === "on" ? { image: null } : {}),
      });
    } catch (e) {
      return fail(400, { error: `Couldn't save ${name}: ${(e as Error).message}`, editing: id });
    }
    return { saved: name };
  },

  remove: async ({ request, locals }) => {
    const data = await request.formData();
    const id = String(data.get("id") || "");
    try {
      await locals.pb.collection("fighters").delete(id);
    } catch (e) {
      return fail(400, { error: (e as Error).message });
    }
    return { removed: true };
  },
};
