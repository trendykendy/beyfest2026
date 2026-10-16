import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { loadFighters, loadTournamentView } from "$lib/server/load";
import { pbUrlFor } from "$lib/config";
import { planStarters, type Starter } from "$lib/starters";

// Where the starting fighters' list and files are served (static/starter-fighters).
const STARTERS = "/starter-fighters";

// The fighter library: who the TV's VS intro shows, with their katakana,
// cut-out and announcer voice. Not tied to a tournament (see migrations
// 1710001100_fighters and 1710001200_fighter_player_voice).

export const load: PageServerLoad = async ({ locals, url }) => {
  const view = await loadTournamentView(locals.pb);
  return { fighters: view.fighters, players: view.players.map((p) => p.name), pbUrl: pbUrlFor(url) };
};

// An uploaded file, or null when the file input was left empty.
function fileFrom(data: FormData, field: string): File | null {
  const f = data.get(field);
  return f instanceof File && f.size > 0 ? f : null;
}

// Combat names and player names must each stay unique (ignoring case), since
// players are matched by them. Returns the problem, or "" when it's fine.
async function clash(pb: App.Locals["pb"], name: string, player: string, exceptId = ""): Promise<string> {
  const key = (s: string) => s.trim().toLowerCase();
  const others = (await loadFighters(pb)).filter((f) => f.id !== exceptId);
  if (others.some((f) => key(f.name) === key(name))) return `There's already a fighter called ${name}.`;
  const taken = player ? others.find((f) => key(f.player) === key(player)) : undefined;
  if (taken) return `${player} is already ${taken.name}'s player.`;
  return "";
}

// The text fields both forms send.
function fieldsFrom(data: FormData) {
  return {
    name: String(data.get("name") || "").trim(),
    player: String(data.get("player") || "").trim(),
    kana: String(data.get("kana") || "").trim(),
    mirror: data.get("mirror") === "on",
  };
}

export const actions: Actions = {
  add: async ({ request, locals }) => {
    const data = await request.formData();
    const fields = fieldsFrom(data);
    const { name } = fields;
    if (!name) return fail(400, { error: "A fighter needs a combat name." });
    const problem = await clash(locals.pb, name, fields.player);
    if (problem) return fail(400, { error: problem });
    const image = fileFrom(data, "image");
    const voice = fileFrom(data, "voice");
    try {
      await locals.pb.collection("fighters").create({
        ...fields,
        ...(image ? { image } : {}),
        ...(voice ? { voice } : {}),
      });
    } catch (e) {
      return fail(400, { error: `Couldn't add ${name}: ${(e as Error).message}` });
    }
    return { saved: name };
  },

  update: async ({ request, locals }) => {
    const data = await request.formData();
    const id = String(data.get("id") || "");
    const fields = fieldsFrom(data);
    const { name } = fields;
    if (!name) return fail(400, { error: "A fighter needs a combat name.", editing: id });
    const problem = await clash(locals.pb, name, fields.player, id);
    if (problem) return fail(400, { error: problem, editing: id });
    const image = fileFrom(data, "image");
    const voice = fileFrom(data, "voice");
    try {
      await locals.pb.collection("fighters").update(id, {
        ...fields,
        // a new upload replaces the file; "remove" clears it
        ...(image ? { image } : data.get("removeImage") === "on" ? { image: null } : {}),
        ...(voice ? { voice } : data.get("removeVoice") === "on" ? { voice: null } : {}),
      });
    } catch (e) {
      return fail(400, { error: `Couldn't save ${name}: ${(e as Error).message}`, editing: id });
    }
    return { saved: name };
  },

  // Load the starting fighters shipped with the app (lib/starters.ts). Their
  // list and files are static files, fetched through the app itself.
  starters: async ({ locals, fetch }) => {
    let starters: Starter[];
    try {
      const res = await fetch(`${STARTERS}/fighters.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      starters = await res.json();
    } catch (e) {
      return fail(500, { error: `Couldn't read the starting fighters: ${(e as Error).message}` });
    }
    const file = async (name: string) => {
      const res = await fetch(`${STARTERS}/${encodeURIComponent(name)}`);
      if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
      return new File([await res.blob()], name, { type: res.headers.get("content-type") || "" });
    };

    let added = 0;
    let filled = 0;
    const problems: string[] = [];
    for (const step of planStarters(starters, await loadFighters(locals.pb))) {
      const s = step.starter;
      try {
        if (step.kind === "add") {
          await locals.pb.collection("fighters").create({
            name: s.name,
            player: s.player ?? "",
            kana: s.kana ?? "",
            mirror: !!s.mirror,
            ...(s.image ? { image: await file(s.image) } : {}),
            ...(s.voice ? { voice: await file(s.voice) } : {}),
          });
          added++;
        } else {
          const files: Record<string, File> = {};
          for (const k of step.files) files[k] = await file(s[k]!);
          await locals.pb.collection("fighters").update(step.id, { ...step.fields, ...files });
          filled++;
        }
      } catch (e) {
        problems.push(`${s.name}: ${(e as Error).message}`);
      }
    }
    if (problems.length) return fail(500, { error: `Some starting fighters didn't load. ${problems.join("; ")}` });
    return { starters: { added, filled } };
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
