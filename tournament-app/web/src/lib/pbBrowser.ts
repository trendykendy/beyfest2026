import PocketBase from "pocketbase";
import { PB_URL } from "./config";

// A browser-side PocketBase client for read + realtime subscriptions on the
// public display. Never authenticated — public read only.
let instance: PocketBase | null = null;

export function pb(): PocketBase {
  if (!instance) instance = new PocketBase(PB_URL);
  return instance;
}
