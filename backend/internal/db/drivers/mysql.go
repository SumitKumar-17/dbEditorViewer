package drivers

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/dbeditorviewer/backend/internal/models"
	_ "github.com/go-sql-driver/mysql"
)

// MySQLDriver implements Driver for MySQL/MariaDB.
type MySQLDriver struct {
	url   string
	dsn   string
	sqlDB *sql.DB
}

func NewMySQLDriver(url string) *MySQLDriver {
	return &MySQLDriver{url: url}
}

func (d *MySQLDriver) DBType() models.DBType { return models.DBTypeMySQL }

func (d *MySQLDriver) Connect() error {
	dsn, err := convertMySQLURLInternal(d.url)
	if err != nil {
		return fmt.Errorf("mysql url conversion: %w", err)
	}
	d.dsn = dsn

	sqlDB, err := sql.Open("mysql", dsn)
	if err != nil {
		return fmt.Errorf("mysql open: %w", err)
	}
	sqlDB.SetMaxOpenConns(10)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)
	if err := sqlDB.Ping(); err != nil {
		sqlDB.Close()
		return fmt.Errorf("mysql ping: %w", err)
	}
	d.sqlDB = sqlDB
	return nil
}

func (d *MySQLDriver) Disconnect() error {
	if d.sqlDB != nil {
		return d.sqlDB.Close()
	}
	return nil
}

func (d *MySQLDriver) GetSchemas() ([]string, error) {
	query := `SELECT schema_name FROM information_schema.schemata
	          WHERE schema_name NOT IN ('information_schema','performance_schema','mysql','sys')
	          ORDER BY schema_name`
	rows, err := d.sqlDB.Query(query)
	if err != nil {
		return nil, fmt.Errorf("get schemas: %w", err)
	}
	defer rows.Close()

	var schemas []string
	for rows.Next() {
		var s string
		if err := rows.Scan(&s); err != nil {
			return nil, err
		}
		schemas = append(schemas, s)
	}
	return schemas, rows.Err()
}

func (d *MySQLDriver) GetTables(schema string) ([]string, error) {
	query := "SELECT table_name FROM information_schema.tables WHERE table_schema=? AND table_type='BASE TABLE' ORDER BY table_name"
	rows, err := d.sqlDB.Query(query, schema)
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

func (d *MySQLDriver) GetTableSchema(schema, table string) ([]models.ColumnDef, error) {
	query := `
	SELECT
	    c.COLUMN_NAME,
	    c.DATA_TYPE,
	    c.IS_NULLABLE = 'YES',
	    c.COLUMN_DEFAULT,
	    c.COLUMN_KEY = 'PRI' AS is_pk,
	    c.COLUMN_KEY = 'MUL' AS is_fk,
	    kcu.REFERENCED_TABLE_NAME,
	    kcu.REFERENCED_COLUMN_NAME
	FROM information_schema.COLUMNS c
	LEFT JOIN information_schema.KEY_COLUMN_USAGE kcu
	    ON kcu.TABLE_SCHEMA = c.TABLE_SCHEMA
	    AND kcu.TABLE_NAME = c.TABLE_NAME
	    AND kcu.COLUMN_NAME = c.COLUMN_NAME
	    AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
	WHERE c.TABLE_SCHEMA = ?
	    AND c.TABLE_NAME = ?
	ORDER BY c.ORDINAL_POSITION`

	rows, err := d.sqlDB.Query(query, schema, table)
	if err != nil {
		return nil, fmt.Errorf("get table schema: %w", err)
	}
	defer rows.Close()

	var cols []models.ColumnDef
	for rows.Next() {
		var col models.ColumnDef
		var defaultVal sql.NullString
		var foreignTable sql.NullString
		var foreignCol sql.NullString

		if err := rows.Scan(
			&col.Name,
			&col.DataType,
			&col.IsNullable,
			&defaultVal,
			&col.IsPrimaryKey,
			&col.IsForeignKey,
			&foreignTable,
			&foreignCol,
		); err != nil {
			return nil, err
		}
		if defaultVal.Valid {
			col.DefaultValue = &defaultVal.String
		}
		if foreignTable.Valid {
			col.ForeignTable = &foreignTable.String
			col.IsForeignKey = true
		}
		if foreignCol.Valid {
			col.ForeignCol = &foreignCol.String
		}
		cols = append(cols, col)
	}
	return cols, rows.Err()
}

func (d *MySQLDriver) GetIndexes(schema, table string) ([]models.IndexDef, error) {
	query := `
	SELECT INDEX_NAME, NON_UNIQUE = 0 AS is_unique, COLUMN_NAME
	FROM information_schema.STATISTICS
	WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
	ORDER BY INDEX_NAME, SEQ_IN_INDEX`

	rows, err := d.sqlDB.Query(query, schema, table)
	if err != nil {
		return nil, fmt.Errorf("get indexes: %w", err)
	}
	defer rows.Close()

	idxMap := make(map[string]*models.IndexDef)
	var order []string

	for rows.Next() {
		var name, col string
		var unique bool
		if err := rows.Scan(&name, &unique, &col); err != nil {
			return nil, err
		}
		if _, ok := idxMap[name]; !ok {
			idxMap[name] = &models.IndexDef{Name: name, Unique: unique, Columns: []string{}}
			order = append(order, name)
		}
		idxMap[name].Columns = append(idxMap[name].Columns, col)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	result := make([]models.IndexDef, 0, len(order))
	for _, name := range order {
		result = append(result, *idxMap[name])
	}
	return result, nil
}

func (d *MySQLDriver) GetData(opts models.QueryOpts) (*models.DataResult, error) {
	if opts.Page < 1 {
		opts.Page = 1
	}
	if opts.Limit < 1 {
		opts.Limit = 50
	}
	if opts.Limit > 500 {
		opts.Limit = 500
	}

	quotedTable := fmt.Sprintf("`%s`.`%s`", opts.Schema, opts.Table)

	// Count
	var total int64
	if err := d.sqlDB.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM %s", quotedTable)).Scan(&total); err != nil {
		return nil, fmt.Errorf("count query: %w", err)
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("SELECT * FROM %s", quotedTable))

	if opts.SortCol != "" {
		dir := "ASC"
		if strings.ToLower(opts.SortDir) == "desc" {
			dir = "DESC"
		}
		sb.WriteString(fmt.Sprintf(" ORDER BY `%s` %s", opts.SortCol, dir))
	}

	offset := (opts.Page - 1) * opts.Limit
	sb.WriteString(fmt.Sprintf(" LIMIT %d OFFSET %d", opts.Limit, offset))

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
			row[name] = normalizeVal(vals[i])
		}
		resultRows = append(resultRows, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Fetch PK columns to mark IsPrimaryKey in column defs.
	pkSet := map[string]bool{}
	pkRows, pkErr := d.sqlDB.Query(`
		SELECT COLUMN_NAME FROM information_schema.COLUMNS
		WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_KEY='PRI'`, opts.Schema, opts.Table)
	if pkErr == nil {
		defer pkRows.Close()
		for pkRows.Next() {
			var col string
			if pkRows.Scan(&col) == nil {
				pkSet[col] = true
			}
		}
	}

	cols := make([]models.ColumnDef, len(colNames))
	for i, ct := range colTypes {
		nullable, _ := ct.Nullable()
		cols[i] = models.ColumnDef{
			Name:         ct.Name(),
			DataType:     ct.DatabaseTypeName(),
			IsNullable:   nullable,
			IsPrimaryKey: pkSet[ct.Name()],
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

func (d *MySQLDriver) InsertRow(schema, table string, data map[string]interface{}) (map[string]interface{}, error) {
	if len(data) == 0 {
		return nil, fmt.Errorf("no data provided")
	}

	cols := make([]string, 0, len(data))
	vals := make([]interface{}, 0, len(data))
	placeholders := make([]string, 0, len(data))
	for k, v := range data {
		cols = append(cols, fmt.Sprintf("`%s`", k))
		vals = append(vals, v)
		placeholders = append(placeholders, "?")
	}

	query := fmt.Sprintf(
		"INSERT INTO `%s`.`%s` (%s) VALUES (%s)",
		schema, table,
		strings.Join(cols, ", "),
		strings.Join(placeholders, ", "),
	)

	res, err := d.sqlDB.Exec(query, vals...)
	if err != nil {
		return nil, fmt.Errorf("insert row: %w", err)
	}

	id, err := res.LastInsertId()
	if err == nil && id > 0 {
		return map[string]interface{}{"lastInsertId": id}, nil
	}
	return map[string]interface{}{}, nil
}

func (d *MySQLDriver) UpdateRow(schema, table string, pk map[string]interface{}, data map[string]interface{}) (map[string]interface{}, error) {
	if len(data) == 0 {
		return nil, fmt.Errorf("no data provided")
	}
	if len(pk) == 0 {
		return nil, fmt.Errorf("cannot update row without a primary key")
	}

	setClauses := make([]string, 0, len(data))
	vals := make([]interface{}, 0, len(data)+len(pk))
	for k, v := range data {
		setClauses = append(setClauses, fmt.Sprintf("`%s`=?", k))
		vals = append(vals, v)
	}

	whereClauses := make([]string, 0, len(pk))
	for k, v := range pk {
		whereClauses = append(whereClauses, fmt.Sprintf("`%s`=?", k))
		vals = append(vals, v)
	}

	query := fmt.Sprintf(
		"UPDATE `%s`.`%s` SET %s WHERE %s",
		schema, table,
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

func (d *MySQLDriver) DeleteRows(schema, table string, pks []map[string]interface{}) (int64, error) {
	if len(pks) == 0 {
		return 0, nil
	}

	if len(pks[0]) == 0 {
		return 0, fmt.Errorf("cannot delete rows without a primary key")
	}

	var totalAffected int64
	for _, pk := range pks {
		whereClauses := make([]string, 0, len(pk))
		vals := make([]interface{}, 0, len(pk))
		for k, v := range pk {
			whereClauses = append(whereClauses, fmt.Sprintf("`%s`=?", k))
			vals = append(vals, v)
		}
		query := fmt.Sprintf(
			"DELETE FROM `%s`.`%s` WHERE %s",
			schema, table,
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

func (d *MySQLDriver) ExecuteQuery(query string) (*models.QueryResult, error) {
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
			row[name] = normalizeVal(vals[i])
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
