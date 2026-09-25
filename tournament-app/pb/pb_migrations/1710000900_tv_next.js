/// <reference path="../pb_data/types.d.ts" />
// tv_state.next: the match the organiser picked with "Score this" (its code).
// The TV's "Up next" shows that match rather than the next one in play order,
// and the admin page keeps the pick across a reload. Ignored once the match
// is finished or live.
migrate(
  (app) => {
    const tv = app.findCollectionByNameOrId("tv_state");
    tv.fields.add(new Field({ name: "next", type: "text" }));
    app.save(tv);
  },
  (app) => {
    const tv = app.findCollectionByNameOrId("tv_state");
    tv.fields.removeByName("next");
    app.save(tv);
  },
);
