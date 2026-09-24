import { readFile } from "node:fs/promises";
import { env } from "$env/dynamic/private";

// How people reach the app, for the TV's standby screen. On the Raspberry Pi,
// the beyfest-network service (scripts/beyfest-wifi.sh watch) writes this file
// every 10 seconds and install-pi.sh points BEYFEST_NETWORK_FILE at it.
// Elsewhere (Windows, Mac, dev) there's no file and the TV just leaves it out.
export type NetworkInfo = {
  mode: "hotspot" | "wifi" | "ethernet";
  ssid: string; // the wifi to join ("" on a cable)
  ip: string;
  host: string; // e.g. beyfest.local
};

export async function loadNetwork(): Promise<NetworkInfo | null> {
  if (!env.BEYFEST_NETWORK_FILE) return null;
  try {
    const n = JSON.parse(await readFile(env.BEYFEST_NETWORK_FILE, "utf8"));
    if (n.mode !== "hotspot" && n.mode !== "wifi" && n.mode !== "ethernet") return null;
    return { mode: n.mode, ssid: String(n.ssid ?? ""), ip: String(n.ip ?? ""), host: String(n.host ?? "") };
  } catch {
    return null;
  }
}
