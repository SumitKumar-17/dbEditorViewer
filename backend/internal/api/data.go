package api

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/dbeditorviewer/backend/internal/db"
	"github.com/dbeditorviewer/backend/internal/models"
)

// DataHandler handles table data CRUD endpoints.
type DataHandler struct {
	manager *db.Manager
}

// GetData handles GET /api/db/:id/tables/:table/data
func (h *DataHandler) GetData(c *gin.Context) {
	id := c.Param("id")
	table := c.Param("table")
	schema := c.DefaultQuery("schema", "")
	if schema == "" {
		schema = defaultSchema(h.manager, id)
	}

	page := parseIntQuery(c, "page", 1)
	limit := parseIntQuery(c, "limit", 50)
	if limit > 500 {
		limit = 500
	}
	if page < 1 {
		page = 1
	}

	opts := models.QueryOpts{
		Schema:  schema,
		Table:   table,
		Page:    page,
		Limit:   limit,
		SortCol: c.Query("sort"),
		SortDir: c.DefaultQuery("dir", "asc"),
		Filter:  c.Query("filter"),
	}

	drv, err := h.manager.Get(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	result, err := drv.GetData(opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// InsertRow handles POST /api/db/:id/tables/:table/rows
func (h *DataHandler) InsertRow(c *gin.Context) {
	id := c.Param("id")
	table := c.Param("table")
	schema := c.DefaultQuery("schema", "")
	if schema == "" {
		schema = defaultSchema(h.manager, id)
	}

	var data map[string]interface{}
	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	drv, err := h.manager.Get(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	row, err := drv.InsertRow(schema, table, data)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"row": row})
}

// UpdateRow handles PUT /api/db/:id/tables/:table/rows
// Body: {"pk": {...}, "data": {...}}
func (h *DataHandler) UpdateRow(c *gin.Context) {
	id := c.Param("id")
	table := c.Param("table")
	schema := c.DefaultQuery("schema", "")
	if schema == "" {
		schema = defaultSchema(h.manager, id)
	}

	var body struct {
		PK   map[string]interface{} `json:"pk"   binding:"required"`
		Data map[string]interface{} `json:"data" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	drv, err := h.manager.Get(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	row, err := drv.UpdateRow(schema, table, body.PK, body.Data)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"row": row})
}

// DeleteRows handles DELETE /api/db/:id/tables/:table/rows
// Body: {"pks": [{...}, ...]}
func (h *DataHandler) DeleteRows(c *gin.Context) {
	id := c.Param("id")
	table := c.Param("table")
	schema := c.DefaultQuery("schema", "")
	if schema == "" {
		schema = defaultSchema(h.manager, id)
	}

	var body struct {
		PKs []map[string]interface{} `json:"pks" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	drv, err := h.manager.Get(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	count, err := drv.DeleteRows(schema, table, body.PKs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"deleted": count})
}

// parseIntQuery reads an integer query param with a fallback default.
func parseIntQuery(c *gin.Context, key string, defaultVal int) int {
	s := c.Query(key)
	if s == "" {
		return defaultVal
	}
	n, err := strconv.Atoi(s)
	if err != nil || n < 1 {
		return defaultVal
	}
	return n
}
