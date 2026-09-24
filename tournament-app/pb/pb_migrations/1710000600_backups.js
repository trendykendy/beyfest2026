/// <reference path="../pb_data/types.d.ts" />
// Automatic backups for the event: PocketBase zips the whole data folder into
// pb_data/backups every 10 minutes and keeps the newest 20 (about 3 hours).
// Restoring one is in the README ("If something goes wrong").
migrate(
  (app) => {
    const settings = app.settings();
    settings.backups.cron = "*/10 * * * *";
    settings.backups.cronMaxKeep = 20;
    settings.meta.appName = "Beyfest"; // backup files are named after the app
    app.save(settings);
  },
  (app) => {
    const settings = app.settings();
    settings.backups.cron = "";
    app.save(settings);
  },
);
