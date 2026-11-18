/// <reference path="../pb_data/types.d.ts" />

// Instance bootstrap settings (runs once per database):
// - batch API enabled (the part editor saves via /api/batch), up to 100 requests,
// - app name "Kidra", app URL from KIDRA_APP_URL (optional),
// - trusted proxy header X-Forwarded-For when KIDRA_TRUSTED_PROXY is 1/true/yes/on (behind a
//   reverse proxy, so rate limits and logs see the real client IP),
// - daily backups at 03:00, keeping the last 7,
// - a superuser from KIDRA_ADMIN_EMAIL + KIDRA_ADMIN_PASSWORD (both must be set).
//
// Since migrations only run once, later changes to these env vars have no effect here.
// Change the admin password afterwards with `kidra superuser upsert <email> <password>`
// (add --dir=<data dir> if not the default) or in the dashboard at /_/.

migrate((app) => {
  const settings = app.settings();

  settings.batch.enabled = true;
  settings.batch.maxRequests = 100;

  settings.meta.appName = "Kidra";
  const appURL = $os.getenv("KIDRA_APP_URL").trim();
  if (appURL) {
    settings.meta.appURL = appURL;
  }

  if (/^(1|true|yes|on)$/i.test($os.getenv("KIDRA_TRUSTED_PROXY").trim())) {
    settings.trustedProxy.headers = ["X-Forwarded-For"];
  }

  settings.backups.cron = "0 3 * * *";
  settings.backups.cronMaxKeep = 7;

  app.save(settings);

  const email = $os.getenv("KIDRA_ADMIN_EMAIL").trim();
  const password = $os.getenv("KIDRA_ADMIN_PASSWORD");
  if (email && password) {
    let superuser;
    try {
      superuser = app.findAuthRecordByEmail("_superusers", email);
    } catch (_) {
      superuser = new Record(app.findCollectionByNameOrId("_superusers"));
      superuser.setEmail(email);
    }
    superuser.setPassword(password);
    app.save(superuser);
  }
}, (app) => {
  // No-op: settings and the superuser are kept.
});
