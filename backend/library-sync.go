package main

import (
	"context"
	"path/filepath"
	"regexp"
	"sync"
	"sync/atomic"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/filesystem"
)

type renderKind string

const (
	renderKindSymbol    renderKind = "symbols"
	renderKindFootprint renderKind = "footprints"
)

// renderJob is one symbol/footprint whose SVG preview must be (re)rendered.
type renderJob struct {
	kind     renderKind // also the collection name
	recordId string
	input    string // repo-relative path: symbols/<lib>.kicad_sym or footprints/<lib>.pretty
	name     string // symbol name / footprint name inside the library
	hash     string // source hash the render corresponds to
}

// applySourceHash updates sourceHash during parsing. With a renderer, sourceHash is
// only written after a successful render (see LibrarySync.render), so it means
// "the preview matches this source". Without a renderer, the hash is stored right
// away and a now-stale preview is dropped; previews stay empty, so installing
// kicad-cli later renders every entry with an empty preview.
// It returns true when the record was modified.
func applySourceHash(record *core.Record, hash string, renderAvailable bool) bool {
	if renderAvailable || record.GetString("sourceHash") == hash {
		return false
	}
	record.Set("sourceHash", hash)
	if record.GetString("preview") != "" {
		record.Set("preview", nil)
	}
	return true
}

// needsRender reports whether the record's preview is missing or out of date.
func needsRender(record *core.Record, hash string) bool {
	return record.GetString("preview") == "" || record.GetString("sourceHash") != hash
}

// LibrarySync pulls the library repository, parses it into the database and
// renders previews in the background. Runs never overlap.
type LibrarySync struct {
	app      core.App
	git      *GitManager
	renderer Renderer

	syncing atomic.Bool
	parsed  atomic.Bool // the last parse succeeded

	renderMu  sync.Mutex
	rendering bool
	pending   []renderJob
}

func NewLibrarySync(app core.App, git *GitManager, renderer Renderer) *LibrarySync {
	return &LibrarySync{app: app, git: git, renderer: renderer}
}

// Run pulls the repository and re-parses it when it changed, when force is set, or
// when the previous parse failed. Errors are logged; it never panics or exits.
// It returns false without doing anything when another run is in progress.
func (s *LibrarySync) Run(force bool) bool {
	if !s.syncing.CompareAndSwap(false, true) {
		return false
	}
	defer s.syncing.Store(false)

	logger := s.app.Logger()
	changed, err := s.git.Pull()
	if err != nil {
		logger.Warn("library repository pull failed", "error", err)
	}
	if !s.git.Ready() {
		return true // not cloned yet (offline?); the cron retries
	}
	if changed {
		logger.Info("library repository updated")
	}
	if !changed && !force && s.parsed.Load() {
		return true
	}

	renderAvailable := s.renderer.Available()
	ok := true
	symbolJobs, err := ParseSymbolLibraries(s.git, s.app, renderAvailable)
	if err != nil {
		ok = false
		logger.Error("parsing symbol libraries failed", "error", err)
	}
	footprintJobs, err := ParseFootprintLibraries(s.git, s.app, renderAvailable)
	if err != nil {
		ok = false
		logger.Error("parsing footprint libraries failed", "error", err)
	}
	s.parsed.Store(ok)
	logger.Info("library repository parsed", "symbolsToRender", len(symbolJobs), "footprintsToRender", len(footprintJobs))

	if renderAvailable {
		s.scheduleRender(append(symbolJobs, footprintJobs...))
	}
	return true
}

// scheduleRender hands jobs to the background renderer. If a render run is in
// progress, the new set replaces any queued one and runs right after it.
func (s *LibrarySync) scheduleRender(jobs []renderJob) {
	if len(jobs) == 0 {
		return
	}
	s.renderMu.Lock()
	s.pending = jobs
	if s.rendering {
		s.renderMu.Unlock()
		return
	}
	s.rendering = true
	s.renderMu.Unlock()

	go s.renderLoop()
}

func (s *LibrarySync) renderLoop() {
	for {
		s.renderMu.Lock()
		jobs := s.pending
		s.pending = nil
		if len(jobs) == 0 {
			s.rendering = false
			s.renderMu.Unlock()
			return
		}
		s.renderMu.Unlock()

		rendered, failed := 0, 0
		for _, job := range jobs {
			if err := s.render(job); err != nil {
				failed++
				s.app.Logger().Warn("rendering preview failed", "collection", string(job.kind), "name", job.name, "error", err)
			} else {
				rendered++
			}
		}
		s.app.Logger().Info("preview rendering finished", "rendered", rendered, "failed", failed)
	}
}

var unsafeFileChars = regexp.MustCompile(`[^A-Za-z0-9._-]+`)

func (s *LibrarySync) render(job renderJob) error {
	var svg []byte
	var err error
	// Hold the read lock only for the kicad-cli call, so a pull can run between jobs.
	s.git.mu.RLock()
	input := filepath.Join(s.git.RepoPath(), filepath.FromSlash(job.input))
	switch job.kind {
	case renderKindSymbol:
		svg, err = s.renderer.RenderSymbol(context.Background(), input, job.name)
	default:
		svg, err = s.renderer.RenderFootprint(context.Background(), input, job.name)
	}
	s.git.mu.RUnlock()
	if err != nil {
		return err
	}

	record, err := s.app.FindRecordById(string(job.kind), job.recordId)
	if err != nil {
		return err // deleted meanwhile
	}
	file, err := filesystem.NewFileFromBytes(svg, unsafeFileChars.ReplaceAllString(job.name, "_")+".svg")
	if err != nil {
		return err
	}
	record.Set("preview", file)
	record.Set("sourceHash", job.hash)
	return s.app.Save(record)
}
