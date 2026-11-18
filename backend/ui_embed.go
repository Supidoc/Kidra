//go:build embedui

package main

import (
	"embed"
	"io/fs"
)

// Build the frontend first (`pnpm -C ../frontend build` writes ui/dist).
//
//go:embed all:ui/dist
var embeddedUI embed.FS

// embeddedUIFS returns the SPA compiled into the binary (build tag embedui).
func embeddedUIFS() fs.FS {
	sub, err := fs.Sub(embeddedUI, "ui/dist")
	if err != nil {
		panic(err)
	}
	return sub
}
