package main

import (
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func TestParseEnvFile(t *testing.T) {
	input := "\uFEFF# comment\n" +
		"\n" +
		"PLAIN=value\n" +
		"  SPACED  =  spaced value  \n" +
		"export EXPORTED=yes\n" +
		"INLINE=abc # trailing comment\n" +
		"HASH=abc#def\n" +
		"DOUBLE=\"a \\\"quoted\\\" #not comment\\nnext\" # comment\n" +
		"SINGLE='literal \\n $HOME'\n" +
		"EMPTY=\n" +
		"EMPTY_QUOTED=\"\"\n" +
		"EQUALS=a=b=c\n" +
		"DUP=first\n" +
		"DUP=second\n"

	got, err := parseEnvFile(strings.NewReader(input))
	if err != nil {
		t.Fatal(err)
	}
	want := [][2]string{
		{"PLAIN", "value"},
		{"SPACED", "spaced value"},
		{"EXPORTED", "yes"},
		{"INLINE", "abc"},
		{"HASH", "abc#def"},
		{"DOUBLE", "a \"quoted\" #not comment\nnext"},
		{"SINGLE", `literal \n $HOME`},
		{"EMPTY", ""},
		{"EMPTY_QUOTED", ""},
		{"EQUALS", "a=b=c"},
		{"DUP", "second"},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got  %q\nwant %q", got, want)
	}
}

func TestParseEnvFileErrors(t *testing.T) {
	for _, input := range []string{
		"NOEQUALS\n",
		"1BAD=x\n",
		"BAD KEY=x\n",
		"UNTERMINATED=\"abc\n",
		"TRAILING=\"abc\" junk\n",
	} {
		if _, err := parseEnvFile(strings.NewReader(input)); err == nil {
			t.Errorf("expected an error for %q", input)
		}
	}
}

func TestLoadEnvFile(t *testing.T) {
	dir := t.TempDir()
	content := "KIDRA_TEST_ENVFILE_NEW=from-file\nKIDRA_TEST_ENVFILE_SET=from-file\n"
	if err := os.WriteFile(filepath.Join(dir, envFileName), []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}

	t.Setenv("KIDRA_ENV_FILE", "")
	os.Unsetenv("KIDRA_ENV_FILE")
	t.Setenv("KIDRA_TEST_ENVFILE_SET", "from-env")
	t.Setenv("KIDRA_TEST_ENVFILE_NEW", "")
	os.Unsetenv("KIDRA_TEST_ENVFILE_NEW")

	path, err := loadEnvFile(dir)
	if err != nil {
		t.Fatal(err)
	}
	if path != filepath.Join(dir, envFileName) {
		t.Fatalf("loaded %q", path)
	}
	if got := os.Getenv("KIDRA_TEST_ENVFILE_NEW"); got != "from-file" {
		t.Errorf("new var = %q", got)
	}
	if got := os.Getenv("KIDRA_TEST_ENVFILE_SET"); got != "from-env" {
		t.Errorf("already-set var was overridden: %q", got)
	}
}

func TestLoadEnvFileMissing(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("KIDRA_ENV_FILE", "")
	os.Unsetenv("KIDRA_ENV_FILE")

	// The default file is optional.
	if path, err := loadEnvFile(dir); err != nil || path != "" {
		t.Fatalf("missing default file: path=%q err=%v", path, err)
	}

	// An explicit KIDRA_ENV_FILE must exist.
	t.Setenv("KIDRA_ENV_FILE", filepath.Join(dir, "nope.env"))
	if _, err := loadEnvFile(dir); err == nil {
		t.Fatal("expected an error for a missing KIDRA_ENV_FILE")
	}
}

func TestLoadEnvFileExplicit(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "custom.env")
	if err := os.WriteFile(path, []byte("KIDRA_TEST_ENVFILE_CUSTOM='x y'\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("KIDRA_ENV_FILE", path)
	t.Setenv("KIDRA_TEST_ENVFILE_CUSTOM", "")
	os.Unsetenv("KIDRA_TEST_ENVFILE_CUSTOM")

	if _, err := loadEnvFile(t.TempDir()); err != nil {
		t.Fatal(err)
	}
	if got := os.Getenv("KIDRA_TEST_ENVFILE_CUSTOM"); got != "x y" {
		t.Fatalf("got %q", got)
	}
}
