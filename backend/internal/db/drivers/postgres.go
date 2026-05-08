package drivers

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/dbeditorviewer/backend/internal/models"
	_ "github.com/jackc/pgx/v5/stdlib"
)

// PostgresDriver implements Driver for PostgreSQL via pgx stdlib.
type PostgresDriver struct {
	url string
	db  *sql.DB
}

func NewPostgresDriver(url string) *PostgresDriver {
	return &PostgresDriver{url: url}
}

func (d *PostgresDriver) DBType() models.DBType { return models.DBTypePostgres }

func (d *PostgresDriver) Connect() error {
	sqlDB, err := sql.Open("pgx", d.url)
	if err != nil {
		return fmt.Errorf("postgres open: %w", err)
	}
	sqlDB.SetMaxOpenConns(10)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)
	if err := sqlDB.Ping(); err != nil {
		sqlDB.Close()
		return fmt.Errorf("postgres ping: %w", err)
	}
	d.db = sqlDB
	return nil
}

func (d *PostgresDriver) Disconnect() error {
	if d.db != nil {
		return d.db.Close()
	}
	return nil
}

func (d *PostgresDriver) GetSchemas() ([]string, error) {
	query := `SELECT schema_name FROM information_schema.schemata
	          WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast')
	          ORDER BY schema_name`
	rows, err := d.db.Query(query)
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

func (d *PostgresDriver) GetTables(schema string) ([]string, error) {
	query := `SELECT table_name FROM information_schema.tables
	          WHERE table_schema=$1 AND table_type='BASE TABLE'
	          ORDER BY table_name`
	rows, err := d.db.Query(query, schema)
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

func (d *PostgresDriver) GetTableSchema(schema, table string) ([]models.ColumnDef, error) {
	query := `
	SELECT
	    c.column_name,
	    c.data_type,
	    c.is_nullable = 'YES' AS is_nullable,
	    c.column_default,
	    COALESCE(pk.is_pk, false) AS is_pk,
	    COALESCE(fk.is_fk, false) AS is_fk,
	    fk.foreign_table,
	    fk.foreign_col
	FROM information_schema.columns c
	LEFT JOIN (
	    SELECT ku.column_name, true AS is_pk
	    FROM information_schema.table_constraints tc
	    JOIN information_schema.key_column_usage ku
	        ON tc.constraint_name = ku.constraint_name
	        AND tc.table_schema = ku.table_schema
	        AND tc.table_name = ku.table_name
	    WHERE tc.constraint_type = 'PRIMARY KEY'
	        AND tc.table_schema = $1
	        AND tc.table_name = $2
	) pk ON c.column_name = pk.column_name
	LEFT JOIN (
	    SELECT
	        ku.column_name,
	        true AS is_fk,
	        ccu.table_name AS foreign_table,
	        ccu.column_name AS foreign_col
	    FROM information_schema.table_constraints tc
	    JOIN information_schema.key_column_usage ku
	        ON tc.constraint_name = ku.constraint_name
	        AND tc.table_schema = ku.table_schema
	        AND tc.table_name = ku.table_name
	    JOIN information_schema.constraint_column_usage ccu
	        ON tc.constraint_name = ccu.constraint_name
	    WHERE tc.constraint_type = 'FOREIGN KEY'
	        AND tc.table_schema = $1
	        AND tc.table_name = $2
	) fk ON c.column_name = fk.column_name
	WHERE c.table_schema = $1
	    AND c.table_name = $2
	ORDER BY c.ordinal_position`

	rows, err := d.db.Query(query, schema, table)
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
		}
		if foreignCol.Valid {
			col.ForeignCol = &foreignCol.String
		}
		cols = append(cols, col)
	}
	return cols, rows.Err()
}

func (d *PostgresDriver) GetIndexes(schema, table string) ([]models.IndexDef, error) {
	query := `
	SELECT
	    i.relname AS index_name,
	    ix.indisunique AS is_unique,
	    a.attname AS column_name
	FROM pg_class t
	JOIN pg_namespace n ON n.oid = t.relnamespace
	JOIN pg_index ix ON t.oid = ix.indrelid
	JOIN pg_class i ON i.oid = ix.indexrelid
	JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
	WHERE t.relkind = 'r'
	    AND n.nspname = $1
	    AND t.relname = $2
	ORDER BY i.relname, a.attnum`

	rows, err := d.db.Query(query, schema, table)
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

func (d *PostgresDriver) GetData(opts models.QueryOpts) (*models.DataResult, error) {
	if opts.Page < 1 {
		opts.Page = 1
	}
	if opts.Limit < 1 {
		opts.Limit = 50
	}
	if opts.Limit > 500 {
		opts.Limit = 500
	}

	quotedTable := fmt.Sprintf(`"%s"."%s"`, opts.Schema, opts.Table)

	// Count query
	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM %s`, quotedTable)
	var total int64
	if err := d.db.QueryRow(countQuery).Scan(&total); err != nil {
		return nil, fmt.Errorf("count query: %w", err)
	}

	// Build SELECT query
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf(`SELECT * FROM %s`, quotedTable))

	offset := (opts.Page - 1) * opts.Limit
	args := []interface{}{}
	argIdx := 1

	if opts.SortCol != "" {
		dir := "ASC"
		if strings.ToLower(opts.SortDir) == "desc" {
			dir = "DESC"
		}
		sb.WriteString(fmt.Sprintf(` ORDER BY "%s" %s`, opts.SortCol, dir))
	}

	sb.WriteString(fmt.Sprintf(` LIMIT $%d OFFSET $%d`, argIdx, argIdx+1))
	args = append(args, opts.Limit, offset)

	rows, err := d.db.Query(sb.String(), args...)
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

	// Build column defs from column types
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

func (d *PostgresDriver) InsertRow(schema, table string, data map[string]interface{}) (map[string]interface{}, error) {
	if len(data) == 0 {
		return nil, fmt.Errorf("no data provided")
	}

	cols := make([]string, 0, len(data))
	vals := make([]interface{}, 0, len(data))
	placeholders := make([]string, 0, len(data))
	i := 1
	for k, v := range data {
		cols = append(cols, fmt.Sprintf(`"%s"`, k))
		vals = append(vals, v)
		placeholders = append(placeholders, fmt.Sprintf("$%d", i))
		i++
	}

	query := fmt.Sprintf(
		`INSERT INTO "%s"."%s" (%s) VALUES (%s) RETURNING *`,
		schema, table,
		strings.Join(cols, ", "),
		strings.Join(placeholders, ", "),
	)

	rows, err := d.db.Query(query, vals...)
	if err != nil {
		return nil, fmt.Errorf("insert row: %w", err)
	}
	defer rows.Close()

	colNames, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	if rows.Next() {
		vals2 := make([]interface{}, len(colNames))
		ptrs := make([]interface{}, len(colNames))
		for i := range vals2 {
			ptrs[i] = &vals2[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			return nil, err
		}
		result := make(map[string]interface{}, len(colNames))
		for i, name := range colNames {
			result[name] = vals2[i]
		}
		return result, nil
	}
	return map[string]interface{}{}, nil
}

func (d *PostgresDriver) UpdateRow(schema, table string, pk map[string]interface{}, data map[string]interface{}) (map[string]interface{}, error) {
	if len(data) == 0 {
		return nil, fmt.Errorf("no data provided")
	}

	setClauses := make([]string, 0, len(data))
	vals := make([]interface{}, 0, len(data)+len(pk))
	argIdx := 1

	for k, v := range data {
		setClauses = append(setClauses, fmt.Sprintf(`"%s"=$%d`, k, argIdx))
		vals = append(vals, v)
		argIdx++
	}

	whereClauses := make([]string, 0, len(pk))
	for k, v := range pk {
		whereClauses = append(whereClauses, fmt.Sprintf(`"%s"=$%d`, k, argIdx))
		vals = append(vals, v)
		argIdx++
	}

	query := fmt.Sprintf(
		`UPDATE "%s"."%s" SET %s WHERE %s RETURNING *`,
		schema, table,
		strings.Join(setClauses, ", "),
		strings.Join(whereClauses, " AND "),
	)

	rows, err := d.db.Query(query, vals...)
	if err != nil {
		return nil, fmt.Errorf("update row: %w", err)
	}
	defer rows.Close()

	colNames, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	if rows.Next() {
		rowVals := make([]interface{}, len(colNames))
		ptrs := make([]interface{}, len(colNames))
		for i := range rowVals {
			ptrs[i] = &rowVals[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			return nil, err
		}
		result := make(map[string]interface{}, len(colNames))
		for i, name := range colNames {
			result[name] = rowVals[i]
		}
		return result, nil
	}
	return map[string]interface{}{}, nil
}

func (d *PostgresDriver) DeleteRows(schema, table string, pks []map[string]interface{}) (int64, error) {
	if len(pks) == 0 {
		return 0, nil
	}

	var totalAffected int64
	for _, pk := range pks {
		whereClauses := make([]string, 0, len(pk))
		vals := make([]interface{}, 0, len(pk))
		argIdx := 1
		for k, v := range pk {
			whereClauses = append(whereClauses, fmt.Sprintf(`"%s"=$%d`, k, argIdx))
			vals = append(vals, v)
			argIdx++
		}
		query := fmt.Sprintf(
			`DELETE FROM "%s"."%s" WHERE %s`,
			schema, table,
			strings.Join(whereClauses, " AND "),
		)
		res, err := d.db.Exec(query, vals...)
		if err != nil {
			return totalAffected, fmt.Errorf("delete row: %w", err)
		}
		n, _ := res.RowsAffected()
		totalAffected += n
	}
	return totalAffected, nil
}

func (d *PostgresDriver) ExecuteQuery(query string) (*models.QueryResult, error) {
	start := time.Now()
	result := &models.QueryResult{}

	rows, err := d.db.Query(query)
	if err != nil {
		// Try as exec (INSERT/UPDATE/DELETE without RETURNING)
		res, execErr := d.db.Exec(query)
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
