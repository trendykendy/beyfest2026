/// <reference path="../pb_data/types.d.ts" />
// Fighters get a second victory pose for the battle royale: a full picture
// (background and all) the TV's Champion scene shows when this fighter wins
// the battle royale. Optional; without one the scene uses the normal victory
// pose, then the cut-out.
migrate(
  (app) => {
    const fighters = app.findCollectionByNameOrId("fighters");
    fighters.fields.add(
      new Field({
        name: "royaleVictory",
        type: "file",
        maxSelect: 1,
        maxSize: 8 * 1024 * 1024,
        mimeTypes: ["image/png", "image/webp", "image/jpeg"],
        // The admin page's preview; the TV shows the full picture.
        thumbs: ["300x200"],
      }),
    );
    app.save(fighters);
  },
  (app) => {
    const fighters = app.findCollectionByNameOrId("fighters");
    fighters.fields.removeByName("royaleVictory");
    app.save(fighters);
  },
);
