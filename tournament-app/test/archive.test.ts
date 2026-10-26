import { describe, expect, test } from "bun:test";
import { exportFileName, exportHtml, type ArchiveData } from "../web/src/lib/archive";
import type { PBMatch, PBPlayer } from "../web/src/lib/view";

// A match with just the fields the export reads.
function match(code: string, p1: string, p2: string, extra: Partial<PBMatch> = {}): PBMatch {
  return {
    id: code,
    code,
    stage: "group",
    roundLabel: "Group 1",
    orderIndex: 0,
    groupIndex: 0,
    p1,
    p2,
    p1Score: null,
    p2Score: null,
    liveP1: 0,
    liveP2: 0,
    liveLog: [],
    startedAt: "",
    resultAt: "",
    walkover: false,
    winner: "",
    loser: "",
    matchStatus: "ready",
    ...extra,
  } as PBMatch;
}
const done = (code: string, p1: string, p2: string, s1: number, s2: number, extra: Partial<PBMatch> = {}) =>
  match(code, p1, p2, { matchStatus: "done", p1Score: s1, p2Score: s2, winner: s1 > s2 ? p1 : p2, loser: s1 > s2 ? p2 : p1, ...extra });
const player = (id: string, name: string): PBPlayer => ({ id, name, groupIndex: 0, drawOrder: 0, finalGroupRank: null, withdrawn: false });

function data(extra: Partial<ArchiveData> = {}): ArchiveData {
  return {
    exportedAt: "2026-11-07T22:00:00.000Z",
    tournament: { id: "t", name: "Beyfest 2026 — Triple Threat", status: "complete", createdAt: "2026-11-07T10:00:00.000Z", archivedAt: "" },
    groups: [{ id: "g", index: 0, name: "Group 1", size: 3, format: "single", complete: true }],
    players: [player("a", "Moss"), player("b", "Shane"), player("c", "Ronan")],
    matches: [
      done("G1", "a", "b", 5, 3),
      done("G2", "b", "c", 5, 0, { walkover: true }),
      done("G3", "a", "c", 5, 2),
      done("GF1", "b", "a", 11, 4, { stage: "gf", groupIndex: null, roundLabel: "Phase 7 — Grand Final", orderIndex: 9 }),
    ],
    fighters: [{ id: "f", name: "The Pugilist", player: "Shane" } as ArchiveData["fighters"][number]],
    royale: null,
    bettors: [],
    bets: [],
    ...extra,
  };
}

// The records carried inside the page, read back out.
function embedded(html: string): unknown {
  const m = html.match(/<script type="application\/json" id="beyfest-data">([\s\S]*?)<\/script>/);
  return m ? JSON.parse(m[1]) : null;
}

describe("exportHtml", () => {
  test("names the champion and the grand final score", () => {
    const html = exportHtml(data());
    expect(html).toContain("Champion");
    expect(html).toMatch(/<h2>Shane <small>The Pugilist<\/small><\/h2>/);
    expect(html).toContain("11–4");
  });

  test("no champion before the grand final is played", () => {
    const d = data();
    d.matches = d.matches.filter((m) => m.stage !== "gf");
    expect(exportHtml(d)).not.toContain("Champion");
  });

  test("group table and results, walkovers as W/O", () => {
    const html = exportHtml(data());
    expect(html).toContain("Group 1");
    expect(html).toContain("<b>W/O</b>");
    expect(html).toContain("5–3");
  });

  test("the raw records round-trip", () => {
    const d = data();
    expect(embedded(exportHtml(d))).toEqual(JSON.parse(JSON.stringify(d)));
  });

  test("names can't break the page", () => {
    const d = data();
    d.players[0] = player("a", "</script><b>x</b>");
    const html = exportHtml(d);
    expect(html).not.toContain("<b>x</b>");
    expect(html).toContain("&lt;/script&gt;");
    // Still one data script, still readable.
    expect((embedded(html) as ArchiveData).players[0].name).toBe("</script><b>x</b>");
  });

  test("battle royale champion and line-ups", () => {
    const html = exportHtml(
      data({
        royale: {
          id: "r",
          spaces: 4,
          entrants: ["Moss", "Shane", "Ronan"],
          battles: { F: { winner: "Ronan", runnerUp: "Moss", resultAt: "2026-11-07T21:00:00Z" } },
        },
      }),
    );
    expect(html).toContain("Battle royale champion");
    expect(html).toMatch(/Ronan <em>winner<\/em>/);
    expect(html).toContain("3 bladers, 4 at a time");
  });

  test("betting leaderboard, richest first", () => {
    const html = exportHtml(
      data({
        bettors: [
          { id: "x", name: "Aoife" },
          { id: "y", name: "Ciara" },
        ],
        bets: [{ id: "1", bettor: "y", match: "G1", pick: "a", stake: 1000, odds: 2, created: "2026-11-07T10:00:00Z" }],
      }),
    );
    expect(html.indexOf("Ciara")).toBeLessThan(html.indexOf("Aoife"));
    expect(html).toContain("$11,000");
  });
});

describe("exportFileName", () => {
  test("tournament name and date", () => {
    expect(exportFileName("Beyfest 2026 — Triple Threat", "2026-11-07T10:00:00.000Z")).toBe("beyfest-2026-triple-threat-2026-11-07.html");
  });
  test("falls back without a name or date", () => {
    expect(exportFileName("", "")).toBe("beyfest.html");
  });
});
