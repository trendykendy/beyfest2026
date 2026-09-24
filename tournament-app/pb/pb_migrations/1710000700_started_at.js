/// <reference path="../pb_data/types.d.ts" />
// When the organiser pressed "Start match" (the launch). It makes the match
// live straight away, before the first round is scored, and cues the TV's
// "3 · 2 · 1 · LET IT RIP!" countdown. Empty if not started. The engine ignores it.
migrate(
  (app) => {
    const c = app.findCollectionByNameOrId("matches");
    c.fields.add(new Field({ name: "startedAt", type: "date" }));
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId("matches");
    c.fields.removeByName("startedAt");
    app.save(c);
  },
);
