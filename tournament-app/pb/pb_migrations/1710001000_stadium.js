/// <reference path="../pb_data/types.d.ts" />
// Triple Threat stadia: every round is played in one of three stadia, drawn
// just before the round (weighted towards the least used; see web/src/lib/stadia.ts).
//   matches.stadium     — the stadium for the round about to be played (key), "" if none
//   matches.stadiumAt   — when it was drawn; a change cues the TV's draw animation
//   tournaments.stadiaOff — stadia taken out of the draw (JSON array of keys)
// Each liveLog entry also gains a "stadium" key: where that round was played.
// The engine ignores all of it.
migrate(
  (app) => {
    const m = app.findCollectionByNameOrId("matches");
    m.fields.add(new Field({ name: "stadium", type: "text" }));
    m.fields.add(new Field({ name: "stadiumAt", type: "date" }));
    app.save(m);
    const t = app.findCollectionByNameOrId("tournaments");
    t.fields.add(new Field({ name: "stadiaOff", type: "json", maxSize: 2000 }));
    app.save(t);
  },
  (app) => {
    const m = app.findCollectionByNameOrId("matches");
    m.fields.removeByName("stadium");
    m.fields.removeByName("stadiumAt");
    app.save(m);
    const t = app.findCollectionByNameOrId("tournaments");
    t.fields.removeByName("stadiaOff");
    app.save(t);
  },
);
