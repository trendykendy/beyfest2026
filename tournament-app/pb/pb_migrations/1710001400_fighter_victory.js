/// <reference path="../pb_data/types.d.ts" />
// Fighters get a victory pose: a full picture (with its own background) the
// TV's Champion scene shows instead of the cut-out when this fighter wins.
// Optional; without one the scene uses the normal image.
migrate(
  (app) => {
    const fighters = app.findCollectionByNameOrId("fighters");
    fighters.fields.add(
      new Field({
        name: "victory",
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
    fighters.fields.removeByName("victory");
    app.save(fighters);
  },
);
