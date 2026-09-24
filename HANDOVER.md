# Handover: tournament app redesign

Written 24 September 2026 (day 1), updated at the end of day 2. Read this first, then `CLAUDE.md`.

## Where things stand

The tournament app (`tournament-app/`) is being redesigned because the old look read as AI-generated. The **TV and admin are finished**. The public page is parked (see Phone view). On day 2 the user also picked four event-day improvements, all built (see "Day 2 improvements").

All work is on branch **`redesign/tournament-app`**. `main` is still the untouched baseline and **nothing has been merged yet**. The working tree is clean.

| Step | What | Status |
|---|---|---|
| 1 | Design foundation (fonts, colours, no photo/glow/emoji) | Done |
| 2 | Rebuild all 6 TV scenes | Done |
| 3 | TV control: auto-rotate, cut to live scores, admin lock | Done |
| – | Match centre round-win animation | Done |
| – | Bracket lines no longer hidden behind cards | Done |
| 4 | Admin redesign | **Redesign done** (day 2, tested in Edge on Windows). Mac-specific checks wait until there's a Mac |
| 5 | Public display (`/`) for phones | **Parked (low priority):** nobody is expected to watch on phones. Audit and plan below under "Phone view" |
| 6 | Mac + Pi launchers | Not started (user parked it on day 2) |
| – | Day 2 improvements: fix a result, resilience, finish stats and awards, Let it rip | Done |

### Commits on `redesign/tournament-app` (oldest first)

```
9637457 move public website into public-site folder
eca4957 remove unused images from public site
f170504 tournament app: new design foundation (fonts, colours, no photo/glow/emoji)
fa33fb8 tournament app: swap display font to Saira Black Italic
fdd7488 tv: rebuild group stage scene, add on-now band, remove bracket corner ticks
26aeb36 tv: rebuild match centre as a face-off, plain-words round names
c258168 tv: bracket match plates as white slabs, plain-words round and slot names
7f2cac0 tv: rebuild mini round-robins scene on the group slabs
41abc27 tv: champion and standby scenes with the big gold slab, event date in config
c3760e4 fix group standings counting knockout rematches between group-mates
6d7e2e1 tv: auto rotation, cut to match centre on score changes, admin can lock the TV scene
03b549f tv bracket: route column-skipping lines through clear corridors so they never pass behind cards
a876ea8 tv match centre: animated round-win call-out that settles as a finish pill; store round log
```

`c3760e4` is a real bug fix (group tables counted knockout rematches between group-mates) and can go onto `main` on its own if wanted before the redesign merges.

## Design decisions (agreed with the user)

- **Direction:** Japanese Beyblade tournament broadcast. White "telop" slabs with heavy black outlines and **hard** offset shadows (no blur), diagonal cuts, on an ultramarine background with static diagonal speed lines. Katakana accents above scene titles.
- **Colour** (tokens in `web/src/lib/theme.css`):
  - Background: `--field` `#172a7a` and `--field-deep` `#0e1a52`.
  - Slabs: `--paper` `#fff` and `--ink` `#000`.
  - Arena colours, **always with meaning:** green = Winners, gold = Mid, red = Losers. The Grand Final is an inverted black slab with gold.
- **Type:** **Saira** only. Display is Saira Black Italic, condensed and uppercase, via the `--font-display` alias "Beyfest Display". Text is plain Saira. Katakana is Zen Kaku Gothic New Black.
  - The user rejected Dela Gothic One as "too goofy" and wants type that's sleek, not chunky.
  - Fonts are self-hosted in `web/static/fonts`, since the app must run offline.
- **Pi-friendly:** only `transform`/`opacity` animation, no filters/blur/glow, no photos, no emoji (Raspberry Pi OS has no colour emoji font; use `components/Trophy.svelte`).
- **Words:** plain language on screen ("Mid bracket round 2", not "Phase 4 — MB R2"). Use `roundName()` and `slotLabel()` in `web/src/lib/view.ts`.
- **Hardware:** the TV screens are 16:9 at the venue and will eventually run on a Raspberry Pi; admin runs on a Mac. **The Pi's role is undecided** (TV browser only, or the whole server), so keep both working.

## How the TV works now

- Scenes: standby, groups, rr, bracket, spotlight (Match centre), champion. `availableScenes()` in `view.ts` decides which exist; the TV and admin both use it.
- Which scene shows (first rule that applies wins): a key pressed at the TV (60s) → admin lock → a score just changed or a result went in (Match centre on that match, 20s) → auto rotation (groups 25s, rr 20s, bracket 25s, spotlight 15s, champion 30s). The logic is in `web/src/routes/tv/+page.svelte`.
- The admin's "TV screen" panel writes the `tv_state` PocketBase record (migration `1710000300_tv_state.js`). The TV follows it live.
- The round-win animation reads `matches.liveLog`, a list of `{who, finish}` (migration `1710000400_live_log.js`). The admin scorer posts it via `/admin/live`.

## Start here next session (raised by the user at end of day 1)

A–C from end of day 1 are **done** (day 2):

- A. Champion name clipping: `24e78ff` pads `.big-slab > span` by `0.1em` each side. Long names still end in "…" rather than overflowing.
- B. The +/− header is now **"Point diff."** on the TV (wraps to two lines) and on the public page's `GroupCard`: `204d36d`.
- C. Match centre keeps **one pill per round won** under each card, oldest first, at the VS end: `27ab2f1`.
  - It steps down in size past 4 and 7 pills, and `.mc-duel` reserves room for two rows.
  - The Winner chip is now the first item in the same row (`sideFoot` snippet).
  - Pills only show while live, because `load.ts` blanks `liveLog` once a match is done.
  - Possible follow-up: keep the round recap on the Result screen. That needs `load.ts` to stop blanking `liveLog`.

Remaining: step 6 (Mac + Pi launchers), plus checking admin on a real Mac. Step 5 is parked.

Test helper worth recreating: a small script that PATCHes a live match's `liveP1/liveP2/liveLog` as the organiser, then screenshots Match centre. Add the last round while the page is open to catch the call-out.

## Known issues / to do

1. ~~The scorer resets on reload~~: fixed in `8549e91`. `RoundScorer` starts from the match's saved `liveLog`.
2. When the organiser picks a different match with "Score this", the TV's "Up next" still shows the default next match until the first point is scored. After that the TV cuts to the live match as normal. Minor; worth knowing.
3. Step 5 public display: parked. See "Phone view" below.
4. Step 6: `start.ps1` and `pb/pocketbase.exe` are **Windows-only**.
   - The Mac needs the macOS PocketBase build plus a `start.sh`.
   - The Pi needs the arm64 build, or just Chromium in kiosk mode pointing at the Mac. Document both in the README.
   - **Also:** the browser connects to PocketBase at `PUBLIC_PB_URL`, which defaults to `127.0.0.1:8090`. A TV on a Pi (or any other device) viewing the Mac's app must have that set to the Mac's LAN address, or its live updates never arrive.
5. 8-player (double-elimination) bracket:
   - Its round headings aren't covered by `roundName()` yet ("UPPER BRACKET — QUARTERFINALS").
   - Its first two column gaps have a dense bundle of lines.
6. For the first ~250ms, the round-win slab overlaps the LIVE status line on Match centre.
7. The sample scripts (`midgroup.ts`) set a live score **without** a round log. Admin's scorer then shows 0–0 for that match while the TV shows 3–2. This only happens with sample data; the real scorer always writes both.
8. Before the event, change the default logins: organiser `organiser@beyfest.local` / `beyfest2026`, and PocketBase superuser `admin@beyfest.local` / `beyfestadmin2026`. They're in the seed migration and README.
9. `svelte.config.js` shows a deprecation warning for `csrf.checkOrigin`; it predates the redesign and is harmless for now.

## Day 2 improvements (the user picked four of five suggestions)

The five suggestions were: 1 fix a result, 2 finish stats, 3 Let it rip, 4 resilience, 5 walkovers and name fixes. All five are built; 5 came last, including a one-click withdraw (see 5 below).

1. **Fix a recorded result** (`e845177`).
   - Admin shows the **Last result** under Now playing, with **Fix**: pick any finished match and enter the corrected score.
   - The rules live in `engine/src/correct.ts` (`planCorrection` / `applyCorrection`), with tests in `engine/test/correct.test.ts`:
     - A score-only fix always passes.
     - A flipped winner is swapped into the next matches, unless one of them has been played. Then it's refused with a plain-words reason, e.g. "MB5 has already been played with Zeutron in it".
     - A group or round-robin fix is refused once the knockout was drawn from a table it would reorder.
     - The server also refuses if a next-round match it would change is live.
   - Why it's needed: resolved players get pinned into their next match (the slot is cleared), so re-applying a result alone would leave the old winner there.
   - New `matches.resultAt` field (migration 500).
   - Reset also puts the TV back to Auto, since an old lock could point at a scene that doesn't exist.
2. **Event-day resilience** (`a5c4409`, `00f45e6`).
   - **Found and fixed a real bug:** if a refresh ran while the network was down, SvelteKit fell back to a full page load, stranding the TV on the browser's "not connected" page for good.
   - Now every refresh asks `/ping` (app server + PocketBase) first. Shared helper `liveUpdates()` in `lib/pbBrowser.ts`, used by the TV, admin and public pages.
   - The pages also refresh on realtime reconnect, on a heartbeat (TV 30s), and every 5s while down.
   - The TV shows a small "Reconnecting" mark bottom-left.
   - Tested: a browser dropout recovers about 4s after reconnecting; a PocketBase stop and restart recovers in under a second.
   - **Backups:** migration 600 turns on PocketBase backups every 10 minutes, keeps 20, and names the app "Beyfest". Confirmed: a zip appeared in `pb_data/backups`.
   - Admin's Danger zone has **Download results**, a JSON export via `/admin/export`, organiser only.
   - `scripts/rehearsal.ts [players] [secondsPerRound]` plays a whole tournament round by round through the real server. **It resets the database it talks to.**
   - README: new organiser workflow, plus "If something goes wrong" (restoring from a backup).
3. **Keep every round's finish** (`200598e`).
   - The round log (`liveLog`) is no longer wiped when a result is recorded.
   - A correction that changes the score clears it, since it would no longer add up.
   - Match centre keeps the finish pills on the Result screen.
   - New **Awards** TV scene: Knockout king, Dominator, Iron wall, Comeback.
     - It appears once 6 finished matches have a log (`computeAwards` / `loggedResults` in `view.ts`).
     - Ties of more than two are left out.
     - It's "so far" until the grand final.
4. **Let it rip** (`d9e4b4f`).
   - Admin's scorer has **Start match** before the first round, with Cancel start to undo a wrong tap. It stamps `matches.startedAt` (migration 700) via `/admin/start`.
   - `isLive()` counts started matches, so On now and Up next are right straight away. This also fixes known issue 2 whenever Start is used.
   - The TV cuts to the match and plays **3 · 2 · 1 · LET IT RIP!** with ゴーシュート: a black band plus keyed CSS animations, transform/opacity only, skipped for reduced motion.
   - The katakana subset was re-downloaded; its character list in `theme.css` now includes アワード and ゴーシュート.

5. **Walkovers, withdrawals and name fixes** (the latest commit).
   - **Walkover…** in the scorer asks who didn't show. The result is recorded as target–0 with `matches.walkover = true`. `recordWalkover` in `tournament.ts`.
   - A **Bladers** panel in admin (`BladersPanel.svelte`), shown at every stage:
     - **Rename** (names must stay unique).
     - **Withdraw** / **Bring back**, which sets `players.withdrawn`.
   - `autoWalkovers()` runs after every result, knockout generation and correction. It walks over any ready match with a withdrawn blader and repeats until none are left.
     - Tested: a withdrawn blader's remaining group matches, and later their Losers round-robin matches, all became walkovers by themselves.
   - "W/O" shows in the TV fixtures and bracket plates ("Walkover" in the header), on Match centre (a "Walkover" tag, no scores), on the Champion line, and in the admin fixtures and Last result bar.
   - Awards skip walkovers.
   - A walkover still counts as target–0 in the tables (points and point diff.).
   - Migration 800.

## Points to win (changed day 2, `aa2d2a3`)

The first-to-7 rule is decided in `pointsToWin()` in `engine/src/rules.ts`. It now looks at the **stage** first, not just the round's name. The user's reasoning: the 10-player Winners semi-finals and final are a bracket within the bracket, not real semi-finals.

- **9:** the Grand Final.
- **7:** the Mid bracket semi-final(s) and final (9–15 bladers). For 8 bladers, only the upper and lower bracket finals; the user chose this.
- **5:** everything else, including the 10-player Winners mini-bracket (WSF1, WSF2, WBF) and the 8-player semi-finals.

`engine/test/rules.test.ts` pins every match's target for every format. The public page's rule text follows the same rule. `bracket-and-tourney/tournament-spec.txt` still describes the old rule; the user's decision replaces it.

## How admin works now (step 4)

- **Layout** (built for a laptop, one match at a time):
  - A slim status row: stage tag, name, bladers, Log out.
  - Then **Now playing** (wide) beside a sidebar with **TV screen** and **Up next**.
  - Below: groups and fixtures (group stage), or round-robins and the bracket (knockout).
  - At the bottom, the **Danger zone** with Reset.
- **Now playing:**
  - Picks the match the organiser chose with "Score this", else the live one, else the next ready one in play order.
  - Recording a result moves it on by itself.
  - Once every group is done, it shows the big **Generate knockout bracket** button instead.
- **`RoundScorer`** is the Match centre build:
  - player slabs, gold/red finish buttons, the round log as pills
  - "Undo <finish> for <name>"
  - The finish buttons hide once the match is won, so **Record result** sits right under the cards.
  - Buttons only; the user said no keyboard shortcuts.
- **Shared components got the slab style.** The public page uses them too.
  - `GroupCard`: black header, a destination stripe per row, outlined chips until the group finishes, and a "Points" column, since points scored is the second tie-breaker.
  - `MiniRRTable`: plain words.
- **Bracket.** Admin reuses the TV's `BroadcastBracket` inside a 640px box. The old `Bracket`/`MatchCard` are now only used by the parked public page.
- **Shared helpers** in `view.ts`: `isLive`, `matchContext` (used by the TV too) and `groupsInWords` ("3 groups of 4").

## Phone view (step 5, parked)

The user said this is low priority: nobody is expected to look on their phone at the event. **Don't build it unless asked.** This is the audit and the agreed plan, ready for when it's needed.

### Audit (390px wide, mid-group and completed tournament)

Nothing overflows sideways, but:

- **Header:** "BEYFEST 2026" wraps onto two lines and "Triple Threat" is squashed against the nav. The nav shows Display / TV / Organiser, which spectators don't need.
- **Nothing live:** no live match, score, finishes or "Next up" anywhere. That's the main reason anyone would open it.
- **The rules come first:** three rule boxes sit above the standings and push them a screen down.
- **Wording doesn't match the TV:**
  - The meta line says "4 / 4 / 4 groups"; it should say "3 groups of 4".
  - It says "players"; the TV says "bladers".
  - Bracket columns use raw labels ("PHASE 1A — WB MINI-RR") instead of `roundName()`. `MiniRRTable` also uses "WB-1ST" seeds and "Winners Mini-RR".
- **Knockout:** `Bracket.svelte` is a sideways-scrolling row of columns and shows about two at a time on a phone.
- **Groups:** no fixture list; the TV shows it.
- **Style:** the old rounded dark cards and faint pill chips, not the slab style. The files are `routes/+page.svelte`, `routes/+layout.svelte` (header), `GroupCard`, `MiniRRTable`, `Bracket` and `MatchCard`.

### Agreed plan

The user chose **one scrolling page** (no tabs) and **only an Organiser link, in the footer**.

The page, top to bottom:

1. **Slim header:** the BEYFEST slab plus katakana only. The Organiser link goes to a small footer link.
2. **On now:** the live match as a slab with names, score, finish pills and "First to N", plus Next up. After the grand final it becomes the gold champion slab.
3. **Groups:** white slabs with the standings (W–L, Point diff., Goes to), with fixtures underneath like the TV.
4. **Mini round-robins:** the same slab style, with green and red headers.
5. **Knockout:** on phones, a vertical list of rounds with `roundName()` headings. Each match is a compact row with scores, coloured by bracket. Wide screens can keep columns.
6. **How it works:** the rules, moved to the bottom.

Suggested commits: (a) header and footer, (b) On now, (c) group slabs with fixtures, (d) round-robins, (e) phone knockout list, (f) wording and rules. Reuse the TV's helpers from `view.ts` (`roundName`, `slotLabel`, `groupStandings`, `miniRRStandings`) and its finish-pill markup.

A screenshot helper for this is worth recreating: puppeteer at 390×844 with `isMobile`, a full-page shot, and a log of `scrollWidth - innerWidth` to catch sideways overflow.

## Running it for development

From `tournament-app/`:

```sh
# PocketBase (use a throwaway data dir so real data in pb/pb_data isn't touched)
pb/pocketbase.exe serve --http=127.0.0.1:8090 --dir=<some temp dir> --migrationsDir=pb/pb_migrations

# Web app (hot reload), in another terminal
cd web && bun run dev          # http://localhost:5173  (/tv, /admin, /)
```

- Migrations only run when PocketBase **starts**, so restart it after adding one.
- A fresh data dir gets the organiser login from the seed migration.
- Checks: `bun run check` (in `web`) and `bun run test` (in `tournament-app`, 47 engine tests).

### Sample data scripts (they talk to 127.0.0.1:8090)

| Command | What it gives you |
|---|---|
| `bun run scripts/midgroup.ts <players> <played>` | Group stage part-played, next match live at 3–2 |
| `bun run scripts/midgroup.ts <players> 999` then `bun run scripts/advance.ts` | Completed tournament of any size |
| `bun run scripts/sample.ts setup` then `bun run scripts/advance.ts` | Completed 12-player tournament |
| `bun run scripts/fresh.ts <players>` | Unplayed group stage |

- Checking screens: screenshot `/tv` at 1920×1080 in headless Edge with `puppeteer-core` (press 1–5 to switch scenes). **Wait for `load`, not `networkidle0`**; the realtime connection never goes idle.

## Gotchas learned the hard way

- **Katakana font subset:** `web/static/fonts/zenkaku_kana.woff2` contains *only* the characters listed in the `theme.css` header. New Japanese text needs the subset re-downloaded (Google Fonts css2 `text=` parameter).
- **`@font-face` descriptors must match** across all faces of "Beyfest Display" (including `font-stretch`). Otherwise the browser picks the kana face at normal width and the Latin text falls back to plain Saira.
- Slanted slabs use `transform: skewX()` rather than `clip-path`, so borders and hard shadows survive. Counter-skew the text inside.
- Long multi-line Python heredocs in the Bash tool can break on quoting; write the script to a file and run it instead.

## Public website (separate from the app)

- `public-site/` is the static event site, hosted on **Netlify** at https://beyfest.com. The date (November 7, 2026) and the "Innishannon" spelling are live.
- The Netlify CLI is logged in on this machine (`npx netlify-cli`), but the folder **isn't linked to the site yet**. Link it (`netlify link`), then deploy with `netlify deploy --dir public-site --prod`. **Always confirm with the user before deploying.**
