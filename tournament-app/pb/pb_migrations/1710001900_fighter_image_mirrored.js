/// <reference path="../pb_data/types.d.ts" />
// Fighters can have a hand-made mirror image of their cut-out, for one with
// lettering (the Cheatseeker's rule book) that would read backwards when a
// screen flips it. Wherever the cut-out is shown mirrored, this is shown
// instead (as it is). Optional; without one the cut-out is flipped as before.
migrate(
  (app) => {
    const fighters = app.findCollectionByNameOrId("fighters");
    fighters.fields.add(
      new Field({
        name: "imageMirrored",
        type: "file",
        maxSelect: 1,
        maxSize: 8 * 1024 * 1024,
        mimeTypes: ["image/png", "image/webp", "image/jpeg"],
        // The same size the TV asks for as the cut-out.
        thumbs: ["0x900"],
      }),
    );
    app.save(fighters);
  },
  (app) => {
    const fighters = app.findCollectionByNameOrId("fighters");
    fighters.fields.removeByName("imageMirrored");
    app.save(fighters);
  },
);
