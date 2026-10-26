import { books, leaderboard, type PBBet, type PBBettor } from "./betting";
import { fighterFor, type PBFighter } from "./fighters";
import { royaleView, type PBRoyale } from "./royale";
import {
  computeAwards,
  groupStandings,
  knockoutTiers,
  nameMap,
  roundName,
  type PBGroup,
  type PBMatch,
  type PBPlayer,
} from "./view";

// A tournament's results as one file the organiser can keep on their phone:
// a plain web page that opens offline (no scripts, no fonts, no pictures to
// fetch) with the champion, the tables, every result, the battle royale, the
// awards and the betting. The raw records ride along inside it as JSON, so
// the file can be read back into the app one day. Plain logic, tested.

export type ArchiveData = {
  exportedAt: string; // ISO
  tournament: { id: string; name: string; status: string; createdAt: string; archivedAt: string };
  groups: PBGroup[];
  players: PBPlayer[];
  matches: PBMatch[];
  fighters: PBFighter[]; // for combat names (pictures aren't included)
  royale: PBRoyale | null;
  bettors: PBBettor[];
  bets: PBBet[];
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const day = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" }) : "";
};

// "beyfest-2026-triple-threat-2026-11-07.html"
export function exportFileName(name: string, iso: string): string {
  const slug = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const date = Number.isFinite(Date.parse(iso)) ? new Date(iso).toISOString().slice(0, 10) : "";
  return `${[slug || "beyfest", date].filter(Boolean).join("-")}.html`;
}

const TIER_TITLE = { wb: "Winners bracket", mb: "Mid bracket", lb: "Losers bracket", gf: "Grand final" } as const;

export function exportHtml(d: ArchiveData): string {
  const names = nameMap(d.players);
  const groupCount = d.groups.length;
  // A blader by player id: their name, with their combat name if they have one.
  const who = (id: string) => {
    const name = names.get(id) ?? "—";
    const f = fighterFor(name, d.fighters);
    return f && f.name.toLowerCase() !== name.toLowerCase() ? `${esc(name)} <small>${esc(f.name)}</small>` : esc(name);
  };
  // The same for battle royale entrants, who are names, not players.
  const whoNamed = (name: string) => {
    const f = fighterFor(name, d.fighters);
    return f && f.name.toLowerCase() !== name.toLowerCase() ? `${esc(name)} <small>${esc(f.name)}</small>` : esc(name);
  };

  // One result line: both sides, winner in bold, "W/O" for a walkover.
  const result = (m: PBMatch) => {
    const side = (id: string) => (id ? who(id) : "<i>—</i>");
    const done = m.matchStatus === "done";
    const score = !done ? "<span class=vs>not played</span>" : m.walkover ? "<b>W/O</b>" : `${m.p1Score ?? 0}–${m.p2Score ?? 0}`;
    const cls = (id: string) => (done && id && id === m.winner ? "won" : "");
    return `<li><span class=code>${esc(m.code)}</span><span class="${cls(m.p1)}">${side(m.p1)}</span><span class=score>${score}</span><span class="${cls(m.p2)}">${side(m.p2)}</span></li>`;
  };

  const parts: string[] = [];

  // ── The podium ──
  const gf = d.matches.find((m) => m.stage === "gf" && m.matchStatus === "done");
  if (gf?.winner) {
    const [w, l] = gf.winner === gf.p1 ? [gf.p1Score, gf.p2Score] : [gf.p2Score, gf.p1Score];
    parts.push(`<section class=champ><p class=kicker>Champion</p><h2>${who(gf.winner)}</h2>
      <p>Beat ${who(gf.loser)} in the grand final${gf.walkover ? " (walkover)" : `, ${w ?? 0}–${l ?? 0}`}.</p></section>`);
  }
  const rv = d.royale ? royaleView(d.royale) : null;
  if (rv?.champion) {
    parts.push(`<section class=champ royale><p class=kicker>Battle royale champion</p><h2>${whoNamed(rv.champion)}</h2>
      ${rv.runnerUp ? `<p>Runner-up: ${whoNamed(rv.runnerUp)}</p>` : ""}</section>`);
  }

  // ── Awards ──
  const awards = computeAwards(d.matches);
  if (awards.length) {
    parts.push(`<section><h3>Awards</h3><ul class=awards>${awards
      .map((a) => `<li><b>${esc(a.title)}</b> ${a.winners.map(who).join(" &amp; ")} <span>${esc(a.detail)}</span></li>`)
      .join("")}</ul></section>`);
  }

  // ── Groups ──
  for (const g of d.groups) {
    const rows = groupStandings(d.players, d.matches, g.index);
    const games = d.matches.filter((m) => m.stage === "group" && m.groupIndex === g.index);
    parts.push(`<section><h3>${esc(g.name)}</h3>
      <table><thead><tr><th>#</th><th class=l>Blader</th><th>W</th><th>L</th><th>For</th><th>Agst</th><th>+/−</th></tr></thead><tbody>${rows
        .map(
          (r) =>
            `<tr><td>${r.rank}</td><td class=l>${who(r.playerId)}</td><td>${r.wins}</td><td>${r.losses}</td><td>${r.pointsFor}</td><td>${r.pointsAgainst}</td><td>${r.pointDiff > 0 ? "+" : ""}${r.pointDiff}</td></tr>`,
        )
        .join("")}</tbody></table>
      <ul class=results>${games.map(result).join("")}</ul></section>`);
  }

  // ── Knockout ──
  for (const t of knockoutTiers(d.matches)) {
    parts.push(`<section><h3>${TIER_TITLE[t.tier]}</h3>${t.rounds
      .map((r) => `<h4>${esc(roundName(r.label))}</h4><ul class=results>${r.matches.map(result).join("")}</ul>`)
      .join("")}</section>`);
  }

  // ── Battle royale ──
  if (rv) {
    const battle = (b: (typeof rv.battles)[number]) => {
      const r = b.result;
      const tag = (n: string) =>
        b.kind === "sudden"
          ? r.advancing?.includes(n) ? " <em>through</em>" : ""
          : n === r.winner ? " <em>winner</em>" : n === r.runnerUp ? " <em class=second>runner-up</em>" : "";
      const line = b.entrants.length ? b.entrants.map((n) => `<li>${whoNamed(n)}${b.status === "done" ? tag(n) : ""}</li>`).join("") : "<li><i>Not played</i></li>";
      return `<h4>${esc(b.label)}</h4><ul class=royale>${line}</ul>`;
    };
    parts.push(`<section><h3>Battle royale</h3><p class=note>${d.royale!.entrants.length} bladers, ${d.royale!.spaces} at a time.</p>${rv.battles.map(battle).join("")}</section>`);
  }

  // ── Betting ──
  if (d.bettors.length) {
    const board = leaderboard(books(d.bettors, d.bets, d.matches));
    parts.push(`<section><h3>Betting</h3><table><thead><tr><th>#</th><th class=l>Bettor</th><th>Finished with</th></tr></thead><tbody>${board
      .map((r) => `<tr><td>${r.rank}</td><td class=l>${esc(r.bettor.name)}</td><td>$${r.worth.toLocaleString("en-IE")}</td></tr>`)
      .join("")}</tbody></table></section>`);
  }

  // The raw records, for reading back in one day. "<" is escaped so nothing
  // in a name can close the script tag.
  const raw = JSON.stringify(d).replace(/</g, "\\u003c");
  const t = d.tournament;
  const when = day(t.createdAt);
  const sub = [when, `${d.players.length} bladers`, groupCount ? `${groupCount} groups` : ""].filter(Boolean).join(" · ");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t.name)} — results</title>
<style>
  :root { color-scheme: dark; --bg: #0e1a52; --card: #13226a; --line: #2a3f9e; --text: #fff; --soft: #a9b4e8; --gold: #ffc700; --green: #19b25a; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 20px 16px 48px; }
  header h1 { margin: 0; font-size: 1.9rem; line-height: 1.1; font-style: italic; text-transform: uppercase; }
  header p { margin: 4px 0 0; color: var(--soft); }
  section { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; margin-top: 16px; }
  h3 { margin: 0 0 10px; font-size: 1.25rem; text-transform: uppercase; font-style: italic; color: var(--gold); }
  h4 { margin: 14px 0 6px; font-size: 1rem; color: var(--soft); }
  small { color: var(--soft); font-size: 0.8em; margin-left: 4px; }
  .champ { background: var(--gold); color: #000; border: 0; text-align: center; }
  .champ small, .champ .kicker { color: #3a3000; }
  .champ[royale] { background: #fff; }
  .champ h2 { margin: 2px 0 4px; font-size: 1.8rem; text-transform: uppercase; font-style: italic; }
  .champ p { margin: 0; }
  .kicker { font-size: 0.8rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
  th, td { padding: 6px 4px; text-align: center; border-bottom: 1px solid var(--line); }
  th { font-size: 0.75rem; color: var(--soft); text-transform: uppercase; }
  .l { text-align: left; }
  ul { list-style: none; margin: 0; padding: 0; }
  .results { margin-top: 10px; }
  .results li { display: grid; grid-template-columns: 3.2em 1fr auto 1fr; gap: 8px; align-items: baseline; padding: 5px 0; border-bottom: 1px solid var(--line); }
  .results li > span:nth-child(4) { text-align: right; }
  .code { color: var(--soft); font-size: 0.8rem; }
  .score { font-variant-numeric: tabular-nums; font-weight: 700; white-space: nowrap; }
  .vs { color: var(--soft); font-weight: 400; font-size: 0.85rem; }
  .won { font-weight: 700; color: var(--gold); }
  .awards li, .royale li { padding: 5px 0; border-bottom: 1px solid var(--line); }
  .awards span { display: block; color: var(--soft); font-size: 0.9rem; }
  em { font-style: normal; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; background: var(--gold); color: #000; padding: 1px 6px; border-radius: 4px; margin-left: 6px; }
  em.second { background: #d9dde9; }
  .note { margin: 0; color: var(--soft); }
  footer { margin-top: 24px; color: var(--soft); font-size: 0.85rem; text-align: center; }
</style>
</head>
<body>
<main>
<header><h1>${esc(t.name)}</h1><p>${esc(sub)}</p></header>
${parts.join("\n")}
<footer>Saved from the Beyfest app on ${esc(day(d.exportedAt))}.${t.archivedAt ? ` Archived ${esc(day(t.archivedAt))}.` : ""}</footer>
</main>
<script type="application/json" id="beyfest-data">${raw}</script>
</body>
</html>
`;
}
