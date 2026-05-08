package db

import (
	"fmt"
	"sync"

	"github.com/dbeditorviewer/backend/internal/db/drivers"
	"github.com/dbeditorviewer/backend/internal/models"
)

// Manager maintains a thread-safe map of active database connections.
type Manager struct {
	mu      sync.RWMutex
	drivers map[string]drivers.Driver
}

// NewManager creates a new connection manager.
func NewManager() *Manager {
	return &Manager{
		drivers: make(map[string]drivers.Driver),
	}
}

// Connect creates a new driver for the given connection and calls Connect().
func (m *Manager) Connect(conn *models.Connection) error {
	drv, err := createDriver(conn)
	if err != nil {
		return fmt.Errorf("create driver: %w", err)
	}
	if err := drv.Connect(); err != nil {
		return fmt.Errorf("driver connect: %w", err)
	}

	m.mu.Lock()
	// Disconnect existing driver for this ID if present
	if existing, ok := m.drivers[conn.ID]; ok {
		existing.Disconnect()
	}
	m.drivers[conn.ID] = drv
	m.mu.Unlock()

	return nil
}

// Disconnect removes and disconnects the driver for the given connection ID.
func (m *Manager) Disconnect(id string) error {
	m.mu.Lock()
	drv, ok := m.drivers[id]
	if ok {
		delete(m.drivers, id)
	}
	m.mu.Unlock()

	if !ok {
		return fmt.Errorf("connection %s not found", id)
	}
	return drv.Disconnect()
}

// Get returns the driver for the given connection ID.
func (m *Manager) Get(id string) (drivers.Driver, error) {
	m.mu.RLock()
	drv, ok := m.drivers[id]
	m.mu.RUnlock()

	if !ok {
		return nil, fmt.Errorf("connection %s not active; please reconnect", id)
	}
	return drv, nil
}

// IsConnected returns true if the connection ID has an active driver.
func (m *Manager) IsConnected(id string) bool {
	m.mu.RLock()
	_, ok := m.drivers[id]
	m.mu.RUnlock()
	return ok
}

// TestURL connects to a URL without persisting anything and returns an error if it fails.
func (m *Manager) TestURL(url string, dbType models.DBType) error {
	tempConn := &models.Connection{ID: "__test__", URL: url, Type: dbType}
	drv, err := createDriver(tempConn)
	if err != nil {
		return fmt.Errorf("create driver: %w", err)
	}
	if err := drv.Connect(); err != nil {
		return fmt.Errorf("connect: %w", err)
	}
	drv.Disconnect()
	return nil
}

// DisconnectAll disconnects all active connections.
func (m *Manager) DisconnectAll() {
	m.mu.Lock()
	defer m.mu.Unlock()

	for id, drv := range m.drivers {
		drv.Disconnect()
		delete(m.drivers, id)
	}
}

// createDriver instantiates the appropriate Driver implementation based on conn.Type.
func createDriver(conn *models.Connection) (drivers.Driver, error) {
	switch conn.Type {
	case models.DBTypePostgres:
		return drivers.NewPostgresDriver(conn.URL), nil
	case models.DBTypeMySQL:
		return drivers.NewMySQLDriver(conn.URL), nil
	case models.DBTypeSQLite:
		return drivers.NewSQLiteDriver(conn.URL), nil
	case models.DBTypeMongoDB:
		return drivers.NewMongoDriver(conn.URL), nil
	default:
		return nil, fmt.Errorf("unsupported database type: %s", conn.Type)
	}
}
