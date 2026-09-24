# Beyfest 2026 — Tournament App

A self-contained app to **run** the Beyfest 2026 tournament on the day: enter the
players who show up, auto-draw the groups and build the right bracket, record
scores, and show a live public display. Runs entirely on one laptop over the
venue wifi — **no internet required**.

It implements the locked-in structures in
[`../bracket-and-tourney/tournament-spec.txt`](../bracket-and-tourney/tournament-spec.txt)
for every count from 8 to 15 players.

## Stack

- **PocketBase** (`pb/pocketbase.exe`) — database + auth + REST + realtime, one binary.
- **SvelteKit** (`web/`, Svelte 5, `adapter-node`) — public display + organiser admin.
- **Engine** (`engine/`) — zero-dependency TypeScript: the draw, round-robin,
  standings/tiebreakers, bracket generation and resolution. Fully unit-tested.

## Running it at the event

1. On Windows, double-click **`start.ps1`** (or `pwsh -File .\start.ps1`). On a Mac, see below.
   - It builds the web app on first run, starts PocketBase + the web server bound
     to `0.0.0.0`, detects the laptop's LAN IP, and prints the URLs.
2. On the laptop, open the **Organiser admin** URL and log in:
   - `organiser@beyfest.local` / `beyfest2026`
3. Put the **Public display** URL on the projector/TV. Players can open it on their
   phones (same wifi) — it updates live as you enter scores.
4. **Windows Firewall** may prompt the first time — allow access on private networks
   so other devices can reach the laptop.

### On a Mac

`start.sh` is the Mac/Linux twin of `start.ps1`. **Do the first run at home, with
internet**: it installs packages, builds the web app, downloads the right PocketBase
for the Mac (Apple Silicon or Intel) into `pb/pocketbase`, and creates the database
with the default logins. After that it runs offline.

1. Install **Bun**: `curl -fsSL https://bun.sh/install | bash`. **Node** is optional;
   it's used to run the server if present, otherwise Bun does.
2. Double-click **`start.command`** in Finder, or run `./start.sh` in Terminal.
   - If macOS says it can't check the file, right-click it → *Open* (only the first time).
   - When macOS asks whether `pocketbase` and `node`/`bun` may **accept incoming
     connections**, choose *Allow*. Otherwise the TV and phones can't reach the Mac.
3. It prints the URLs, including the **TV screen** one. Close the window (or Ctrl+C)
   to stop both servers.
4. Stop the Mac sleeping during the event (System Settings → Battery/Energy →
   *Prevent automatic sleeping*), and keep it plugged in.

If it picks the wrong address (e.g. the Mac is on both wifi and a cable), force it:
`BEYFEST_IP=192.168.1.20 ./start.sh`.

### The TV on a Raspberry Pi

There are two ways to use the Pi. Either way, run `sudo raspi-config nonint do_blanking 1`
once and reboot, so the screen never goes blank.

**A. The Pi is only the TV browser (the app runs on the Mac)**, the simplest setup:

```sh
scripts/pi-kiosk.sh --install <mac>.local   # or the IP start.sh printed
```

- It opens `/tv` full-screen in Chromium, and `--install` makes it do that at every
  login. Leave `--install` off to open it just once.
- `<mac>` is the Mac's local hostname (System Settings → General → Sharing →
  *Local hostname*). The hostname still works if the Mac's IP changes. The IP
  works too, if `.local` names don't resolve on the venue network.
- It waits until the Mac's app answers, so the order you switch things on doesn't matter.
- Alt+F4 leaves the kiosk. To stop it starting at login: `rm ~/.config/autostart/beyfest-tv.desktop`.

**B. The Pi runs the whole app.** Use 64-bit Raspberry Pi OS and follow the Mac steps
in a terminal on the Pi (install Bun, `./start.sh`, first run at home). Then run
`scripts/pi-kiosk.sh` with no address to show this Pi's own TV screen. The organiser
uses the admin page from another device, at the address `start.sh` printed.

### Organiser workflow

1. **Enter bladers**: type the names (one per line, 8–15), then *Draw groups and build bracket*.
   The app randomly draws the groups and generates every group match.
2. **Now playing** shows one match at a time.
   - Tap the finish for each round (Spin +1, Knockout +2, Dominant +3). The TV follows live.
   - When someone reaches the target, press **Record result**. Now playing moves on to the next match.
   - **Up next** lists what's ready. *Score this* switches to a different match.
3. When every group is in, Now playing offers **Generate knockout bracket**.
4. **Knockout**: same as the groups, through to the Grand Final.
5. **Made a mistake?** Under Now playing, **Last result → Fix** corrects any recorded score.
   - If the winner changes, the next round is updated.
   - The fix is refused, with the reason, if a later match has already been played with the old winner or loser.
6. **Danger zone** (bottom of the page):
   - *Download results* saves a copy of everything as a file.
   - *Reset tournament* deletes everything and starts again.

## If something goes wrong

- **The TV shows "Reconnecting" in the corner.** It has lost the laptop. Nothing to do: it catches up by itself as soon as the connection is back (it checks every 5 seconds).
- **Backups.** PocketBase saves a backup of everything every 10 minutes into `pb/pb_data/backups/`, keeping the newest 20 (about 3 hours).
- **To restore one:**
  1. Log in to the PocketBase console (`http://<laptop>:8090/_/`) with the superuser.
  2. Go to *Settings → Backups*.
  3. Pick a backup and choose *Restore*. PocketBase restarts with that data.
- **Admin says it can't reach the database.** PocketBase has stopped. Run `start.ps1` (or `start.sh` on a Mac) again; your data is safe in `pb/pb_data`. On a Mac, PocketBase's own messages are in `pb/pocketbase.log`.

## Development

```sh
bun install                 # from this folder (installs all workspaces)

# Terminal 1 — PocketBase (data + realtime)
bun run pb                  # Windows. On a Mac, after one run of start.sh:
                            # pb/pocketbase serve --dir=pb/pb_data --migrationsDir=pb/pb_migrations

# Terminal 2 — web app (dev, hot reload)
bun run web                 # http://localhost:5173
```

Other commands:

```sh
bun run test                # engine unit tests (match counts + full simulations)
bun run e2e [count]         # full flow against a running PocketBase (default 12)
bun run build               # production build of the web app
```

## First-time / fresh database setup

`pb/pb_data/` (gitignored) is created automatically. To rebuild it from scratch:

```sh
pb/pocketbase.exe migrate up --migrationsDir=pb/pb_migrations --dir=pb/pb_data
pb/pocketbase.exe superuser upsert admin@beyfest.local beyfestadmin2026 --dir=pb/pb_data
```

The migrations create the schema and seed the organiser login. See `.env.example`
for all credentials — **change them before a real event** from the PocketBase admin
console (`http://127.0.0.1:8090/_/`).

## Layout

```
tournament-app/
  start.ps1              one-command launcher for the event laptop (Windows)
  start.sh               the same for macOS / Linux / Raspberry Pi
  start.command          double-click wrapper for start.sh on a Mac
  scripts/pi-kiosk.sh    Raspberry Pi: TV screen full-screen in Chromium
  engine/                pure-TS tournament logic + tests
  pb/                    PocketBase binary + migrations (pb_data is runtime)
  web/                   SvelteKit app (public display + admin)
  scripts/e2e.ts         end-to-end check against a running PocketBase
```

## Notes

- **One tournament at a time.** Starting a new event = *Reset*, then enter new players.
- The group draw and Mid-Bracket pairings are **random** and persisted once done, so
  they stay stable for the rest of the event.
- Everything is vendored (PocketBase binary, self-hosted fonts) so it runs offline.
