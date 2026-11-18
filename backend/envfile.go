package main

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// envFileName is the dotenv file looked up in the data dir when KIDRA_ENV_FILE is unset.
const envFileName = "kidra.env"

// loadEnvFile loads KIDRA_ENV_FILE, else <dataDir>/kidra.env, into the process
// environment. Variables that are already set are never overridden. A missing default
// file is not an error; a missing explicit KIDRA_ENV_FILE is. It returns the path that
// was loaded ("" when none).
//
// Meant for native installs (systemd, Windows) that have no compose env_file.
func loadEnvFile(dataDir string) (string, error) {
	path := strings.TrimSpace(os.Getenv("KIDRA_ENV_FILE"))
	explicit := path != ""
	if !explicit {
		path = filepath.Join(dataDir, envFileName)
	}

	f, err := os.Open(path)
	if err != nil {
		if !explicit && errors.Is(err, fs.ErrNotExist) {
			return "", nil
		}
		return "", err
	}
	defer f.Close()

	values, err := parseEnvFile(f)
	if err != nil {
		return "", fmt.Errorf("%s: %w", path, err)
	}
	for _, kv := range values {
		if _, set := os.LookupEnv(kv[0]); set {
			continue
		}
		if err := os.Setenv(kv[0], kv[1]); err != nil {
			return "", fmt.Errorf("%s: setting %s: %w", path, kv[0], err)
		}
	}
	return path, nil
}

// parseEnvFile parses a dotenv file: KEY=VALUE lines, optional "export " prefix, blank
// lines and # comments (whole-line, or after whitespace on unquoted values), and single
// or double quoted values. Double-quoted values support \n, \t, \", \\ escapes; single
// quoted values are literal. Later duplicates win.
func parseEnvFile(r io.Reader) ([][2]string, error) {
	var result [][2]string
	index := map[string]int{}

	scanner := bufio.NewScanner(r)
	lineNo := 0
	for scanner.Scan() {
		lineNo++
		line := strings.TrimSpace(scanner.Text())
		if lineNo == 1 {
			line = strings.TrimPrefix(line, "\uFEFF")
		}
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		line = strings.TrimPrefix(line, "export ")

		key, rawValue, ok := strings.Cut(line, "=")
		key = strings.TrimSpace(key)
		if !ok || !validEnvKey(key) {
			return nil, fmt.Errorf("line %d: expected KEY=VALUE", lineNo)
		}

		value, err := parseEnvValue(strings.TrimSpace(rawValue))
		if err != nil {
			return nil, fmt.Errorf("line %d: %w", lineNo, err)
		}

		if i, seen := index[key]; seen {
			result[i][1] = value
		} else {
			index[key] = len(result)
			result = append(result, [2]string{key, value})
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

func parseEnvValue(raw string) (string, error) {
	if raw == "" {
		return "", nil
	}

	switch quote := raw[0]; quote {
	case '"', '\'':
		end := -1
		for i := 1; i < len(raw); i++ {
			if quote == '"' && raw[i] == '\\' {
				i++
				continue
			}
			if raw[i] == quote {
				end = i
				break
			}
		}
		if end < 0 {
			return "", errors.New("unterminated quoted value")
		}
		rest := strings.TrimSpace(raw[end+1:])
		if rest != "" && !strings.HasPrefix(rest, "#") {
			return "", errors.New("unexpected characters after quoted value")
		}
		inner := raw[1:end]
		if quote == '\'' {
			return inner, nil
		}
		return unescapeDoubleQuoted(inner), nil
	}

	// Unquoted: an inline comment starts at " #".
	for i := 1; i < len(raw); i++ {
		if raw[i] == '#' && (raw[i-1] == ' ' || raw[i-1] == '\t') {
			raw = raw[:i]
			break
		}
	}
	return strings.TrimSpace(raw), nil
}

func unescapeDoubleQuoted(s string) string {
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		if s[i] != '\\' || i+1 == len(s) {
			b.WriteByte(s[i])
			continue
		}
		i++
		switch s[i] {
		case 'n':
			b.WriteByte('\n')
		case 't':
			b.WriteByte('\t')
		case 'r':
			b.WriteByte('\r')
		case '"', '\\', '$':
			b.WriteByte(s[i])
		default:
			b.WriteByte('\\')
			b.WriteByte(s[i])
		}
	}
	return b.String()
}

func validEnvKey(key string) bool {
	if key == "" {
		return false
	}
	for i, c := range key {
		isLetter := c == '_' || (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z')
		isDigit := c >= '0' && c <= '9'
		if !isLetter && !(isDigit && i > 0) {
			return false
		}
	}
	return true
}
