/// <reference path="../pb_data/types.d.ts" />
// Play-money betting on the phone page (/live). Everyone starts with $10,000
// and bets on match winners. Balances aren't stored: the web server works
// them out from the bets and the results, so a corrected result re-settles
// by itself.
//
// Public read (phones show the leaderboard); no create/update/delete rules,
// so only a superuser can write. The web server writes as one ("bookie",
// set up by start.ps1 / start.sh) after checking the bet. Both cascade from
// the tournament, so a reset clears the bets too.
migrate(
  (app) => {
    const tournaments = app.findCollectionByNameOrId("tournaments");
    const players = app.findCollectionByNameOrId("players");
    const matches = app.findCollectionByNameOrId("matches");

    const bettors = new Collection({
      type: "base",
      name: "bettors",
      listRule: "",
      viewRule: "",
      fields: [
        { name: "tournament", type: "relation", required: true, collectionId: tournaments.id, maxSelect: 1, cascadeDelete: true },
        { name: "name", type: "text", required: true, max: 16 },
        // Proves the phone that joined is the one betting; never sent to phones.
        { name: "token", type: "text", required: true, hidden: true },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      ],
      indexes: ["CREATE UNIQUE INDEX idx_bettors_name ON bettors (tournament, name COLLATE NOCASE)"],
    });
    app.save(bettors);

    const bets = new Collection({
      type: "base",
      name: "bets",
      listRule: "",
      viewRule: "",
      fields: [
        { name: "tournament", type: "relation", required: true, collectionId: tournaments.id, maxSelect: 1, cascadeDelete: true },
        { name: "bettor", type: "relation", required: true, collectionId: bettors.id, maxSelect: 1, cascadeDelete: true },
        { name: "match", type: "relation", required: true, collectionId: matches.id, maxSelect: 1, cascadeDelete: true },
        { name: "pick", type: "relation", required: true, collectionId: players.id, maxSelect: 1 },
        { name: "stake", type: "number", required: true, min: 1, onlyInt: true },
        { name: "odds", type: "number", required: true, min: 1 },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      ],
    });
    app.save(bets);
  },
  (app) => {
    for (const name of ["bets", "bettors"]) {
      try {
        app.delete(app.findCollectionByNameOrId(name));
      } catch (_) {
        /* already gone */
      }
    }
  },
);
