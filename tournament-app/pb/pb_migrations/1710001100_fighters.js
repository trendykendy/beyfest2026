/// <reference path="../pb_data/types.d.ts" />
// The fighter library for the TV's VS intro: a name, an optional katakana
// spelling and an optional cut-out image per fighter. It isn't tied to a
// tournament, so it's set up once and kept through resets and new events.
// Players are matched to fighters by name (see web/src/lib/fighters.ts).
// Public read (the TV isn't logged in); organiser writes. Images live in
// PocketBase storage, so they're in the automatic backups.
migrate(
  (app) => {
    const authed = '@request.auth.collectionName = "organisers"';
    const fighters = new Collection({
      type: "base",
      name: "fighters",
      listRule: "",
      viewRule: "",
      createRule: authed,
      updateRule: authed,
      deleteRule: authed,
      fields: [
        { name: "name", type: "text", required: true },
        { name: "kana", type: "text" },
        {
          name: "image",
          type: "file",
          maxSelect: 1,
          maxSize: 8 * 1024 * 1024,
          mimeTypes: ["image/png", "image/webp", "image/jpeg"],
          // The TV asks for this size, so the Pi never decodes a huge original.
          thumbs: ["0x900"],
        },
        { name: "mirror", type: "bool" }, // flip a cut-out that faces the wrong way
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      ],
    });
    app.save(fighters);
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId("fighters"));
    } catch (_) {
      /* already gone */
    }
  },
);
