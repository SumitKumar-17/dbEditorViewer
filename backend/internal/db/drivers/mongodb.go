package drivers

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/dbeditorviewer/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// MongoDriver implements Driver for MongoDB.
type MongoDriver struct {
	url    string
	client *mongo.Client
}

func NewMongoDriver(url string) *MongoDriver {
	return &MongoDriver{url: url}
}

func (d *MongoDriver) DBType() models.DBType { return models.DBTypeMongoDB }

func (d *MongoDriver) Connect() error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	clientOpts := options.Client().ApplyURI(d.url)
	client, err := mongo.Connect(ctx, clientOpts)
	if err != nil {
		return fmt.Errorf("mongo connect: %w", err)
	}
	if err := client.Ping(ctx, nil); err != nil {
		client.Disconnect(ctx)
		return fmt.Errorf("mongo ping: %w", err)
	}
	d.client = client
	return nil
}

func (d *MongoDriver) Disconnect() error {
	if d.client != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return d.client.Disconnect(ctx)
	}
	return nil
}

func (d *MongoDriver) GetSchemas() ([]string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	names, err := d.client.ListDatabaseNames(ctx, bson.M{})
	if err != nil {
		return nil, fmt.Errorf("list databases: %w", err)
	}

	excluded := map[string]bool{"admin": true, "local": true, "config": true}
	var result []string
	for _, name := range names {
		if !excluded[name] {
			result = append(result, name)
		}
	}
	return result, nil
}

func (d *MongoDriver) GetTables(schema string) ([]string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	database := d.client.Database(schema)
	names, err := database.ListCollectionNames(ctx, bson.M{})
	if err != nil {
		return nil, fmt.Errorf("list collections: %w", err)
	}
	return names, nil
}

func (d *MongoDriver) GetTableSchema(schema, table string) ([]models.ColumnDef, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	collection := d.client.Database(schema).Collection(table)

	// Sample up to 100 documents to infer schema
	findOpts := options.Find().SetLimit(100)
	cursor, err := collection.Find(ctx, bson.M{}, findOpts)
	if err != nil {
		return nil, fmt.Errorf("sample collection: %w", err)
	}
	defer cursor.Close(ctx)

	// Collect field names and types
	fieldTypes := make(map[string]string)
	fieldOrder := []string{}

	for cursor.Next(ctx) {
		var doc bson.D
		if err := cursor.Decode(&doc); err != nil {
			continue
		}
		for _, elem := range doc {
			if _, exists := fieldTypes[elem.Key]; !exists {
				fieldOrder = append(fieldOrder, elem.Key)
			}
			fieldTypes[elem.Key] = bsonTypeName(elem.Value)
		}
	}

	cols := make([]models.ColumnDef, 0, len(fieldOrder))
	for _, name := range fieldOrder {
		col := models.ColumnDef{
			Name:         name,
			DataType:     fieldTypes[name],
			IsNullable:   true,
			IsPrimaryKey: name == "_id",
		}
		cols = append(cols, col)
	}

	// If collection is empty, return minimal schema
	if len(cols) == 0 {
		cols = append(cols, models.ColumnDef{
			Name:         "_id",
			DataType:     "ObjectID",
			IsNullable:   false,
			IsPrimaryKey: true,
		})
	}

	return cols, cursor.Err()
}

func bsonTypeName(v interface{}) string {
	switch v.(type) {
	case primitive.ObjectID:
		return "ObjectID"
	case string:
		return "string"
	case int32:
		return "int32"
	case int64:
		return "int64"
	case float64:
		return "double"
	case bool:
		return "bool"
	case primitive.DateTime:
		return "date"
	case primitive.A:
		return "array"
	case bson.D, bson.M:
		return "object"
	case primitive.Binary:
		return "binary"
	case nil:
		return "null"
	default:
		return fmt.Sprintf("%T", v)
	}
}

func (d *MongoDriver) GetIndexes(schema, table string) ([]models.IndexDef, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := d.client.Database(schema).Collection(table)
	cursor, err := collection.Indexes().List(ctx)
	if err != nil {
		return nil, fmt.Errorf("list indexes: %w", err)
	}
	defer cursor.Close(ctx)

	var result []models.IndexDef
	for cursor.Next(ctx) {
		var idx bson.M
		if err := cursor.Decode(&idx); err != nil {
			continue
		}
		name, _ := idx["name"].(string)
		unique, _ := idx["unique"].(bool)

		var cols []string
		if key, ok := idx["key"].(bson.M); ok {
			for k := range key {
				cols = append(cols, k)
			}
		}

		result = append(result, models.IndexDef{
			Name:    name,
			Unique:  unique,
			Columns: cols,
		})
	}
	return result, cursor.Err()
}

func (d *MongoDriver) GetData(opts models.QueryOpts) (*models.DataResult, error) {
	if opts.Page < 1 {
		opts.Page = 1
	}
	if opts.Limit < 1 {
		opts.Limit = 50
	}
	if opts.Limit > 500 {
		opts.Limit = 500
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	collection := d.client.Database(opts.Schema).Collection(opts.Table)

	filter := bson.M{}

	// Count
	total, err := collection.CountDocuments(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("count documents: %w", err)
	}

	skip := int64((opts.Page - 1) * opts.Limit)
	limit := int64(opts.Limit)

	findOpts := options.Find().SetSkip(skip).SetLimit(limit)
	if opts.SortCol != "" {
		dir := 1
		if opts.SortDir == "desc" {
			dir = -1
		}
		findOpts.SetSort(bson.D{{Key: opts.SortCol, Value: dir}})
	}

	cursor, err := collection.Find(ctx, filter, findOpts)
	if err != nil {
		return nil, fmt.Errorf("find documents: %w", err)
	}
	defer cursor.Close(ctx)

	var resultRows []map[string]interface{}
	for cursor.Next(ctx) {
		var doc bson.D
		if err := cursor.Decode(&doc); err != nil {
			continue
		}
		row := bsonDToMap(doc)
		resultRows = append(resultRows, row)
	}
	if err := cursor.Err(); err != nil {
		return nil, err
	}

	if resultRows == nil {
		resultRows = []map[string]interface{}{}
	}

	// Build column defs from schema
	cols, _ := d.GetTableSchema(opts.Schema, opts.Table)

	return &models.DataResult{
		Rows:    resultRows,
		Total:   total,
		Page:    opts.Page,
		Limit:   opts.Limit,
		Columns: cols,
	}, nil
}

// bsonDToMap converts a bson.D to a plain map, converting ObjectIDs to hex strings.
func bsonDToMap(doc bson.D) map[string]interface{} {
	result := make(map[string]interface{}, len(doc))
	for _, elem := range doc {
		result[elem.Key] = convertBSONValue(elem.Value)
	}
	return result
}

func convertBSONValue(v interface{}) interface{} {
	switch val := v.(type) {
	case primitive.ObjectID:
		return val.Hex()
	case primitive.DateTime:
		return val.Time().UTC().Format(time.RFC3339)
	case bson.D:
		return bsonDToMap(val)
	case primitive.A:
		arr := make([]interface{}, len(val))
		for i, item := range val {
			arr[i] = convertBSONValue(item)
		}
		return arr
	default:
		return v
	}
}

func (d *MongoDriver) InsertRow(schema, table string, data map[string]interface{}) (map[string]interface{}, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := d.client.Database(schema).Collection(table)
	result, err := collection.InsertOne(ctx, data)
	if err != nil {
		return nil, fmt.Errorf("insert document: %w", err)
	}

	insertedID := result.InsertedID
	if oid, ok := insertedID.(primitive.ObjectID); ok {
		return map[string]interface{}{"_id": oid.Hex()}, nil
	}
	return map[string]interface{}{"_id": insertedID}, nil
}

func (d *MongoDriver) UpdateRow(schema, table string, pk map[string]interface{}, data map[string]interface{}) (map[string]interface{}, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := d.client.Database(schema).Collection(table)

	filter, err := buildMongoFilter(pk)
	if err != nil {
		return nil, err
	}

	update := bson.M{"$set": data}
	result, err := collection.UpdateOne(ctx, filter, update)
	if err != nil {
		return nil, fmt.Errorf("update document: %w", err)
	}

	return map[string]interface{}{
		"matchedCount":  result.MatchedCount,
		"modifiedCount": result.ModifiedCount,
	}, nil
}

func (d *MongoDriver) DeleteRows(schema, table string, pks []map[string]interface{}) (int64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := d.client.Database(schema).Collection(table)
	var totalDeleted int64

	for _, pk := range pks {
		filter, err := buildMongoFilter(pk)
		if err != nil {
			return totalDeleted, err
		}
		result, err := collection.DeleteOne(ctx, filter)
		if err != nil {
			return totalDeleted, fmt.Errorf("delete document: %w", err)
		}
		totalDeleted += result.DeletedCount
	}
	return totalDeleted, nil
}

// buildMongoFilter constructs a bson.M filter from a pk map.
// If _id is a hex string, it converts it to ObjectID.
func buildMongoFilter(pk map[string]interface{}) (bson.M, error) {
	filter := bson.M{}
	for k, v := range pk {
		if k == "_id" {
			if s, ok := v.(string); ok {
				oid, err := primitive.ObjectIDFromHex(s)
				if err == nil {
					filter[k] = oid
					continue
				}
			}
		}
		filter[k] = v
	}
	return filter, nil
}

// ExecuteQuery for MongoDB: parses the query as JSON and uses it as a filter
// against the collection. The query format is:
//
//	{"db": "mydb", "collection": "mycoll", "filter": {...}, "limit": 100}
func (d *MongoDriver) ExecuteQuery(query string) (*models.QueryResult, error) {
	start := time.Now()
	result := &models.QueryResult{
		Rows:    []map[string]interface{}{},
		Columns: []string{},
	}

	// Try to parse as structured query
	var structured struct {
		DB         string                 `json:"db"`
		Collection string                 `json:"collection"`
		Filter     map[string]interface{} `json:"filter"`
		Limit      int64                  `json:"limit"`
	}

	if err := json.Unmarshal([]byte(query), &structured); err != nil {
		errStr := fmt.Sprintf("invalid query JSON: %v", err)
		result.Error = &errStr
		result.Duration = time.Since(start).Milliseconds()
		return result, nil
	}

	if structured.DB == "" || structured.Collection == "" {
		errStr := `query must include "db" and "collection" fields, e.g. {"db":"mydb","collection":"mycoll","filter":{}}`
		result.Error = &errStr
		result.Duration = time.Since(start).Milliseconds()
		return result, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	filter := bson.M{}
	if structured.Filter != nil {
		for k, v := range structured.Filter {
			filter[k] = v
		}
	}

	limit := structured.Limit
	if limit == 0 {
		limit = 100
	}

	collection := d.client.Database(structured.DB).Collection(structured.Collection)
	findOpts := options.Find().SetLimit(limit)
	cursor, err := collection.Find(ctx, filter, findOpts)
	if err != nil {
		errStr := err.Error()
		result.Error = &errStr
		result.Duration = time.Since(start).Milliseconds()
		return result, nil
	}
	defer cursor.Close(ctx)

	var resultRows []map[string]interface{}
	colSet := make(map[string]bool)

	for cursor.Next(ctx) {
		var doc bson.D
		if err := cursor.Decode(&doc); err != nil {
			continue
		}
		row := bsonDToMap(doc)
		for k := range row {
			colSet[k] = true
		}
		resultRows = append(resultRows, row)
	}

	if resultRows == nil {
		resultRows = []map[string]interface{}{}
	}

	cols := make([]string, 0, len(colSet))
	for k := range colSet {
		cols = append(cols, k)
	}

	result.Rows = resultRows
	result.Columns = cols
	result.RowsAffected = int64(len(resultRows))
	result.Duration = time.Since(start).Milliseconds()
	return result, nil
}
