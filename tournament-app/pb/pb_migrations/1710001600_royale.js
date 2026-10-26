/// <reference path="../pb_data/types.d.ts" />
// The battle royale after the main tournament (see web/src/lib/royale.ts).
// One record per tournament: the spaces around the arena, the entrants in
// drawn order (names, since extra people can join who didn't play the main
// event) and each battle's result, keyed H1…Hn / SD / F. Every battle's
// line-up is worked out from those, so one record is all there is to write.
// Public read; organiser write, like the matches. Cascades from the
// tournament, so a reset clears it.
migrate(
  (app) => {
    const tournaments = app.findCollectionByNameOrId("tournaments");
    const authed = '@request.auth.collectionName = "organisers"';
    const royales = new Collection({
      type: "base",
      name: "royales",
      listRule: "",
      viewRule: "",
      createRule: authed,
      updateRule: authed,
      deleteRule: authed,
      fields: [
        { name: "tournament", type: "relation", required: true, collectionId: tournaments.id, maxSelect: 1, cascadeDelete: true },
        { name: "spaces", type: "number", required: true, min: 2, max: 8, onlyInt: true },
        { name: "entrants", type: "json", required: true, maxSize: 200000 },
        { name: "battles", type: "json", maxSize: 200000 },
        { name: "createdAt", type: "autodate", onCreate: true, onUpdate: false },
      ],
    });
    app.save(royales);
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId("royales"));
    } catch (_) {
      /* already gone */
    }
  },
);
