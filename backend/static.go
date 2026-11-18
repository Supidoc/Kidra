package main

import (
	"io/fs"
	"os"
	"path"
	"strings"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

const (
	cacheImmutable = "public, max-age=31536000, immutable"
	cacheNoCache   = "no-cache"
)

// uiSource picks the SPA to serve: KIDRA_PUBLIC_DIR, else the UI embedded with
// -tags embedui, else ./ui/dist if it exists. It returns a nil fs.FS when there is none.
func uiSource() (fs.FS, string) {
	if dir := envOr("KIDRA_PUBLIC_DIR", ""); dir != "" {
		return os.DirFS(dir), dir
	}
	if embedded := embeddedUIFS(); embedded != nil {
		return embedded, "embedded"
	}
	if info, err := os.Stat("ui/dist"); err == nil && info.IsDir() {
		return os.DirFS("ui/dist"), "./ui/dist"
	}
	return nil, ""
}

// RegisterStatic serves the SPA under "/" with an index.html fallback for client-side
// routes. Unmatched /api/* and /kicad-api/* requests and missing /_app/* build assets get
// a JSON 404 instead.
func RegisterStatic(app core.App) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		fsys, source := uiSource()
		if fsys == nil {
			app.Logger().Warn("no web UI found (set KIDRA_PUBLIC_DIR, build with -tags embedui, or build into ./ui/dist); only the API is served")
			return se.Next()
		}
		app.Logger().Info("serving web UI", "source", source)
		se.Router.GET("/{path...}", spaHandler(fsys))
		return se.Next()
	})
}

func spaHandler(fsys fs.FS) func(*core.RequestEvent) error {
	static := apis.Static(fsys, true)
	return func(e *core.RequestEvent) error {
		name := strings.TrimPrefix(path.Clean("/"+e.Request.PathValue(apis.StaticWildcardParam)), "/")
		if isAPIPath(name) {
			return e.NotFoundError("", nil)
		}
		// A missing build asset (e.g. a stale hashed chunk after a deploy) must 404 rather
		// than get index.html, which the browser would fail to parse as JS/CSS.
		if strings.HasPrefix(name, "_app/") {
			if _, err := fs.Stat(fsys, name); err != nil {
				return e.NotFoundError("", nil)
			}
		}
		e.Response.Header().Set("Cache-Control", cacheControlFor(fsys, name))
		return static(e)
	}
}

func isAPIPath(name string) bool {
	for _, prefix := range []string{"api", "kicad-api"} {
		if name == prefix || strings.HasPrefix(name, prefix+"/") {
			return true
		}
	}
	return false
}

// cacheControlFor returns the Cache-Control header for a request path: hashed build
// assets under _app/immutable/ are cached forever, everything else (index.html and the
// SPA fallback in particular) must be revalidated.
func cacheControlFor(fsys fs.FS, name string) string {
	if strings.HasPrefix(name, "_app/immutable/") {
		if info, err := fs.Stat(fsys, name); err == nil && !info.IsDir() {
			return cacheImmutable
		}
	}
	return cacheNoCache
}
