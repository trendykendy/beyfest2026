/// <reference path="../pb_data/types.d.ts" />
// Archived tournaments.
//   tournaments.archivedAt — when the organiser archived it; empty while it's
//                            the current one. Archived tournaments keep every
//                            record but drop off the TV, the phone page and
//                            the admin page's running event, so a new one can
//                            start. The admin page lists them for download.
migrate(
  (app) => {
    const tournaments = app.findCollectionByNameOrId("tournaments");
    tournaments.fields.add(new Field({ name: "archivedAt", type: "date" }));
    app.save(tournaments);
  },
  (app) => {
    const tournaments = app.findCollectionByNameOrId("tournaments");
    tournaments.fields.removeByName("archivedAt");
    app.save(tournaments);
  },
);
