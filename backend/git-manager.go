package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/go-git/go-git/v5"
)

// GitManager owns the clone of the KiCad library repository.
//
// The repository may not exist yet (e.g. no network at start-up); Pull() then
// retries the clone. mu is a RWMutex: Pull/clone take the write lock, readers
// (parsers, renderer, 3D model route) take short read locks.
type GitManager struct {
	mu       sync.RWMutex
	repo     *git.Repository
	repoURL  string
	repoPath string
}

// NewGitManager creates a manager without touching the network.
func NewGitManager(gitRepoURL string, gitRepoPath string) (*GitManager, error) {
	absPath, err := filepath.Abs(gitRepoPath)
	if err != nil {
		return nil, fmt.Errorf("resolve repository path: %w", err)
	}
	return &GitManager{repoURL: gitRepoURL, repoPath: absPath}, nil
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

	repo, err = git.PlainClone(manager.repoPath, false, &git.CloneOptions{URL: manager.repoURL})
	if err != nil {
		// Don't leave a half-cloned directory behind so the next attempt clones
		// again, but never delete a directory that existed before.
		if !existedBefore {
			_ = os.RemoveAll(manager.repoPath)
		}
		return false, fmt.Errorf("clone repository %s: %w", manager.repoURL, err)
	}
	manager.repo = repo
	return true, nil
}

// Pull clones the repository if needed and pulls. It returns true when the worktree
// changed (fresh clone or new commits). Even when the pull itself fails (offline),
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

	worktree, err := manager.repo.Worktree()
	if err != nil {
		return false, fmt.Errorf("get repository worktree: %w", err)
	}

	err = worktree.Pull(&git.PullOptions{RemoteName: "origin"})
	if errors.Is(err, git.NoErrAlreadyUpToDate) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("pull repository %s: %w", manager.repoPath, err)
	}

	return true, nil
}
