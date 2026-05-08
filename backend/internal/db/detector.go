package db

import (
	"net/url"
	"strings"

	"github.com/dbeditorviewer/backend/internal/models"
)

// DetectDBType determines the database type from a connection URL.
func DetectDBType(rawURL string) models.DBType {
	lower := strings.ToLower(rawURL)

	switch {
	case strings.HasPrefix(lower, "postgres://"), strings.HasPrefix(lower, "postgresql://"):
		return models.DBTypePostgres
	case strings.HasPrefix(lower, "mysql://"), strings.HasPrefix(lower, "mariadb://"):
		return models.DBTypeMySQL
	case strings.HasPrefix(lower, "mongodb://"), strings.HasPrefix(lower, "mongodb+srv://"):
		return models.DBTypeMongoDB
	case strings.HasPrefix(lower, "sqlite://"):
		return models.DBTypeSQLite
	case strings.HasSuffix(lower, ".sqlite"), strings.HasSuffix(lower, ".db"), strings.HasSuffix(lower, ".sqlite3"):
		return models.DBTypeSQLite
	}

	return models.DBTypeUnknown
}

// MaskPassword replaces the password in a URL with ***.
func MaskPassword(rawURL string) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}
	if u.User == nil {
		return rawURL
	}
	_, hasPass := u.User.Password()
	if !hasPass {
		return rawURL
	}
	u.User = url.UserPassword(u.User.Username(), "***")
	return u.String()
}
