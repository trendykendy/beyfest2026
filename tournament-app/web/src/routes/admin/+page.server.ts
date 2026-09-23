import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { loadTournamentView, loadTvState } from "$lib/server/load";
import { SCENE_TITLE, type Scene } from "$lib/view";
import {
  createTournament,
  enterScore,
  generateKnockoutStage,
  getActiveTournament,
  resetTournament,
} from "$lib/server/tournament";

export const load: PageServerLoad = async ({ locals }) => {
  const [view, tv] = await Promise.all([loadTournamentView(locals.pb), loadTvState(locals.pb)]);
  return { ...view, tv };
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    const data = await request.formData();
    const name = String(data.get("name") || "");
    const raw = String(data.get("players") || "");
    const names = raw
      .split(/[\n,]/)
      .map((n) => n.trim())
      .filter(Boolean);

    if (names.length < 8 || names.length > 15) {
      return fail(400, {
        error: `Enter between 8 and 15 players (you entered ${names.length}).`,
        players: raw,
        name,
      });
    }
    const dupes = names.filter((n, i) => names.findIndex((m) => m.toLowerCase() === n.toLowerCase()) !== i);
    if (dupes.length) {
      return fail(400, { error: `Duplicate names: ${[...new Set(dupes)].join(", ")}.`, players: raw, name });
    }

    const existing = await getActiveTournament(locals.pb);
    if (existing) {
      return fail(409, { error: "A tournament already exists. Reset it first.", players: raw, name });
    }

    try {
      await createTournament(locals.pb, name, names);
    } catch (e) {
      return fail(500, { error: (e as Error).message, players: raw, name });
    }
    return { created: true };
  },

  score: async ({ request, locals }) => {
    const data = await request.formData();
    const code = String(data.get("code") || "");
    const s1 = Number(data.get("s1"));
    const s2 = Number(data.get("s2"));
    const t = await getActiveTournament(locals.pb);
    if (!t) return fail(400, { error: "No active tournament." });
    if (!Number.isInteger(s1) || !Number.isInteger(s2) || s1 < 0 || s2 < 0) {
      return fail(400, { error: "Scores must be non-negative whole numbers." });
    }
    if (s1 === s2) return fail(400, { error: "Matches can't end in a draw." });
    try {
      await enterScore(locals.pb, t.id, code, s1, s2);
    } catch (e) {
      return fail(400, { error: (e as Error).message });
    }
    return { scored: code };
  },

  generateKnockout: async ({ locals }) => {
    const t = await getActiveTournament(locals.pb);
    if (!t) return fail(400, { error: "No active tournament." });
    try {
      await generateKnockoutStage(locals.pb, t.id);
    } catch (e) {
      return fail(400, { error: (e as Error).message });
    }
    return { knockout: true };
  },

  // What the venue TV shows: "Auto" (rotate + cut to live scores) or lock it
  // on one scene. The TV follows the tv_state record live.
  tv: async ({ request, locals }) => {
    const data = await request.formData();
    const auto = data.get("mode") === "auto";
    const scene = String(data.get("scene") || "") as Scene;
    if (!auto && !(scene in SCENE_TITLE)) return fail(400, { error: "Unknown TV scene." });
    const tv = await loadTvState(locals.pb);
    if (!tv.id) {
      return fail(500, { error: "TV settings are missing. Restart PocketBase so its migrations run." });
    }
    await locals.pb.collection("tv_state").update(tv.id, auto ? { mode: "auto" } : { mode: "locked", scene });
    return { tv: true };
  },

  reset: async ({ locals }) => {
    const t = await getActiveTournament(locals.pb);
    if (t) await resetTournament(locals.pb, t.id);
    return { reset: true };
  },

  logout: async ({ locals }) => {
    locals.pb.authStore.clear();
    throw redirect(303, "/");
  },
};
