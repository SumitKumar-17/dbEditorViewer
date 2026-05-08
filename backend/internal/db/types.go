// Package db provides database connection management and re-exports model types.
package db

import (
	"github.com/dbeditorviewer/backend/internal/models"
)

// Re-export all types from models so callers can use db.Connection etc.
type DBType = models.DBType
type Connection = models.Connection
type ColumnDef = models.ColumnDef
type IndexDef = models.IndexDef
type TableInfo = models.TableInfo
type QueryOpts = models.QueryOpts
type DataResult = models.DataResult
type QueryResult = models.QueryResult

const (
	DBTypePostgres DBType = models.DBTypePostgres
	DBTypeMySQL    DBType = models.DBTypeMySQL
	DBTypeSQLite   DBType = models.DBTypeSQLite
	DBTypeMongoDB  DBType = models.DBTypeMongoDB
	DBTypeUnknown  DBType = models.DBTypeUnknown
)
