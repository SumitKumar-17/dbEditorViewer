import * as React from 'react'
import { Plus, Trash2, RefreshCw, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface GridToolbarProps {
  totalRows: number
  page: number
  limit: number
  selectedCount: number
  loading: boolean
  onAddRow: () => void
  onDeleteSelected: () => void
  onRefresh: () => void
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
  onExportCSV?: () => void
  onExportJSON?: () => void
}

const PAGE_SIZES = [25, 50, 100, 200]

export function GridToolbar({
  totalRows,
  page,
  limit,
  selectedCount,
  loading,
  onAddRow,
  onDeleteSelected,
  onRefresh,
  onPageChange,
  onLimitChange,
  onExportCSV,
  onExportJSON,
}: GridToolbarProps) {
  const totalPages = Math.max(1, Math.ceil(totalRows / limit))
  const startRow = (page - 1) * limit + 1
  const endRow = Math.min(page * limit, totalRows)

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onAddRow}
          className="h-8 text-xs"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Row
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onDeleteSelected}
          disabled={selectedCount === 0}
          className={cn(
            'h-8 text-xs',
            selectedCount > 0 && 'text-red-500 border-red-300 hover:bg-red-50 dark:hover:bg-red-950'
          )}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          Delete{selectedCount > 0 ? ` (${selectedCount})` : ''}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onRefresh}
          className="h-8 w-8"
          title="Refresh"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </Button>
        <span className="text-xs text-muted-foreground">
          {totalRows.toLocaleString()} rows
        </span>
      </div>

      <div className="flex items-center gap-3">
        {(onExportCSV || onExportJSON) && (
          <details className="relative">
            <summary className="list-none inline-flex items-center justify-center rounded-md text-xs font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3 cursor-pointer select-none">
              <Download className="h-3.5 w-3.5 mr-1" />
              Export
            </summary>
            <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg py-1">
              {onExportCSV && (
                <button
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={onExportCSV}
                >
                  Export as CSV
                </button>
              )}
              {onExportJSON && (
                <button
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={onExportJSON}
                >
                  Export as JSON
                </button>
              )}
            </div>
          </details>
        )}
        <div className="flex items-center gap-1">
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="h-7 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>{s} / page</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground px-2 min-w-[80px] text-center">
            {totalRows > 0 ? `${startRow}–${endRow} of ${totalRows.toLocaleString()}` : 'No data'}
          </span>
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
