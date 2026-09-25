# Handover: Beyfest tournament app

Rewritten at the end of day 3 (25 September 2026). Read this first, then `CLAUDE.md` and `tournament-app/README.md`. The event is **7 November 2026** in Innishannon.

## Where things stand

- **Everything is merged into `main`** (merge commit `856782b`, PR #1). Work from `main`, on a new branch per task; don't commit to `main` directly. The old `redesign/tournament-app` branch is finished.
- **The repo is public:** https://github.com/trendykendy/beyfest2026. Its history was rewritten on day 3 (before the first push) to drop deleted images and `refimages/`. All commit IDs in this file are the new ones.
- **The app is feature-complete for the event:**
  - the redesign (TV, admin)
  - the day 2 event-day features
  - day 3's polish
- **The Raspberry Pi is the main setup.** It runs the app, the database and the TV screen. The organiser uses admin from the Mac (or any device) at `http://beyfest.local/admin`. The Mac (`start.sh`) and Windows (`start.ps1`) launchers are the backups.
- **None of the Pi or Mac setup has run on real hardware yet.** It was tested in throwaway Debian/Ubuntu systems in WSL. That test is the next job.
- **Nothing is half-done.** GitHub's `pi-main` package is built from `856782b`.

| Area | Status |
|---|---|
| Design, TV scenes, TV control, admin redesign | Done |
| Day 2 event-day features (fix a result, resilience, awards, Let it rip, walkovers) | Done |
| Pi installer, Pi package, wifi + hotspot fallback | Done. **Needs the real-Pi test** |
| Mac / Windows launchers (backup) | Done. Mac untested on a real Mac |
| Day 3 polish (the old known-issues list) | Done |
| Phone view of the public page (`/`) | **Parked** by the user (low priority); plan under "Phone view" |
| Version tag | Not yet: tag whatever passes the Pi test |

## Start here tomorrow

Ask the user whether the Pi is available. If it is, walk them through this (full instructions in the README, "On a Raspberry Pi"):

1. **Flash the SD card** with Raspberry Pi Imager: **Raspberry Pi OS (64-bit) with desktop**. Set a username, and enable SSH if they want to run it from the Mac. The user thinks it's a Pi 3 (memory unknown).
2. **Run the installer** in a terminal on the Pi:
   `curl -fsSL https://raw.githubusercontent.com/trendykendy/beyfest2026/main/tournament-app/install-pi.sh | bash`
   - Choose the passwords, add the home wifi, and set a hotspot password. Say yes to the restart.
3. **After the restart,** check:
   - The TV comes up full-screen by itself.
   - `http://beyfest.local/admin` opens from the Mac.
   - The standby screen shows the "Join wifi / Live results / Organiser" line.
4. **Hotspot test:**
   - Switch the router off (or take the Pi out of range). After about a minute a "Beyfest" wifi should appear.
   - The Mac joins it. `beyfest.local/admin` opens (or `http://10.42.0.1/admin`), and the TV hint changes to "Join wifi Beyfest".
   - `beyfest-wifi auto` goes back to the home wifi.
5. **Rehearsal:** play a tournament through (by hand, or `scripts/rehearsal.ts` against a **test** database, since it resets whatever it talks to). Watch whether the Pi 3 keeps up with Chromium. Pull the network once to see the TV's "Reconnecting" mark and recovery.
6. **If it all passes:** tag it (`git tag v1.0 && git push --tags`) so there's a known-good version for the day.

**Likely snags on the real Pi, and where to look:**
- **The TV doesn't open at login.** The kiosk uses an XDG autostart entry (`~/.config/autostart/beyfest-tv.desktop`), and it's unconfirmed whether the Pi's labwc/wayfire session runs it. The fallback is labwc's own autostart file.
- **Wifi or the hotspot does nothing.** Check `beyfest-wifi status`, `journalctl -u beyfest-network`, and that a wifi country is set (the installer sets IE if it's empty).
- **The app doesn't answer.** Run `systemctl status beyfest-web beyfest-pb` and `journalctl -u beyfest-web -u beyfest-pb -n 50`.
- **A Pi 3 is too slow with Chromium.** Options: a Pi 4, or the Mac runs the app and the Pi is only the TV (`pi-kiosk.sh --install <mac>.local`).

If the Pi isn't available, candidates: the phone view (only if the user asks), or anything the user brings.

## How the event setup works (day 3)

**The Pi installer, `tournament-app/install-pi.sh`,** is run as `curl … | bash`. Its questions are read from `/dev/tty`.
- **Folders:** the app lives in `/opt/beyfest/app`, which is replaced on every update, with the previous one kept as `app.previous`. The data and backups live in `/opt/beyfest/data`, which is never touched.
- **Services:**
  - `beyfest-pb`: PocketBase on :8090.
  - `beyfest-web`: Node on **port 80**, via `CAP_NET_BIND_SERVICE`.
  - `beyfest-network`: the wifi watcher, running as root.
  - All three restart themselves if they crash. The first two run as the installing user.
- **Passwords:** asked on the first install, or with `--passwords`. The organiser password is set through the PocketBase API as the superuser.
- **Pi settings,** through raspi-config:
  - hostname `beyfest`
  - desktop auto-login (B4)
  - blanking off
  - wifi country IE if it's unset
  - plus the kiosk autostart entry
- **Options:** `--passwords`, `--wifi`, `--no-kiosk`. `BEYFEST_CHANNEL` picks the release (default `main`). `BEYFEST_PKG_URL` overrides the download, for testing.
- **Updating:** run the same command again. It keeps the data, the wifi profiles and the passwords, and offers a restart so the TV loads the new code.

**The Pi package:** `.github/workflows/pi-package.yml` runs `tournament-app/scripts/pi-package.sh` on every push to `main`.
- It runs the tests, builds, and bundles `beyfest-pi-arm64.tar.gz`, containing:
  - the built app, plus the `pocketbase` SDK, its only runtime package
  - PocketBase linux-arm64
  - the migrations
  - `start.sh`, `pi-kiosk.sh`, `beyfest-wifi.sh`, `scripts/set-organiser-password.mjs`
  - `VERSION`
- It's published as the rolling prerelease `pi-main`. The Pi only needs Node from Raspberry Pi OS, with no Bun and no build (a Pi 3 can't build).
- `pi-package.sh` copies the SDK with `cp -L` because Bun stores it as a symlink.

**Wifi, `scripts/beyfest-wifi.sh`** (the `beyfest-wifi` command), using NetworkManager:
- **Known networks:** NM profiles named `beyfest-wifi-<ssid>`, with autoconnect at priority 10.
- **The hotspot:** `beyfest-hotspot`, in access-point mode. SSID "Beyfest", 2.4 GHz, WPA2/CCMP, shared IPv4 (address 10.42.0.1), autoconnect off.
- **The watcher** (`watch`, run by the service):
  - Every 10s it writes `/run/beyfest/network.json`.
  - It starts the hotspot after ~60s with no wifi or cable.
  - It never leaves the hotspot by itself; `beyfest-wifi auto` does.
- **The TV hint:** the web service reads that file through `BEYFEST_NETWORK_FILE` (`web/src/lib/server/network.ts`), and the TV standby shows the join line. Off the Pi there's no file, so nothing is shown.

**Addresses:**
- The browser connects to PocketBase at port 8090 on whatever host served the page (`browserPbUrl()` in `web/src/lib/config.ts`). The server always uses 127.0.0.1.
- So an IP change, `beyfest.local` or the hotspot all work without setting `PUBLIC_PB_URL`, which is now only an override.

**Backup launchers:** `start.sh` (+ `start.command` to double-click on the Mac) and `start.ps1` (Windows).
- On a new database they ask for the passwords (`scripts/set-organiser-password.mjs` sets the organiser's). With no keyboard, they keep the dev defaults and warn in the banner.
- `start.sh` downloads the right PocketBase on first run, and needs Bun only to install or build.
- `pi-kiosk.sh --install <mac>.local` makes a Pi into just the TV for a Mac-hosted app.
- `.gitattributes` keeps `*.sh`/`*.command` LF, and git stores them as executable.

## Still untested / open

- **On a real Pi:**
  - the raspi-config steps
  - the kiosk autostart under labwc/wayfire
  - Chromium's speed and memory on a Pi 3
  - the hotspot broadcasting, and a Mac or phone joining it
  - `beyfest.local` from the Mac
  - joining real venue wifi
- **On a real Mac:**
  - `start.sh`'s IP detection (`route`/`ipconfig getifaddr`)
  - the Gatekeeper and firewall prompts
  - the admin page in Safari
- **Duplicated code:** the installer has its own copy of the organiser-password code (the same logic as `scripts/set-organiser-password.mjs`). It could use the shared script now that it's in the package; left alone because the installer's version is tested.
- **Android and `.local`:** older Android phones may not resolve `.local` names. The TV hint shows the IP as well.

## Day 3 commits (on `main`)

```
e9b1478 Mac and Pi launchers: start.sh, start.command, pi-kiosk.sh
cfa55b5 browser finds PocketBase from the page's own address
70fcb9e GitHub builds a ready-to-run Pi package on every push
6bfc852 Raspberry Pi installer: install-pi.sh
02f8983 Pi wifi: known networks, fallback hotspot, network hint on the TV
983441d walkovers: a win with no points in the tables
8b849d8 svelte config: trustedOrigins instead of deprecated checkOrigin
cb3402b TV: 8-player bracket as upper and lower rows, with proper round names
d145844 TV: finish call-out never covers the LIVE line
fc75bf2 "Score this" tells the TV: Up next shows the picked match
ee09477 sample data: live match has a round log matching its score
66811f8 launchers ask for passwords on a new database, like the Pi installer
2e7d0ee point the installer, README and Pi package at main
856782b Merge: tournament app redesign, Raspberry Pi setup and event-day features
```

**Day 3 fixes, in detail:**
1. **Walkovers** count as a **win with no points** in the tables (the user's choice). The match is still stored as target–0. `computeStandings` skips points when `match.walkover`, a Fix turns it into a played result, and `engine/test/walkover.test.ts` pins the rule.
2. **8-player bracket:** `roundName()` names the double-elimination rounds ("Upper bracket quarter-finals"). The TV draws two rows (upper and lower) with the Grand Final at the end, and only winner lines; the plates already say "Loser of QF1". Other sizes are unchanged.
3. **Finish call-out:**
   - It overlapped LIVE during the slam-in and the hold (a 172px slab in a 152px gap).
   - It now hangs from `.mc-status`, bottom-anchored 24px above it, at 6.75rem, with a softer overshoot.
   - Measured at 1/10 speed: it stays ≥9px clear.
4. **"Score this":** it saves the pick to `tv_state.next` (migration 900, admin action `pick`). The TV's Up next and Match centre put it first, admin keeps it after a reload, and Reset clears it.
5. **Logins:** every launcher and the installer ask for passwords on a new database. The migrations still seed the dev defaults (`.env.example`).
6. **Smaller:**
   - `csrf.trustedOrigins: ["*"]` replaces the deprecated `checkOrigin`, with the same behaviour; a login from a foreign Origin was checked.
   - `midgroup.ts` writes a round log matching its 3–2.

### Earlier commits (days 1–2, oldest first)

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
- **Hardware:** the TV is 16:9 at the venue. **Decided day 3:** the Pi runs everything (server + TV), and the Mac is an admin browser; the Mac launcher is the backup. Keep TV scenes light for a Pi 3.

## How the TV works now

- **Scenes:** standby, groups, rr, bracket, spotlight (Match centre), awards, champion. `availableScenes()` in `view.ts` decides which exist; the TV and the admin TV panel both use it.
- **Which scene shows** (first rule that applies wins):
  1. a key pressed at the TV (holds 60s)
  2. the admin's lock
  3. a score changed, a result went in, or a match was started: Match centre on that match for 20s
  4. auto rotation: groups 25s, rr 20s, bracket 25s, spotlight 15s, awards 20s, champion 30s

  The logic is in `web/src/routes/tv/+page.svelte`.
- **Admin control:** the "TV screen" panel writes the `tv_state` record (migration 300), and the TV follows it live. Reset puts it back to Auto. `tv_state.next` (migration 900) holds the "Score this" pick.
- **Round log:** `matches.liveLog` is a list of `{who, finish}` (migration 400). It drives the round-win call-out and the finish pills, and it's kept after the match for the Result recap and Awards.
- **Start match:** stamps `matches.startedAt` (migration 700), which cues the launch countdown.
- **Live updates:** all three pages use `liveUpdates()` from `lib/pbBrowser.ts`, which checks `/ping` before every refresh. The TV shows a "Reconnecting" mark bottom-left while it can't reach the server.

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
- Checks: `bun run check` (in `web`), `bun run test` (in `tournament-app`, 77 engine tests), and `bun run e2e <players>` against a throwaway PocketBase (it plays a whole tournament through the server code).
- A throwaway data dir (served directly, not through a launcher) has no superuser. To check settings (e.g. backups), add one: `pb/pocketbase.exe superuser upsert admin@beyfest.local beyfestadmin2026 --dir=<that dir>`.

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
- **Python heredocs.** Long multi-line ones in the Bash tool can break on quoting, and `\n` inside them can turn into real newlines. A line reading just `EOF` inside one ends the heredoc early, and bash then runs the rest as commands; unbalanced quotes in the text can fail the whole command. Write files with the Write tool and run them, or use the Edit tool.
- **Testing Linux bits on this PC:** `wsl --install Debian --name <x> --no-launch` gives a disposable Debian 13 with systemd, and `wsl --unregister <x>` removes it. Use `wsl -d <x> -e bash -c '…'`: plain `wsl -- …` re-parses the command, so `$?` and quotes break. There's no wifi chip in WSL (`BEYFEST_WIFI_DEVICE=wlan0` lets `beyfest-wifi` create profiles anyway). A small Python pty driver can answer interactive prompts.
- **Git Bash `tar`** reads `C:/…` as a remote host. Use `/c/…` paths.
- **`gh`** is installed at `C:\Program Files\GitHub CLI\gh.exe` and logged in as `trendykendy`. It may not be on PATH in an old terminal.
- **Merging to `main`** needs the user's explicit go-ahead (the auto-mode review blocks it otherwise). Use a merge commit, not a squash, so the commit IDs here stay valid.
- **Imports in `lib/server/tournament.ts`.** The scripts import it directly with Bun, outside SvelteKit, so it must not use `$lib/...` imports; use relative paths.
- **Resolved slots are pinned.** Once a result resolves, the engine writes the player into the next match and clears the slot. Changing a past result therefore needs `applyCorrection` (it re-pins); re-running `applyResult` alone would leave the old winner in place.
- **SvelteKit offline trap.** If `invalidateAll()` fails for network reasons, SvelteKit does a full page load. With no network that strands the browser on its own offline page, and nothing on our page runs to recover. That's why every refresh goes through `/ping` first.
- **PocketBase 0.40 backups.** The backups API is superuser-only; the organiser login can't use it. Scheduled backups are set by migration 600.

## Public website (separate from the app)

- `public-site/` is the static event site, hosted on **Netlify** at https://beyfest.com. The date (November 7, 2026) and the "Innishannon" spelling are live.
- The Netlify CLI is logged in on this machine (`npx netlify-cli`), but the folder **isn't linked to the site yet**. Link it (`netlify link`), then deploy with `netlify deploy --dir public-site --prod`. **Always confirm with the user before deploying.**
