import * as React from 'react'
import { AgGridReact } from 'ag-grid-react'
import {
  type ColDef,
  type GridApi,
  type GridReadyEvent,
} from 'ag-grid-community'
import { Clock, Rows, AlertCircle, Info } from 'lucide-react'
import type { QueryResult } from '@/types'
import { useUIStore } from '@/stores/ui'
import { JsonCellRenderer, isJSONColumn } from '@/components/DataGrid/JsonCellRenderer'

interface ResultsPanelProps {
  result: QueryResult | null
  loading: boolean
}

export function ResultsPanel({ result, loading }: ResultsPanelProps) {
  const { theme } = useUIStore()
  const gridTheme = theme === 'dark' ? 'ag-theme-alpine-dark' : 'ag-theme-alpine'
  const gridApiRef = React.useRef<GridApi | null>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Auto-fit columns when container resizes
  React.useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(() => {
      gridApiRef.current?.sizeColumnsToFit()
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const onGridReady = React.useCallback((event: GridReadyEvent) => {
    gridApiRef.current = event.api
    event.api.sizeColumnsToFit()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-3 text-gray-500">
        <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm">Executing query...</span>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-gray-500">
        <Info className="h-4 w-4" />
        <span className="text-sm">Run a query to see results</span>
      </div>
    )
  }

  if (result.error) {
    return (
      <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/50 border-t border-red-200 dark:border-red-900 h-full overflow-auto">
        <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-red-700 dark:text-red-400 text-sm">Query Error</p>
          <pre className="mt-1 text-xs text-red-600 dark:text-red-300 whitespace-pre-wrap font-mono">{result.error}</pre>
        </div>
      </div>
    )
  }

  const colDefs: ColDef[] = result.columns.map((col) => {
    const firstVal = result.rows[0]?.[col]
    const jsonCol = isJSONColumn('', firstVal)
    return {
      field: col,
      headerName: col,
      editable: false,
      resizable: true,
      sortable: true,
      filter: true,
      minWidth: jsonCol ? 180 : 80,
      ...(jsonCol
        ? {
            cellRenderer: (params: { value: unknown }) => (
              <JsonCellRenderer value={params.value} columnName={col} />
            ),
          }
        : {
            valueFormatter: (params: { value: unknown }) => {
              if (params.value === null || params.value === undefined) return 'NULL'
              if (typeof params.value === 'object') return JSON.stringify(params.value)
              return String(params.value)
            },
            cellStyle: (params: { value: unknown }) => {
              if (params.value === null || params.value === undefined) {
                return { color: '#9ca3af', fontStyle: 'italic' }
              }
              return null
            },
          }),
    }
  })

  return (
    <div className="flex flex-col h-full border-t border-gray-200 dark:border-gray-700">
      {/* Stats bar */}
      <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          <span>{result.durationMs}ms</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Rows className="h-3.5 w-3.5" />
          <span>
            {result.rows.length > 0
              ? `${result.rows.length} rows returned`
              : `${result.rowsAffected} rows affected`}
          </span>
        </div>
      </div>

      {result.rows.length > 0 ? (
        <div ref={containerRef} className={`${gridTheme} flex-1 overflow-hidden`} style={{ height: '100%' }}>
          <AgGridReact
            rowData={result.rows}
            columnDefs={colDefs}
            defaultColDef={{
              editable: false,
              resizable: true,
              sortable: true,
              filter: true,
            }}
            onGridReady={onGridReady}
            rowHeight={34}
            headerHeight={38}
            animateRows={false}
          />
        </div>
      ) : (
        <div className="flex items-center justify-center flex-1 text-sm text-gray-500">
          Query executed successfully — no rows returned
        </div>
      )}
    </div>
  )
}
