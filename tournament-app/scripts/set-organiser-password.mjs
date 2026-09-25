// Set the organiser's password through PocketBase's API, signed in as the
// PocketBase admin (superuser). start.sh and start.ps1 run it on a brand-new
// database, straight after starting PocketBase, so it waits for it to answer.
// Plain Node or Bun, no packages. Passwords come in through the environment so
// they don't show up in the process list:
//   SU_EMAIL, SU_PW    the PocketBase admin
//   ORG_EMAIL, ORG_PW  the organiser login and its new password
//   PB_URL             default http://127.0.0.1:8090
const base = (process.env.PB_URL || "http://127.0.0.1:8090") + "/api";
const { SU_EMAIL, SU_PW, ORG_EMAIL, ORG_PW } = process.env;

async function call(path, init = {}) {
  const res = await fetch(base + path, { ...init, headers: { "content-type": "application/json", ...init.headers } });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function waitForPocketBase() {
  for (let i = 0; i < 30; i++) {
    try {
      await call("/health");
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error("PocketBase didn't start.");
}

try {
  await waitForPocketBase();
  const { token } = await call("/collections/_superusers/auth-with-password", {
    method: "POST",
    body: JSON.stringify({ identity: SU_EMAIL, password: SU_PW }),
  });
  const filter = encodeURIComponent(`email="${ORG_EMAIL}"`);
  const list = await call(`/collections/organisers/records?filter=${filter}`, { headers: { authorization: token } });
  if (!list.items.length) throw new Error(`There's no organiser ${ORG_EMAIL}.`);
  await call(`/collections/organisers/records/${list.items[0].id}`, {
    method: "PATCH",
    headers: { authorization: token },
    body: JSON.stringify({ password: ORG_PW, passwordConfirm: ORG_PW }),
  });
} catch (e) {
  console.error(`  Couldn't set the organiser password: ${e.message}`);
  process.exit(1);
}
