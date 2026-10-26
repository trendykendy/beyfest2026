import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { loadFighters, loadTournamentView } from "$lib/server/load";
import { pbUrlFor } from "$lib/config";
import { planStarters, type Starter } from "$lib/starters";
import { toFace, type PBFighter } from "$lib/fighters";
import { readStarters } from "$lib/server/starterFiles";

// The fighter library: who the TV's VS intro shows, with their katakana,
// cut-out, announcer voice and victory pose. Not tied to a tournament (see
// migrations 1710001100_fighters, 1710001200_fighter_player_voice,
// 1710001400_fighter_victory, 1710001700_fighter_face,
// 1710001800_fighter_royale_victory and 1710001900_fighter_image_mirrored).

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

// The face point clicked in on the edit form: hidden faceX/faceY/faceH inputs,
// empty when it's not set (or was cleared), which saves no face.
function faceFrom(data: FormData) {
  const n = (k: string) => (data.get(k) === "" || data.get(k) === null ? NaN : Number(data.get(k)));
  return toFace({ x: n("faceX"), y: n("faceY"), h: n("faceH") });
}

// Which fighters still missing a face point or mirror image have a starter's
// picture, byte for byte: fighter id → the picture's file name. Those can
// take what goes with the starter's picture even if it was uploaded by hand
// under another name.
async function starterPictures(
  pb: App.Locals["pb"],
  library: PBFighter[],
  starters: Starter[],
  file: (name: string) => Promise<File>,
): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  const wanted = library.filter((f) => f.image && (!f.face || !f.imageMirrored));
  const faced = starters.filter((s) => s.image && (s.face || s.imageMirrored));
  if (!wanted.length || !faced.length) return found;
  const sizes = new Map<number, string[]>(); // by size first, so few are compared in full
  const bytes = new Map<string, Uint8Array>();
  for (const s of faced) {
    const b = new Uint8Array(await (await file(s.image!)).arrayBuffer());
    bytes.set(s.image!, b);
    sizes.set(b.length, [...(sizes.get(b.length) ?? []), s.image!]);
  }
  for (const f of wanted) {
    try {
      const res = await fetch(pb.files.getURL({ id: f.id, collectionName: "fighters" }, f.image));
      if (!res.ok) continue;
      const b = new Uint8Array(await res.arrayBuffer());
      const name = (sizes.get(b.length) ?? []).find((n) => equal(bytes.get(n)!, b));
      if (name) found.set(f.id, name);
    } catch {
      // Can't read it: it just doesn't get a face point.
    }
  }
  return found;
}

function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
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
    const imageMirrored = fileFrom(data, "imageMirrored");
    const victory = fileFrom(data, "victory");
    const royaleVictory = fileFrom(data, "royaleVictory");
    const voice = fileFrom(data, "voice");
    try {
      await locals.pb.collection("fighters").create({
        ...fields,
        ...(image ? { image } : {}),
        ...(imageMirrored ? { imageMirrored } : {}),
        ...(victory ? { victory } : {}),
        ...(royaleVictory ? { royaleVictory } : {}),
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
    const imageMirrored = fileFrom(data, "imageMirrored");
    const victory = fileFrom(data, "victory");
    const royaleVictory = fileFrom(data, "royaleVictory");
    const voice = fileFrom(data, "voice");
    // A new picture's face is somewhere else, so the old point goes with it.
    const face = image || data.get("removeImage") === "on" ? null : faceFrom(data);
    try {
      await locals.pb.collection("fighters").update(id, {
        ...fields,
        face,
        // a new upload replaces the file; "remove" clears it
        ...(image ? { image } : data.get("removeImage") === "on" ? { image: null } : {}),
        // The mirror image goes with its picture: a new or removed picture drops it.
        ...(imageMirrored
          ? { imageMirrored }
          : image || data.get("removeImage") === "on" || data.get("removeImageMirrored") === "on"
            ? { imageMirrored: null }
            : {}),
        ...(victory ? { victory } : data.get("removeVictory") === "on" ? { victory: null } : {}),
        ...(royaleVictory
          ? { royaleVictory }
          : data.get("removeRoyaleVictory") === "on"
            ? { royaleVictory: null }
            : {}),
        ...(voice ? { voice } : data.get("removeVoice") === "on" ? { voice: null } : {}),
      });
    } catch (e) {
      return fail(400, { error: `Couldn't save ${name}: ${(e as Error).message}`, editing: id });
    }
    return { saved: name };
  },

  // Load the starting fighters shipped with the app (lib/starters.ts).
  starters: async ({ locals }) => {
    let starters: Starter[];
    let file: (name: string) => Promise<File>;
    try {
      ({ starters, file } = await readStarters());
    } catch (e) {
      return fail(500, { error: `Couldn't read the starting fighters: ${(e as Error).message}` });
    }

    const library = await loadFighters(locals.pb);
    const pictures = await starterPictures(locals.pb, library, starters, file);
    let added = 0;
    let filled = 0;
    const problems: string[] = [];
    for (const step of planStarters(starters, library, pictures)) {
      const s = step.starter;
      try {
        if (step.kind === "add") {
          await locals.pb.collection("fighters").create({
            name: s.name,
            player: s.player ?? "",
            kana: s.kana ?? "",
            mirror: !!s.mirror,
            face: s.face ?? null,
            ...(s.image ? { image: await file(s.image) } : {}),
            ...(s.imageMirrored ? { imageMirrored: await file(s.imageMirrored) } : {}),
            ...(s.victory ? { victory: await file(s.victory) } : {}),
            ...(s.royaleVictory ? { royaleVictory: await file(s.royaleVictory) } : {}),
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
