package api

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/dbeditorviewer/backend/internal/db"
	"github.com/dbeditorviewer/backend/internal/models"
	"github.com/dbeditorviewer/backend/internal/store"
)

// ConnectionHandler handles connection CRUD endpoints.
type ConnectionHandler struct {
	manager *db.Manager
	store   *store.ConnectionStore
}

type createConnectionRequest struct {
	Name string `json:"name" binding:"required"`
	URL  string `json:"url"  binding:"required"`
}

// Create handles POST /api/connections
func (h *ConnectionHandler) Create(c *gin.Context) {
	var req createConnectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	dbType := db.DetectDBType(req.URL)
	if dbType == models.DBTypeUnknown {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unrecognized database URL scheme"})
		return
	}

	conn := models.Connection{
		ID:        uuid.New().String(),
		Name:      req.Name,
		URL:       req.URL,
		Type:      dbType,
		CreatedAt: time.Now().UTC(),
	}

	// Attempt to connect
	if err := h.manager.Connect(&conn); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to connect: " + err.Error()})
		return
	}

	// Persist to store
	if err := h.store.Add(conn); err != nil {
		c.JSON(http.StatusCreated, gin.H{
			"connection": safeConn(conn),
			"warning":    "connection active but failed to persist: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"connection": safeConn(conn)})
}

// List handles GET /api/connections
func (h *ConnectionHandler) List(c *gin.Context) {
	conns, err := h.store.List()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	result := make([]gin.H, 0, len(conns))
	for _, conn := range conns {
		item := safeConn(conn)
		item["connected"] = h.manager.IsConnected(conn.ID)
		result = append(result, item)
	}

	c.JSON(http.StatusOK, gin.H{"connections": result})
}

// Delete handles DELETE /api/connections/:id
func (h *ConnectionHandler) Delete(c *gin.Context) {
	id := c.Param("id")

	// Disconnect if active (ignore error if not connected)
	h.manager.Disconnect(id)

	if err := h.store.Remove(id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "connection deleted"})
}

// Test handles POST /api/connections/:id/test — reconnects and tests the connection.
func (h *ConnectionHandler) Test(c *gin.Context) {
	id := c.Param("id")

	conns, err := h.store.List()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var found *models.Connection
	for i := range conns {
		if conns[i].ID == id {
			found = &conns[i]
			break
		}
	}
	if found == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "connection not found"})
		return
	}

	// Reconnect (this also tests the connection)
	if err := h.manager.Connect(found); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "connection test failed: " + err.Error(), "connected": false})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "connection successful", "connected": true})
}

// safeConn returns a connection map with the password masked.
func safeConn(conn models.Connection) gin.H {
	return gin.H{
		"id":        conn.ID,
		"name":      conn.Name,
		"url":       db.MaskPassword(conn.URL),
		"type":      conn.Type,
		"createdAt": conn.CreatedAt,
	}
}
