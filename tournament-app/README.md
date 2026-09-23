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

1. Double-click **`start.ps1`** (or `pwsh -File .\start.ps1`).
   - It builds the web app on first run, starts PocketBase + the web server bound
     to `0.0.0.0`, detects the laptop's LAN IP, and prints the URLs.
2. On the laptop, open the **Organiser admin** URL and log in:
   - `organiser@beyfest.local` / `beyfest2026`
3. Put the **Public display** URL on the projector/TV. Players can open it on their
   phones (same wifi) — it updates live as you enter scores.
4. **Windows Firewall** may prompt the first time — allow access on private networks
   so other devices can reach the laptop.

### Organiser workflow

1. **Enter players** — paste the names (one per line, 8–15) → *Draw groups & build bracket*.
   The app randomly draws the groups and generates every group match.
2. **Group stage** — enter each match score. Standings and tiebreakers update live.
3. When all groups are complete, **Generate knockout bracket**.
4. **Knockout** — enter scores as matches become ready; the bracket advances itself
   through to the Grand Final and crowns the champion.
5. **Reset tournament** clears everything to start again.

## Development

```sh
bun install                 # from this folder (installs all workspaces)

# Terminal 1 — PocketBase (data + realtime)
bun run pb

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
  start.ps1              one-command launcher for the event laptop
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
