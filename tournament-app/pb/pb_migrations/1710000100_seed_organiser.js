/// <reference path="../pb_data/types.d.ts" />
// Seed the single shared organiser login. These are local, offline, dev
// defaults for the laptop that runs the event — change the password from the
// PocketBase admin console (or re-run against fresh pb_data) before a real
// event if the laptop is ever exposed beyond the venue LAN.
migrate(
  (app) => {
    const organisers = app.findCollectionByNameOrId("organisers");
    const rec = new Record(organisers);
    rec.set("email", "organiser@beyfest.local");
    rec.set("name", "Organiser");
    rec.set("verified", true);
    rec.setPassword("beyfest2026");
    app.save(rec);
  },
  (app) => {
    try {
      const rec = app.findAuthRecordByEmail("organisers", "organiser@beyfest.local");
      app.delete(rec);
    } catch (_) {
      /* already gone */
    }
  },
);
