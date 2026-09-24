# Handover: tournament app redesign

Written 24 September 2026, end of day 1. Read this first, then `CLAUDE.md`.

## Where things stand

The tournament app (`tournament-app/`) is being redesigned because the old look read as AI-generated. The **TV screens are finished**. The admin and public pages have the new fonts and colours but their old layouts.

All work is on branch **`redesign/tournament-app`**. `main` is still the untouched baseline and **nothing has been merged yet**. The working tree is clean.

| Step | What | Status |
|---|---|---|
| 1 | Design foundation (fonts, colours, no photo/glow/emoji) | Done |
| 2 | Rebuild all 6 TV scenes | Done |
| 3 | TV control: auto-rotate, cut to live scores, admin lock | Done |
| – | Match centre round-win animation | Done |
| – | Bracket lines no longer hidden behind cards | Done |
| 4 | Admin redesign for the Mac | **On hold**: waiting until there's a Mac to test on |
| 5 | Public display (`/`) for phones | Not started |
| 6 | Mac + Pi launchers | Not started |

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

## Known issues / to do

1. **The scorer resets on reload (fix in step 4).** `RoundScorer.svelte` keeps the round log only in browser state. Reloading the admin page mid-match shows 0–0, and the next tap overwrites the live score **and** `liveLog`. Fix: start it from `match.liveP1`/`liveP2`/`liveLog`.
2. Step 4 admin redesign ideas from the audit:
   - A "now playing" scorer instead of every playable match stacked (18 cards at the start).
   - Move **Reset tournament** away from Log out.
   - Apply the slab style.
3. Step 5 public display:
   - The header wraps and overlaps on phones.
   - The meta line reads "4 / 4 / 4 groups"; it should say "3 groups of 4".
   - The page says "players" while the TV says "bladers".
   - It doesn't show finishes.
4. Step 6: `start.ps1` and `pb/pocketbase.exe` are **Windows-only**. The Mac needs the macOS PocketBase build plus a `start.sh`. The Pi needs the arm64 build, or just Chromium in kiosk mode pointing at the Mac. Document both in the README.
5. 8-player (double-elimination) bracket:
   - Its round headings aren't covered by `roundName()` yet ("UPPER BRACKET — QUARTERFINALS").
   - Its first two column gaps have a dense bundle of lines.
6. For the first ~250ms, the round-win slab overlaps the LIVE status line on Match centre.
7. Before the event, change the default logins: organiser `organiser@beyfest.local` / `beyfest2026`, and PocketBase superuser `admin@beyfest.local` / `beyfestadmin2026`. They're in the seed migration and README.
8. `svelte.config.js` shows a deprecation warning for `csrf.checkOrigin`; it predates the redesign and is harmless for now.

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
