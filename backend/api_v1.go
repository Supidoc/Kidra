package main

import (
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

type CategoryDto struct {
	Id          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
}

type PartDto struct {
	Id                string           `json:"id"`
	Name              string           `json:"name"`
	Description       string           `json:"description,omitempty"`
	Fields            map[string]Field `json:"fields"`
	ExcludeFromBom    string           `json:"exclude_from_bom"`
	ExcludeFromBoard  string           `json:"exclude_from_board"`
	Symbol            string           `json:"symbolIdStr,omitempty"`
	FootprintIdString string           `json:"footprint,omitempty"`
	Keywords          string           `json:"keywords,omitempty"`
}

type Field struct {
	Value   string `json:"value"`
	Visible string `json:"visible,omitempty"`
}

type KiCadUnit struct {
	Factor       float64
	SymbolLetter string
}

type KiCadEndpoint struct {
	Categories string `json:"categories"`
	Parts      string `json:"parts"`
}

// RegisterApiV1 registers the API v1 endpoints for the KiCad API.
func RegisterApiV1(app *pocketbase.PocketBase) {

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {

		// Register the API v1 endpoints
		se.Router.GET("/kicad-api/v1/", func(e *core.RequestEvent) error {

			var kicadEndpoints = KiCadEndpoint{}

			return e.JSON(http.StatusOK, kicadEndpoints)
		})

		// Register the categories endpoint which returns all categories in JSON format.
		se.Router.GET("/kicad-api/v1/categories.json", func(e *core.RequestEvent) error {

			categoryRecords, err := app.FindAllRecords("categories")

			if err != nil {
				return e.String(http.StatusInternalServerError, "Failed to fetch categories")
			}
			var categoriesDto = make([]CategoryDto, len(categoryRecords))
			for i := 0; i < len(categoryRecords); i++ {
				var categoryDto CategoryDto
				categoryDto.Id = categoryRecords[i].Id
				categoryDto.Name = categoryRecords[i].GetString("name")
				categoryDto.Description = categoryRecords[i].GetString("description")
				categoriesDto[i] = categoryDto
			}

			return e.JSON(http.StatusOK, categoriesDto)
		})

		// Register the parts endpoint which returns all parts in a given category in JSON format.
		se.Router.GET("/kicad-api/v1/parts/category/{id}", func(e *core.RequestEvent) error {

			categoryId := e.Request.PathValue("id")

			// Kicad requests {id}.json, which is not possible to register in pocketbase,
			// so we need to remove the .json suffix from the id.
			categoryId = strings.TrimSuffix(categoryId, ".json")

			partsRecords, err := app.FindRecordsByFilter("parts", "category = {:categoryId} && status = 'Active'", "", 0, 0, dbx.Params{"categoryId": categoryId})

			if err != nil {
				return e.String(http.StatusInternalServerError, "Failed to fetch parts")
			}
			var partsDto = make([]PartDto, len(partsRecords))
			for i := 0; i < len(partsRecords); i++ {

				partDto, err := PartRecordToDto(partsRecords[i], app, requestBaseURL(e.Request))
				if err != nil {
					app.Logger().Error("kicad-api: converting part failed", "part", partsRecords[i].Id, "error", err)
					return e.String(http.StatusInternalServerError, "Failed to convert part to DTO")
				}

				partsDto[i] = partDto
			}

			return e.JSON(http.StatusOK, partsDto)
		})

		// Register the part endpoint which returns a single part by its ID in JSON format.
		se.Router.GET("/kicad-api/v1/parts/{id}", func(e *core.RequestEvent) error {
			partId := e.Request.PathValue("id")

			// Kicad requests {id}.json, which is not possible to register in pocketbase,
			// so we need to remove the .json suffix from the id.
			partId = strings.TrimSuffix(partId, ".json")

			partRecord, err := app.FindRecordById("parts", partId)
			if errors.Is(err, sql.ErrNoRows) {
				return e.String(http.StatusNotFound, "Part not found")
			}
			if err != nil {
				return e.String(http.StatusInternalServerError, "Failed to fetch part")
			}
			partDto, err := PartRecordToDto(partRecord, app, requestBaseURL(e.Request))
			if err != nil {
				app.Logger().Error("kicad-api: converting part failed", "part", partId, "error", err)
				return e.String(http.StatusInternalServerError, "Failed to convert part to DTO")
			}

			return e.JSON(http.StatusOK, partDto)
		})

		return se.Next()
	})
}

// partExpandKeys are the relations PartRecordToDto reads.
var partExpandKeys = []string{"tags", "ratings", "manufacturer", "symbol", "symbol.library", "footprint", "footprint.library", "distributorParts", "distributorParts.distributor", "datasheet"}

// PartRecordToDto converts a part record to a PartDto, fetching related symbol and footprint information.
// baseURL (scheme://host of the incoming request) is used for the datasheet file URL.
// Missing relations (no manufacturer, symbol, footprint, datasheet...) are skipped.
func PartRecordToDto(partRecord *core.Record, app *pocketbase.PocketBase, baseURL string) (PartDto, error) {
	var partDto PartDto
	partDto.Id = partRecord.Id
	partDto.Name = PartRecordValue(partRecord, app)
	partDto.Description = partRecord.GetString("description")
	partDto.ExcludeFromBom = partRecord.GetString("excludeFromBom")
	partDto.ExcludeFromBoard = partRecord.GetString("excludeFromBoard")
	partDto.Fields = make(map[string]Field)
	partDto.Fields["Value"] = Field{Value: partDto.Name, Visible: "true"}
	if failed := app.ExpandRecord(partRecord, partExpandKeys, nil); len(failed) > 0 {
		var errs []error
		for key, err := range failed {
			errs = append(errs, fmt.Errorf("expand %s: %w", key, err))
		}
		return partDto, errors.Join(errs...)
	}

	if symbolRecord := partRecord.ExpandedOne("symbol"); symbolRecord != nil {
		partDto.Symbol = libraryQualifiedName(symbolRecord)
	}

	if footprintRecord := partRecord.ExpandedOne("footprint"); footprintRecord != nil {
		// KiCad matches field names case-insensitively; "Footprint" is its canonical name.
		partDto.Fields["Footprint"] = Field{Value: libraryQualifiedName(footprintRecord), Visible: "false"}
	}

	if manufacturerRecord := partRecord.ExpandedOne("manufacturer"); manufacturerRecord != nil {
		partDto.Fields["Manufacturer"] = Field{Value: manufacturerRecord.GetString("name"), Visible: "false"}
	}

	partDto.Fields["Manufacturer Number"] = Field{Value: partRecord.GetString("manufacturerNumber"), Visible: "false"}

	tagRecords := partRecord.ExpandedAll("tags")
	var keywords string
	for _, tagRecord := range tagRecords {
		keywords += tagRecord.GetString("name") + " "
	}
	partDto.Keywords = keywords

	partDto.Fields["Status"] = Field{Value: partRecord.GetString("status"), Visible: "false"}

	ratingsRecords := partRecord.ExpandedAll("ratings")
	for _, ratingRecord := range ratingsRecords {
		fieldName := ratingRecord.GetString("key")
		fieldValue := ratingRecord.GetString("value")
		fieldVisible := "false"
		partDto.Fields[fieldName] = Field{Value: fieldValue, Visible: fieldVisible}
	}

	distributorPartsRecords := partRecord.ExpandedAll("distributorParts")
	for _, distributorPartsRecord := range distributorPartsRecords {
		distributor := distributorPartsRecord.ExpandedOne("distributor")
		if distributor == nil {
			continue
		}
		fieldName := distributor.GetString("name") + " Number"
		fieldValue := distributorPartsRecord.GetString("distributorNumber")
		fieldVisible := "false"
		partDto.Fields[fieldName] = Field{Value: fieldValue, Visible: fieldVisible}
	}

	if datasheetRecord := partRecord.ExpandedOne("datasheet"); datasheetRecord != nil {
		if value := attachmentURL(baseURL, datasheetRecord); value != "" {
			partDto.Fields["Datasheet"] = Field{Value: value, Visible: "false"}
		}
	}

	return partDto, nil
}

// libraryQualifiedName returns "<library>:<name>" for a symbol/footprint record with
// an expanded library, or just the name when the library is missing.
func libraryQualifiedName(record *core.Record) string {
	if library := record.ExpandedOne("library"); library != nil {
		return library.GetString("name") + ":" + record.GetString("name")
	}
	return record.GetString("name")
}

// requestBaseURL returns scheme://host of the request, honouring reverse-proxy
// headers (X-Forwarded-Proto / X-Forwarded-Host).
func requestBaseURL(request *http.Request) string {
	scheme := "http"
	if request.TLS != nil {
		scheme = "https"
	}
	if forwarded := firstHeaderValue(request.Header.Get("X-Forwarded-Proto")); forwarded == "http" || forwarded == "https" {
		scheme = forwarded
	}
	host := request.Host
	if forwarded := firstHeaderValue(request.Header.Get("X-Forwarded-Host")); forwarded != "" {
		host = forwarded
	}
	return scheme + "://" + host
}

func firstHeaderValue(value string) string {
	first, _, _ := strings.Cut(value, ",")
	return strings.ToLower(strings.TrimSpace(first))
}

// attachmentURL returns the PocketBase file URL of an attachment record, or its
// `url` field when it has no file.
func attachmentURL(baseURL string, record *core.Record) string {
	if fileName := record.GetString("file"); fileName != "" {
		return recordFileURL(baseURL, record.BaseFilesPath(), fileName)
	}
	return record.GetString("url")
}

// recordFileURL builds <baseURL>/api/files/<collectionId>/<recordId>/<file>.
func recordFileURL(baseURL string, baseFilesPath string, fileName string) string {
	return strings.TrimRight(baseURL, "/") + "/api/files/" + baseFilesPath + "/" + url.PathEscape(fileName)
}
