import PocketBase from "pocketbase";
import { PB_URL } from "./config";

// A browser-side PocketBase client for read + realtime subscriptions on the
// public display. Never authenticated — public read only.
let instance: PocketBase | null = null;

export function pb(): PocketBase {
  if (!instance) instance = new PocketBase(PB_URL);
  return instance;
}

// Can this page safely refresh right now? (App server and PocketBase both up.)
async function reachable(): Promise<boolean> {
  try {
    const res = await fetch("/ping", { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

// Keep a page in step with the database, and heal after a dropout.
// • A change to any of these collections refreshes the page.
// • When the realtime connection comes back (wifi blip, PocketBase restart),
//   it refreshes too, because changes made during the gap were never sent.
// • It also refreshes every `everyMs` in case the connection died silently.
// Every refresh asks /ping first and is skipped while the servers can't be
// reached: a refresh that fails makes the browser fall back to a full page
// load, which with the network down leaves it stuck on its own offline page.
// While unreachable it re-checks every few seconds.
// onStatus reports reachable / not (for the TV's corner mark).
// Returns a cleanup function for onMount.
export function liveUpdates(
  collections: string[],
  refresh: () => Promise<unknown> | void,
  { onStatus, everyMs = 60_000 }: { onStatus?: (up: boolean) => void; everyMs?: number } = {},
): () => void {
  const RETRY_MS = 5_000;
  const client = pb();
  let stopped = false;
  let up = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;

  const setUp = (value: boolean) => {
    if (value !== up) {
      up = value;
      onStatus?.(value);
    }
  };

  let again = false; // a change arrived mid-refresh: run once more after
  async function safeRefresh() {
    if (stopped) return;
    if (running) {
      again = true;
      return;
    }
    running = true;
    try {
      const ok = await reachable();
      setUp(ok);
      if (ok) await refresh();
    } finally {
      running = false;
      if (again && up) {
        again = false;
        void safeRefresh();
      } else {
        again = false;
        schedule();
      }
    }
  }

  // Next check: soon while down, otherwise the regular heartbeat.
  function schedule() {
    clearTimeout(timer);
    if (!stopped) timer = setTimeout(safeRefresh, up ? everyMs : RETRY_MS);
  }

  const subs = collections.map((c) => client.collection(c).subscribe("*", () => void safeRefresh()));
  let firstConnect = true;
  const connected = client.realtime.subscribe("PB_CONNECT", () => {
    if (firstConnect) firstConnect = false;
    else void safeRefresh(); // reconnected: catch up on anything missed
  });
  client.realtime.onDisconnect = () => {
    setUp(false);
    schedule();
  };
  schedule();

  return () => {
    stopped = true;
    clearTimeout(timer);
    [...subs, connected].forEach((p) => p.then((unsub) => unsub()).catch(() => {}));
    client.realtime.onDisconnect = undefined;
  };
}
