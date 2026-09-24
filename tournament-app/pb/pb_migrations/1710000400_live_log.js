/// <reference path="../pb_data/types.d.ts" />
// Live round log. Alongside the running tally (liveP1/liveP2), the admin
// scorer writes how each round was won, so the TV can call out the finish
// ("Knockout +2") as it happens. JSON array, oldest first:
//   [{ "who": 1 | 2, "finish": "spin" | "knockout" | "dominant" }, ...]
// Cleared when the final result is recorded. The engine ignores it.
migrate(
  (app) => {
    const c = app.findCollectionByNameOrId("matches");
    c.fields.add(new Field({ name: "liveLog", type: "json", maxSize: 20000 }));
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId("matches");
    c.fields.removeByName("liveLog");
    app.save(c);
  },
);
