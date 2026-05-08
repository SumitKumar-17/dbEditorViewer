package drivers

import (
	"fmt"
	"net/url"
	"strings"
)

// convertMySQLURLInternal converts a mysql:// or mariadb:// URL to go-sql-driver/mysql DSN format.
// mysql://user:pass@host:port/dbname → user:pass@tcp(host:port)/dbname?parseTime=true&multiStatements=true
func convertMySQLURLInternal(rawURL string) (string, error) {
	// Normalize mariadb:// to mysql://
	lower := strings.ToLower(rawURL)
	if strings.HasPrefix(lower, "mariadb://") {
		rawURL = "mysql://" + rawURL[len("mariadb://"):]
	}

	u, err := url.Parse(rawURL)
	if err != nil {
		return "", fmt.Errorf("parse mysql url: %w", err)
	}

	host := u.Hostname()
	port := u.Port()
	if port == "" {
		port = "3306"
	}

	dbName := strings.TrimPrefix(u.Path, "/")

	var userInfo string
	if u.User != nil {
		username := u.User.Username()
		password, hasPass := u.User.Password()
		if hasPass {
			userInfo = username + ":" + password + "@"
		} else {
			userInfo = username + "@"
		}
	}

	// Merge existing query params
	params := u.Query()
	params.Set("parseTime", "true")
	params.Set("multiStatements", "true")

	dsn := userInfo + "tcp(" + host + ":" + port + ")/" + dbName + "?" + params.Encode()
	return dsn, nil
}
