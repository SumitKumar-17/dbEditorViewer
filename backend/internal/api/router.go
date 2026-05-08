package api

import (
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"github.com/dbeditorviewer/backend/internal/db"
	"github.com/dbeditorviewer/backend/internal/store"
)

// SetupRouter creates and configures the Gin router with all routes.
func SetupRouter(manager *db.Manager, connStore *store.ConnectionStore) *gin.Engine {
	r := gin.Default()

	// CORS: allow all origins in dev
	r.Use(cors.New(cors.Config{
		AllowAllOrigins:  true,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: false,
	}))

	connHandler := &ConnectionHandler{manager: manager, store: connStore}
	schemaHandler := &SchemaHandler{manager: manager}
	dataHandler := &DataHandler{manager: manager}
	queryHandler := &QueryHandler{manager: manager}

	api := r.Group("/api")
	{
		// Connection management
		api.POST("/connections", connHandler.Create)
		api.GET("/connections", connHandler.List)
		api.DELETE("/connections/:id", connHandler.Delete)
		api.POST("/connections/:id/test", connHandler.Test)

		// Schema browsing and data CRUD (grouped under /db/:id)
		dbGroup := api.Group("/db/:id")
		{
			dbGroup.GET("/schemas", schemaHandler.GetSchemas)
			dbGroup.GET("/tables", schemaHandler.GetTables)
			dbGroup.GET("/tables/:table/schema", schemaHandler.GetTableSchema)
			dbGroup.GET("/tables/:table/indexes", schemaHandler.GetIndexes)

			// Data CRUD
			dbGroup.GET("/tables/:table/data", dataHandler.GetData)
			dbGroup.POST("/tables/:table/rows", dataHandler.InsertRow)
			dbGroup.PUT("/tables/:table/rows", dataHandler.UpdateRow)
			dbGroup.DELETE("/tables/:table/rows", dataHandler.DeleteRows)

			// Raw query
			dbGroup.POST("/query", queryHandler.Execute)
		}
	}

	return r
}
