# Handover: tournament app redesign

Written 24 September 2026 (day 1), rewritten at the end of day 2. Read this first, then `CLAUDE.md`.

## Where things stand

The tournament app (`tournament-app/`) is being redesigned because the old look read as AI-generated.

- **The TV and admin are finished** and tested in Edge on Windows. Admin hasn't been tried on a real Mac yet.
- **All five event-day improvements the user picked are built:** fix a result, resilience, finish stats and awards, Let it rip, and walkovers/withdraw/rename. See "Day 2 improvements".
- The **points-to-win rule** was corrected; see "Points to win".
- **Parked by the user:** step 5, the public page for phones (plan ready below).
- **Step 6, the Mac and Pi launchers, is written** (day 3) but **untested on real hardware**. See known issue 3.

All work is on branch **`redesign/tournament-app`**. `main` is still the untouched baseline and **nothing has been merged yet**. At the end of day 2 the working tree was clean.

| Step | What | Status |
|---|---|---|
| 1 | Design foundation (fonts, colours, no photo/glow/emoji) | Done |
| 2 | Rebuild all TV scenes | Done |
| 3 | TV control: auto-rotate, cut to live scores, admin lock | Done |
| – | Match centre round-win animation, bracket line routing | Done |
| 4 | Admin redesign | Done (day 2). Still to check on a real Mac |
| 5 | Public display (`/`) for phones | **Parked (low priority).** Audit and plan under "Phone view" |
| 6 | Mac + Pi launchers | Written day 3: `start.sh`, `start.command`, `scripts/pi-kiosk.sh`. Tested in WSL Ubuntu only |
| – | Day 2 improvements 1–5 | Done |
| – | Points to win: first to 7 only on the main path | Done |

### Commits on `redesign/tournament-app` (oldest first)

```
de55722 move public website into public-site folder
fddda3b tournament app: new design foundation (fonts, colours, no photo/glow/emoji)
5b24596 tournament app: swap display font to Saira Black Italic
e12dfce tv: rebuild group stage scene, add on-now band, remove bracket corner ticks
0c7eb25 tv: rebuild match centre as a face-off, plain-words round names
d4aee44 tv: bracket match plates as white slabs, plain-words round and slot names
8ef7337 tv: rebuild mini round-robins scene on the group slabs
9a05a51 tv: champion and standby scenes with the big gold slab, event date in config
ebd2b7b fix group standings counting knockout rematches between group-mates
5cf952e tv: auto rotation, cut to match centre on score changes, admin can lock the TV scene
c559fdf tv bracket: route column-skipping lines through clear corridors so they never pass behind cards
c15e1a8 tv match centre: animated round-win call-out that settles as a finish pill; store round log
── day 2 ──
517f47a tv champion: pad the name slab so the italic last letter isn't clipped
825f6f7 group tables: label the +/- column "Point diff."
567884d tv match centre: keep a finish pill for every round won, winner chip in the pill row
2cf940a admin scorer: start from the saved live score so a reload doesn't reset to 0-0
aacec63 admin: one Now playing scorer in the TV slab style, with an Up next queue
29d4250 admin: slim status header, TV control in the sidebar, champion slab, reset moved to a danger zone
966bc51 admin: group tables as white slabs, two-column fixtures marking Now playing, generate-knockout button in Now playing
7e689ce admin knockout: round-robin tables as slabs in plain words, the TV bracket scaled into a box
564f087 admin: new-tournament form and login as slabs, group sizes in plain words
b5aa719 first to 7 only on the main path: Mid bracket semis and final, or the 8-player bracket finals
f7d9f5d admin: fix a recorded result, re-routing the next round when the winner changes
9f85f30 tv/admin/public: heal after a dropout instead of stranding on the browser's offline page
336662b event-day safety: backups every 10 minutes, results download, rehearsal script
72b64fb keep every round's finish: Result recap pills and a TV Awards scene
3f64e6a Start match: the TV cuts in with a 3·2·1 LET IT RIP countdown
96a84d4 walkovers, withdrawals and name fixes
```
(handover-only commits left out)

Two commits could go onto `main` by themselves before the redesign merges, if wanted:
- `ebd2b7b`: a real bug fix. Group tables counted knockout rematches between group-mates.
- `b5aa719`: the points-to-win rule fix.

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

- **Scenes:** standby, groups, rr, bracket, spotlight (Match centre), awards, champion. `availableScenes()` in `view.ts` decides which exist; the TV and the admin TV panel both use it.
- **Which scene shows** (first rule that applies wins):
  1. a key pressed at the TV (holds 60s)
  2. the admin's lock
  3. a score changed, a result went in, or a match was started: Match centre on that match for 20s
  4. auto rotation: groups 25s, rr 20s, bracket 25s, spotlight 15s, awards 20s, champion 30s

  The logic is in `web/src/routes/tv/+page.svelte`.
- **Admin control:** the "TV screen" panel writes the `tv_state` record (migration 300), and the TV follows it live. Reset puts it back to Auto.
- **Round log:** `matches.liveLog` is a list of `{who, finish}` (migration 400). It drives the round-win call-out and the finish pills, and it's kept after the match for the Result recap and Awards.
- **Start match:** stamps `matches.startedAt` (migration 700), which cues the launch countdown.
- **Live updates:** all three pages use `liveUpdates()` from `lib/pbBrowser.ts`, which checks `/ping` before every refresh. The TV shows a "Reconnecting" mark bottom-left while it can't reach the server.

## Start here next session

Nothing is half-done. Ask the user what's next. Candidates, most useful first:

1. **A dress rehearsal on the real hardware**, whenever the Mac and the TV (and Pi) are available.
   - Run `scripts/rehearsal.ts` against a **test** data folder; it resets the database it talks to.
   - Watch the TV through a whole event, and pull the network cable once to see it recover.
2. **Try the Pi installer on the real Pi** (README "On a Raspberry Pi"). Include the wifi: add the home network during install, then switch the router off (or take the Pi out of range) and check that the "Beyfest" hotspot appears after about a minute, the Mac can join it, `http://beyfest.local/admin` opens, and the TV standby shows the hint. `beyfest-wifi auto` then goes back. Then also try the Mac launcher (README "On a Mac (backup setup)"). See known issue 3.
3. **Before the event:** change the default logins (known issue 7). Then merge the branch into `main` and tag it.
4. **Smaller polish:**
   - the 8-player bracket headings and lines (known issue 4)
   - the call-out overlapping LIVE for its first moments (known issue 5)
5. **Step 5, the phone view:** only if the user asks.

Day 1's end-of-day items are all done: champion name clipping `517f47a`, "Point diff." header `825f6f7`, and one finish pill per round `567884d`.

## Known issues / to do

1. **"Score this" and the TV.** If the organiser picks a match with "Score this" but doesn't press **Start match**, the TV's "Up next" shows the default next match until the first point. Using Start avoids it.
2. **Step 5,** the public display: parked. See "Phone view" below.
3. **Step 6, launchers (written day 3, not yet run on a Mac or Pi).**
   - `start.sh` (+ `start.command` for double-click) is the macOS/Linux twin of `start.ps1`. On first run it downloads PocketBase 0.40.4 for the OS/CPU into `pb/pocketbase` (gitignored), runs `bun install` and the build, and on a fresh `pb_data` creates the default superuser. It prints the LAN addresses (override with `BEYFEST_IP`).
   - Day 3: the launchers no longer set `PUBLIC_PB_URL`. The browser now uses port 8090 on whatever host served the page (`browserPbUrl()` in `web/src/lib/config.ts`), and the server always uses 127.0.0.1. So an IP change, `beyfest.local` or the Pi's hotspot all just work. Checked in headless Edge: the TV opened via 10.0.1.15 connects realtime to 10.0.1.15:8090, and via localhost to localhost:8090.
   - `scripts/pi-kiosk.sh [--install] [host]` waits for `/ping`, then opens `/tv` in Chromium kiosk mode; `--install` adds an XDG autostart entry.
   - Tested in WSL Ubuntu (x86_64): first-run download/install/build, both logins, LAN address, Ctrl+C and SIGTERM stopping both servers, kiosk wait and launch (with a stub Chromium).
   - **Not tested:** the macOS IP detection (`route`/`ipconfig getifaddr`), Gatekeeper and firewall prompts, the arm64 builds, real Chromium on the Pi, and whether labwc on the Pi honours the XDG autostart entry.
   - `.gitattributes` forces LF on `*.sh`/`*.command`, and git stores them as executable.
   - **Pi installer (day 3):** `tournament-app/install-pi.sh`, run as `curl … | bash` (the URL is in the README). The Pi is now the **main setup**: it runs everything, and the Mac is only an admin browser; the Mac launcher is the backup.
     - It puts the app in `/opt/beyfest/app` and the data in `/opt/beyfest/data`, and keeps the last app as `app.previous`.
     - Services `beyfest-pb` and `beyfest-web` (port 80, via `CAP_NET_BIND_SERVICE`), with `Restart=always`, run as the installing user.
     - Passwords are asked on the first install or with `--passwords`. The organiser password is set through the PocketBase API as the superuser. There's also `--no-kiosk`.
     - It uses raspi-config for the hostname `beyfest`, desktop auto-login (B4) and blanking off, plus a kiosk XDG autostart entry. It installs `nodejs`, `avahi-daemon` and `chromium` or `chromium-browser`, whichever has an installable version.
     - `BEYFEST_CHANNEL` picks the release (default `redesign-tournament-app`; switch the default to `main` after merging). `BEYFEST_PKG_URL` overrides it, for testing.
     - Tested in a throwaway Debian 13 WSL distro with systemd, using an amd64 package: first install (password checks: short and mismatch), pages on port 80, new passwords work and old ones are refused, an update keeps the data, no prompts on update, kill -9 recovery, `--passwords`, `--no-kiosk`, starting at boot, and the kiosk on :80.
     - **Not tested:** real Raspberry Pi OS (raspi-config steps), a Pi 3's speed and memory with Chromium, whether the labwc/wayfire session runs the XDG autostart entry, and `beyfest.local` from the Mac.
   - **Wifi + hotspot fallback (day 3):** `scripts/beyfest-wifi.sh` (linked as the `beyfest-wifi` command), using NetworkManager/nmcli.
     - Networks added by the installer (first install or `--wifi`) or with `beyfest-wifi add` become NM profiles `beyfest-wifi-<ssid>` (autoconnect, priority 10).
     - `beyfest-hotspot` is an AP-mode profile: SSID "Beyfest", 2.4 GHz, WPA2/CCMP, `ipv4.method shared` (dnsmasq-base), autoconnect off.
     - `beyfest-network.service` (root) runs `beyfest-wifi.sh watch`. Every 10s it writes `/run/beyfest/network.json` and brings the hotspot up after ~60s with no connected wifi or ethernet. It never leaves the hotspot by itself (`beyfest-wifi auto` does).
     - The web service gets `BEYFEST_NETWORK_FILE`; `web/src/lib/server/network.ts` reads it, and the TV standby shows "Join wifi X · Live results beyfest.local (ip) · Organiser beyfest.local/admin", or "On the venue network" on a cable. No file (Windows/Mac/dev) means nothing is shown.
     - The installer sets the wifi country to IE if it's empty. Added `@types/node` (dev) to web.
     - Tested in a throwaway Debian 13 + NetworkManager WSL distro, with no wifi chip (`BEYFEST_WIFI_DEVICE=wlan0` override): the installer's wifi prompts, profile settings, open vs WPA networks, list/remove/status and the error paths, the watcher's fallback attempt after ~60s, ethernet mode on the TV, an update keeping the profiles, and all 3 services after a restart. The TV hint was screenshotted in headless Edge at 1920×1080.
     - **Not tested:** the hotspot actually broadcasting on a Pi 3 and a Mac/phone joining it and resolving beyfest.local; joining real venue wifi.
   - **Pi package (day 3):** `.github/workflows/pi-package.yml` runs `tournament-app/scripts/pi-package.sh` on every push to `main` or `redesign/tournament-app`. That runs the tests, builds, and bundles `beyfest-pi-arm64.tar.gz` (built app + the `pocketbase` SDK, the only runtime package, + PocketBase linux-arm64 + migrations + start.sh + VERSION). It's published as a rolling prerelease tagged `pi-<branch>`, e.g. `pi-redesign-tournament-app`. Tested in WSL: it runs from the package with Node 18 alone (the Raspberry Pi OS version, no Bun). `start.sh` now needs Bun only to install or build.
4. **The 8-player (double-elimination) bracket:**
   - Its round headings aren't covered by `roundName()` yet ("UPPER BRACKET — QUARTERFINALS").
   - Its first two column gaps have a dense bundle of lines.
5. For the first ~250ms, the round-win slab overlaps the LIVE status line on Match centre.
6. **Sample data mismatch.** `midgroup.ts` sets a live score **without** a round log, so admin's scorer shows 0–0 for that match while the TV shows 3–2. This only happens with sample data; the real scorer always writes both.
7. **Before the event, change the default logins:**
   - organiser `organiser@beyfest.local` / `beyfest2026`
   - PocketBase superuser `admin@beyfest.local` / `beyfestadmin2026`

   They're in the seed migration and the README.
8. `svelte.config.js` shows a deprecation warning for `csrf.checkOrigin`. It predates the redesign and is harmless for now.

## Day 2 improvements (five suggestions, all built at the user's request)

The five suggestions were: 1 fix a result, 2 finish stats, 3 Let it rip, 4 resilience, 5 walkovers and name fixes. All five are built; 5 came last, including a one-click withdraw (see 5 below).

1. **Fix a recorded result** (`f7d9f5d`).
   - Admin shows the **Last result** under Now playing, with **Fix**: pick any finished match and enter the corrected score.
   - The rules live in `engine/src/correct.ts` (`planCorrection` / `applyCorrection`), with tests in `engine/test/correct.test.ts`:
     - A score-only fix always passes.
     - A flipped winner is swapped into the next matches, unless one of them has been played. Then it's refused with a plain-words reason, e.g. "MB5 has already been played with Zeutron in it".
     - A group or round-robin fix is refused once the knockout was drawn from a table it would reorder.
     - The server also refuses if a next-round match it would change is live.
   - Why it's needed: resolved players get pinned into their next match (the slot is cleared), so re-applying a result alone would leave the old winner there.
   - New `matches.resultAt` field (migration 500).
   - Reset also puts the TV back to Auto, since an old lock could point at a scene that doesn't exist.
2. **Event-day resilience** (`9f85f30`, `336662b`).
   - **Found and fixed a real bug:** if a refresh ran while the network was down, SvelteKit fell back to a full page load, stranding the TV on the browser's "not connected" page for good.
   - Now every refresh asks `/ping` (app server + PocketBase) first. Shared helper `liveUpdates()` in `lib/pbBrowser.ts`, used by the TV, admin and public pages.
   - The pages also refresh on realtime reconnect, on a heartbeat (TV 30s), and every 5s while down.
   - The TV shows a small "Reconnecting" mark bottom-left.
   - Tested: a browser dropout recovers about 4s after reconnecting; a PocketBase stop and restart recovers in under a second.
   - **Backups:** migration 600 turns on PocketBase backups every 10 minutes, keeps 20, and names the app "Beyfest". Confirmed: a zip appeared in `pb_data/backups`.
   - Admin's Danger zone has **Download results**, a JSON export via `/admin/export`, organiser only.
   - `scripts/rehearsal.ts [players] [secondsPerRound]` plays a whole tournament round by round through the real server. **It resets the database it talks to.**
   - README: new organiser workflow, plus "If something goes wrong" (restoring from a backup).
3. **Keep every round's finish** (`72b64fb`).
   - The round log (`liveLog`) is no longer wiped when a result is recorded.
   - A correction that changes the score clears it, since it would no longer add up.
   - Match centre keeps the finish pills on the Result screen.
   - New **Awards** TV scene: Knockout king, Dominator, Iron wall, Comeback.
     - It appears once 6 finished matches have a log (`computeAwards` / `loggedResults` in `view.ts`).
     - Ties of more than two are left out.
     - It's "so far" until the grand final.
4. **Let it rip** (`3f64e6a`).
   - Admin's scorer has **Start match** before the first round, with Cancel start to undo a wrong tap. It stamps `matches.startedAt` (migration 700) via `/admin/start`.
   - `isLive()` counts started matches, so On now and Up next are right straight away. This also fixes known issue 1 whenever Start is used.
   - The TV cuts to the match and plays **3 · 2 · 1 · LET IT RIP!** with ゴーシュート: a black band plus keyed CSS animations, transform/opacity only, skipped for reduced motion.
   - The katakana subset was re-downloaded; its character list in `theme.css` now includes アワード and ゴーシュート.

5. **Walkovers, withdrawals and name fixes** (`96a84d4`).
   - **Walkover…** in the scorer asks who didn't show. The result is recorded as target–0 with `matches.walkover = true`. `recordWalkover` in `tournament.ts`.
   - A **Bladers** panel in admin (`BladersPanel.svelte`), shown at every stage:
     - **Rename** (names must stay unique).
     - **Withdraw** / **Bring back**, which sets `players.withdrawn`.
   - `autoWalkovers()` runs after every result, knockout generation and correction. It walks over any ready match with a withdrawn blader and repeats until none are left.
     - Tested: a withdrawn blader's remaining group matches, and later their Losers round-robin matches, all became walkovers by themselves.
   - "W/O" shows in the TV fixtures and bracket plates ("Walkover" in the header), on Match centre (a "Walkover" tag, no scores), on the Champion line, and in the admin fixtures and Last result bar.
   - Awards skip walkovers.
   - Day 3, the user's choice: a walkover counts as a **win with no points** in the tables (the match is still stored as target–0). `computeStandings` skips points when `match.walkover`, a Fix turns it into a played result, and it's pinned by `engine/test/walkover.test.ts`.
   - Migration 800.

## Points to win (changed day 2, `b5aa719`)

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
- Checks: `bun run check` (in `web`) and `bun run test` (in `tournament-app`, 75 engine tests).
- A throwaway data dir has no superuser. To check settings (e.g. backups), add one: `pb/pocketbase.exe superuser upsert admin@beyfest.local beyfestadmin2026 --dir=<that dir>`.

### Sample data scripts (they talk to 127.0.0.1:8090)

| Command | What it gives you |
|---|---|
| `bun run scripts/midgroup.ts <players> <played>` | Group stage part-played, next match live at 3–2 |
| `bun run scripts/midgroup.ts <players> 999` then `bun run scripts/advance.ts` | Completed tournament of any size |
| `bun run scripts/sample.ts setup` then `bun run scripts/advance.ts` | Completed 12-player tournament |
| `bun run scripts/fresh.ts <players>` | Unplayed group stage |
| `bun run scripts/rehearsal.ts <players> <secondsPerRound>` | A whole tournament played round by round, live on the TV (**resets the database**) |

- **Checking screens:** screenshot `/tv` at 1920×1080 and `/admin` at 1440×900 in headless Edge with `puppeteer-core` (press 1–7 on the TV to switch scenes). **Wait for `load`, not `networkidle0`**; the realtime connection never goes idle.
- **Testing a dropout:** `page.setOfflineMode(true)` does **not** close the realtime connection, so the "Reconnecting" mark only appears at the next heartbeat (≤30s). Stopping PocketBase triggers it immediately.

## Gotchas learned the hard way

- **Katakana font subset:** `web/static/fonts/zenkaku_kana.woff2` contains *only* the characters listed in the `theme.css` header. New Japanese text needs the subset re-downloaded (Google Fonts css2 `text=` parameter).
- **`@font-face` descriptors must match** across all faces of "Beyfest Display" (including `font-stretch`). Otherwise the browser picks the kana face at normal width and the Latin text falls back to plain Saira.
- Slanted slabs use `transform: skewX()` rather than `clip-path`, so borders and hard shadows survive. Counter-skew the text inside.
- **Python heredocs.** Long multi-line ones in the Bash tool can break on quoting, and `\n` inside them can turn into real newlines. Write the script to a file and run it instead.
- **Imports in `lib/server/tournament.ts`.** The scripts import it directly with Bun, outside SvelteKit, so it must not use `$lib/...` imports; use relative paths.
- **Resolved slots are pinned.** Once a result resolves, the engine writes the player into the next match and clears the slot. Changing a past result therefore needs `applyCorrection` (it re-pins); re-running `applyResult` alone would leave the old winner in place.
- **SvelteKit offline trap.** If `invalidateAll()` fails for network reasons, SvelteKit does a full page load. With no network that strands the browser on its own offline page, and nothing on our page runs to recover. That's why every refresh goes through `/ping` first.
- **PocketBase 0.40 backups.** The backups API is superuser-only; the organiser login can't use it. Scheduled backups are set by migration 600.

## Public website (separate from the app)

- `public-site/` is the static event site, hosted on **Netlify** at https://beyfest.com. The date (November 7, 2026) and the "Innishannon" spelling are live.
- The Netlify CLI is logged in on this machine (`npx netlify-cli`), but the folder **isn't linked to the site yet**. Link it (`netlify link`), then deploy with `netlify deploy --dir public-site --prod`. **Always confirm with the user before deploying.**
