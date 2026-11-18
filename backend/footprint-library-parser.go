package main

import (
	"database/sql"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path"
	"slices"
	"strings"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"github.com/xiam/s-expr/parser"
)

type KicadFootprintLibrary struct {
	name       string
	dirName    string
	footprints []KicadFootprint
}

type KicadFootprint struct {
	name     string
	fileStem string // KiCad identifies footprints in a .pretty by file name
	hash     string
	padCount int
	model3d  string
}

// ParseFootprintLibraries reads footprints/*.pretty from the repository worktree and
// syncs the footprintLibraries/footprints collections. It returns the render jobs for
// footprints whose preview is missing or out of date (only when rendering is available).
func ParseFootprintLibraries(manager *GitManager, app core.App, renderAvailable bool) ([]renderJob, error) {
	libraries, err := readFootprintLibraries(manager)
	if err != nil {
		return nil, err
	}
	return UpdateFootprintLibrariesInDatabase(app, libraries, renderAvailable)
}

func readFootprintLibraries(manager *GitManager) ([]*KicadFootprintLibrary, error) {
	manager.mu.RLock()
	defer manager.mu.RUnlock()

	repoFS := os.DirFS(manager.RepoPath())
	entries, err := fs.ReadDir(repoFS, "footprints")
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return nil, nil
		}
		return nil, fmt.Errorf("read footprints directory: %w", err)
	}

	libraries := make([]*KicadFootprintLibrary, 0)
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		library, err := ParseFootprintLibrary(repoFS, entry.Name())
		if err != nil {
			return nil, fmt.Errorf("parse footprint library: %w", err)
		}
		libraries = append(libraries, library)
	}
	return libraries, nil
}

// ParseFootprintLibrary parses every .kicad_mod in footprints/<dirName>.
func ParseFootprintLibrary(repoFS fs.FS, dirName string) (*KicadFootprintLibrary, error) {
	library := &KicadFootprintLibrary{
		name:    strings.TrimSuffix(dirName, ".pretty"),
		dirName: dirName,
	}
	entries, err := fs.ReadDir(repoFS, path.Join("footprints", dirName))
	if err != nil {
		return nil, fmt.Errorf("read footprint library %q: %w", dirName, err)
	}

	for _, entry := range entries {
		if entry.IsDir() || path.Ext(entry.Name()) != ".kicad_mod" {
			continue
		}
		content, err := fs.ReadFile(repoFS, path.Join("footprints", dirName, entry.Name()))
		if err != nil {
			return nil, fmt.Errorf("read footprint file %q: %w", entry.Name(), err)
		}
		footprint, err := ParseFootprint(entry.Name(), content)
		if err != nil {
			return nil, fmt.Errorf("parse footprint %q: %w", entry.Name(), err)
		}
		library.footprints = append(library.footprints, *footprint)
	}

	return library, nil
}

// ParseFootprint parses the content of one .kicad_mod file.
func ParseFootprint(fileName string, content []byte) (*KicadFootprint, error) {
	parsed, err := parser.Parse(content)
	if err != nil {
		return nil, fmt.Errorf("parse footprint file: %w", err)
	}
	if len(parsed.List()) == 0 {
		return nil, fmt.Errorf("invalid footprint file: %s", fileName)
	}
	root := parsed.List()[0]
	// "module" is the pre-KiCad-6 head; still accepted by KiCad.
	head := sexprHead(root)
	name := sexprArg(root, 1)
	if (head != "footprint" && head != "module") || name == "" {
		return nil, fmt.Errorf("invalid footprint file: %s", fileName)
	}

	return &KicadFootprint{
		name:     name,
		fileStem: strings.TrimSuffix(fileName, ".kicad_mod"),
		hash:     sexprHash(root),
		padCount: footprintPadCount(root),
		model3d:  footprintModel(root),
	}, nil
}

func UpdateFootprintLibrariesInDatabase(app core.App, footprintLibraries []*KicadFootprintLibrary, renderAvailable bool) ([]renderJob, error) {
	libraryCollection, err := app.FindCollectionByNameOrId("footprintLibraries")
	if err != nil {
		return nil, fmt.Errorf("find footprint_libraries collection: %w", err)
	}

	libraryRecords, err := app.FindAllRecords("footprintLibraries")
	if err != nil {
		return nil, fmt.Errorf("find footprint library records: %w", err)
	}

	// Mark all existing footprint libraries as unavailable if they are not in the new list
	for _, record := range libraryRecords {
		if slices.ContainsFunc(footprintLibraries, func(lib *KicadFootprintLibrary) bool {
			return lib.name == record.GetString("name")
		}) {
			continue
		}
		if !record.GetBool("available") {
			continue
		}
		record.Set("available", false)
		if err := app.Save(record); err != nil {
			return nil, fmt.Errorf("mark footprint library %q unavailable: %w", record.GetString("name"), err)
		}
	}

	// Add new libraries and set existing ones as available
	for _, library := range footprintLibraries {
		record, err := app.FindFirstRecordByData("footprintLibraries", "name", library.name)
		if errors.Is(err, sql.ErrNoRows) {
			record = core.NewRecord(libraryCollection)
			record.Set("name", library.name)
			record.Set("available", true)

			if err := app.Save(record); err != nil {
				return nil, fmt.Errorf("save footprint library %q: %w", library.name, err)
			}
		} else if err != nil {
			return nil, fmt.Errorf("find footprint library %q: %w", library.name, err)
		} else if !record.GetBool("available") {
			record.Set("available", true)
			if err := app.Save(record); err != nil {
				return nil, fmt.Errorf("save footprint library %q: %w", library.name, err)
			}
		}
	}

	libraryRecords, err = app.FindAllRecords("footprintLibraries")
	if err != nil {
		return nil, fmt.Errorf("find footprint library records: %w", err)
	}

	var jobs []renderJob
	for _, record := range libraryRecords {
		if !record.GetBool("available") {
			if err := SetFootprintsUnavailableForLibrary(app, record); err != nil {
				return nil, fmt.Errorf("set footprints unavailable for library %q: %w", record.GetString("name"), err)
			}
			continue
		}
		footprintLibraryIndex := slices.IndexFunc(footprintLibraries, func(lib *KicadFootprintLibrary) bool {
			return lib.name == record.GetString("name")
		})
		if footprintLibraryIndex >= 0 {
			footprintLibrary := footprintLibraries[footprintLibraryIndex]
			libraryJobs, err := CreateAndUpdateFootprintsForLibrary(app, footprintLibrary, record, renderAvailable)
			if err != nil {
				return nil, fmt.Errorf("create and update footprints for library %q: %w", record.GetString("name"), err)
			}
			jobs = append(jobs, libraryJobs...)
		}
	}

	return jobs, nil
}

func CreateAndUpdateFootprintsForLibrary(app core.App, library *KicadFootprintLibrary, footprintLibrary *core.Record, renderAvailable bool) ([]renderJob, error) {
	records, err := app.FindRecordsByFilter("footprints", "library = {:libraryId}", "", 0, 0, dbx.Params{"libraryId": footprintLibrary.Id})
	if err != nil {
		return nil, fmt.Errorf("find footprint records: %w", err)
	}
	collection, err := app.FindCollectionByNameOrId("footprints")
	if err != nil {
		return nil, fmt.Errorf("find footprint collection: %w", err)
	}

	var jobs []renderJob
	for _, footprint := range library.footprints {
		index := slices.IndexFunc(records, func(record *core.Record) bool {
			return record.GetString("name") == footprint.name
		})
		var record *core.Record
		changed := false
		if index >= 0 {
			record = records[index]
		} else {
			record = core.NewRecord(collection)
			record.Set("name", footprint.name)
			record.Set("library", footprintLibrary.Id)
			changed = true
		}
		if !record.GetBool("available") {
			record.Set("available", true)
			changed = true
		}
		if record.GetInt("padCount") != footprint.padCount {
			record.Set("padCount", footprint.padCount)
			changed = true
		}
		if record.GetString("model3d") != footprint.model3d {
			record.Set("model3d", footprint.model3d)
			changed = true
		}
		if applySourceHash(record, footprint.hash, renderAvailable) {
			changed = true
		}
		if changed {
			if err := app.Save(record); err != nil {
				return nil, fmt.Errorf("save footprint %q: %w", footprint.name, err)
			}
		}
		if renderAvailable && needsRender(record, footprint.hash) {
			jobs = append(jobs, renderJob{
				kind:     renderKindFootprint,
				recordId: record.Id,
				input:    path.Join("footprints", library.dirName),
				name:     footprint.fileStem,
				hash:     footprint.hash,
			})
		}
	}

	// Mark footprints that are no longer present in the library as unavailable
	for _, record := range records {
		index := slices.IndexFunc(library.footprints, func(footprint KicadFootprint) bool {
			return footprint.name == record.GetString("name")
		})
		if index < 0 && record.GetBool("available") {
			record.Set("available", false)
			if err := app.Save(record); err != nil {
				return nil, fmt.Errorf("update footprint %q: %w", record.GetString("name"), err)
			}
		}
	}
	return jobs, nil
}

func SetFootprintsUnavailableForLibrary(app core.App, footprintLibrary *core.Record) error {
	records, err := app.FindRecordsByFilter("footprints", "library = {:libraryId} && available = true", "", 0, 0, dbx.Params{"libraryId": footprintLibrary.Id})
	if err != nil {
		return fmt.Errorf("find footprint records: %w", err)
	}

	for _, record := range records {
		record.Set("available", false)
		if err := app.Save(record); err != nil {
			return fmt.Errorf("update footprint %q: %w", record.GetString("name"), err)
		}
	}
	return nil
}
