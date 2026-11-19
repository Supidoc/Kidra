package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/config"
	"github.com/go-git/go-git/v5/plumbing"
)

// GitManager owns the clone of the KiCad library repository.
//
// Kidra only reads the library, so the clone is a mirror of one remote branch:
// Pull() fetches that branch and hard-resets the worktree to it. This also follows
// force-pushes and lets the configured branch change between restarts (e.g. dev
// tracks "dev", prod tracks "main"). An empty branch means the branch that is
// checked out, i.e. the remote's default branch after the first clone.
//
// The repository may not exist yet (e.g. no network at start-up); Pull() then
// retries the clone. mu is a RWMutex: Pull/clone take the write lock, readers
// (parsers, renderer, 3D model route) take short read locks.
type GitManager struct {
	mu       sync.RWMutex
	repo     *git.Repository
	repoURL  string
	repoPath string
	branch   string
}

// NewGitManager creates a manager without touching the network. branch may be
// empty to follow the remote's default branch.
func NewGitManager(gitRepoURL string, gitRepoPath string, branch string) (*GitManager, error) {
	absPath, err := filepath.Abs(gitRepoPath)
	if err != nil {
		return nil, fmt.Errorf("resolve repository path: %w", err)
	}
	return &GitManager{repoURL: gitRepoURL, repoPath: absPath, branch: branch}, nil
}

// RepoPath returns the absolute on-disk path of the worktree.
func (manager *GitManager) RepoPath() string {
	return manager.repoPath
}

// Ready reports whether the repository has been opened or cloned.
func (manager *GitManager) Ready() bool {
	manager.mu.RLock()
	defer manager.mu.RUnlock()
	return manager.repo != nil
}

// ensureLocked opens the repository or clones it. It returns true when a clone
// happened. The caller must hold the write lock.
func (manager *GitManager) ensureLocked() (bool, error) {
	if manager.repo != nil {
		return false, nil
	}
	if err := os.MkdirAll(filepath.Dir(manager.repoPath), 0o755); err != nil {
		return false, fmt.Errorf("create repository parent directory: %w", err)
	}

	repo, err := git.PlainOpen(manager.repoPath)
	if err == nil {
		manager.repo = repo
		return false, nil
	}
	if !errors.Is(err, git.ErrRepositoryNotExists) {
		return false, fmt.Errorf("open repository %s: %w", manager.repoPath, err)
	}

	_, statErr := os.Stat(manager.repoPath)
	existedBefore := statErr == nil

	options := &git.CloneOptions{URL: manager.repoURL}
	if manager.branch != "" {
		options.ReferenceName = plumbing.NewBranchReferenceName(manager.branch)
		options.SingleBranch = true
	}
	repo, err = git.PlainClone(manager.repoPath, false, options)
	if err != nil {
		// Don't leave a half-cloned directory behind so the next attempt clones
		// again, but never delete a directory that existed before.
		if !existedBefore {
			_ = os.RemoveAll(manager.repoPath)
		}
		return false, fmt.Errorf("clone repository %s (branch %q): %w", manager.repoURL, manager.branch, err)
	}
	manager.repo = repo
	return true, nil
}

// targetBranchLocked returns the branch to mirror: the configured one, or the
// branch currently checked out.
func (manager *GitManager) targetBranchLocked() (string, error) {
	if manager.branch != "" {
		return manager.branch, nil
	}
	head, err := manager.repo.Head()
	if err != nil {
		return "", fmt.Errorf("read HEAD: %w", err)
	}
	if !head.Name().IsBranch() {
		return "", fmt.Errorf("HEAD of %s is detached; set KIDRA_LIBRARY_BRANCH", manager.repoPath)
	}
	return head.Name().Short(), nil
}

// Pull clones the repository if needed, then fetches the target branch and resets
// the worktree to it. It returns true when the worktree changed (fresh clone, new
// commits, force-push or a different branch). Even when the fetch fails (offline),
// an existing clone stays usable: check Ready().
func (manager *GitManager) Pull() (bool, error) {
	manager.mu.Lock()
	defer manager.mu.Unlock()

	cloned, err := manager.ensureLocked()
	if err != nil {
		return false, err
	}
	if cloned {
		return true, nil
	}

	branch, err := manager.targetBranchLocked()
	if err != nil {
		return false, err
	}
	localRef := plumbing.NewBranchReferenceName(branch)
	remoteRef := plumbing.NewRemoteReferenceName("origin", branch)

	err = manager.repo.Fetch(&git.FetchOptions{
		RemoteName: "origin",
		RefSpecs:   []config.RefSpec{config.RefSpec(fmt.Sprintf("+%s:%s", localRef, remoteRef))},
		Force:      true,
	})
	if err != nil && !errors.Is(err, git.NoErrAlreadyUpToDate) {
		return false, fmt.Errorf("fetch branch %q of %s: %w", branch, manager.repoURL, err)
	}

	remote, err := manager.repo.Reference(remoteRef, true)
	if err != nil {
		return false, fmt.Errorf("branch %q not found on %s: %w", branch, manager.repoURL, err)
	}

	head, err := manager.repo.Head()
	if err == nil && head.Name() == localRef && head.Hash() == remote.Hash() {
		return false, nil
	}

	worktree, err := manager.repo.Worktree()
	if err != nil {
		return false, fmt.Errorf("get repository worktree: %w", err)
	}

	// Point the local branch at the remote commit, check it out and discard
	// anything else in the worktree: the clone is a read-only mirror.
	if err := manager.repo.Storer.SetReference(plumbing.NewHashReference(localRef, remote.Hash())); err != nil {
		return false, fmt.Errorf("update branch %q: %w", branch, err)
	}
	if err := worktree.Checkout(&git.CheckoutOptions{Branch: localRef, Force: true}); err != nil {
		return false, fmt.Errorf("checkout branch %q: %w", branch, err)
	}
	if err := worktree.Reset(&git.ResetOptions{Commit: remote.Hash(), Mode: git.HardReset}); err != nil {
		return false, fmt.Errorf("reset to origin/%s: %w", branch, err)
	}

	return true, nil
}
