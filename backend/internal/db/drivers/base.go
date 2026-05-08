package drivers

import (
	"github.com/dbeditorviewer/backend/internal/models"
)

// Driver is the interface that every database driver must implement.
type Driver interface {
	Connect() error
	Disconnect() error
	GetSchemas() ([]string, error)
	GetTables(schema string) ([]string, error)
	GetTableSchema(schema, table string) ([]models.ColumnDef, error)
	GetIndexes(schema, table string) ([]models.IndexDef, error)
	GetData(opts models.QueryOpts) (*models.DataResult, error)
	InsertRow(schema, table string, data map[string]interface{}) (map[string]interface{}, error)
	UpdateRow(schema, table string, pk map[string]interface{}, data map[string]interface{}) (map[string]interface{}, error)
	DeleteRows(schema, table string, pks []map[string]interface{}) (int64, error)
	ExecuteQuery(query string) (*models.QueryResult, error)
	DBType() models.DBType
}
