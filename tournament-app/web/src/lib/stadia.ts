// The three Triple Threat stadia (from the public site). Every round of every
// match is played in one, drawn just before the round starts. Keys are what's
// stored; the numeral, name and nickname are what screens show.
export interface Stadium {
  key: string;
  num: string; // I / II / III
  name: string; // short name that fits the TV at display size
  code: string; // nickname
}

export const STADIA: Stadium[] = [
  { key: "xtreme", num: "I", name: "Xtreme Battle", code: "The Neutral Ground" },
  { key: "motor", num: "II", name: "Double Xtreme", code: "The Crusher" },
  { key: "drop", num: "III", name: "Drop Attack", code: "Death From Above" },
];

const BY_KEY = new Map(STADIA.map((s) => [s.key, s]));
export const stadiumOf = (key: string | undefined | null): Stadium | null => (key ? BY_KEY.get(key) ?? null : null);
export const isStadiumKey = (key: unknown): key is string => typeof key === "string" && BY_KEY.has(key);

// Weighted draw, so the event ends up with an even split without being
// predictable. A stadium's weight is (1 + how many draws it is behind the
// most-used one)²: equal counts are a fair 1 in 3, and a stadium one draw
// behind is 4× as likely as the leader.
//   counts — draws so far, by key (missing = 0)
//   off    — stadia taken out of the draw (e.g. a flat motor)
//   avoid  — the stadium being redrawn, so a redraw never repeats it
// If that leaves nothing, `avoid` is ignored, then `off`: there's always a stadium.
export function pickStadium(
  counts: Record<string, number>,
  { off = [], avoid = "", random = Math.random }: { off?: string[]; avoid?: string; random?: () => number } = {},
): string {
  const keys = STADIA.map((s) => s.key);
  let pool = keys.filter((k) => !off.includes(k) && k !== avoid);
  if (pool.length === 0) pool = keys.filter((k) => !off.includes(k));
  if (pool.length === 0) pool = keys;

  const max = Math.max(...pool.map((k) => counts[k] ?? 0));
  const weights = pool.map((k) => (1 + max - (counts[k] ?? 0)) ** 2);
  let r = random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r < 0) return pool[i];
  }
  return pool[pool.length - 1];
}
