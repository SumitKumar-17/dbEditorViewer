package store

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/dbeditorviewer/backend/internal/models"
)

const configDir = ".dbeditor"
const configFile = "connections.json"

// ConnectionStore persists connections to ~/.dbeditor/connections.json.
type ConnectionStore struct {
	mu       sync.RWMutex
	filePath string
}

var defaultStore *ConnectionStore
var once sync.Once

// DefaultStore returns the singleton ConnectionStore, initializing it on first call.
func DefaultStore() (*ConnectionStore, error) {
	var initErr error
	once.Do(func() {
		home, err := os.UserHomeDir()
		if err != nil {
			initErr = fmt.Errorf("get home dir: %w", err)
			return
		}

		dir := filepath.Join(home, configDir)
		if err := os.MkdirAll(dir, 0700); err != nil {
			initErr = fmt.Errorf("create config dir: %w", err)
			return
		}

		defaultStore = &ConnectionStore{
			filePath: filepath.Join(dir, configFile),
		}
	})
	if initErr != nil {
		return nil, initErr
	}
	return defaultStore, nil
}

// Load reads all connections from disk. Returns empty slice if file doesn't exist.
func (s *ConnectionStore) Load() ([]models.Connection, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	data, err := os.ReadFile(s.filePath)
	if os.IsNotExist(err) {
		return []models.Connection{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read connections file: %w", err)
	}

	var conns []models.Connection
	if len(data) == 0 {
		return []models.Connection{}, nil
	}
	if err := json.Unmarshal(data, &conns); err != nil {
		return nil, fmt.Errorf("parse connections file: %w", err)
	}
	return conns, nil
}

// Save writes all connections to disk atomically.
func (s *ConnectionStore) Save(conns []models.Connection) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := json.MarshalIndent(conns, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal connections: %w", err)
	}

	// Write to a temp file then rename for atomicity
	tmpPath := s.filePath + ".tmp"
	if err := os.WriteFile(tmpPath, data, 0600); err != nil {
		return fmt.Errorf("write connections file: %w", err)
	}
	if err := os.Rename(tmpPath, s.filePath); err != nil {
		return fmt.Errorf("rename connections file: %w", err)
	}
	return nil
}

// List returns all saved connections.
func (s *ConnectionStore) List() ([]models.Connection, error) {
	return s.Load()
}

// Add appends a connection to the store, or replaces it if the ID already exists.
func (s *ConnectionStore) Add(conn models.Connection) error {
	conns, err := s.Load()
	if err != nil {
		return err
	}
	found := false
	for i, c := range conns {
		if c.ID == conn.ID {
			conns[i] = conn
			found = true
			break
		}
	}
	if !found {
		conns = append(conns, conn)
	}
	return s.Save(conns)
}

// Remove deletes the connection with the given ID from the store.
func (s *ConnectionStore) Remove(id string) error {
	conns, err := s.Load()
	if err != nil {
		return err
	}

	filtered := make([]models.Connection, 0, len(conns))
	found := false
	for _, c := range conns {
		if c.ID == id {
			found = true
			continue
		}
		filtered = append(filtered, c)
	}

	if !found {
		return fmt.Errorf("connection %s not found", id)
	}
	return s.Save(filtered)
}
