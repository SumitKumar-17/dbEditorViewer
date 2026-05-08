package api

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/dbeditorviewer/backend/internal/db"
)

// QueryHandler handles raw query execution.
type QueryHandler struct {
	manager *db.Manager
}

type executeQueryRequest struct {
	Query string `json:"query" binding:"required"`
}

// Execute handles POST /api/db/:id/query
func (h *QueryHandler) Execute(c *gin.Context) {
	id := c.Param("id")

	var req executeQueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	drv, err := h.manager.Get(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	result, err := drv.ExecuteQuery(req.Query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}
