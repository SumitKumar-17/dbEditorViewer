package drivers

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/dbeditorviewer/backend/internal/models"
	_ "modernc.org/sqlite"
)

// SQLiteDriver implements Driver for SQLite via modernc.org/sqlite (pure Go).
type SQLiteDriver struct {
	url      string
	filePath string
	sqlDB    *sql.DB
}

func NewSQLiteDriver(url string) *SQLiteDriver {
	filePath := extractSQLitePath(url)
	return &SQLiteDriver{url: url, filePath: filePath}
}

// extractSQLitePath strips the sqlite:// prefix and returns the file path.
func extractSQLitePath(rawURL string) string {
	lower := strings.ToLower(rawURL)
	if strings.HasPrefix(lower, "sqlite://") {
		return rawURL[len("sqlite://"):]
	}
	return rawURL
}

func (d *SQLiteDriver) DBType() models.DBType { return models.DBTypeSQLite }

func (d *SQLiteDriver) Connect() error {
	sqlDB, err := sql.Open("sqlite", d.filePath)
	if err != nil {
		return fmt.Errorf("sqlite open: %w", err)
	}
	// SQLite works best with a single connection to avoid locking issues
	sqlDB.SetMaxOpenConns(1)
	if err := sqlDB.Ping(); err != nil {
		sqlDB.Close()
		return fmt.Errorf("sqlite ping: %w", err)
	}
	d.sqlDB = sqlDB
	return nil
}

func (d *SQLiteDriver) Disconnect() error {
	if d.sqlDB != nil {
		return d.sqlDB.Close()
	}
	return nil
}

func (d *SQLiteDriver) GetSchemas() ([]string, error) {
	return []string{"main"}, nil
}

func (d *SQLiteDriver) GetTables(schema string) ([]string, error) {
	query := `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
	rows, err := d.sqlDB.Query(query)
	if err != nil {
		return nil, fmt.Errorf("get tables: %w", err)
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err != nil {
			return nil, err
		}
		tables = append(tables, t)
	}
	return tables, rows.Err()
}

func (d *SQLiteDriver) GetTableSchema(schema, table string) ([]models.ColumnDef, error) {
	// PRAGMA table_info returns: cid, name, type, notnull, dflt_value, pk
	query := fmt.Sprintf(`PRAGMA table_info("%s")`, table)
	rows, err := d.sqlDB.Query(query)
	if err != nil {
		return nil, fmt.Errorf("get table schema: %w", err)
	}
	defer rows.Close()

	var cols []models.ColumnDef
	for rows.Next() {
		var cid int
		var name, dataType string
		var notNull int
		var dfltValue sql.NullString
		var pk int

		if err := rows.Scan(&cid, &name, &dataType, &notNull, &dfltValue, &pk); err != nil {
			return nil, err
		}

		col := models.ColumnDef{
			Name:         name,
			DataType:     dataType,
			IsNullable:   notNull == 0,
			IsPrimaryKey: pk > 0,
		}
		if dfltValue.Valid {
			col.DefaultValue = &dfltValue.String
		}
		cols = append(cols, col)
	}
	return cols, rows.Err()
}

func (d *SQLiteDriver) GetIndexes(schema, table string) ([]models.IndexDef, error) {
	// PRAGMA index_list returns: seq, name, unique, origin, partial
	listQuery := fmt.Sprintf(`PRAGMA index_list("%s")`, table)
	listRows, err := d.sqlDB.Query(listQuery)
	if err != nil {
		return nil, fmt.Errorf("get index list: %w", err)
	}
	defer listRows.Close()

	type indexMeta struct {
		name   string
		unique bool
	}
	var indexes []indexMeta

	for listRows.Next() {
		var seq int
		var name string
		var unique int
		var origin, partial string
		if err := listRows.Scan(&seq, &name, &unique, &origin, &partial); err != nil {
			return nil, err
		}
		indexes = append(indexes, indexMeta{name: name, unique: unique == 1})
	}
	if err := listRows.Err(); err != nil {
		return nil, err
	}

	result := make([]models.IndexDef, 0, len(indexes))
	for _, idx := range indexes {
		// PRAGMA index_info returns: seqno, cid, name
		infoQuery := fmt.Sprintf(`PRAGMA index_info("%s")`, idx.name)
		infoRows, err := d.sqlDB.Query(infoQuery)
		if err != nil {
			return nil, fmt.Errorf("get index info: %w", err)
		}

		var cols []string
		for infoRows.Next() {
			var seqno, cid int
			var colName string
			if err := infoRows.Scan(&seqno, &cid, &colName); err != nil {
				infoRows.Close()
				return nil, err
			}
			cols = append(cols, colName)
		}
		infoRows.Close()
		if err := infoRows.Err(); err != nil {
			return nil, err
		}

		result = append(result, models.IndexDef{
			Name:    idx.name,
			Unique:  idx.unique,
			Columns: cols,
		})
	}
	return result, nil
}

func (d *SQLiteDriver) GetData(opts models.QueryOpts) (*models.DataResult, error) {
	if opts.Page < 1 {
		opts.Page = 1
	}
	if opts.Limit < 1 {
		opts.Limit = 50
	}
	if opts.Limit > 500 {
		opts.Limit = 500
	}

	quotedTable := fmt.Sprintf(`"%s"`, opts.Table)

	// Count
	var total int64
	if err := d.sqlDB.QueryRow(fmt.Sprintf(`SELECT COUNT(*) FROM %s`, quotedTable)).Scan(&total); err != nil {
		return nil, fmt.Errorf("count query: %w", err)
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf(`SELECT * FROM %s`, quotedTable))

	if opts.SortCol != "" {
		dir := "ASC"
		if strings.ToLower(opts.SortDir) == "desc" {
			dir = "DESC"
		}
		sb.WriteString(fmt.Sprintf(` ORDER BY "%s" %s`, opts.SortCol, dir))
	}

	offset := (opts.Page - 1) * opts.Limit
	sb.WriteString(fmt.Sprintf(` LIMIT %d OFFSET %d`, opts.Limit, offset))

	rows, err := d.sqlDB.Query(sb.String())
	if err != nil {
		return nil, fmt.Errorf("data query: %w", err)
	}
	defer rows.Close()

	colNames, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	colTypes, err := rows.ColumnTypes()
	if err != nil {
		return nil, err
	}

	var resultRows []map[string]interface{}
	for rows.Next() {
		vals := make([]interface{}, len(colNames))
		ptrs := make([]interface{}, len(colNames))
		for i := range vals {
			ptrs[i] = &vals[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			return nil, err
		}
		row := make(map[string]interface{}, len(colNames))
		for i, name := range colNames {
			row[name] = vals[i]
		}
		resultRows = append(resultRows, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	cols := make([]models.ColumnDef, len(colNames))
	for i, ct := range colTypes {
		nullable, _ := ct.Nullable()
		cols[i] = models.ColumnDef{
			Name:       ct.Name(),
			DataType:   ct.DatabaseTypeName(),
			IsNullable: nullable,
		}
	}

	if resultRows == nil {
		resultRows = []map[string]interface{}{}
	}

	return &models.DataResult{
		Rows:    resultRows,
		Total:   total,
		Page:    opts.Page,
		Limit:   opts.Limit,
		Columns: cols,
	}, nil
}

func (d *SQLiteDriver) InsertRow(schema, table string, data map[string]interface{}) (map[string]interface{}, error) {
	if len(data) == 0 {
		return nil, fmt.Errorf("no data provided")
	}

	cols := make([]string, 0, len(data))
	vals := make([]interface{}, 0, len(data))
	placeholders := make([]string, 0, len(data))
	for k, v := range data {
		cols = append(cols, fmt.Sprintf(`"%s"`, k))
		vals = append(vals, v)
		placeholders = append(placeholders, "?")
	}

	query := fmt.Sprintf(
		`INSERT INTO "%s" (%s) VALUES (%s)`,
		table,
		strings.Join(cols, ", "),
		strings.Join(placeholders, ", "),
	)

	res, err := d.sqlDB.Exec(query, vals...)
	if err != nil {
		return nil, fmt.Errorf("insert row: %w", err)
	}

	id, err := res.LastInsertId()
	if err == nil {
		return map[string]interface{}{"lastInsertId": id}, nil
	}
	return map[string]interface{}{}, nil
}

func (d *SQLiteDriver) UpdateRow(schema, table string, pk map[string]interface{}, data map[string]interface{}) (map[string]interface{}, error) {
	if len(data) == 0 {
		return nil, fmt.Errorf("no data provided")
	}

	setClauses := make([]string, 0, len(data))
	vals := make([]interface{}, 0, len(data)+len(pk))
	for k, v := range data {
		setClauses = append(setClauses, fmt.Sprintf(`"%s"=?`, k))
		vals = append(vals, v)
	}

	whereClauses := make([]string, 0, len(pk))
	for k, v := range pk {
		whereClauses = append(whereClauses, fmt.Sprintf(`"%s"=?`, k))
		vals = append(vals, v)
	}

	query := fmt.Sprintf(
		`UPDATE "%s" SET %s WHERE %s`,
		table,
		strings.Join(setClauses, ", "),
		strings.Join(whereClauses, " AND "),
	)

	res, err := d.sqlDB.Exec(query, vals...)
	if err != nil {
		return nil, fmt.Errorf("update row: %w", err)
	}

	affected, _ := res.RowsAffected()
	return map[string]interface{}{"rowsAffected": affected}, nil
}

func (d *SQLiteDriver) DeleteRows(schema, table string, pks []map[string]interface{}) (int64, error) {
	if len(pks) == 0 {
		return 0, nil
	}

	var totalAffected int64
	for _, pk := range pks {
		whereClauses := make([]string, 0, len(pk))
		vals := make([]interface{}, 0, len(pk))
		for k, v := range pk {
			whereClauses = append(whereClauses, fmt.Sprintf(`"%s"=?`, k))
			vals = append(vals, v)
		}
		query := fmt.Sprintf(
			`DELETE FROM "%s" WHERE %s`,
			table,
			strings.Join(whereClauses, " AND "),
		)
		res, err := d.sqlDB.Exec(query, vals...)
		if err != nil {
			return totalAffected, fmt.Errorf("delete row: %w", err)
		}
		n, _ := res.RowsAffected()
		totalAffected += n
	}
	return totalAffected, nil
}

func (d *SQLiteDriver) ExecuteQuery(query string) (*models.QueryResult, error) {
	start := time.Now()
	result := &models.QueryResult{}

	rows, err := d.sqlDB.Query(query)
	if err != nil {
		res, execErr := d.sqlDB.Exec(query)
		if execErr != nil {
			errStr := err.Error()
			result.Error = &errStr
			result.Duration = time.Since(start).Milliseconds()
			result.Rows = []map[string]interface{}{}
			result.Columns = []string{}
			return result, nil
		}
		affected, _ := res.RowsAffected()
		result.RowsAffected = affected
		result.Duration = time.Since(start).Milliseconds()
		result.Rows = []map[string]interface{}{}
		result.Columns = []string{}
		return result, nil
	}
	defer rows.Close()

	colNames, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	result.Columns = colNames

	var resultRows []map[string]interface{}
	for rows.Next() {
		vals := make([]interface{}, len(colNames))
		ptrs := make([]interface{}, len(colNames))
		for i := range vals {
			ptrs[i] = &vals[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			return nil, err
		}
		row := make(map[string]interface{}, len(colNames))
		for i, name := range colNames {
			row[name] = vals[i]
		}
		resultRows = append(resultRows, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if resultRows == nil {
		resultRows = []map[string]interface{}{}
	}
	result.Rows = resultRows
	result.RowsAffected = int64(len(resultRows))
	result.Duration = time.Since(start).Milliseconds()
	return result, nil
}
