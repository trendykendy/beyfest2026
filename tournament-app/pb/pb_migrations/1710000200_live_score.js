/// <reference path="../pb_data/types.d.ts" />
// Live running score. A match is scored round-by-round in the admin panel; the
// current tally is written here (separate from the final p1Score/p2Score) so
// the public/TV displays can show it live via realtime while a match is still
// in progress. The engine ignores these fields entirely.
migrate(
  (app) => {
    const c = app.findCollectionByNameOrId("matches");
    c.fields.add(new Field({ name: "liveP1", type: "number" }));
    c.fields.add(new Field({ name: "liveP2", type: "number" }));
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId("matches");
    c.fields.removeByName("liveP1");
    c.fields.removeByName("liveP2");
    app.save(c);
  },
);
