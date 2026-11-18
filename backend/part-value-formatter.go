package main

import (
	"sort"
	"strconv"
	"strings"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

// PartRecordValue returns the value of a part record, formatted according to its unit and whether it is numeric or raw.
func PartRecordValue(partRecord *core.Record, app *pocketbase.PocketBase) string {
	if partRecord == nil {
		return ""
	}
	if partRecord.GetBool("isNumeric") {
		valueSi := partRecord.GetFloat("valueSi")
		unitId := partRecord.GetString("unit")
		activeUnitRecord, err := app.FindRecordById("units", unitId)
		if err != nil {
			return ""
		}
		unitSetId := activeUnitRecord.GetString("unitSet")
		availableUnits, err := app.FindRecordsByFilter("units", "unitSet = {:unitSetId}", "", 0, 0, dbx.Params{"unitSetId": unitSetId})
		if err != nil {
			app.Logger().Error("failed to fetch units for part value", "error", err, "unitSet", unitSetId)
			return strconv.FormatFloat(valueSi, 'f', -1, 64)
		}

		units := make([]KiCadUnit, 0, len(availableUnits))
		for _, unitRecord := range availableUnits {
			units = append(units, KiCadUnit{
				Factor:       unitRecord.GetFloat("factor"),
				SymbolLetter: unitRecord.GetString("symbolLetter"),
			})
		}
		valueInBaseUnit := valueSi * activeUnitRecord.GetFloat("factor")
		return FormatKiCadValue(valueInBaseUnit, units)
	} else {
		return partRecord.GetString("valueRaw")
	}
}

// FormatKiCadValue formats an SI value using KiCad's replacement-letter
// notation, choosing the largest available unit that keeps a leading digit.
// valueSI needs to be in the base unit of the unit set (e.g. Ohm for resistance, F for capacitance).
func FormatKiCadValue(valueSI float64, units []KiCadUnit) string {
	if len(units) == 0 {
		return strconv.FormatFloat(valueSI, 'f', -1, 64)
	}

	sortedUnits := append([]KiCadUnit(nil), units...)
	sort.Slice(sortedUnits, func(i, j int) bool {
		return sortedUnits[i].Factor < sortedUnits[j].Factor
	})

	unit := sortedUnits[0]
	absoluteValue := valueSI
	if absoluteValue < 0 {
		absoluteValue = -absoluteValue
	}
	for _, candidate := range sortedUnits {
		if candidate.Factor <= 0 {
			continue
		}
		if candidate.Factor <= absoluteValue {
			unit = candidate
		}
	}

	if unit.Factor <= 0 {
		return strconv.FormatFloat(valueSI, 'f', -1, 64)
	}

	scaledValue := valueSI / unit.Factor
	formattedValue := strconv.FormatFloat(scaledValue, 'f', -1, 64)
	decimalIndex := strings.IndexByte(formattedValue, '.')
	if decimalIndex < 0 {
		return formattedValue + unit.SymbolLetter
	}

	return formattedValue[:decimalIndex] + unit.SymbolLetter + formattedValue[decimalIndex+1:]
}
