package main

import (
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/jsvm"
)

// TestMigrationsOnEmptyDataDir applies all JS migrations in ./pb_migrations to an empty
// data dir and checks the resulting schema and bootstrap settings.
func TestMigrationsOnEmptyDataDir(t *testing.T) {
	t.Setenv("KIDRA_APP_URL", "https://kidra.example.com")
	t.Setenv("KIDRA_TRUSTED_PROXY", "1")
	t.Setenv("KIDRA_ADMIN_EMAIL", "admin@example.com")
	t.Setenv("KIDRA_ADMIN_PASSWORD", "test-password-123")

	app := core.NewBaseApp(core.BaseAppConfig{DataDir: t.TempDir()})
	if err := jsvm.Register(app, jsvm.Config{MigrationsDir: "pb_migrations", HooksFilesPattern: noHooksPattern}); err != nil {
		t.Fatal(err)
	}
	if err := app.Bootstrap(); err != nil {
		t.Fatal(err)
	}
	defer app.ResetBootstrapState()

	if err := app.RunAllMigrations(); err != nil {
		t.Fatalf("migrations failed: %v", err)
	}

	for _, name := range []string{
		"parts", "attachments", "categories", "designators", "distributorParts", "distributors",
		"footprintLibraries", "footprints", "manufacturers", "ratings", "symbolLibraries",
		"symbols", "tags", "tagsPartsCountView", "unitSets", "units", "users",
	} {
		if _, err := app.FindCollectionByNameOrId(name); err != nil {
			t.Errorf("collection %q missing: %v", name, err)
		}
	}

	parts, err := app.FindCollectionByNameOrId("parts")
	if err != nil {
		t.Fatal(err)
	}
	for _, field := range []string{"attachments", "datasheet", "tags", "ratings", "distributorParts"} {
		if parts.Fields.GetByName(field) == nil {
			t.Errorf("parts.%s missing", field)
		}
	}

	settings := app.Settings()
	if !settings.Batch.Enabled || settings.Batch.MaxRequests != 100 {
		t.Errorf("batch = %+v", settings.Batch)
	}
	if settings.Meta.AppName != "Kidra" || settings.Meta.AppURL != "https://kidra.example.com" {
		t.Errorf("meta = %q %q", settings.Meta.AppName, settings.Meta.AppURL)
	}
	if len(settings.TrustedProxy.Headers) != 1 || settings.TrustedProxy.Headers[0] != "X-Forwarded-For" {
		t.Errorf("trustedProxy = %+v", settings.TrustedProxy)
	}
	if settings.Backups.Cron != "0 3 * * *" || settings.Backups.CronMaxKeep != 7 {
		t.Errorf("backups = %+v", settings.Backups)
	}

	superuser, err := app.FindAuthRecordByEmail(core.CollectionNameSuperusers, "admin@example.com")
	if err != nil {
		t.Fatalf("superuser missing: %v", err)
	}
	if !superuser.ValidatePassword("test-password-123") {
		t.Error("superuser password not set")
	}
}
