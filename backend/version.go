package main

import (
	"context"
	"fmt"
	"net/http"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/spf13/cobra"
)

// Set at build time:
//
//	go build -ldflags "-X main.version=v1.2.3 -X main.commit=abc1234"
var (
	version = "dev"
	commit  = "unknown"
)

const (
	kicadVersionTimeout = 15 * time.Second
	defaultHealthURL    = "http://127.0.0.1:8090/api/health"
)

// KidraInfo is the response of GET /api/kidra/info.
type KidraInfo struct {
	Version      string `json:"version"`
	Commit       string `json:"commit"`
	KicadCli     bool   `json:"kicadCli"`
	KicadVersion string `json:"kicadVersion"`
}

// kicadCliInfo runs `kicad-cli version` once (lazily) and caches the result.
var kicadCliInfo = sync.OnceValues(func() (bool, string) {
	cliPath, _, err := lookupKicadCli()
	if err != nil {
		return false, ""
	}
	ctx, cancel := context.WithTimeout(context.Background(), kicadVersionTimeout)
	defer cancel()
	out, err := exec.CommandContext(ctx, cliPath, "version").Output()
	if err != nil {
		return true, ""
	}
	return true, strings.TrimSpace(string(out))
})

// RegisterInfoRoute adds the public GET /api/kidra/info endpoint.
func RegisterInfoRoute(app core.App) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		// Warm the kicad-cli version cache so the first request doesn't wait for it.
		go kicadCliInfo()

		se.Router.GET("/api/kidra/info", func(e *core.RequestEvent) error {
			available, kicadVersion := kicadCliInfo()
			return e.JSON(http.StatusOK, KidraInfo{
				Version:      version,
				Commit:       commit,
				KicadCli:     available,
				KicadVersion: kicadVersion,
			})
		})
		return se.Next()
	})
}

// newHealthCommand returns `kidra health`, which exits 0 when GET <url> answers 200 and
// 1 otherwise. It's for container HEALTHCHECKs in images without curl/wget.
func newHealthCommand() *cobra.Command {
	var url string
	var timeout time.Duration
	cmd := &cobra.Command{
		Use:           "health",
		Short:         "Checks that a running Kidra server is healthy (exit code 0/1)",
		SilenceUsage:  true,
		SilenceErrors: true, // printed by main
		Args:          cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return checkHealth(cmd.Context(), url, timeout)
		},
	}
	cmd.Flags().StringVar(&url, "url", defaultHealthURL, "health endpoint to query")
	cmd.Flags().DurationVar(&timeout, "timeout", 5*time.Second, "request timeout")
	return cmd
}

func checkHealth(ctx context.Context, url string, timeout time.Duration) error {
	if ctx == nil {
		ctx = context.Background()
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unhealthy: %s returned %s", url, resp.Status)
	}
	return nil
}

// isHealthCommand reports whether the CLI args invoke `kidra health`.
func isHealthCommand(args []string) bool {
	return len(args) > 1 && args[1] == "health"
}
