# DBEditor

A browser-based universal database manager. Paste a connection URL, get a full GUI with a spreadsheet-style data editor, schema explorer, and SQL query console — no install required beyond the server.

![DBEditor Screenshot](docs/image1.png)

## Features

- **Multi-database support** — PostgreSQL, MySQL / MariaDB, SQLite, MongoDB
- **Schema explorer** — collapsible sidebar tree: connection → schema → tables
- **Spreadsheet data editor** — AG Grid with inline cell editing, pagination, add/delete rows
- **SQL query console** — Monaco editor (VS Code engine) with syntax highlighting, Ctrl+Enter execution, and timed results
- **Schema viewer** — columns, types, nullable, default values, primary / foreign key flags, indexes
- **JSON cell renderer** — objects and arrays shown with a click-to-expand modal
- **Dark / light theme** — persisted to localStorage
- **Connection persistence** — saved to `~/.dbeditor/connections.json`, auto-reconnects on restart
- **Docker support** — single `docker compose up` starts everything

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Go 1.22 · Gin · pgx · go-sql-driver/mysql · modernc.org/sqlite · MongoDB Go Driver |
| Frontend | React 18 · TypeScript · Vite · Tailwind CSS · shadcn/ui |
| Grid | AG Grid Community v32 |
| Editor | Monaco Editor |
| State | Zustand + TanStack Query v5 |
| Docker | Go multi-stage → Alpine · Nginx |

## Quick start

### Prerequisites

- [Go 1.22+](https://go.dev/dl/)
- [Node.js 20+](https://nodejs.org/)
- [pnpm 10+](https://pnpm.io/installation)

### Run locally

```bash
git clone <repo-url> dbEditorViewer
cd dbEditorViewer

# Install frontend deps
pnpm install

# Start both backend (port 3001) and frontend (port 5173)
pnpm start
```

Open [http://localhost:5173](http://localhost:5173).

### Run with Docker

```bash
pnpm docker:up
# or: docker compose up --build
```

Open [http://localhost:80](http://localhost:80). The frontend proxies `/api` to the backend container automatically.

```bash
pnpm docker:down   # stop and remove containers
```

## Adding a connection

1. Click **+ New** in the top-right corner (or the button in the welcome screen).
2. Enter a display name and your connection URL.
3. Click **Test Connection** to verify the credentials before saving.
4. Click **Add Connection** — the connection appears in the sidebar and expands automatically.

### Supported URL formats

| Database | Example URL |
|---|---|
| PostgreSQL | `postgres://user:pass@host:5432/dbname` |
| MySQL | `mysql://user:pass@host:3306/dbname` |
| MariaDB | `mariadb://user:pass@host:3306/dbname` |
| SQLite | `sqlite:///path/to/file.db` |
| MongoDB | `mongodb://user:pass@host:27017/dbname` |

## Using the editor

### Data tab

![Data Grid](docs/image2.png)

- Click any table in the sidebar to load its data.
- **Edit a cell** — click to select, double-click (or press Enter) to start editing, Enter/Tab to confirm.
- **Add a row** — click **+ Row** in the toolbar; fill in the blank row that appears at the top.
- **Delete rows** — select one or more rows with the checkbox column, then click **Delete**.
- **Sort** — click any column header.
- **Filter** — click the filter icon in a column header.
- **Paginate** — use the toolbar controls to change page / page size.

### Schema tab
Shows all columns with their type, nullable flag, default value, primary / foreign key badges, and the full index list.

### Query tab

![Query Editor](docs/image3.png)

Full Monaco SQL editor. Works even without a table selected — useful for `SELECT current_user`, `SHOW TABLES`, etc.

- **Run** — click the **Run** button or press **Ctrl+Enter** (⌘+Enter on Mac).
- **Results** appear below with execution time and row count.
- **Errors** are displayed in-line with the original PostgreSQL / MySQL / SQLite error message.

> **MongoDB queries** use a JSON format instead of SQL:
> ```json
> {"db": "mydb", "collection": "users", "filter": {"active": true}, "limit": 50}
> ```

## Project structure

```
dbEditorViewer/
├── backend/
│   ├── main.go
│   └── internal/
│       ├── api/          # Gin handlers: connections, schema, data, query
│       ├── db/
│       │   ├── manager.go        # Thread-safe connection pool
│       │   ├── detector.go       # URL → db type detection
│       │   └── drivers/          # Per-DB implementations (postgres, mysql, sqlite, mongodb)
│       ├── models/       # Shared Go structs (Connection, ColumnDef, DataResult …)
│       └── store/        # JSON file persistence (~/.dbeditor/connections.json)
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── ConnectionManager/   # Add dialog, connection tree item
│       │   ├── DataGrid/            # AG Grid wrapper, toolbar, JSON cell renderer
│       │   ├── Layout/              # AppShell, Header, Sidebar
│       │   ├── QueryEditor/         # Monaco wrapper, results panel
│       │   └── SchemaViewer/        # Column & index tables
│       ├── lib/api.ts       # Typed fetch client
│       ├── stores/          # Zustand: connections, UI state
│       └── types/index.ts   # Shared TypeScript interfaces
├── docker-compose.yml
├── package.json             # pnpm workspace root + npm scripts
└── pnpm-workspace.yaml
```

## API reference

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/connections` | Add and persist a connection |
| `GET` | `/api/connections` | List all saved connections |
| `DELETE` | `/api/connections/:id` | Remove a connection |
| `POST` | `/api/connections/:id/test` | Reconnect and test an existing connection |
| `POST` | `/api/connections/test-url` | Test a URL without persisting |
| `GET` | `/api/db/:id/schemas` | List schemas / databases |
| `GET` | `/api/db/:id/tables?schema=X` | List tables in a schema |
| `GET` | `/api/db/:id/tables/:table/schema` | Column definitions |
| `GET` | `/api/db/:id/tables/:table/indexes` | Index list |
| `GET` | `/api/db/:id/tables/:table/data` | Paginated rows |
| `POST` | `/api/db/:id/tables/:table/rows` | Insert a row |
| `PUT` | `/api/db/:id/tables/:table/rows` | Update a row (body: `{pk, data}`) |
| `DELETE` | `/api/db/:id/tables/:table/rows` | Delete rows (body: `{pks: [...]}`) |
| `POST` | `/api/db/:id/query` | Execute raw SQL / MongoDB query |

## Development

```bash
# Type-check frontend only
pnpm typecheck

# Backend only
cd backend && go build ./...

# Rebuild Docker images after code changes
pnpm docker:up
```

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `GIN_MODE` | `release` | Set to `debug` for verbose Gin logs |
| `PORT` | `3001` | Backend listen port (edit `main.go`) |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
