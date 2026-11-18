package main

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/plugins/jsvm"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"
)

// noHooksPattern matches no file name, so jsvm never loads pb_hooks/*.pb.js app hooks
// (not even if such a directory happens to exist next to the data dir). Kidra only uses
// jsvm for its JS migrations; all app logic lives in Go.
const noHooksPattern = `^$`

// registerMigrations wires the JS migrations (applied automatically on `serve`) and the
// `kidra migrate` command. Automigrate (writing a migration file for every schema change
// made in the dashboard) is only enabled under `go run`, i.e. during development.
func registerMigrations(app *pocketbase.PocketBase) string {
	migDir := resolveMigrationsDir()

	jsvm.MustRegister(app, jsvm.Config{
		MigrationsDir:     migDir,
		HooksFilesPattern: noHooksPattern,
	})

	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		TemplateLang: migratecmd.TemplateLangJS,
		Automigrate:  isGoRun(),
		Dir:          migDir,
	})

	return migDir
}

// resolveMigrationsDir returns KIDRA_MIGRATIONS_DIR, else <executable dir>/pb_migrations
// when that exists, else ./pb_migrations.
func resolveMigrationsDir() string {
	if dir := envOr("KIDRA_MIGRATIONS_DIR", ""); dir != "" {
		return dir
	}
	if exe, err := os.Executable(); err == nil {
		candidate := filepath.Join(filepath.Dir(exe), "pb_migrations")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
	}
	return filepath.Join(".", "pb_migrations")
}

// isGoRun reports whether the executable lives under the temp dir, i.e. most likely
// it was started with `go run` (or is a `go test` binary).
func isGoRun() bool {
	exe, err := os.Executable()
	if err != nil {
		return false
	}
	return isUnder(exe, os.TempDir())
}

// isUnder reports whether path is inside dir (both resolved through symlinks if possible).
func isUnder(path string, dir string) bool {
	if resolved, err := filepath.EvalSymlinks(path); err == nil {
		path = resolved
	}
	if resolved, err := filepath.EvalSymlinks(dir); err == nil {
		dir = resolved
	}
	rel, err := filepath.Rel(dir, path)
	if err != nil {
		return false
	}
	return rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator)) && !filepath.IsAbs(rel)
}
