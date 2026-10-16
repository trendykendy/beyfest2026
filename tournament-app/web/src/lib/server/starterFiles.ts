// Reads the starting fighters' files (static/starter-fighters) from disk.
//
// They're read directly rather than fetched from the app's own URL, which
// depends on how the server was reached (beyfest.local, an IP, the hotspot).
// The folder is found by walking up from this file: in development it's
// web/static/starter-fighters; in a build it's build/client/starter-fighters.

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Starter } from "$lib/starters";

function findDir(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    for (const sub of ["client/starter-fighters", "static/starter-fighters"]) {
      const d = join(dir, sub);
      if (existsSync(join(d, "fighters.json"))) return d;
    }
    dir = dirname(dir);
  }
  throw new Error("the starter-fighters folder is missing");
}

const TYPES: Record<string, string> = {
  png: "image/png",
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
};

export async function readStarters(): Promise<{ starters: Starter[]; file: (name: string) => Promise<File> }> {
  const dir = findDir();
  const starters: Starter[] = JSON.parse(await readFile(join(dir, "fighters.json"), "utf8"));
  const file = async (name: string) => {
    const safe = basename(name); // only files in the folder itself
    const type = TYPES[safe.split(".").pop()!.toLowerCase()] ?? "application/octet-stream";
    return new File([await readFile(join(dir, safe))], safe, { type });
  };
  return { starters, file };
}
