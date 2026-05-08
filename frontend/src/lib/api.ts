import type { Connection, ColumnDef, IndexDef, DataResult, QueryResult, DBType } from '@/types'

const BASE = 'http://localhost:3001/api'

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const body = await res.json()
      message = body.error || body.message || message
    } catch {
      // ignore
    }
    throw new Error(message)
  }

  const text = await res.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

export function detectDBType(url: string): DBType {
  if (/^(postgres|postgresql):\/\//.test(url)) return 'postgres'
  if (/^(mysql|mariadb):\/\//.test(url)) return 'mysql'
  if (/^mongodb(\+srv)?:\/\//.test(url)) return 'mongodb'
  if (/^sqlite:\/\//.test(url) || /\.(sqlite|db|sqlite3)$/.test(url)) return 'sqlite'
  return 'unknown'
}

export const api = {
  // connections
  listConnections(): Promise<Connection[]> {
    return request<Connection[]>('/connections')
  },

  addConnection(data: { name: string; url: string }): Promise<Connection> {
    return request<Connection>('/connections', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  deleteConnection(id: string): Promise<void> {
    return request<void>(`/connections/${id}`, {
      method: 'DELETE',
    })
  },

  testConnection(id: string): Promise<{ ok: boolean; message: string }> {
    return request<{ ok: boolean; message: string }>(`/connections/${id}/test`, {
      method: 'POST',
    })
  },

  // schema
  getSchemas(id: string): Promise<string[]> {
    return request<string[]>(`/connections/${id}/schemas`)
  },

  getTables(id: string, schema: string): Promise<string[]> {
    return request<string[]>(`/connections/${id}/schemas/${encodeURIComponent(schema)}/tables`)
  },

  getTableSchema(id: string, schema: string, table: string): Promise<ColumnDef[]> {
    return request<ColumnDef[]>(
      `/connections/${id}/schemas/${encodeURIComponent(schema)}/tables/${encodeURIComponent(table)}/columns`
    )
  },

  getIndexes(id: string, schema: string, table: string): Promise<IndexDef[]> {
    return request<IndexDef[]>(
      `/connections/${id}/schemas/${encodeURIComponent(schema)}/tables/${encodeURIComponent(table)}/indexes`
    )
  },

  // data
  getData(
    id: string,
    schema: string,
    table: string,
    opts: { page?: number; limit?: number; sort?: string; dir?: string }
  ): Promise<DataResult> {
    const params = new URLSearchParams()
    if (opts.page !== undefined) params.set('page', String(opts.page))
    if (opts.limit !== undefined) params.set('limit', String(opts.limit))
    if (opts.sort) params.set('sort', opts.sort)
    if (opts.dir) params.set('dir', opts.dir)
    return request<DataResult>(
      `/connections/${id}/schemas/${encodeURIComponent(schema)}/tables/${encodeURIComponent(table)}/data?${params}`
    )
  },

  insertRow(
    id: string,
    schema: string,
    table: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return request<Record<string, unknown>>(
      `/connections/${id}/schemas/${encodeURIComponent(schema)}/tables/${encodeURIComponent(table)}/data`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  },

  updateRow(
    id: string,
    schema: string,
    table: string,
    pk: Record<string, unknown>,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return request<Record<string, unknown>>(
      `/connections/${id}/schemas/${encodeURIComponent(schema)}/tables/${encodeURIComponent(table)}/data`,
      {
        method: 'PUT',
        body: JSON.stringify({ pk, data }),
      }
    )
  },

  deleteRows(
    id: string,
    schema: string,
    table: string,
    pks: Record<string, unknown>[]
  ): Promise<void> {
    return request<void>(
      `/connections/${id}/schemas/${encodeURIComponent(schema)}/tables/${encodeURIComponent(table)}/data`,
      {
        method: 'DELETE',
        body: JSON.stringify({ pks }),
      }
    )
  },

  // query
  executeQuery(id: string, query: string): Promise<QueryResult> {
    return request<QueryResult>(`/connections/${id}/query`, {
      method: 'POST',
      body: JSON.stringify({ query }),
    })
  },
}
