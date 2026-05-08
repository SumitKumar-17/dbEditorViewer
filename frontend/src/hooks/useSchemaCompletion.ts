import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface TableCompletion {
  schema: string
  table: string
  columns: string[]
}

export function useSchemaCompletion(connectionId: string | null): TableCompletion[] {
  const { data } = useQuery({
    queryKey: ['schema-completion', connectionId],
    enabled: connectionId != null,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<TableCompletion[]> => {
      if (!connectionId) return []

      const schemas = await api.getSchemas(connectionId)
      const results: TableCompletion[] = []

      await Promise.all(
        schemas.map(async (schema) => {
          const tables = await api.getTables(connectionId, schema)
          await Promise.all(
            tables.map(async (table) => {
              const columnDefs = await api.getTableSchema(connectionId, schema, table)
              results.push({
                schema,
                table,
                columns: columnDefs.map((c) => c.name),
              })
            })
          )
        })
      )

      return results
    },
  })

  return data ?? []
}
