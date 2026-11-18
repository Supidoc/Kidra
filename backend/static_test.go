package main

import (
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/pocketbase/pocketbase/tests"
)

func writeTestUI(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	files := map[string]string{
		"index.html":                     "<!doctype html><title>kidra-spa</title>",
		"robots.txt":                     "User-agent: *",
		"_app/immutable/entry/app.A1.js": "console.log('app')",
	}
	for name, content := range files {
		path := filepath.Join(dir, filepath.FromSlash(name))
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return dir
}

func TestStaticSPA(t *testing.T) {
	t.Setenv("KIDRA_PUBLIC_DIR", writeTestUI(t))

	factory := func(t testing.TB) *tests.TestApp {
		app, err := tests.NewTestApp()
		if err != nil {
			t.Fatal(err)
		}
		RegisterInfoRoute(app)
		RegisterStatic(app)
		return app
	}
	headers := func(want map[string]string) func(testing.TB, *tests.TestApp, *http.Response) {
		return func(t testing.TB, _ *tests.TestApp, res *http.Response) {
			for key, value := range want {
				if got := res.Header.Get(key); got != value {
					t.Errorf("%s = %q, want %q", key, got, value)
				}
			}
		}
	}

	scenarios := []tests.ApiScenario{
		{
			Name:            "index",
			Method:          http.MethodGet,
			URL:             "/",
			ExpectedStatus:  200,
			ExpectedContent: []string{"kidra-spa"},
			AfterTestFunc:   headers(map[string]string{"Cache-Control": cacheNoCache}),
		},
		{
			Name:            "deep link falls back to index.html",
			Method:          http.MethodGet,
			URL:             "/app/parts/abc",
			ExpectedStatus:  200,
			ExpectedContent: []string{"kidra-spa"},
			AfterTestFunc:   headers(map[string]string{"Cache-Control": cacheNoCache}),
		},
		{
			Name:            "immutable asset",
			Method:          http.MethodGet,
			URL:             "/_app/immutable/entry/app.A1.js",
			ExpectedStatus:  200,
			ExpectedContent: []string{"console.log"},
			AfterTestFunc:   headers(map[string]string{"Cache-Control": cacheImmutable}),
		},
		{
			Name:            "missing build asset is a 404",
			Method:          http.MethodGet,
			URL:             "/_app/immutable/entry/gone.js",
			ExpectedStatus:  404,
			ExpectedContent: []string{`"status":404`},
		},
		{
			Name:            "other static file",
			Method:          http.MethodGet,
			URL:             "/robots.txt",
			ExpectedStatus:  200,
			ExpectedContent: []string{"User-agent"},
			AfterTestFunc:   headers(map[string]string{"Cache-Control": cacheNoCache}),
		},
		{
			Name:            "unknown api route is a JSON 404",
			Method:          http.MethodGet,
			URL:             "/api/nope",
			ExpectedStatus:  404,
			ExpectedContent: []string{`"status":404`},
			AfterTestFunc:   headers(map[string]string{"Content-Type": "application/json"}),
		},
		{
			Name:            "unknown kicad-api route is a JSON 404",
			Method:          http.MethodGet,
			URL:             "/kicad-api/v2/nope",
			ExpectedStatus:  404,
			ExpectedContent: []string{`"status":404`},
		},
		{
			Name:            "existing api routes still win",
			Method:          http.MethodGet,
			URL:             "/api/health",
			ExpectedStatus:  200,
			ExpectedContent: []string{`"code":200`},
		},
		{
			Name:            "info endpoint is public",
			Method:          http.MethodGet,
			URL:             "/api/kidra/info",
			ExpectedStatus:  200,
			ExpectedContent: []string{`"version":"dev"`, `"commit":"unknown"`, `"kicadCli":`},
		},
	}
	for _, scenario := range scenarios {
		scenario.TestAppFactory = factory
		scenario.Test(t)
	}
}

func TestIsAPIPath(t *testing.T) {
	for name, want := range map[string]bool{
		"api":                true,
		"api/nope":           true,
		"kicad-api":          true,
		"kicad-api/v1/x":     true,
		"apis":               false,
		"app/parts":          false,
		"":                   false,
		"kicad-api-like/foo": false,
	} {
		if got := isAPIPath(name); got != want {
			t.Errorf("isAPIPath(%q) = %v, want %v", name, got, want)
		}
	}
}

func TestIsUnder(t *testing.T) {
	dir := t.TempDir()
	if !isUnder(filepath.Join(dir, "go-build1", "exe", "kidra"), dir) {
		t.Error("expected a path inside dir")
	}
	if isUnder(filepath.Join(filepath.Dir(dir), "elsewhere", "kidra"), dir) {
		t.Error("expected a path outside dir")
	}
}
