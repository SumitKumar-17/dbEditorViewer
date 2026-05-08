import * as React from 'react'
import { AgGridReact } from 'ag-grid-react'
import {
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type CellValueChangedEvent,
  type SelectionChangedEvent,
  type IRowNode,
} from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useUIStore } from '@/stores/ui'
import { toast } from '@/hooks/useToast'
import { GridToolbar } from './GridToolbar'
import { Key, AlertCircle, AlertTriangle } from 'lucide-react'
import { JsonCellRenderer, isJSONColumn } from './JsonCellRenderer'
import type { ColumnDef } from '@/types'

export function DataGrid() {
  const { activeConnectionId, activeSchema, activeTable, theme } = useUIStore()
  const [page, setPage] = React.useState(1)
  const [limit, setLimit] = React.useState(50)
  const [selectedNodes, setSelectedNodes] = React.useState<IRowNode[]>([])
  const gridRef = React.useRef<AgGridReact>(null)
  const gridApiRef = React.useRef<GridApi | null>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  const queryKey = ['data', activeConnectionId, activeSchema, activeTable, page, limit]

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () =>
      api.getData(activeConnectionId!, activeSchema!, activeTable!, { page, limit }),
    enabled: !!(activeConnectionId && activeSchema && activeTable),
    staleTime: 30000,
  })

  // Reset page when table changes
  React.useEffect(() => {
    setPage(1)
    setSelectedNodes([])
  }, [activeConnectionId, activeSchema, activeTable])

  // Auto-fit columns when container resizes
  React.useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(() => {
      gridApiRef.current?.sizeColumnsToFit()
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const updateMutation = useMutation({
    mutationFn: ({
      pk,
      rowData,
    }: {
      pk: Record<string, unknown>
      rowData: Record<string, unknown>
    }) => api.updateRow(activeConnectionId!, activeSchema!, activeTable!, pk, rowData),
    onSuccess: () => {
      toast({ title: 'Row updated', description: 'Changes saved successfully' })
    },
    onError: (err) => {
      toast({ title: 'Update failed', description: String(err), variant: 'destructive' })
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (pks: Record<string, unknown>[]) =>
      api.deleteRows(activeConnectionId!, activeSchema!, activeTable!, pks),
    onSuccess: () => {
      toast({ title: 'Rows deleted' })
      queryClient.invalidateQueries({ queryKey })
      setSelectedNodes([])
    },
    onError: (err) => {
      toast({ title: 'Delete failed', description: String(err), variant: 'destructive' })
    },
  })

  const insertMutation = useMutation({
    mutationFn: (rowData: Record<string, unknown>) =>
      api.insertRow(activeConnectionId!, activeSchema!, activeTable!, rowData),
    onSuccess: () => {
      toast({ title: 'Row added' })
      queryClient.invalidateQueries({ queryKey })
    },
    onError: (err) => {
      toast({ title: 'Insert failed', description: String(err), variant: 'destructive' })
    },
  })

  const columns: ColumnDef[] = data?.columns || []
  const pkColumns = columns.filter((c) => c.isPrimaryKey).map((c) => c.name)
  const hasPK = pkColumns.length > 0

  const handleJsonEdit = React.useCallback(
    (colName: string, rowData: Record<string, unknown>, newValue: unknown) => {
      const pk: Record<string, unknown> = {}
      for (const pkCol of pkColumns) {
        pk[pkCol] = rowData[pkCol]
      }
      updateMutation.mutate({ pk, rowData: { [colName]: newValue } })
    },
    [pkColumns, updateMutation]
  )

  const colDefs: ColDef[] = React.useMemo(() => {
    if (!columns.length) return []
    return columns.map((col) => {
      const jsonCol = isJSONColumn(col.dataType, undefined)
      return {
        field: col.name,
        headerName: col.name,
        editable: hasPK && !col.isPrimaryKey && !jsonCol,
        sortable: true,
        resizable: true,
        filter: true,
        minWidth: jsonCol ? 180 : 80,
        headerComponent: col.isPrimaryKey ? PKHeaderComponent : undefined,
        headerComponentParams: col.isPrimaryKey ? { displayName: col.name } : undefined,
        cellStyle: col.isPrimaryKey
          ? { color: '#818cf8', fontWeight: '500' }
          : undefined,
        ...(jsonCol
          ? {
              cellRenderer: (params: { value: unknown; data: Record<string, unknown> }) => (
                <JsonCellRenderer
                  value={params.value}
                  columnName={col.name}
                  onEdit={
                    hasPK
                      ? (newVal) => handleJsonEdit(col.name, params.data, newVal)
                      : undefined
                  }
                />
              ),
            }
          : {
              valueFormatter: (params: { value: unknown }) => {
                if (params.value === null || params.value === undefined) return ''
                if (typeof params.value === 'object') return JSON.stringify(params.value)
                return String(params.value)
              },
            }),
      }
    })
  }, [columns, hasPK, handleJsonEdit]) // eslint-disable-line react-hooks/exhaustive-deps

  const onCellValueChanged = React.useCallback(
    (event: CellValueChangedEvent) => {
      const rowData = event.data as Record<string, unknown>
      const pk: Record<string, unknown> = {}
      for (const pkCol of pkColumns) {
        pk[pkCol] = rowData[pkCol]
      }
      // Strip PK columns from the changed data payload
      const changedData: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(rowData)) {
        if (!pkColumns.includes(k)) changedData[k] = v
      }
      updateMutation.mutate({ pk, rowData: changedData })
    },
    [pkColumns, updateMutation]
  )

  const onSelectionChanged = React.useCallback((event: SelectionChangedEvent) => {
    setSelectedNodes(event.api.getSelectedNodes())
  }, [])

  const onGridReady = React.useCallback((event: GridReadyEvent) => {
    gridApiRef.current = event.api
    event.api.sizeColumnsToFit()
  }, [])

  const handleAddRow = () => {
    const emptyRow: Record<string, unknown> = {}
    for (const col of columns) {
      if (!col.isPrimaryKey) emptyRow[col.name] = null
    }
    insertMutation.mutate(emptyRow)
  }

  const handleDeleteSelected = () => {
    const pks = selectedNodes.map((node) => {
      const rowData = node.data as Record<string, unknown>
      const pk: Record<string, unknown> = {}
      for (const pkCol of pkColumns) {
        pk[pkCol] = rowData[pkCol]
      }
      return pk
    })
    deleteMutation.mutate(pks)
  }

  const gridTheme = theme === 'dark' ? 'ag-theme-alpine-dark' : 'ag-theme-alpine'

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-100">Failed to load data</p>
          <p className="text-sm text-gray-500 mt-1">{String(error)}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {!isLoading && columns.length > 0 && !hasPK && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400 flex-shrink-0">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          This table has no primary key — editing and deleting rows is disabled.
        </div>
      )}
      <GridToolbar
        totalRows={data?.total || 0}
        page={page}
        limit={limit}
        selectedCount={selectedNodes.length}
        loading={isLoading}
        onAddRow={handleAddRow}
        onDeleteSelected={handleDeleteSelected}
        onRefresh={() => refetch()}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1) }}
      />
      <div ref={containerRef} className={`${gridTheme} flex-1 w-full overflow-hidden`} style={{ height: '100%' }}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3 text-gray-500">
              <svg className="h-8 w-8 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm">Loading data...</span>
            </div>
          </div>
        ) : (
          <AgGridReact
            ref={gridRef}
            rowData={data?.rows || []}
            columnDefs={colDefs}
            defaultColDef={{
              resizable: true,
              sortable: true,
              filter: true,
              minWidth: 80,
            }}
            rowSelection="multiple"
            onCellValueChanged={onCellValueChanged}
            onSelectionChanged={onSelectionChanged}
            onGridReady={onGridReady}
            animateRows={false}
            suppressRowClickSelection={true}
            rowBuffer={30}
            rowHeight={36}
            headerHeight={40}
          />
        )}
      </div>
    </div>
  )
}

function PKHeaderComponent(props: { displayName: string }) {
  return (
    <div className="flex items-center gap-1">
      <Key className="h-3 w-3 text-indigo-400" />
      <span>{props.displayName}</span>
    </div>
  )
}
