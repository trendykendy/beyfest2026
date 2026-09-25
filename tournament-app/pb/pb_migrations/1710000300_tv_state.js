/// <reference path="../pb_data/types.d.ts" />
// What the venue TV shows. A single record: `mode` is "auto" (rotate through
// the scenes, cutting to Match centre when a score changes) or "locked" (stay
// on `scene`). The organiser changes it from the admin page; the TV follows it
// live via realtime. Public read (the TV isn't logged in); organiser writes.
migrate(
  (app) => {
    const authed = '@request.auth.collectionName = "organisers"';
    const tv = new Collection({
      type: "base",
      name: "tv_state",
      listRule: "",
      viewRule: "",
      createRule: authed,
      updateRule: authed,
      deleteRule: authed,
      fields: [
        { name: "mode", type: "select", required: true, maxSelect: 1, values: ["auto", "locked"] },
        { name: "scene", type: "text" }, // groups | rr | bracket | spotlight | champion
      ],
    });
    app.save(tv);

    const rec = new Record(tv);
    rec.set("mode", "auto");
    rec.set("scene", "groups");
    app.save(rec);
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId("tv_state"));
    } catch (_) {
      /* already gone */
    }
  },
);
