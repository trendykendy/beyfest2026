/// <reference path="../pb_data/types.d.ts" />
// Fighters get a face point: where the face is in the cut-out, so screens
// that crop it (the battle royale's panels, the board's round pictures, the
// phone) keep the face in view. { x, y, h }: the face's centre and its
// height, as fractions of the image's width and height. Empty means none
// (the screens fall back to their old crop). The starting fighters ship with
// one (scripts/find-faces.py); for others it's clicked in on the Fighters page.
migrate(
  (app) => {
    const fighters = app.findCollectionByNameOrId("fighters");
    fighters.fields.add(new Field({ name: "face", type: "json", maxSize: 1000 }));
    app.save(fighters);
  },
  (app) => {
    const fighters = app.findCollectionByNameOrId("fighters");
    fighters.fields.removeByName("face");
    app.save(fighters);
  },
);
