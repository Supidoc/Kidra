package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

const (
	defaultLibraryRepo = "https://github.com/Supidoc/Gradur_Libraries_Test.git"
	defaultModelDir    = "3dmodels"
	defaultPullCron    = "*/5 * * * *"
)

// envOr returns the trimmed value of an environment variable, or fallback when unset/empty.
func envOr(name string, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(name)); value != "" {
		return value
	}
	return fallback
}

func main() {
	app := pocketbase.New()
	app.RootCmd.AddCommand(newHealthCommand())

	if isHealthCommand(os.Args) {
		// Run without bootstrapping: the health check must not open (or create) a data dir.
		if err := app.RootCmd.Execute(); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		return
	}

	// pocketbase.New() already parsed --dir, so app.DataDir() is final here.
	if envFile, err := loadEnvFile(app.DataDir()); err != nil {
		log.Fatalf("loading env file: %v", err)
	} else if envFile != "" {
		log.Printf("loaded environment from %s", envFile)
	}

	registerMigrations(app)

	// Configuration (all optional):
	//   KIDRA_ENV_FILE            dotenv file to load (default <dataDir>/kidra.env); never
	//                             overrides variables that are already set
	//   KIDRA_MIGRATIONS_DIR      JS migrations dir (default <exe dir>/pb_migrations, else ./pb_migrations)
	//   KIDRA_PUBLIC_DIR          serve the web UI from this dir instead of the embedded one
	//   KIDRA_APP_URL, KIDRA_TRUSTED_PROXY, KIDRA_ADMIN_EMAIL, KIDRA_ADMIN_PASSWORD
	//                             applied by the bootstrap migration (see pb_migrations)
	//   KIDRA_LIBRARY_REPO        git URL of the KiCad library repository
	//   KIDRA_LIBRARY_BRANCH      branch to mirror (default: the repository's default branch)
	//   KIDRA_LIBRARY_PATH        where it is cloned (default <dataDir>/repositories/project)
	//   KIDRA_LIBRARY_PULL_CRON   pull schedule (default every 5 minutes)
	//   KIDRA_3DMODEL_DIR         repo-relative dir that ${KICAD*_3DMODEL_DIR} maps to
	//   KIDRA_KICAD_CLI           kicad-cli binary for SVG previews (default: PATH lookup)
	//   KIDRA_KICAD_STOCK_3DMODEL_DIR
	//                             KiCad's stock 3D models for ${KICAD<n>_3DMODEL_DIR}
	//                             (default: first existing common install location)
	//   KIDRA_DOWNLOAD_ALLOW_PRIVATE
	//                             "true" lets the download proxy fetch from private networks
	repoURL := envOr("KIDRA_LIBRARY_REPO", defaultLibraryRepo)
	repoBranch := envOr("KIDRA_LIBRARY_BRANCH", "")
	modelDir := envOr("KIDRA_3DMODEL_DIR", defaultModelDir)
	stockModelDir := findStockModelDir(envOr("KIDRA_KICAD_STOCK_3DMODEL_DIR", ""), stockModelDirCandidates)

	var librarySync *LibrarySync
	var gitManager *GitManager

	RegisterApiV1(app)
	RegisterCorsEndpoint(app)
	RegisterModelHooks(app)
	RegisterFootprintModelRoutes(app, func() *GitManager { return gitManager }, modelDir, stockModelDir)

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		// The data dir is only known once the CLI flags are parsed.
		repoPath := envOr("KIDRA_LIBRARY_PATH", filepath.Join(app.DataDir(), "repositories", "project"))
		manager, err := NewGitManager(repoURL, repoPath, repoBranch)
		if err != nil {
			return err
		}
		gitManager = manager
		librarySync = NewLibrarySync(app, manager, NewRenderer(app.Logger()))
		app.Logger().Info("library repository", "url", repoURL, "branch", repoBranch, "path", manager.RepoPath(), "3dModelDir", modelDir, "stock3dModelDir", stockModelDir)

		// Clone/pull and parse once in the background; start-up never waits for the network.
		go librarySync.Run(true)

		// Afterwards only re-parse when the pull brings changes (or the last parse failed).
		pullCron := envOr("KIDRA_LIBRARY_PULL_CRON", defaultPullCron)
		if err := app.Cron().Add("pull-project", pullCron, func() { librarySync.Run(false) }); err != nil {
			app.Logger().Error("invalid KIDRA_LIBRARY_PULL_CRON; using default", "value", pullCron, "error", err)
			app.Cron().MustAdd("pull-project", defaultPullCron, func() { librarySync.Run(false) })
		}

		return se.Next()
	})

	RegisterInfoRoute(app)
	RegisterStatic(app)

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
