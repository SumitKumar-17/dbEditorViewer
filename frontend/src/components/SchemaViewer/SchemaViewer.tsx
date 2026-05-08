import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Key,
  Link,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Fingerprint,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useUIStore } from '@/stores/ui'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

export function SchemaViewer() {
  const { activeConnectionId, activeSchema, activeTable } = useUIStore()

  const {
    data: columns,
    isLoading: loadingColumns,
    error: columnsError,
  } = useQuery({
    queryKey: ['columns', activeConnectionId, activeSchema, activeTable],
    queryFn: () => api.getTableSchema(activeConnectionId!, activeSchema!, activeTable!),
    enabled: !!(activeConnectionId && activeSchema && activeTable),
    staleTime: 60000,
  })

  const {
    data: indexes,
    isLoading: loadingIndexes,
  } = useQuery({
    queryKey: ['indexes', activeConnectionId, activeSchema, activeTable],
    queryFn: () => api.getIndexes(activeConnectionId!, activeSchema!, activeTable!),
    enabled: !!(activeConnectionId && activeSchema && activeTable),
    staleTime: 60000,
  })

  if (loadingColumns) {
    return (
      <div className="flex items-center justify-center h-full gap-3 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading schema...</span>
      </div>
    )
  }

  if (columnsError) {
    return (
      <div className="flex items-center justify-center h-full gap-3 p-8 text-center">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-100">Failed to load schema</p>
          <p className="text-sm text-gray-500 mt-1">{String(columnsError)}</p>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-4xl mx-auto">
        {/* Columns section */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Columns</h2>
            {columns && (
              <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                {columns.length}
              </span>
            )}
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider">Nullable</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider">Default</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider">Flags</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider">References</th>
                </tr>
              </thead>
              <tbody>
                {columns?.map((col, idx) => (
                  <tr
                    key={col.name}
                    className={cn(
                      'border-b border-gray-100 dark:border-gray-800 last:border-0 transition-colors',
                      col.isPrimaryKey
                        ? 'bg-indigo-50/50 dark:bg-indigo-950/30'
                        : idx % 2 === 0
                        ? 'bg-white dark:bg-gray-900'
                        : 'bg-gray-50/50 dark:bg-gray-800/30'
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {col.isPrimaryKey && (
                          <Key className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
                        )}
                        {col.isForeignKey && !col.isPrimaryKey && (
                          <Link className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                        )}
                        <span
                          className={cn(
                            'font-mono text-xs',
                            col.isPrimaryKey
                              ? 'text-indigo-700 dark:text-indigo-300 font-semibold'
                              : 'text-gray-900 dark:text-gray-100'
                          )}
                        >
                          {col.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded">
                        {col.dataType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {col.isNullable ? (
                        <CheckCircle2 className="h-4 w-4 text-gray-400" />
                      ) : (
                        <XCircle className="h-4 w-4 text-gray-300 dark:text-gray-600" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {col.defaultValue !== null && col.defaultValue !== undefined ? (
                        <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
                          {String(col.defaultValue)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">none</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {col.isPrimaryKey && (
                          <span className="text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded font-medium">
                            PK
                          </span>
                        )}
                        {col.isForeignKey && (
                          <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-medium">
                            FK
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {col.isForeignKey && col.foreignTable ? (
                        <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                          <ArrowRight className="h-3 w-3" />
                          <span className="font-mono">
                            {col.foreignTable}{col.foreignColumn ? `.${col.foreignColumn}` : ''}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Indexes section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Indexes</h2>
            {indexes && (
              <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                {indexes.length}
              </span>
            )}
          </div>

          {loadingIndexes ? (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading indexes...
            </div>
          ) : indexes && indexes.length > 0 ? (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider">Columns</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider">Unique</th>
                  </tr>
                </thead>
                <tbody>
                  {indexes.map((idx, i) => (
                    <tr
                      key={idx.name}
                      className={cn(
                        'border-b border-gray-100 dark:border-gray-800 last:border-0',
                        i % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-800/30'
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Fingerprint className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                          <span className="font-mono text-xs text-gray-900 dark:text-gray-100">{idx.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {idx.columns.map((col) => (
                            <span
                              key={col}
                              className="font-mono text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded"
                            >
                              {col}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {idx.unique ? (
                          <span className="text-xs bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-medium">
                            UNIQUE
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-center text-sm text-gray-500">
              No indexes found for this table
            </div>
          )}
        </section>
      </div>
    </ScrollArea>
  )
}
