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
  async listConnections(): Promise<Connection[]> {
    const data = await request<Connection[] | null>('/connections')
    return Array.isArray(data) ? data : []
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

  testURL(url: string): Promise<{ ok: boolean; message: string; type?: string }> {
    return request<{ ok: boolean; message: string; type?: string }>('/connections/test-url', {
      method: 'POST',
      body: JSON.stringify({ url }),
    })
  },

  // schema — routes under /db/:id/...
  getSchemas(id: string): Promise<string[]> {
    return request<string[]>(`/db/${id}/schemas`)
  },

  getTables(id: string, schema: string): Promise<string[]> {
    return request<string[]>(`/db/${id}/tables?schema=${encodeURIComponent(schema)}`)
  },

  getTableSchema(id: string, schema: string, table: string): Promise<ColumnDef[]> {
    return request<ColumnDef[]>(
      `/db/${id}/tables/${encodeURIComponent(table)}/schema?schema=${encodeURIComponent(schema)}`
    )
  },

  getIndexes(id: string, schema: string, table: string): Promise<IndexDef[]> {
    return request<IndexDef[]>(
      `/db/${id}/tables/${encodeURIComponent(table)}/indexes?schema=${encodeURIComponent(schema)}`
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
    params.set('schema', schema)
    if (opts.page !== undefined) params.set('page', String(opts.page))
    if (opts.limit !== undefined) params.set('limit', String(opts.limit))
    if (opts.sort) params.set('sort', opts.sort)
    if (opts.dir) params.set('dir', opts.dir)
    return request<DataResult>(
      `/db/${id}/tables/${encodeURIComponent(table)}/data?${params}`
    )
  },

  insertRow(
    id: string,
    schema: string,
    table: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return request<Record<string, unknown>>(
      `/db/${id}/tables/${encodeURIComponent(table)}/rows?schema=${encodeURIComponent(schema)}`,
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
      `/db/${id}/tables/${encodeURIComponent(table)}/rows?schema=${encodeURIComponent(schema)}`,
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
      `/db/${id}/tables/${encodeURIComponent(table)}/rows?schema=${encodeURIComponent(schema)}`,
      {
        method: 'DELETE',
        body: JSON.stringify({ pks }),
      }
    )
  },

  // query
  executeQuery(id: string, query: string): Promise<QueryResult> {
    return request<QueryResult>(`/db/${id}/query`, {
      method: 'POST',
      body: JSON.stringify({ query }),
    })
  },
}
