package drivers

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/dbeditorviewer/backend/internal/models"
)

// normalizeVal converts database scan values to JSON-safe Go types.
// pgx and other drivers may return non-standard types ([16]byte for UUID,
// time.Time, int32, float32) that won't serialize correctly.
func normalizeVal(v interface{}) interface{} {
	if v == nil {
		return nil
	}
	switch t := v.(type) {
	case []byte:
		return string(t)
	case [16]byte: // UUID from pgx
		return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", t[0:4], t[4:6], t[6:8], t[8:10], t[10:])
	case time.Time:
		return t.UTC().Format(time.RFC3339Nano)
	case int8:
		return int64(t)
	case int16:
		return int64(t)
	case int32:
		return int64(t)
	case uint:
		return int64(t)
	case uint8:
		return int64(t)
	case uint16:
		return int64(t)
	case uint32:
		return int64(t)
	case uint64:
		return int64(t)
	case float32:
		return float64(t)
	default:
		b, err := json.Marshal(t)
		if err != nil || string(b) == "{}" {
			return fmt.Sprintf("%v", t)
		}
		return t
	}
}

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
