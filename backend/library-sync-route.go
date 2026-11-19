package main

import (
	"net/http"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// RegisterLibrarySyncRoute adds POST /api/kidra/library/sync, which pulls the library
// repository and re-parses it right away instead of waiting for the pull cron. It answers
// once the libraries are parsed; previews keep rendering in the background.
//
// sync returns nil until the server has started (the sync is created in OnServe).
func RegisterLibrarySyncRoute(app core.App, sync func() *LibrarySync) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.POST("/api/kidra/library/sync", func(e *core.RequestEvent) error {
			librarySync := sync()
			if librarySync == nil {
				return e.Error(http.StatusServiceUnavailable, "Library sync is not ready yet.", nil)
			}
			if !librarySync.Run(true) {
				return e.Error(http.StatusConflict, "A library sync is already running.", nil)
			}
			return e.NoContent(http.StatusNoContent)
		}).Bind(apis.RequireAuth())
		return se.Next()
	})
}
