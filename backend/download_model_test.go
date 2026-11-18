package main

import (
	"errors"
	"io/fs"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestValidateDownloadURL(t *testing.T) {
	valid := []string{
		"https://example.com/datasheet.pdf",
		"http://example.com:8080/a/b.step?x=1",
	}
	for _, raw := range valid {
		if _, err := validateDownloadURL(raw); err != nil {
			t.Errorf("%q: unexpected error %v", raw, err)
		}
	}
	invalid := []string{
		"",
		"example.com/file.pdf",
		"/relative/path",
		"file:///etc/passwd",
		"ftp://example.com/file",
		"gopher://example.com/",
		"http://",
		"https://user:secret@example.com/file.pdf",
		"javascript:alert(1)",
	}
	for _, raw := range invalid {
		if _, err := validateDownloadURL(raw); err == nil {
			t.Errorf("%q: expected an error", raw)
		}
	}
}

func TestIsPublicIP(t *testing.T) {
	cases := map[string]bool{
		"8.8.8.8":          true,
		"93.184.216.34":    true,
		"2606:4700::1111":  true,
		"127.0.0.1":        false,
		"127.1.2.3":        false,
		"::1":              false,
		"10.0.0.1":         false,
		"172.16.5.4":       false,
		"192.168.1.10":     false,
		"169.254.169.254":  false, // cloud metadata
		"100.64.0.1":       false, // carrier-grade NAT
		"0.0.0.0":          false,
		"0.1.2.3":          false,
		"fd00::1":          false,
		"fe80::1":          false,
		"::ffff:127.0.0.1": false,
		"224.0.0.1":        false,
	}
	for raw, want := range cases {
		if got := isPublicIP(net.ParseIP(raw)); got != want {
			t.Errorf("isPublicIP(%s) = %v, want %v", raw, got, want)
		}
	}
	if isPublicIP(nil) {
		t.Error("nil IP must not be public")
	}
}

func TestDownloadClientRefusesPrivateTargets(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("ok"))
	}))
	defer server.Close()

	_, err := newDownloadClient(false).Get(server.URL)
	if !errors.Is(err, errPrivateTarget) {
		t.Fatalf("loopback download: got %v, want errPrivateTarget", err)
	}

	response, err := newDownloadClient(true).Get(server.URL)
	if err != nil {
		t.Fatalf("allowPrivate download failed: %v", err)
	}
	response.Body.Close()
}

func TestDownloadClientRefusesNonHTTPRedirects(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "file:///etc/passwd", http.StatusFound)
	}))
	defer server.Close()
	if _, err := newDownloadClient(true).Get(server.URL); err == nil {
		t.Fatal("redirect to file:// must fail")
	}
}

func TestStockRelativePath(t *testing.T) {
	cases := []struct {
		model, want string
		err         error
	}{
		{"${KICAD9_3DMODEL_DIR}/Diode_SMD.3dshapes/D_SOD-123.step", "Diode_SMD.3dshapes/D_SOD-123.step", nil},
		{"${KICAD10_3DMODEL_DIR}/a/b.wrl", "a/b.wrl", nil},
		{"$(KICAD6_3DMODEL_DIR)\\a\\b.wrl", "a/b.wrl", nil},
		{"${KICAD_USER_3DMODEL_DIR}/a.step", "", fs.ErrNotExist}, // not a stock variable
		{"${KICAD_3DMODEL_DIR}/a.step", "", fs.ErrNotExist},
		{"a/${KICAD9_3DMODEL_DIR}/b.step", "", fs.ErrNotExist}, // variable must lead
		{"${KICAD9_3DMODEL_DIR}/../../etc/passwd", "", errModelPathOutsideRepo},
		{"${KICAD9_3DMODEL_DIR}/..", "", errModelPathOutsideRepo},
		{"${KICAD9_3DMODEL_DIR}", "", errModelPathOutsideRepo},
		{"${KICAD9_3DMODEL_DIR}/${HOME}/x.step", "", errModelPathOutsideRepo},
	}
	for _, c := range cases {
		got, err := stockRelativePath(c.model)
		if c.err != nil {
			if !errors.Is(err, c.err) {
				t.Errorf("%q: got %q, %v; want error %v", c.model, got, err, c.err)
			}
			continue
		}
		if err != nil || got != c.want {
			t.Errorf("%q: got %q, %v; want %q", c.model, got, err, c.want)
		}
	}
}

func TestResolveFootprintModelStockDir(t *testing.T) {
	root := t.TempDir()
	repo := filepath.Join(root, "repo")
	stock := filepath.Join(root, "stock")
	write := func(rel string) {
		full := filepath.Join(root, rel)
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(full, []byte("x"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	write("stock/Diode_SMD.3dshapes/D_SOD-123.step")
	write("stock/Pkg.3dshapes/QFN.wrl")
	write("repo/3dmodels/Diode_SMD.3dshapes/D_SOD-123.step") // shadowed by the stock model
	write("repo/3dmodels/Custom.3dshapes/Only_In_Repo.step") // fallback to the repo
	write("repo/3dmodels/user/R.step")
	write("secret.step")
	if err := os.Symlink(filepath.Join(root, "secret.step"), filepath.Join(stock, "escape.step")); err != nil {
		t.Fatal(err)
	}
	evalRoot, _ := filepath.EvalSymlinks(root)

	cases := []struct {
		model, stockDir, want string
	}{
		{"${KICAD9_3DMODEL_DIR}/Diode_SMD.3dshapes/D_SOD-123.step", stock, "stock/Diode_SMD.3dshapes/D_SOD-123.step"},
		{"${KICAD8_3DMODEL_DIR}/Pkg.3dshapes/QFN.step", stock, "stock/Pkg.3dshapes/QFN.wrl"}, // extension fallback
		{"${KICAD9_3DMODEL_DIR}/Custom.3dshapes/Only_In_Repo.step", stock, "repo/3dmodels/Custom.3dshapes/Only_In_Repo.step"},
		{"${KICAD9_3DMODEL_DIR}/Diode_SMD.3dshapes/D_SOD-123.step", "", "repo/3dmodels/Diode_SMD.3dshapes/D_SOD-123.step"},
		{"${KICAD_USER_3DMODEL_DIR}/user/R.step", stock, "repo/3dmodels/user/R.step"}, // user models never use stock
		{"${KICAD9_3DMODEL_DIR}/escape.step", stock, ""},                              // symlink escaping the stock dir
		{"${KICAD9_3DMODEL_DIR}/../secret.step", stock, ""},
		{"${KICAD9_3DMODEL_DIR}/missing.step", stock, ""},
	}
	for _, c := range cases {
		got, err := resolveFootprintModel(repo, "3dmodels", c.stockDir, c.model)
		if c.want == "" {
			if err == nil {
				t.Errorf("%q: expected error, got %q", c.model, got)
			}
			continue
		}
		if err != nil || got != filepath.Join(evalRoot, filepath.FromSlash(c.want)) {
			t.Errorf("%q (stock %q): got %q, %v; want %q", c.model, c.stockDir, got, err, c.want)
		}
	}

	// Without a repository (not cloned yet), stock models still resolve.
	if got, err := resolveFootprintModel("", "3dmodels", stock, "${KICAD9_3DMODEL_DIR}/Diode_SMD.3dshapes/D_SOD-123.step"); err != nil || got == "" {
		t.Errorf("stock model without repo: got %q, %v", got, err)
	}
	if _, err := resolveFootprintModel("", "3dmodels", stock, "${KICAD_USER_3DMODEL_DIR}/user/R.step"); !errors.Is(err, fs.ErrNotExist) {
		t.Errorf("user model without repo: got %v, want fs.ErrNotExist", err)
	}
}

func TestFindStockModelDir(t *testing.T) {
	dir := t.TempDir()
	file := filepath.Join(dir, "file")
	if err := os.WriteFile(file, nil, 0o644); err != nil {
		t.Fatal(err)
	}
	if got := findStockModelDir("/configured", []string{dir}); got != "/configured" {
		t.Errorf("configured value must win, got %q", got)
	}
	if got := findStockModelDir("", []string{filepath.Join(dir, "missing"), file, dir}); got != dir {
		t.Errorf("want first existing directory %q, got %q", dir, got)
	}
	if got := findStockModelDir("", []string{filepath.Join(dir, "missing")}); got != "" {
		t.Errorf("want empty, got %q", got)
	}
}
