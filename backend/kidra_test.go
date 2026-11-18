package main

import (
	"crypto/tls"
	"errors"
	"io/fs"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/core"
)

const sampleSymbolLib = `(kicad_symbol_lib
	(version 20231120)
	(generator "kicad_symbol_editor")
	(symbol "R"
		(pin_numbers hide)
		(property "Reference" "R" (at 2.032 0 90))
		(symbol "R_0_1"
			(rectangle (start -1.016 -2.54) (end 1.016 2.54) (stroke (width 0.254) (type default)) (fill (type none)))
		)
		(symbol "R_1_1"
			(pin passive line (at 0 3.81 270) (length 1.27) (name "~" (effects (font (size 1.27 1.27)))) (number "1" (effects (font (size 1.27 1.27)))))
			(pin passive line (at 0 -3.81 90) (length 1.27) (name "~" (effects (font (size 1.27 1.27)))) (number "2" (effects (font (size 1.27 1.27)))))
		)
	)
	(symbol "OpAmp_Dual"
		(symbol "OpAmp_Dual_1_1"
			(pin input line (at -7.62 2.54 0) (length 2.54) (name "+" (effects (font (size 1.27 1.27)))) (number "3" (effects (font (size 1.27 1.27)))))
			(pin output line (at 7.62 0 180) (length 2.54) (name "~" (effects (font (size 1.27 1.27)))) (number "1" (effects (font (size 1.27 1.27)))))
		)
		(symbol "OpAmp_Dual_2_1"
			(pin input line (at -7.62 2.54 0) (length 2.54) (name "+" (effects (font (size 1.27 1.27)))) (number "5" (effects (font (size 1.27 1.27)))))
		)
		(symbol "OpAmp_Dual_3_1"
			(pin power_in line (at -2.54 -7.62 90) (length 3.81) (name "V-" (effects (font (size 1.27 1.27)))) (number "4" (effects (font (size 1.27 1.27)))))
			(pin power_in line (at -2.54 7.62 270) (length 3.81) (name "V+" (effects (font (size 1.27 1.27)))) (number "8" (effects (font (size 1.27 1.27)))))
		)
		(symbol "OpAmp_Dual_3_2"
			(pin power_in line (at -2.54 -7.62 90) (length 3.81) (name "V-" (effects (font (size 1.27 1.27)))) (number "4" (effects (font (size 1.27 1.27)))))
		)
	)
	(symbol "R_Small" (extends "R")
		(property "Reference" "R" (at 0 0 0))
	)
	(symbol "Orphan" (extends "DoesNotExist"))
)
`

func symbolsByName(t *testing.T, content string) map[string]KicadSymbol {
	t.Helper()
	library, err := ParseSymbolLibrary("passive.kicad_sym", []byte(content))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if library.name != "passive" {
		t.Fatalf("library name = %q", library.name)
	}
	result := make(map[string]KicadSymbol)
	for _, symbol := range library.symbols {
		result[symbol.name] = symbol
	}
	return result
}

func TestSymbolPinCounts(t *testing.T) {
	symbols := symbolsByName(t, sampleSymbolLib)
	if len(symbols) != 4 {
		t.Fatalf("expected 4 top-level symbols, got %d: %v", len(symbols), symbols)
	}
	cases := map[string]int{"R": 2, "OpAmp_Dual": 5, "R_Small": 2, "Orphan": 0}
	for name, want := range cases {
		if got := symbols[name].pinCount; got != want {
			t.Errorf("%s pinCount = %d, want %d", name, got, want)
		}
		if len(symbols[name].hash) != 64 {
			t.Errorf("%s hash %q is not a sha256 hex", name, symbols[name].hash)
		}
	}
}

func TestSymbolHashStability(t *testing.T) {
	original := symbolsByName(t, sampleSymbolLib)

	// Whitespace-only changes keep every hash.
	reformatted := symbolsByName(t, "\n"+strings.ReplaceAll(sampleSymbolLib, "\t", "    "))
	for name, symbol := range original {
		if reformatted[name].hash != symbol.hash {
			t.Errorf("%s hash changed on reformat", name)
		}
	}

	// Changing R changes R and the derived R_Small, but not OpAmp_Dual.
	changed := symbolsByName(t, strings.ReplaceAll(sampleSymbolLib, "(width 0.254)", "(width 0.3)"))
	if changed["R"].hash == original["R"].hash {
		t.Error("R hash did not change")
	}
	if changed["R_Small"].hash == original["R_Small"].hash {
		t.Error("R_Small hash did not change with its parent")
	}
	if changed["OpAmp_Dual"].hash != original["OpAmp_Dual"].hash {
		t.Error("OpAmp_Dual hash changed although it did not")
	}
}

const sampleFootprint = `(footprint "SOT-23-5"
	(version 20240108)
	(layer "F.Cu")
	(pad "1" smd roundrect (at -1.1375 -0.95) (size 1.325 0.6) (layers "F.Cu" "F.Paste" "F.Mask"))
	(pad "2" smd roundrect (at -1.1375 0) (size 1.325 0.6) (layers "F.Cu" "F.Paste" "F.Mask"))
	(pad "3" smd roundrect (at -1.1375 0.95) (size 1.325 0.6) (layers "F.Cu" "F.Paste" "F.Mask"))
	(pad "4" smd roundrect (at 1.1375 0.95) (size 1.325 0.6) (layers "F.Cu" "F.Paste" "F.Mask"))
	(pad "5" smd roundrect (at 1.1375 -0.95) (size 1.325 0.6) (layers "F.Cu" "F.Paste" "F.Mask"))
	(pad "5" smd roundrect (at 1.5 -0.95) (size 0.5 0.5) (layers "F.Cu"))
	(pad "" np_thru_hole circle (at 0 0) (size 1 1) (drill 1) (layers "*.Cu" "*.Mask"))
	(model "${KICAD_USER_3DMODEL_DIR}/packages/SOT-23-5.step"
		(offset (xyz 0 0 0)) (scale (xyz 1 1 1)) (rotate (xyz 0 0 0)))
	(model "${KICAD9_3DMODEL_DIR}/Package_TO_SOT_SMD.3dshapes/SOT-23-5.wrl")
)
`

func TestParseFootprint(t *testing.T) {
	footprint, err := ParseFootprint("SOT-23-5.kicad_mod", []byte(sampleFootprint))
	if err != nil {
		t.Fatal(err)
	}
	if footprint.name != "SOT-23-5" || footprint.fileStem != "SOT-23-5" {
		t.Errorf("name = %q, stem = %q", footprint.name, footprint.fileStem)
	}
	if footprint.padCount != 5 {
		t.Errorf("padCount = %d, want 5", footprint.padCount)
	}
	if footprint.model3d != "${KICAD_USER_3DMODEL_DIR}/packages/SOT-23-5.step" {
		t.Errorf("model3d = %q", footprint.model3d)
	}
	again, _ := ParseFootprint("SOT-23-5.kicad_mod", []byte(strings.ReplaceAll(sampleFootprint, "\t", "  ")))
	if again.hash != footprint.hash {
		t.Error("hash changed on reformat")
	}
	changed, _ := ParseFootprint("SOT-23-5.kicad_mod", []byte(strings.ReplaceAll(sampleFootprint, "(at 0 0)", "(at 0 0.1)")))
	if changed.hash == footprint.hash {
		t.Error("hash did not change on content change")
	}

	if _, err := ParseFootprint("x.kicad_mod", []byte(`(kicad_pcb (version 1))`)); err == nil {
		t.Error("expected an error for a non-footprint file")
	}
	noModel, err := ParseFootprint("x.kicad_mod", []byte(`(footprint "X" (pad 1 thru_hole circle (at 0 0)))`))
	if err != nil || noModel.model3d != "" || noModel.padCount != 1 {
		t.Errorf("unquoted pad / no model: %+v %v", noModel, err)
	}
}

func TestModelRelativePath(t *testing.T) {
	cases := []struct {
		model, dir, want string
		wantErr          bool
	}{
		{"${KICAD_USER_3DMODEL_DIR}/packages/SOT-23.wrl", "3dmodels", "3dmodels/packages/SOT-23.wrl", false},
		{"${KICAD9_3DMODEL_DIR}/Diode_SMD.3dshapes/D_SOD-123.step", "3dmodels", "3dmodels/Diode_SMD.3dshapes/D_SOD-123.step", false},
		{"${KICAD6_3DMODEL_DIR}/x.wrl", "/models/", "models/x.wrl", false},
		{"$(KICAD_3DMODEL_DIR)/x.wrl", "3dmodels", "3dmodels/x.wrl", false},
		{"${KIPRJMOD}/local/x.step", "3dmodels", "3dmodels/local/x.step", false},
		{"${KICAD_USER_BASE_DIR}/3dmodels/connector/1051620001.step", "3dmodels", "3dmodels/connector/1051620001.step", false},
		{`${KICAD_USER_3DMODEL_DIR}\passive\C.step`, "3dmodels", "3dmodels/passive/C.step", false},
		{"relative/x.step", "3dmodels", "3dmodels/relative/x.step", false},
		{"${KICAD_USER_3DMODEL_DIR}/../../etc/passwd", "3dmodels", "", true},
		{"${KIPRJMOD}/../..", "3dmodels", "", true},
		{"/etc/passwd", "3dmodels", "", true},
		{"C:/models/x.step", "3dmodels", "", true},
		{"${HOME}/x.step", "3dmodels", "", true},
		{"", "3dmodels", "", true},
	}
	for _, c := range cases {
		got, err := modelRelativePath(c.model, c.dir)
		if (err != nil) != c.wantErr || got != c.want {
			t.Errorf("modelRelativePath(%q, %q) = %q, %v; want %q, err=%v", c.model, c.dir, got, err, c.want, c.wantErr)
		}
	}
}

func TestResolveFootprintModel(t *testing.T) {
	root := t.TempDir()
	repo := filepath.Join(root, "repo")
	write := func(rel string) {
		full := filepath.Join(repo, rel)
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(full, []byte("x"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	write("3dmodels/packages/SOT-23.step")
	write("3dmodels/packages/SOT-23.wrl")
	write("3dmodels/packages/QFN.wrl")
	write("3dmodels/passive/C.stp")
	if err := os.WriteFile(filepath.Join(root, "secret.step"), []byte("s"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(filepath.Join(root, "secret.step"), filepath.Join(repo, "3dmodels", "escape.step")); err != nil {
		t.Fatal(err)
	}

	cases := []struct {
		model, want string
		wantErr     bool
	}{
		{"${KICAD_USER_3DMODEL_DIR}/packages/SOT-23.wrl", "3dmodels/packages/SOT-23.wrl", false},  // referenced file exists
		{"${KICAD_USER_3DMODEL_DIR}/packages/SOT-23.stp", "3dmodels/packages/SOT-23.step", false}, // fallback prefers .step
		{"${KICAD_USER_3DMODEL_DIR}/packages/QFN.step", "3dmodels/packages/QFN.wrl", false},       // fallback to .wrl
		{"${KICAD_USER_3DMODEL_DIR}/passive/C.wrl", "3dmodels/passive/C.stp", false},
		{"${KICAD_USER_3DMODEL_DIR}/missing.step", "", true},
		{"${KICAD_USER_3DMODEL_DIR}/escape.step", "", true}, // symlink pointing outside the repo
		{"${KICAD_USER_3DMODEL_DIR}/../../secret.step", "", true},
		{"${KICAD_USER_3DMODEL_DIR}/packages", "", true}, // directories are not models
	}
	for _, c := range cases {
		got, err := resolveFootprintModel(repo, "3dmodels", "", c.model)
		if c.wantErr {
			if err == nil {
				t.Errorf("%q: expected error, got %q", c.model, got)
			}
			continue
		}
		resolvedRepo, _ := filepath.EvalSymlinks(repo)
		if err != nil || got != filepath.Join(resolvedRepo, filepath.FromSlash(c.want)) {
			t.Errorf("%q: got %q, %v; want %q", c.model, got, err, c.want)
		}
	}
	if _, err := resolveFootprintModel(repo, "3dmodels", "", "${KICAD_USER_3DMODEL_DIR}/missing.step"); !errors.Is(err, fs.ErrNotExist) {
		t.Errorf("missing model should be fs.ErrNotExist, got %v", err)
	}
}

func TestRequestBaseURL(t *testing.T) {
	request := httptest.NewRequest("GET", "http://kidra.local:8090/kicad-api/v1/parts/x.json", nil)
	if got := requestBaseURL(request); got != "http://kidra.local:8090" {
		t.Errorf("plain: %q", got)
	}
	request.TLS = &tls.ConnectionState{}
	if got := requestBaseURL(request); got != "https://kidra.local:8090" {
		t.Errorf("tls: %q", got)
	}
	request.TLS = nil
	request.Header.Set("X-Forwarded-Proto", "HTTPS, http")
	request.Header.Set("X-Forwarded-Host", "parts.example.com")
	if got := requestBaseURL(request); got != "https://parts.example.com" {
		t.Errorf("forwarded: %q", got)
	}
	request.Header.Set("X-Forwarded-Proto", "javascript")
	if got := requestBaseURL(request); got != "http://parts.example.com" {
		t.Errorf("bogus proto: %q", got)
	}
}

func TestAttachmentURL(t *testing.T) {
	collection := core.NewBaseCollection("attachments")
	collection.Id = "pbc_1874485341"
	record := core.NewRecord(collection)
	record.Id = "abc123"
	record.Set("file", "LM 358_ds.pdf")
	record.Set("url", "https://vendor.example/ds.pdf")
	want := "https://kidra.example/api/files/pbc_1874485341/abc123/LM%20358_ds.pdf"
	if got := attachmentURL("https://kidra.example/", record); got != want {
		t.Errorf("file url = %q, want %q", got, want)
	}
	record.Set("file", "")
	if got := attachmentURL("https://kidra.example", record); got != "https://vendor.example/ds.pdf" {
		t.Errorf("url fallback = %q", got)
	}
}

func TestPickRenderedSvg(t *testing.T) {
	dir := t.TempDir()
	for _, name := range []string{"OpAmp_unit2.svg", "OpAmp_unit1.svg", "notes.txt"} {
		_ = os.WriteFile(filepath.Join(dir, name), []byte("x"), 0o644)
	}
	got, err := pickRenderedSvg(dir)
	if err != nil || filepath.Base(got) != "OpAmp_unit1.svg" {
		t.Errorf("got %q, %v", got, err)
	}
	if _, err := pickRenderedSvg(t.TempDir()); err == nil {
		t.Error("expected error for empty dir")
	}
}
