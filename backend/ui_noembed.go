//go:build !embedui

package main

import "io/fs"

// embeddedUIFS returns nil: this binary was built without -tags embedui.
func embeddedUIFS() fs.FS { return nil }
