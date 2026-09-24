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

1. On Windows, double-click **`start.ps1`** (or `pwsh -File .\start.ps1`). For the Raspberry Pi and the Mac, see below.
   - It builds the web app on first run, starts PocketBase + the web server bound
     to `0.0.0.0`, detects the laptop's LAN IP, and prints the URLs.
2. On the laptop, open the **Organiser admin** URL and log in:
   - `organiser@beyfest.local` / `beyfest2026`
3. Put the **Public display** URL on the projector/TV. Players can open it on their
   phones (same wifi) — it updates live as you enter scores.
4. **Windows Firewall** may prompt the first time — allow access on private networks
   so other devices can reach the laptop.

### On a Raspberry Pi (the main setup)

The Pi runs everything: the app, the database and the TV screen on its HDMI output.
The organiser uses the admin page from the Mac, a phone or any other device, at
**`http://beyfest.local/admin`**. Nothing needs the internet on the day.

You need a Raspberry Pi 3 or newer with **64-bit Raspberry Pi OS (with desktop)**,
connected to the TV and, for the install, to the internet. In a terminal on the Pi
(or over SSH), run:

```sh
curl -fsSL https://raw.githubusercontent.com/trendykendy/beyfest2026/redesign/tournament-app/tournament-app/install-pi.sh | bash
```

- It asks you to choose the **organiser** and **PocketBase admin** passwords. Write
  them down.
- It installs Node and Chromium, and downloads the ready-built app from GitHub, so
  the Pi never builds anything.
- It sets the app to start at boot and restart itself if it ever crashes.
- It names the Pi `beyfest`, logs in to the desktop automatically, turns off screen
  blanking, and opens the TV screen full-screen.
- It offers to restart the Pi at the end. After the restart the TV comes up by itself.

**To update**, run the same command again. It replaces only the app. The tournament
data and backups (in `/opt/beyfest/data`) are kept, and the previous app is kept in
`/opt/beyfest/app.previous`. Options go after `bash -s --`, e.g. `… | bash -s -- --passwords`:

- `--passwords` sets new passwords.
- `--wifi` adds wifi networks and sets a new hotspot password.
- `--no-kiosk` runs the Pi as a server only, without the TV screen.

#### Wifi, and the fallback hotspot

On the first install (or with `--wifi`) the installer asks for every wifi network the
Pi might need: home, the venue, a phone hotspot. The Pi joins whichever is in range,
or uses a network cable if one is plugged in.

**If nothing connects for about a minute, the Pi makes its own wifi called "Beyfest"**,
with the password you chose. Join it from the Mac (and phones), then open
`http://beyfest.local/admin`. Nothing needs the internet. The TV's waiting screen
shows which wifi to join and the addresses, so nobody has to remember them.

Once on its hotspot, the Pi stays on it until you run `beyfest-wifi auto` or restart it,
so nobody gets dropped mid-event. On the Pi (a keyboard, or SSH):

```sh
beyfest-wifi status          # what it's connected to, and its address
beyfest-wifi list            # the networks it knows
beyfest-wifi add "Hall wifi" # add one (asks for the password)
beyfest-wifi remove "Hall wifi"
beyfest-wifi hotspot         # switch to the Beyfest hotspot now
beyfest-wifi auto            # leave the hotspot and try the known networks again
```

A Pi 3 model B only sees 2.4 GHz networks (the 3B+ sees 5 GHz too). If the venue
wifi is 5 GHz only, the hotspot takes over by itself. The installer sets the wifi
country to Ireland if it isn't set, because Raspberry Pi OS keeps wifi off until it is.

GitHub builds the package the installer downloads on every push (see
`.github/workflows/pi-package.yml` and `scripts/pi-package.sh`).

If `beyfest.local` doesn't open (some networks and older Android phones don't
support `.local` names), use the Pi's IP address, which the installer prints.

Useful on the Pi:

```sh
systemctl status beyfest-web beyfest-pb       # are they running?
journalctl -u beyfest-web -u beyfest-pb -n 50 # recent messages
sudo systemctl restart beyfest-web beyfest-pb
```

### On a Mac (backup setup)

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

If it prints the wrong address (e.g. the Mac is on both wifi and a cable), force it:
`BEYFEST_IP=192.168.1.20 ./start.sh`.

### The TV on a Raspberry Pi, with the app on the Mac

If the Mac runs the app (above), the Pi can be just the TV's browser. Run
`sudo raspi-config nonint do_blanking 1` once and reboot so the screen never goes blank,
then:

```sh
./pi-kiosk.sh --install <mac>.local   # or the IP start.sh printed
```

- It opens `/tv` full-screen in Chromium, and `--install` makes it do that at every
  login. Leave `--install` off to open it just once.
- `<mac>` is the Mac's local hostname (System Settings → General → Sharing →
  *Local hostname*). The hostname still works if the Mac's IP changes. The IP
  works too, if `.local` names don't resolve on the venue network.
- It waits until the Mac's app answers, so the order you switch things on doesn't matter.
- Alt+F4 leaves the kiosk. To stop it starting at login: `rm ~/.config/autostart/beyfest-tv.desktop`.
- `pi-kiosk.sh` is in `scripts/` in this repo; copy it to the Pi.

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
- **Admin says it can't reach the database.** PocketBase has stopped. On the Pi it restarts by itself within seconds; if not, `sudo systemctl restart beyfest-pb`. On Windows or a Mac, run `start.ps1` (or `start.sh`) again. Your data is safe either way. On a Mac, PocketBase's own messages are in `pb/pocketbase.log`.

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
  install-pi.sh          Raspberry Pi: install or update everything (see above)
  scripts/pi-kiosk.sh    Raspberry Pi: TV screen full-screen in Chromium
  scripts/beyfest-wifi.sh  Raspberry Pi: wifi networks + fallback hotspot (the `beyfest-wifi` command)
  scripts/pi-package.sh  builds the ready-to-run Pi package (GitHub runs it)
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
