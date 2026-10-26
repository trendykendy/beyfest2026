// The battle royale after the main tournament: a free-for-all, last bey
// spinning wins. Not everyone fits around the arena, so the organiser says
// how many can go at once ("spaces") and that sets the heats:
//
// - heats: players ÷ spaces, rounded up, split as evenly as possible
//   (12 players, 5 spaces → 3 heats of 4)
// - the final fills every space: the heat winners first, then the heat
//   runners-up. If there are more runners-up than places left, they fight a
//   sudden death and the last ones still spinning take the places
//   (12/5: 3 winners + 2 of the 3 runners-up). If they all fit, they all go.
// - everyone fits in one go: a single battle, which is the final.
//
// Only the drawn order of entrants and each battle's result are stored (one
// `royales` record); every battle's line-up is worked out here, so fixing a
// heat result re-flows into the battles after it. Plain logic, tested.

export type BattleResult = {
  startedAt?: string; // ISO: Start pressed (the TV plays the intro)
  winner?: string;
  runnerUp?: string;
  advancing?: string[]; // sudden death: who goes through to the final
  resultAt?: string; // ISO: when the result was recorded
};

export interface PBRoyale {
  id: string;
  spaces: number;
  entrants: string[]; // names, in drawn order: heat 1's first, then heat 2's…
  battles: Record<string, BattleResult>; // keyed H1…Hn, SD, F
  createdAt?: string; // ISO: when the heats were drawn (the TV plays the draw)
}

export type RoyalePlan = {
  heats: number[]; // heat sizes, in order (empty: one battle, the final)
  finalSize: number;
  sudden: number; // runners-up fighting a sudden death (0: none)
  suddenPlaces: number; // final places the sudden death decides
};

export const SPACES_MIN = 2;
export const SPACES_MAX = 8;

// The heats and final for `n` players with `spaces` around the arena, or why
// it won't work.
export function planRoyale(n: number, spaces: number): RoyalePlan | { error: string } {
  if (n < 2) return { error: "A battle royale needs at least 2 bladers." };
  if (!Number.isInteger(spaces) || spaces < SPACES_MIN || spaces > SPACES_MAX)
    return { error: `Spaces per round must be ${SPACES_MIN} to ${SPACES_MAX}.` };
  if (n <= spaces) return { heats: [], finalSize: n, sudden: 0, suddenPlaces: 0 };

  const count = Math.ceil(n / spaces);
  // Every heat winner has to fit in the one final.
  if (count > spaces) {
    let need = spaces;
    while (Math.ceil(n / need) > need) need++;
    return { error: `${n} bladers need at least ${need} spaces per round (every heat winner has to fit in the final).` };
  }
  const base = Math.floor(n / count);
  if (base < 2) return { error: "Too few bladers for that many heats." };
  const heats = Array.from({ length: count }, (_, i) => base + (i < n % count ? 1 : 0));

  const finalSize = Math.min(spaces, count * 2); // winners, then runners-up
  const placesLeft = finalSize - count;
  const sudden = placesLeft > 0 && count > placesLeft ? count : 0;
  return { heats, finalSize, sudden, suddenPlaces: sudden ? placesLeft : 0 };
}

export type BattleKind = "heat" | "sudden" | "final";
export type BattleStatus = "waiting" | "ready" | "live" | "done";
export type Battle = {
  key: string; // H1…, SD, F
  kind: BattleKind;
  label: string; // "Heat 1", "Sudden death", "Final"
  entrants: string[]; // empty while waiting on earlier battles
  status: BattleStatus;
  result: BattleResult;
  places: number; // sudden death: places it decides; otherwise 1 (the winner)
};

export type RoyaleView = {
  plan: RoyalePlan;
  battles: Battle[]; // in play order
  next: Battle | null; // the battle being played, or the next to play
  champion: string;
  runnerUp: string;
};

// A result only counts if it fits the battle's current line-up (a fixed
// earlier result can change who's in it).
function settled(kind: BattleKind, entrants: string[], r: BattleResult, places: number): boolean {
  const inIt = (n?: string) => !!n && entrants.includes(n);
  if (kind === "sudden") {
    const a = r.advancing ?? [];
    return a.length === places && new Set(a).size === places && a.every((n) => entrants.includes(n));
  }
  if (!inIt(r.winner)) return false;
  return entrants.length < 2 || (inIt(r.runnerUp) && r.runnerUp !== r.winner);
}

// Every battle, worked out from the stored entrants and results.
export function royaleView(r: PBRoyale): RoyaleView | null {
  const plan = planRoyale(r.entrants.length, r.spaces);
  if ("error" in plan) return null;
  const battles: Battle[] = [];
  const make = (key: string, kind: BattleKind, label: string, entrants: string[], ready: boolean, places = 1): Battle => {
    const result = r.battles?.[key] ?? {};
    const done = ready && settled(kind, entrants, result, places);
    const status: BattleStatus = !ready ? "waiting" : done ? "done" : result.startedAt ? "live" : "ready";
    // An unsettled battle keeps only its start (a stale result isn't shown).
    const shown = done ? result : ready && result.startedAt ? { startedAt: result.startedAt } : {};
    const b = { key, kind, label, entrants: ready ? entrants : [], status, result: shown, places };
    battles.push(b);
    return b;
  };

  let finalists = r.entrants;
  let finalReady = true;
  if (plan.heats.length) {
    let at = 0;
    const heats = plan.heats.map((size, i) => {
      const entrants = r.entrants.slice(at, at + size);
      at += size;
      return make(`H${i + 1}`, "heat", `Heat ${i + 1}`, entrants, true);
    });
    const heatsDone = heats.every((h) => h.status === "done");
    const winners = heats.map((h) => h.result.winner ?? "");
    const runnersUp = heats.map((h) => h.result.runnerUp ?? "");
    const placesLeft = plan.finalSize - heats.length;
    let extra: string[] = [];
    let extraDone = heatsDone;
    if (plan.sudden) {
      const sd = make("SD", "sudden", "Sudden death", runnersUp, heatsDone, plan.suddenPlaces);
      extra = sd.result.advancing ?? [];
      extraDone = sd.status === "done";
    } else if (placesLeft > 0) {
      extra = runnersUp;
    }
    finalists = [...winners, ...extra];
    finalReady = extraDone;
  }
  const final = make("F", "final", "Final", finalists, finalReady);

  return {
    plan,
    battles,
    next: battles.find((b) => b.status === "live") ?? battles.find((b) => b.status === "ready") ?? null,
    champion: final.status === "done" ? (final.result.winner ?? "") : "",
    runnerUp: final.status === "done" ? (final.result.runnerUp ?? "") : "",
  };
}

// Who a finished heat or sudden death sends through to the final (the TV's
// Qualified screen), and, for a heat with a sudden death to come, the
// runner-up who goes to that instead. Matches royaleView's line-ups: the
// runners-up go straight through only when there's no sudden death and the
// final has places beyond the heat winners.
export function qualifiers(plan: RoyalePlan, b: Battle): { through: string[]; toSudden: string } {
  const r = b.result;
  if (b.kind === "sudden") return { through: r.advancing ?? [], toSudden: "" };
  if (b.kind !== "heat" || !r.winner) return { through: [], toSudden: "" };
  const runnerUp = r.runnerUp ?? "";
  if (!runnerUp) return { through: [r.winner], toSudden: "" };
  if (plan.sudden) return { through: [r.winner], toSudden: runnerUp };
  const placesLeft = plan.finalSize - plan.heats.length;
  return { through: placesLeft > 0 ? [r.winner, runnerUp] : [r.winner], toSudden: "" };
}

// The battles played after this one (they depend on its result).
export function laterBattles(view: RoyaleView, key: string): Battle[] {
  const i = view.battles.findIndex((b) => b.key === key);
  const me = view.battles[i];
  if (!me) return [];
  // Heats don't depend on each other; only on what comes after all of them.
  return view.battles.filter((b, j) => j > i && b.kind !== "heat" && (me.kind !== "sudden" || b.kind === "final"));
}

// The preview line for the admin's setup form.
export function planInWords(p: RoyalePlan): string {
  if (!p.heats.length) return `One battle of ${p.finalSize}: last bey standing wins.`;
  const sizes = new Map<number, number>();
  for (const s of p.heats) sizes.set(s, (sizes.get(s) ?? 0) + 1);
  const heats = [...sizes]
    .map(([size, n]) => `${n} heat${n === 1 ? "" : "s"} of ${size}`)
    .join(" and ");
  const w = p.heats.length;
  const rest = p.finalSize - w;
  const how = !rest
    ? `${w} heat winners`
    : p.sudden
      ? `${w} heat winners + ${rest} from a sudden death of ${p.sudden}`
      : `${w} heat winners + ${rest} runners-up`;
  return `${heats} → final of ${p.finalSize} (${how}).`;
}
