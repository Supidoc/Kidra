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

type KicadSymbolLibrary struct {
	name     string
	fileName string
	symbols  []KicadSymbol
}

type KicadSymbol struct {
	name     string
	hash     string
	pinCount int
}

// ParseSymbolLibraries reads symbols/*.kicad_sym from the repository worktree and
// syncs the symbolLibraries/symbols collections. It returns the render jobs for
// symbols whose preview is missing or out of date (only when rendering is available).
func ParseSymbolLibraries(manager *GitManager, app core.App, renderAvailable bool) ([]renderJob, error) {
	symbolLibraries, err := readSymbolLibraries(manager)
	if err != nil {
		return nil, err
	}
	return UpdateSymbolLibrariesInDatabase(app, symbolLibraries, renderAvailable)
}

func readSymbolLibraries(manager *GitManager) ([]*KicadSymbolLibrary, error) {
	manager.mu.RLock()
	defer manager.mu.RUnlock()

	repoFS := os.DirFS(manager.RepoPath())
	entries, err := fs.ReadDir(repoFS, "symbols")
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return nil, nil
		}
		return nil, fmt.Errorf("read symbols directory: %w", err)
	}

	symbolLibraries := make([]*KicadSymbolLibrary, 0)
	for _, entry := range entries {
		if entry.IsDir() || path.Ext(entry.Name()) != ".kicad_sym" {
			continue
		}
		content, err := fs.ReadFile(repoFS, path.Join("symbols", entry.Name()))
		if err != nil {
			return nil, fmt.Errorf("read symbol library file %q: %w", entry.Name(), err)
		}
		symbolLibrary, err := ParseSymbolLibrary(entry.Name(), content)
		if err != nil {
			return nil, fmt.Errorf("parse symbol library: %w", err)
		}
		symbolLibraries = append(symbolLibraries, symbolLibrary)
	}
	return symbolLibraries, nil
}

// ParseSymbolLibrary parses the content of one .kicad_sym file.
func ParseSymbolLibrary(fileName string, fileContent []byte) (*KicadSymbolLibrary, error) {
	parsed, err := parser.Parse(fileContent)
	if err != nil {
		return nil, fmt.Errorf("parse symbol library file %q: %w", fileName, err)
	}

	if len(parsed.List()) == 0 || sexprHead(parsed.List()[0]) != "kicad_symbol_lib" {
		return nil, fmt.Errorf("invalid symbol library file: %s", fileName)
	}

	symbolLibrary := &KicadSymbolLibrary{
		name:     strings.TrimSuffix(fileName, ".kicad_sym"),
		fileName: fileName,
		symbols:  make([]KicadSymbol, 0),
	}
	for _, info := range collectSymbolInfos(parsed.List()[0]) {
		symbolLibrary.symbols = append(symbolLibrary.symbols, KicadSymbol{name: info.name, hash: info.hash, pinCount: info.pinCount})
	}

	return symbolLibrary, nil
}

func UpdateSymbolLibrariesInDatabase(app core.App, symbolLibraries []*KicadSymbolLibrary, renderAvailable bool) ([]renderJob, error) {
	libraryCollection, err := app.FindCollectionByNameOrId("symbolLibraries")
	if err != nil {
		return nil, fmt.Errorf("find symbol_libraries collection: %w", err)
	}

	libraryRecords, err := app.FindAllRecords("symbolLibraries")
	if err != nil {
		return nil, fmt.Errorf("find symbol library records: %w", err)
	}

	// Mark all existing symbol libraries as unavailable if they are not in the new list
	for _, record := range libraryRecords {
		if slices.ContainsFunc(symbolLibraries, func(lib *KicadSymbolLibrary) bool {
			return lib.name == record.GetString("name")
		}) {
			continue
		}
		if !record.GetBool("available") {
			continue
		}
		record.Set("available", false)
		if err := app.Save(record); err != nil {
			return nil, fmt.Errorf("mark symbol library %q unavailable: %w", record.GetString("name"), err)
		}
	}

	// Add new libraries and set existing ones as available
	for _, library := range symbolLibraries {
		record, err := app.FindFirstRecordByData("symbolLibraries", "name", library.name)
		if errors.Is(err, sql.ErrNoRows) {
			record = core.NewRecord(libraryCollection)
			record.Set("name", library.name)
			record.Set("available", true)

			if err := app.Save(record); err != nil {
				return nil, fmt.Errorf("save symbol library %q: %w", library.name, err)
			}
		} else if err != nil {
			return nil, fmt.Errorf("find symbol library %q: %w", library.name, err)
		} else if !record.GetBool("available") {
			record.Set("available", true)
			if err := app.Save(record); err != nil {
				return nil, fmt.Errorf("save symbol library %q: %w", library.name, err)
			}
		}
	}

	libraryRecords, err = app.FindAllRecords("symbolLibraries")
	if err != nil {
		return nil, fmt.Errorf("find symbol library records: %w", err)
	}

	var jobs []renderJob
	for _, record := range libraryRecords {
		if !record.GetBool("available") {
			if err := SetSymbolsUnavailableForLibrary(app, record); err != nil {
				return nil, fmt.Errorf("set symbols unavailable for library %q: %w", record.GetString("name"), err)
			}
			continue
		}
		symbolLibraryIndex := slices.IndexFunc(symbolLibraries, func(lib *KicadSymbolLibrary) bool {
			return lib.name == record.GetString("name")
		})
		if symbolLibraryIndex >= 0 {
			symbolLibrary := symbolLibraries[symbolLibraryIndex]
			libraryJobs, err := CreateAndUpdateSymbolsForLibrary(app, symbolLibrary, record, renderAvailable)
			if err != nil {
				return nil, fmt.Errorf("create and update symbols for library %q: %w", record.GetString("name"), err)
			}
			jobs = append(jobs, libraryJobs...)
		}
	}

	return jobs, nil
}

func CreateAndUpdateSymbolsForLibrary(app core.App, library *KicadSymbolLibrary, symbolLibrary *core.Record, renderAvailable bool) ([]renderJob, error) {
	records, err := app.FindRecordsByFilter("symbols", "library = {:libraryId}", "", 0, 0, dbx.Params{"libraryId": symbolLibrary.Id})
	if err != nil {
		return nil, fmt.Errorf("find symbol records: %w", err)
	}
	collection, err := app.FindCollectionByNameOrId("symbols")
	if err != nil {
		return nil, fmt.Errorf("find symbols collection: %w", err)
	}

	var jobs []renderJob
	for _, symbol := range library.symbols {
		index := slices.IndexFunc(records, func(record *core.Record) bool {
			return record.GetString("name") == symbol.name
		})
		var record *core.Record
		changed := false
		if index >= 0 {
			record = records[index]
		} else {
			record = core.NewRecord(collection)
			record.Set("name", symbol.name)
			record.Set("library", symbolLibrary.Id)
			changed = true
		}
		if !record.GetBool("available") {
			record.Set("available", true)
			changed = true
		}
		if record.GetInt("pinCount") != symbol.pinCount {
			record.Set("pinCount", symbol.pinCount)
			changed = true
		}
		if applySourceHash(record, symbol.hash, renderAvailable) {
			changed = true
		}
		if changed {
			if err := app.Save(record); err != nil {
				return nil, fmt.Errorf("save symbol %q: %w", symbol.name, err)
			}
		}
		if renderAvailable && needsRender(record, symbol.hash) {
			jobs = append(jobs, renderJob{
				kind:     renderKindSymbol,
				recordId: record.Id,
				input:    path.Join("symbols", library.fileName),
				name:     symbol.name,
				hash:     symbol.hash,
			})
		}
	}

	// Mark symbols that are no longer present in the library as unavailable
	for _, record := range records {
		index := slices.IndexFunc(library.symbols, func(symbol KicadSymbol) bool {
			return symbol.name == record.GetString("name")
		})
		if index < 0 && record.GetBool("available") {
			record.Set("available", false)
			if err := app.Save(record); err != nil {
				return nil, fmt.Errorf("update symbol %q: %w", record.GetString("name"), err)
			}
		}
	}
	return jobs, nil
}

func SetSymbolsUnavailableForLibrary(app core.App, symbolLibrary *core.Record) error {
	records, err := app.FindRecordsByFilter("symbols", "library = {:libraryId} && available = true", "", 0, 0, dbx.Params{"libraryId": symbolLibrary.Id})
	if err != nil {
		return fmt.Errorf("find symbol records: %w", err)
	}

	for _, record := range records {
		record.Set("available", false)
		if err := app.Save(record); err != nil {
			return fmt.Errorf("update symbol %q: %w", record.GetString("name"), err)
		}
	}
	return nil
}
