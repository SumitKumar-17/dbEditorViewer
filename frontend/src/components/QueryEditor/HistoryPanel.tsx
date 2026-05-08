import * as React from 'react'
import { useQueryHistoryStore } from '@/stores/queryHistory'
import { cn } from '@/lib/utils'

interface HistoryPanelProps {
  connectionId: string
  onSelect: (query: string) => void
}

function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHr = Math.floor(diffMin / 60)
  return `${diffHr} hr ago`
}

export function HistoryPanel({ connectionId, onSelect }: HistoryPanelProps) {
  const { entries, clearForConnection } = useQueryHistoryStore()

  const filtered = React.useMemo(
    () => entries.filter((e) => e.connectionId === connectionId),
    [entries, connectionId]
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
          History
        </span>
        {filtered.length > 0 && (
          <button
            onClick={() => clearForConnection(connectionId)}
            className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-gray-400 dark:text-gray-500">No queries yet</p>
          </div>
        ) : (
          <ul>
            {filtered.map((entry) => (
              <li key={entry.id}>
                <button
                  className={cn(
                    'w-full h-10 px-3 flex items-center gap-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors group'
                  )}
                  onClick={() => onSelect(entry.query)}
                  title={entry.query}
                >
                  {/* Error dot */}
                  {entry.hadError && (
                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-500" />
                  )}
                  {/* Query preview */}
                  <span className="flex-1 min-w-0 font-mono text-xs text-gray-700 dark:text-gray-300 truncate">
                    {entry.query.slice(0, 65)}
                  </span>
                  {/* Row count badge */}
                  {!entry.hadError && (
                    <span className="flex-shrink-0 text-xs bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">
                      {entry.rowCount}
                    </span>
                  )}
                  {/* Relative time */}
                  <span className="flex-shrink-0 text-xs text-gray-400 dark:text-gray-500">
                    {formatRelativeTime(entry.executedAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
