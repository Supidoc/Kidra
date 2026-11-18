package main

import (
	"errors"
	"io/fs"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// 3D models of footprints, resolved inside the library repository or KiCad's stock models.
//
// A footprint's (model "...") path usually starts with a KiCad path variable.
// ${KICAD<n>_3DMODEL_DIR}, ${KICAD_USER_3DMODEL_DIR} (any KICAD*_3DMODEL_DIR) and
// ${KIPRJMOD} map to modelDir (KIDRA_3DMODEL_DIR, repo-relative, default "3dmodels");
// ${KICAD_USER_BASE_DIR} maps to the repository root. Relative paths without a
// variable are taken relative to modelDir. Absolute paths and unknown variables
// never resolve.
//
// The versioned ${KICAD<n>_3DMODEL_DIR} variables point at KiCad's stock model library.
// When a stock directory is configured (KIDRA_KICAD_STOCK_3DMODEL_DIR) or found in a
// common install location, they resolve there first and fall back to the repository.

var (
	stockModelVariable = regexp.MustCompile(`\$[{(]KICAD[0-9]+_3DMODEL_DIR[})]`)
	modelDirVariable   = regexp.MustCompile(`\$[{(](KICAD[A-Z0-9_]*_3DMODEL_DIR|KIPRJMOD)[})]`)
	modelBaseVariable  = regexp.MustCompile(`\$[{(]KICAD[0-9]*_USER_BASE_DIR[})]`)
	anyVariable        = regexp.MustCompile(`\$[{(][^})]*[})]`)
	windowsDrive       = regexp.MustCompile(`^[A-Za-z]:`)
)

var errModelPathOutsideRepo = errors.New("model path resolves outside the repository")

// modelRelativePath turns a footprint's model3d value into a cleaned repo-relative
// slash path. It rejects absolute paths, unknown variables and paths escaping the repo.
func modelRelativePath(model3d string, modelDir string) (string, error) {
	value := strings.TrimSpace(strings.ReplaceAll(model3d, `\`, "/"))
	if value == "" {
		return "", fs.ErrNotExist
	}
	modelDir = strings.Trim(strings.ReplaceAll(modelDir, `\`, "/"), "/")
	if modelDir == "" {
		modelDir = "."
	}

	switch {
	case modelDirVariable.MatchString(value):
		value = modelDirVariable.ReplaceAllLiteralString(value, modelDir)
	case modelBaseVariable.MatchString(value):
		value = modelBaseVariable.ReplaceAllLiteralString(value, ".")
	case strings.HasPrefix(value, "/") || windowsDrive.MatchString(value):
		return "", errModelPathOutsideRepo
	default:
		value = modelDir + "/" + value
	}
	if anyVariable.MatchString(value) || strings.HasPrefix(value, "/") {
		return "", errModelPathOutsideRepo
	}

	cleaned := path.Clean(value)
	if cleaned == "." || cleaned == ".." || strings.HasPrefix(cleaned, "../") {
		return "", errModelPathOutsideRepo
	}
	return cleaned, nil
}

// modelCandidates lists the files to try for a model, in order: the referenced
// file, then the same stem as .step/.stp, then as .wrl.
func modelCandidates(relativePath string) []string {
	extension := path.Ext(relativePath)
	stem := strings.TrimSuffix(relativePath, extension)
	candidates := []string{relativePath}
	for _, alternative := range []string{".step", ".STEP", ".stp", ".STP", ".wrl", ".WRL"} {
		candidate := stem + alternative
		if candidate != relativePath {
			candidates = append(candidates, candidate)
		}
	}
	return candidates
}

// stockRelativePath turns a model3d value that starts with a versioned
// ${KICAD<n>_3DMODEL_DIR} into a cleaned path relative to the stock model directory.
// Other values return fs.ErrNotExist; paths escaping the directory are rejected.
func stockRelativePath(model3d string) (string, error) {
	value := strings.TrimSpace(strings.ReplaceAll(model3d, `\`, "/"))
	location := stockModelVariable.FindStringIndex(value)
	if location == nil || location[0] != 0 {
		return "", fs.ErrNotExist
	}
	value = "./" + value[location[1]:]
	if anyVariable.MatchString(value) {
		return "", errModelPathOutsideRepo
	}
	cleaned := path.Clean(value)
	if cleaned == "." || cleaned == ".." || strings.HasPrefix(cleaned, "../") {
		return "", errModelPathOutsideRepo
	}
	return cleaned, nil
}

// resolveInside finds the first existing candidate of relativePath below root. The result
// is guaranteed (after resolving symlinks) to be inside root; otherwise fs.ErrNotExist or
// errModelPathOutsideRepo.
func resolveInside(root string, relativePath string) (string, error) {
	root, err := filepath.EvalSymlinks(root)
	if err != nil {
		return "", err
	}
	for _, candidate := range modelCandidates(relativePath) {
		resolved, err := filepath.EvalSymlinks(filepath.Join(root, filepath.FromSlash(candidate)))
		if err != nil {
			continue
		}
		if !isInside(root, resolved) {
			return "", errModelPathOutsideRepo
		}
		info, err := os.Stat(resolved)
		if err != nil || !info.Mode().IsRegular() {
			continue
		}
		return resolved, nil
	}
	return "", fs.ErrNotExist
}

// resolveFootprintModel finds the model file on disk: in stockDir first for versioned
// ${KICAD<n>_3DMODEL_DIR} references (when stockDir is set), then in the repository
// (when repoRoot is set). It returns an absolute path inside one of them, or an error
// (fs.ErrNotExist when nothing was found).
func resolveFootprintModel(repoRoot string, modelDir string, stockDir string, model3d string) (string, error) {
	if stockDir != "" {
		if relativePath, err := stockRelativePath(model3d); err == nil {
			if resolved, err := resolveInside(stockDir, relativePath); err == nil {
				return resolved, nil
			}
		}
	}
	if repoRoot == "" {
		return "", fs.ErrNotExist
	}
	relativePath, err := modelRelativePath(model3d, modelDir)
	if err != nil {
		return "", err
	}
	return resolveInside(repoRoot, relativePath)
}

// stockModelDirCandidates are common install locations of KiCad's stock 3D models.
var stockModelDirCandidates = []string{
	"/usr/share/kicad/3dmodels",
	"/usr/local/share/kicad/3dmodels",
	"/var/lib/flatpak/app/org.kicad.KiCad/current/active/files/share/kicad/3dmodels",
	"/Applications/KiCad/KiCad.app/Contents/SharedSupport/3dmodels",
	`C:\Program Files\KiCad\10.0\share\kicad\3dmodels`,
}

// findStockModelDir returns configured (KIDRA_KICAD_STOCK_3DMODEL_DIR) when set, else the
// first existing directory of candidates, else "".
func findStockModelDir(configured string, candidates []string) string {
	if configured != "" {
		return configured
	}
	for _, candidate := range candidates {
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
	}
	return ""
}

func isInside(root string, target string) bool {
	relative, err := filepath.Rel(root, target)
	if err != nil {
		return false
	}
	return relative != ".." && !strings.HasPrefix(relative, ".."+string(filepath.Separator)) && !filepath.IsAbs(relative)
}

// modelFormat returns a short format name and the content type for a model file.
func modelFormat(fileName string) (string, string) {
	switch strings.ToLower(filepath.Ext(fileName)) {
	case ".step", ".stp":
		return "step", "model/step"
	case ".wrl":
		return "wrl", "model/vrml"
	default:
		return "other", "application/octet-stream"
	}
}

type footprintModelInfo struct {
	Exists   bool   `json:"exists"`
	Model3d  string `json:"model3d"`
	Filename string `json:"filename,omitempty"`
	Format   string `json:"format,omitempty"`
}

// RegisterFootprintModelRoutes registers:
//
//	GET  /api/footprint-model/{id}       the model file (HEAD works too); 404 when absent
//	GET  /api/footprint-model/{id}/info  {"exists","model3d","filename","format"}
//
// Both need an authenticated user who may view the footprint (footprints viewRule).
// stockDir is KiCad's stock 3D model directory, or "" (see resolveFootprintModel).
func RegisterFootprintModelRoutes(app core.App, git func() *GitManager, modelDir string, stockDir string) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		findModel := func(e *core.RequestEvent) (*core.Record, string, error) {
			record, err := e.App.FindRecordById("footprints", e.Request.PathValue("id"))
			if err != nil {
				return nil, "", e.NotFoundError("Footprint not found.", nil)
			}
			info, err := e.RequestInfo()
			if err != nil {
				return nil, "", e.BadRequestError("", err)
			}
			allowed, err := e.App.CanAccessRecord(record, info, record.Collection().ViewRule)
			if err != nil || !allowed {
				return nil, "", e.NotFoundError("Footprint not found.", nil)
			}
			model3d := record.GetString("model3d")
			if model3d == "" {
				return record, "", nil
			}
			repoRoot := ""
			manager := git()
			if manager != nil {
				manager.mu.RLock()
				defer manager.mu.RUnlock()
				repoRoot = manager.RepoPath()
			}
			resolved, err := resolveFootprintModel(repoRoot, modelDir, stockDir, model3d)
			if err != nil {
				return record, "", nil
			}
			return record, resolved, nil
		}

		se.Router.GET("/api/footprint-model/{id}/info", func(e *core.RequestEvent) error {
			record, resolved, err := findModel(e)
			if err != nil {
				return err
			}
			result := footprintModelInfo{Model3d: record.GetString("model3d")}
			if resolved != "" {
				result.Exists = true
				result.Filename = filepath.Base(resolved)
				result.Format, _ = modelFormat(resolved)
			}
			return e.JSON(http.StatusOK, result)
		}).Bind(apis.RequireAuth())

		se.Router.GET("/api/footprint-model/{id}", func(e *core.RequestEvent) error {
			_, resolved, err := findModel(e)
			if err != nil {
				return err
			}
			if resolved == "" {
				return e.NotFoundError("No 3D model available for this footprint.", nil)
			}
			file, err := os.Open(resolved)
			if err != nil {
				return e.NotFoundError("No 3D model available for this footprint.", nil)
			}
			defer file.Close()
			stat, err := file.Stat()
			if err != nil {
				return e.InternalServerError("", err)
			}

			name := filepath.Base(resolved)
			_, contentType := modelFormat(name)
			header := e.Response.Header()
			header.Set("Content-Type", contentType)
			header.Set("Content-Disposition", `inline; filename="`+strings.ReplaceAll(name, `"`, "")+`"`)
			header.Set("X-Model-Filename", name)
			header.Set("Access-Control-Expose-Headers", "Content-Disposition, X-Model-Filename, Content-Length")
			header.Set("Cache-Control", "private, no-cache")
			http.ServeContent(e.Response, e.Request, name, stat.ModTime(), file)
			return nil
		}).Bind(apis.RequireAuth())

		return se.Next()
	})
}
