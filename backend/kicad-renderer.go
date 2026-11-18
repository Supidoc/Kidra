package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// Renderer turns KiCad symbols and footprints into SVG previews. kicad-cli is
// optional: without it a no-op renderer is used and previews stay empty.
type Renderer interface {
	Available() bool
	RenderSymbol(ctx context.Context, libPath string, name string) ([]byte, error)
	RenderFootprint(ctx context.Context, prettyDir string, name string) ([]byte, error)
}

// ErrRendererUnavailable is returned by the no-op renderer.
var ErrRendererUnavailable = errors.New("kicad-cli is not available")

const renderTimeout = 60 * time.Second

// lookupKicadCli resolves kicad-cli from KIDRA_KICAD_CLI, falling back to the PATH.
// configured tells whether KIDRA_KICAD_CLI was set.
func lookupKicadCli() (cliPath string, configured bool, err error) {
	if configuredPath := strings.TrimSpace(os.Getenv("KIDRA_KICAD_CLI")); configuredPath != "" {
		cliPath, err = exec.LookPath(configuredPath)
		return cliPath, true, err
	}
	cliPath, err = exec.LookPath("kicad-cli")
	return cliPath, false, err
}

// NewRenderer resolves kicad-cli (see lookupKicadCli).
// When it can't be found it logs one warning and returns a no-op renderer.
func NewRenderer(logger *slog.Logger) Renderer {
	cliPath, configured, err := lookupKicadCli()
	if err != nil {
		if configured {
			logger.Warn("KIDRA_KICAD_CLI is set but not executable; symbol/footprint previews are disabled", "path", os.Getenv("KIDRA_KICAD_CLI"), "error", err)
		} else {
			logger.Warn("kicad-cli not found (set KIDRA_KICAD_CLI or add it to PATH); symbol/footprint previews are disabled")
		}
		return noopRenderer{}
	}
	logger.Info("kicad-cli found; symbol/footprint previews enabled", "path", cliPath)
	return &kicadCliRenderer{cliPath: cliPath}
}

type noopRenderer struct{}

func (noopRenderer) Available() bool { return false }
func (noopRenderer) RenderSymbol(context.Context, string, string) ([]byte, error) {
	return nil, ErrRendererUnavailable
}
func (noopRenderer) RenderFootprint(context.Context, string, string) ([]byte, error) {
	return nil, ErrRendererUnavailable
}

type kicadCliRenderer struct {
	cliPath string
}

func (r *kicadCliRenderer) Available() bool { return true }

// RenderSymbol runs `kicad-cli sym export svg --symbol <name> -o <tmp> <lib.kicad_sym>`.
// Multi-unit symbols produce one file per unit (<name>_unit1.svg, ...); unit 1 is used.
func (r *kicadCliRenderer) RenderSymbol(ctx context.Context, libPath string, name string) ([]byte, error) {
	return r.run(ctx, []string{"sym", "export", "svg", "--symbol", name}, libPath)
}

// RenderFootprint runs `kicad-cli fp export svg --footprint <name> -o <tmp> <lib.pretty>`.
func (r *kicadCliRenderer) RenderFootprint(ctx context.Context, prettyDir string, name string) ([]byte, error) {
	return r.run(ctx, []string{"fp", "export", "svg", "--footprint", name}, prettyDir)
}

func (r *kicadCliRenderer) run(ctx context.Context, args []string, input string) ([]byte, error) {
	outDir, err := os.MkdirTemp("", "kidra-render-*")
	if err != nil {
		return nil, fmt.Errorf("create temp dir: %w", err)
	}
	defer os.RemoveAll(outDir)

	ctx, cancel := context.WithTimeout(ctx, renderTimeout)
	defer cancel()

	fullArgs := append(append([]string{}, args...), "-o", outDir, input)
	cmd := exec.CommandContext(ctx, r.cliPath, fullArgs...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		if ctx.Err() != nil {
			return nil, fmt.Errorf("kicad-cli timed out after %s", renderTimeout)
		}
		return nil, fmt.Errorf("kicad-cli %s: %w: %s", strings.Join(args[:2], " "), err, strings.TrimSpace(string(output)))
	}

	svgPath, err := pickRenderedSvg(outDir)
	if err != nil {
		return nil, fmt.Errorf("%w (kicad-cli output: %s)", err, strings.TrimSpace(string(output)))
	}
	return os.ReadFile(svgPath)
}

// pickRenderedSvg chooses the output file in a fresh output dir: a "*_unit1.svg"
// when present (multi-unit symbols), otherwise the first .svg by name.
func pickRenderedSvg(dir string) (string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return "", err
	}
	var svgs []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.EqualFold(filepath.Ext(entry.Name()), ".svg") {
			svgs = append(svgs, entry.Name())
		}
	}
	if len(svgs) == 0 {
		return "", errors.New("kicad-cli produced no svg")
	}
	sort.Strings(svgs)
	for _, name := range svgs {
		if strings.HasSuffix(name, "_unit1.svg") {
			return filepath.Join(dir, name), nil
		}
	}
	return filepath.Join(dir, svgs[0]), nil
}
