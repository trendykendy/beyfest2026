/// <reference path="../pb_data/types.d.ts" />
// The TV's sound, set from the admin page's TV panel:
// - soundOff: no music and no announcer (false, so sound is on, by default)
// - musicLevel: the match music's volume, 0–100 (the announcer is always full)
migrate(
  (app) => {
    const tv = app.findCollectionByNameOrId("tv_state");
    tv.fields.add(new Field({ name: "soundOff", type: "bool" }));
    tv.fields.add(new Field({ name: "musicLevel", type: "number", min: 0, max: 100 }));
    app.save(tv);
    app.db().newQuery("UPDATE tv_state SET musicLevel = 60").execute();
  },
  (app) => {
    const tv = app.findCollectionByNameOrId("tv_state");
    tv.fields.removeByName("soundOff");
    tv.fields.removeByName("musicLevel");
    app.save(tv);
  },
);
