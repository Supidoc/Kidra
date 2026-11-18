package main

import (
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func RegisterModelHooks(app *pocketbase.PocketBase) {

	// Update the valueRaw field of a part record whenever it is created or updated, if its value is numeric.
	app.OnRecordUpdate("parts").BindFunc(func(e *core.RecordEvent) error {
		if e.Record.GetBool("isNumeric") {
			e.Record.Set("valueRaw", PartRecordValue(e.Record, app))
		}

		return e.Next()
	})

	// Update the valueRaw field of a part record whenever it is created or updated, if its value is numeric.
	app.OnRecordCreate("parts").BindFunc(func(e *core.RecordEvent) error {
		if e.Record.GetBool("isNumeric") {
			e.Record.Set("valueRaw", PartRecordValue(e.Record, app))
		}

		return e.Next()
	})

}
