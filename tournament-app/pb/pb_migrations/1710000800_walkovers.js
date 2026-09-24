/// <reference path="../pb_data/types.d.ts" />
// Walkovers and withdrawals.
//   matches.walkover  — the result is a walkover (a no-show), not a played
//                       match. Recorded as target–0 so the tables and bracket
//                       carry on; screens show "W/O" and awards ignore it.
//   players.withdrawn — the blader has left. Every match of theirs that becomes
//                       playable is walked over automatically.
// The engine ignores both.
migrate(
  (app) => {
    const matches = app.findCollectionByNameOrId("matches");
    matches.fields.add(new Field({ name: "walkover", type: "bool" }));
    app.save(matches);
    const players = app.findCollectionByNameOrId("players");
    players.fields.add(new Field({ name: "withdrawn", type: "bool" }));
    app.save(players);
  },
  (app) => {
    const matches = app.findCollectionByNameOrId("matches");
    matches.fields.removeByName("walkover");
    app.save(matches);
    const players = app.findCollectionByNameOrId("players");
    players.fields.removeByName("withdrawn");
    app.save(players);
  },
);
