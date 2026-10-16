/// <reference path="../pb_data/types.d.ts" />
// Fighters get two names and a voice:
// - name: the combat name ("The Breycist"), shown and announced by the VS intro
// - player: the name typed in for the tournament ("Conor"), used to match a
//   player to their fighter
// - voice: the announcer clip of the combat name, played as the banner lands
// Until now `name` did the matching, so existing fighters get player = name and
// keep matching as before.
migrate(
  (app) => {
    const fighters = app.findCollectionByNameOrId("fighters");
    fighters.fields.add(new Field({ name: "player", type: "text" }));
    fighters.fields.add(
      new Field({
        name: "voice",
        type: "file",
        maxSelect: 1,
        maxSize: 2 * 1024 * 1024,
        mimeTypes: ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/ogg", "audio/webm", "audio/mp4"],
      }),
    );
    app.save(fighters);
    app.db().newQuery("UPDATE fighters SET player = name WHERE player = '' OR player IS NULL").execute();
  },
  (app) => {
    const fighters = app.findCollectionByNameOrId("fighters");
    fighters.fields.removeByName("player");
    fighters.fields.removeByName("voice");
    app.save(fighters);
  },
);
