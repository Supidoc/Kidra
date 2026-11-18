package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestCheckHealth(t *testing.T) {
	ok := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer ok.Close()
	failing := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer failing.Close()

	ctx := context.Background()
	if err := checkHealth(ctx, ok.URL, time.Second); err != nil {
		t.Errorf("healthy server: %v", err)
	}
	if err := checkHealth(ctx, failing.URL, time.Second); err == nil {
		t.Error("expected an error for a 503")
	}
	closed := httptest.NewServer(http.NotFoundHandler())
	closed.Close()
	if err := checkHealth(ctx, closed.URL, time.Second); err == nil {
		t.Error("expected an error when nothing listens")
	}
}

func TestHealthCommandExitCode(t *testing.T) {
	failing := httptest.NewServer(http.NotFoundHandler())
	defer failing.Close()

	cmd := newHealthCommand()
	cmd.SetArgs([]string{"--url", failing.URL})
	cmd.SilenceErrors = true
	if err := cmd.Execute(); err == nil {
		t.Error("expected the health command to fail on a 404")
	}
}

func TestIsHealthCommand(t *testing.T) {
	if !isHealthCommand([]string{"kidra", "health", "--url=x"}) {
		t.Error("health not detected")
	}
	if isHealthCommand([]string{"kidra", "serve"}) || isHealthCommand([]string{"kidra"}) {
		t.Error("false positive")
	}
}
