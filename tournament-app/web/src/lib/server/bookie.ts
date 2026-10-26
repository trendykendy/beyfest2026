import PocketBase from "pocketbase";
import { dev } from "$app/environment";
import { env } from "$env/dynamic/private";
import { PB_URL } from "$lib/config";

// The web server's own PocketBase login, for writing bets. Phones can't write
// to PocketBase themselves (only organisers can), so /live/bet checks each bet
// and writes it as this superuser. start.ps1 / start.sh make it with a fresh
// random password on every start and pass it in BOOKIE_EMAIL / BOOKIE_PW.
// In development it falls back to the default superuser from .env.example.
const email = env.BOOKIE_EMAIL || (dev ? "admin@beyfest.local" : "");
const password = env.BOOKIE_PW || (dev ? "beyfestadmin2026" : "");

let client: PocketBase | null = null;

// null when there's no login: betting shows as closed.
export async function bookie(): Promise<PocketBase | null> {
  if (!email || !password) return null;
  if (client?.authStore.isValid) return client;
  const pb = new PocketBase(PB_URL);
  // Bets from many phones arrive together; don't let the SDK cancel one
  // request because another like it started.
  pb.autoCancellation(false);
  try {
    await pb.collection("_superusers").authWithPassword(email, password);
  } catch {
    return null;
  }
  client = pb;
  return pb;
}

export const bettingEnabled = () => !!(email && password);
