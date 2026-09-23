import type PocketBase from "pocketbase";

declare global {
  namespace App {
    interface Locals {
      pb: PocketBase;
      organiser: boolean;
    }
    // interface Error {}
    // interface PageData {}
    // interface Platform {}
  }
}

export {};
