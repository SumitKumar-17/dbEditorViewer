# Contributing to DBEditor

Thank you for your interest in contributing! This document covers how to set up the project, the pull request workflow, and the coding standards we follow.

## Table of contents

- [Getting started](#getting-started)
- [Development workflow](#development-workflow)
- [Project conventions](#project-conventions)
- [Adding a database driver](#adding-a-database-driver)
- [Pull request checklist](#pull-request-checklist)
- [Reporting bugs](#reporting-bugs)
- [Requesting features](#requesting-features)

---

## Getting started

### Prerequisites

| Tool | Minimum version |
|---|---|
| Go | 1.22 |
| Node.js | 20 |
| pnpm | 10 |
| Docker (optional) | 24 |

### Local setup

```bash
# 1. Fork and clone
git clone https://github.com/<your-fork>/dbEditorViewer.git
cd dbEditorViewer

# 2. Install frontend dependencies
pnpm install

# 3. Start both backend and frontend with hot-reload
pnpm start
```

The backend listens on **http://localhost:3001** and the frontend on **http://localhost:5173**.  
Vite proxies all `/api/*` requests to the backend so you never need to change CORS or URLs.

---

## Development workflow

### Branch naming

```
feat/<short-description>      # new feature
fix/<short-description>       # bug fix
refactor/<short-description>  # internal cleanup
docs/<short-description>      # documentation only
```

### Making changes

1. Create a branch from `main`.
2. Make your changes — backend and frontend can be edited simultaneously; both hot-reload.
3. Type-check the frontend: `pnpm typecheck`
4. Build the backend: `cd backend && go build ./...`
5. Test manually — open the browser and verify the golden path works (add connection → browse data → edit a cell → run a query).
6. Open a pull request against `main`.

### Running with Docker (optional end-to-end test)

```bash
pnpm docker:up    # builds and starts everything
pnpm docker:down  # teardown
```

---

## Project conventions

### Backend (Go)

- Follow standard Go formatting (`go fmt`, enforced by the pipeline).
- All database drivers must implement the `drivers.Driver` interface in `base.go`.
- Use **parameterized queries** for all user-supplied values — no string interpolation of data.
- Identifiers (table names, column names) are double-quoted for PostgreSQL/SQLite and backtick-quoted for MySQL.
- Handler functions return flat JSON (not wrapped in `{data: ...}`) on success and `{"error": "..."}` on failure.
- Use `normalizeVal(v)` from `drivers/base.go` on every scanned database value before putting it into the response map — this ensures all values are JSON-safe regardless of driver.
- Guards: `UpdateRow` and `DeleteRows` must return an error if `pk` is empty.

### Frontend (TypeScript / React)

- **No `any`** — use proper types or `unknown`.
- Components live under `src/components/<Feature>/`.
- Server state is managed with **TanStack Query** (`useQuery`, `useMutation`). Local UI state uses **Zustand** or `useState`.
- All API calls go through `src/lib/api.ts` — add new endpoints there.
- Tailwind utility classes only — no inline `style={{}}` except for dynamic values (heights, widths from JS).
- AG Grid column definitions must not set `editable: true` in `defaultColDef` — set editability per column so PK columns remain read-only.

---

## Adding a database driver

1. Create `backend/internal/db/drivers/<name>.go` implementing `drivers.Driver`.
2. Add the new `DBType` constant to `backend/internal/models/types.go`.
3. Register the driver in `createDriver()` in `backend/internal/db/manager.go`.
4. Add URL detection in `backend/internal/db/detector.go`.
5. Update the frontend type union in `frontend/src/types/index.ts`.
6. Update `detectDBType()` in `frontend/src/lib/api.ts`.
7. Add a color and label badge in `ConnectionItem.tsx`.
8. Update the README connection URL table.

Key rules for new drivers:
- Call `normalizeVal(v)` on every scanned value.
- Mark primary key columns (`IsPrimaryKey: true`) in the `GetData` column list — the grid depends on this to determine which cells are editable.
- `ExecuteQuery` should never return `(nil, error)` for query-level errors — wrap the error in `QueryResult.Error` and return `(result, nil)` so the frontend shows it inline.

---

## Pull request checklist

Before opening a PR, confirm:

- [ ] `pnpm typecheck` passes with no errors
- [ ] `go build ./...` in `backend/` succeeds
- [ ] The feature works end-to-end in the browser (not just unit-tested)
- [ ] New API endpoints are documented in the README API table
- [ ] No secrets, passwords, or personal connection URLs are committed
- [ ] PR description explains **what** changed and **why**

---

## Reporting bugs

Use the [Bug report](.github/ISSUE_TEMPLATE/bug_report.md) issue template. Include:

- The database type and a minimal reproduction (table structure / query).
- The exact error message shown in the UI and in the browser DevTools console.
- Backend logs if the error is a 5xx.

---

## Requesting features

Use the [Feature request](.github/ISSUE_TEMPLATE/feature_request.md) issue template.  
Describe the problem you're solving, not just the solution — this helps us find the best approach together.
