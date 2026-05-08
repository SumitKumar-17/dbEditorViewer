package api

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/dbeditorviewer/backend/internal/db"
	"github.com/dbeditorviewer/backend/internal/models"
)

// SchemaHandler handles schema and table metadata endpoints.
type SchemaHandler struct {
	manager *db.Manager
}

// GetSchemas handles GET /api/db/:id/schemas
func (h *SchemaHandler) GetSchemas(c *gin.Context) {
	id := c.Param("id")
	drv, err := h.manager.Get(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	schemas, err := drv.GetSchemas()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if schemas == nil {
		schemas = []string{}
	}
	c.JSON(http.StatusOK, schemas)
}

// GetTables handles GET /api/db/:id/tables?schema=X
func (h *SchemaHandler) GetTables(c *gin.Context) {
	id := c.Param("id")
	schema := c.Query("schema")
	if schema == "" {
		schema = defaultSchema(h.manager, id)
	}

	drv, err := h.manager.Get(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	tables, err := drv.GetTables(schema)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if tables == nil {
		tables = []string{}
	}
	c.JSON(http.StatusOK, tables)
}

// GetTableSchema handles GET /api/db/:id/tables/:table/schema?schema=X
func (h *SchemaHandler) GetTableSchema(c *gin.Context) {
	id := c.Param("id")
	table := c.Param("table")
	schema := c.Query("schema")
	if schema == "" {
		schema = defaultSchema(h.manager, id)
	}

	drv, err := h.manager.Get(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	cols, err := drv.GetTableSchema(schema, table)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if cols == nil {
		cols = []models.ColumnDef{}
	}
	c.JSON(http.StatusOK, cols)
}

// GetIndexes handles GET /api/db/:id/tables/:table/indexes?schema=X
func (h *SchemaHandler) GetIndexes(c *gin.Context) {
	id := c.Param("id")
	table := c.Param("table")
	schema := c.Query("schema")
	if schema == "" {
		schema = defaultSchema(h.manager, id)
	}

	drv, err := h.manager.Get(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	indexes, err := drv.GetIndexes(schema, table)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if indexes == nil {
		indexes = []models.IndexDef{}
	}
	c.JSON(http.StatusOK, indexes)
}

// defaultSchema returns a sensible default schema for the given connection.
func defaultSchema(manager *db.Manager, id string) string {
	drv, err := manager.Get(id)
	if err != nil {
		return "public"
	}
	switch drv.DBType() {
	case models.DBTypeSQLite:
		return "main"
	case models.DBTypeMySQL:
		return ""
	default:
		return "public"
	}
}
