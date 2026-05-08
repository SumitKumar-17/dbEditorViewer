package models

import "time"

type DBType string

const (
	DBTypePostgres DBType = "postgres"
	DBTypeMySQL    DBType = "mysql"
	DBTypeSQLite   DBType = "sqlite"
	DBTypeMongoDB  DBType = "mongodb"
	DBTypeUnknown  DBType = "unknown"
)

type Connection struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	URL       string    `json:"url"`
	Type      DBType    `json:"type"`
	CreatedAt time.Time `json:"createdAt"`
}

type ColumnDef struct {
	Name         string  `json:"name"`
	DataType     string  `json:"dataType"`
	IsNullable   bool    `json:"isNullable"`
	DefaultValue *string `json:"defaultValue"`
	IsPrimaryKey bool    `json:"isPrimaryKey"`
	IsForeignKey bool    `json:"isForeignKey"`
	ForeignTable *string `json:"foreignTable,omitempty"`
	ForeignCol   *string `json:"foreignColumn,omitempty"`
}

type IndexDef struct {
	Name    string   `json:"name"`
	Columns []string `json:"columns"`
	Unique  bool     `json:"unique"`
}

type TableInfo struct {
	Name   string `json:"name"`
	Schema string `json:"schema"`
}

type QueryOpts struct {
	Schema  string
	Table   string
	Page    int
	Limit   int
	SortCol string
	SortDir string // "asc" or "desc"
	Filter  string // simple search string
}

type DataResult struct {
	Rows    []map[string]interface{} `json:"rows"`
	Total   int64                    `json:"total"`
	Page    int                      `json:"page"`
	Limit   int                      `json:"limit"`
	Columns []ColumnDef              `json:"columns"`
}

type QueryResult struct {
	Rows         []map[string]interface{} `json:"rows"`
	RowsAffected int64                    `json:"rowsAffected"`
	Columns      []string                 `json:"columns"`
	Duration     int64                    `json:"durationMs"`
	Error        *string                  `json:"error,omitempty"`
}
