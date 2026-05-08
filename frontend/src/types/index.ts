export type DBType = 'postgres' | 'mysql' | 'sqlite' | 'mongodb' | 'unknown'

export interface Connection {
  id: string
  name: string
  url: string
  type: DBType
  createdAt: string
}

export interface ColumnDef {
  name: string
  dataType: string
  isNullable: boolean
  defaultValue: string | null
  isPrimaryKey: boolean
  isForeignKey: boolean
  foreignTable?: string
  foreignColumn?: string
}

export interface IndexDef {
  name: string
  columns: string[]
  unique: boolean
}

export interface DataResult {
  rows: Record<string, unknown>[]
  total: number
  page: number
  limit: number
  columns: ColumnDef[]
}

export interface QueryResult {
  rows: Record<string, unknown>[]
  rowsAffected: number
  columns: string[]
  durationMs: number
  error?: string
}
