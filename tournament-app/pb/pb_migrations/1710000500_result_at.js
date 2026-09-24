/// <reference path="../pb_data/types.d.ts" />
// When a match's result was last recorded or corrected. Admin uses it to
// offer "Undo last result" on the right match (play order isn't always the
// order results come in). Empty until the match is played. The engine ignores it.
migrate(
  (app) => {
    const c = app.findCollectionByNameOrId("matches");
    c.fields.add(new Field({ name: "resultAt", type: "date" }));
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId("matches");
    c.fields.removeByName("resultAt");
    app.save(c);
  },
);
