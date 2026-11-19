package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"
)

// sourceRepo is a local "remote" with a main and a dev branch.
type sourceRepo struct {
	t    *testing.T
	path string
	repo *git.Repository
}

func newSourceRepo(t *testing.T) *sourceRepo {
	t.Helper()
	path := t.TempDir()
	repo, err := git.PlainInitWithOptions(path, &git.PlainInitOptions{
		InitOptions: git.InitOptions{DefaultBranch: plumbing.NewBranchReferenceName("main")},
	})
	if err != nil {
		t.Fatal(err)
	}
	source := &sourceRepo{t: t, path: path, repo: repo}
	source.commit("lib.txt", "main v1")
	// dev starts from main, then diverges.
	head, _ := repo.Head()
	if err := repo.Storer.SetReference(plumbing.NewHashReference(plumbing.NewBranchReferenceName("dev"), head.Hash())); err != nil {
		t.Fatal(err)
	}
	source.checkout("dev")
	source.commit("lib.txt", "dev v1")
	source.checkout("main")
	return source
}

func (source *sourceRepo) checkout(branch string) {
	source.t.Helper()
	worktree, _ := source.repo.Worktree()
	if err := worktree.Checkout(&git.CheckoutOptions{Branch: plumbing.NewBranchReferenceName(branch), Force: true}); err != nil {
		source.t.Fatal(err)
	}
}

func (source *sourceRepo) commit(file string, content string) plumbing.Hash {
	source.t.Helper()
	worktree, _ := source.repo.Worktree()
	if err := os.WriteFile(filepath.Join(source.path, file), []byte(content), 0o644); err != nil {
		source.t.Fatal(err)
	}
	if _, err := worktree.Add(file); err != nil {
		source.t.Fatal(err)
	}
	hash, err := worktree.Commit(content, &git.CommitOptions{
		Author: &object.Signature{Name: "test", Email: "test@example.com", When: time.Now()},
	})
	if err != nil {
		source.t.Fatal(err)
	}
	return hash
}

func readLib(t *testing.T, manager *GitManager) string {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(manager.RepoPath(), "lib.txt"))
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

func mustPull(t *testing.T, manager *GitManager, wantChanged bool) {
	t.Helper()
	changed, err := manager.Pull()
	if err != nil {
		t.Fatalf("Pull: %v", err)
	}
	if changed != wantChanged {
		t.Fatalf("Pull changed = %v, want %v", changed, wantChanged)
	}
}

func TestGitManagerDefaultBranch(t *testing.T) {
	source := newSourceRepo(t)
	manager, _ := NewGitManager(source.path, filepath.Join(t.TempDir(), "clone"), "")

	mustPull(t, manager, true) // clone
	if got := readLib(t, manager); got != "main v1" {
		t.Fatalf("lib = %q, want main v1", got)
	}
	mustPull(t, manager, false) // up to date

	source.commit("lib.txt", "main v2")
	mustPull(t, manager, true)
	if got := readLib(t, manager); got != "main v2" {
		t.Fatalf("lib = %q, want main v2", got)
	}
}

func TestGitManagerBranchAndForcePush(t *testing.T) {
	source := newSourceRepo(t)
	clonePath := filepath.Join(t.TempDir(), "clone")
	manager, _ := NewGitManager(source.path, clonePath, "dev")

	mustPull(t, manager, true)
	if got := readLib(t, manager); got != "dev v1" {
		t.Fatalf("lib = %q, want dev v1", got)
	}

	// New commit on dev.
	source.checkout("dev")
	devV2 := source.commit("lib.txt", "dev v2")
	mustPull(t, manager, true)
	if got := readLib(t, manager); got != "dev v2" {
		t.Fatalf("lib = %q, want dev v2", got)
	}

	// Force-push: dev is rewritten to a commit that is not a descendant.
	mainHead, _ := source.repo.Reference(plumbing.NewBranchReferenceName("main"), true)
	if err := source.repo.Storer.SetReference(plumbing.NewHashReference(plumbing.NewBranchReferenceName("dev"), mainHead.Hash())); err != nil {
		t.Fatal(err)
	}
	source.checkout("dev")
	rewritten := source.commit("lib.txt", "dev rewritten")
	if rewritten == devV2 {
		t.Fatal("expected a different commit")
	}
	mustPull(t, manager, true)
	if got := readLib(t, manager); got != "dev rewritten" {
		t.Fatalf("lib = %q, want dev rewritten", got)
	}

	// Local edits in the mirror are discarded.
	if err := os.WriteFile(filepath.Join(clonePath, "lib.txt"), []byte("local edit"), 0o644); err != nil {
		t.Fatal(err)
	}
	source.commit("lib.txt", "dev v3")
	mustPull(t, manager, true)
	if got := readLib(t, manager); got != "dev v3" {
		t.Fatalf("lib = %q, want dev v3", got)
	}
}

func TestGitManagerSwitchBranchOnExistingClone(t *testing.T) {
	source := newSourceRepo(t)
	clonePath := filepath.Join(t.TempDir(), "clone")

	// First run: a single-branch clone of dev.
	devManager, _ := NewGitManager(source.path, clonePath, "dev")
	mustPull(t, devManager, true)

	// Restart with KIDRA_LIBRARY_BRANCH=main on the same clone.
	mainManager, _ := NewGitManager(source.path, clonePath, "main")
	mustPull(t, mainManager, true)
	if got := readLib(t, mainManager); got != "main v1" {
		t.Fatalf("lib = %q, want main v1", got)
	}
	head, _ := mainManager.repo.Head()
	if head.Name() != plumbing.NewBranchReferenceName("main") {
		t.Fatalf("HEAD = %s, want refs/heads/main", head.Name())
	}
	mustPull(t, mainManager, false)
}

func TestGitManagerMissingBranch(t *testing.T) {
	source := newSourceRepo(t)
	manager, _ := NewGitManager(source.path, filepath.Join(t.TempDir(), "clone"), "nope")
	if _, err := manager.Pull(); err == nil {
		t.Fatal("expected an error for a missing branch")
	}
	if manager.Ready() {
		t.Fatal("failed clone must not leave a ready repository")
	}
}
