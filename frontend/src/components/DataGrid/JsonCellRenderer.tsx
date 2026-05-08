import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import Editor from '@monaco-editor/react'
import { Braces, Pencil, X, Check, AlertCircle } from 'lucide-react'
import { useUIStore } from '@/stores/ui'

// ── helpers ──────────────────────────────────────────────────────────────────

export function tryParseJSON(value: unknown): { parsed: unknown; isJSON: boolean } {
  if (value === null || value === undefined) return { parsed: value, isJSON: false }
  if (typeof value === 'object') return { parsed: value, isJSON: true }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        return { parsed: JSON.parse(trimmed), isJSON: true }
      } catch {
        // not valid JSON
      }
    }
  }
  return { parsed: value, isJSON: false }
}

export function isJSONColumn(dataType: string, value: unknown): boolean {
  const type = dataType.toLowerCase()
  if (type === 'json' || type === 'jsonb' || type === 'object' || type === 'array') return true
  if (typeof value === 'object' && value !== null) return true
  if (typeof value === 'string') {
    const t = (value as string).trim()
    return (t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))
  }
  return false
}

// ── JsonEditDialog ────────────────────────────────────────────────────────────

interface JsonEditDialogProps {
  open: boolean
  value: unknown
  columnName: string
  onSave: (newValue: unknown) => void
  onClose: () => void
}

export function JsonEditDialog({ open, value, columnName, onSave, onClose }: JsonEditDialogProps) {
  const { theme } = useUIStore()
  const { parsed } = tryParseJSON(value)

  const initial = React.useMemo(
    () => JSON.stringify(parsed ?? null, null, 2),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open] // only recalculate when dialog opens, not on every render
  )

  const [text, setText] = React.useState(initial)
  const [parseError, setParseError] = React.useState<string | null>(null)

  // Reset text when dialog opens with a new value
  React.useEffect(() => {
    if (open) {
      setText(JSON.stringify(parsed ?? null, null, 2))
      setParseError(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleChange = (v: string | undefined) => {
    const val = v ?? ''
    setText(val)
    try {
      JSON.parse(val)
      setParseError(null)
    } catch (e) {
      setParseError((e as Error).message)
    }
  }

  const handleSave = () => {
    try {
      const parsed = JSON.parse(text)
      onSave(parsed)
      onClose()
    } catch (e) {
      setParseError((e as Error).message)
    }
  }

  const handleSaveRaw = () => {
    // Save as string if user wants to store raw text
    onSave(text)
    onClose()
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50 animate-in fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[680px] max-w-[95vw] h-[520px] flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Braces className="h-4 w-4 text-indigo-500" />
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Edit JSON
              </span>
              <span className="text-xs text-gray-400 font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                {columnName}
              </span>
            </div>
            <Dialog.Close asChild>
              <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </Dialog.Close>
          </div>

          {/* Monaco editor */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <Editor
              height="100%"
              language="json"
              value={text}
              onChange={handleChange}
              theme={theme === 'dark' ? 'vs-dark' : 'light'}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'off',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                padding: { top: 8 },
                folding: true,
                tabSize: 2,
                formatOnPaste: true,
                formatOnType: false,
                fontFamily: '"JetBrains Mono","Fira Code",Consolas,"Courier New",monospace',
              }}
            />
          </div>

          {/* Validation error */}
          {parseError && (
            <div className="flex items-start gap-2 px-4 py-2 bg-red-50 dark:bg-red-950/40 border-t border-red-200 dark:border-red-900 flex-shrink-0">
              <AlertCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5" />
              <span className="text-xs font-mono text-red-600 dark:text-red-400 break-words">{parseError}</span>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
            <span className="text-xs text-gray-400">
              {parseError ? 'Fix the JSON syntax to save as parsed value' : 'Valid JSON'}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              {parseError && (
                <button
                  onClick={handleSaveRaw}
                  className="px-3 py-1.5 text-sm text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-lg transition-colors"
                  title="Save as raw string (JSON is invalid)"
                >
                  Save as string
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={!!parseError}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                <Check className="h-3.5 w-3.5" />
                Save
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ── JsonCellRenderer ──────────────────────────────────────────────────────────

interface JsonCellRendererProps {
  value: unknown
  /** If provided, an edit button appears and clicking it opens the editor */
  onEdit?: (newValue: unknown) => void
  columnName?: string
}

export function JsonCellRenderer({ value, onEdit, columnName = 'value' }: JsonCellRendererProps) {
  const { parsed, isJSON } = tryParseJSON(value)
  const [viewOpen, setViewOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)

  if (!isJSON) {
    if (value === null || value === undefined) {
      return (
        <div className="flex items-center gap-1 w-full h-full">
          <span className="text-gray-400 italic text-xs">NULL</span>
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); setEditOpen(true) }}
              className="ml-auto p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              title="Edit value"
            >
              <Pencil className="h-3 w-3 text-gray-400" />
            </button>
          )}
          {onEdit && (
            <JsonEditDialog
              open={editOpen}
              value={value}
              columnName={columnName}
              onSave={onEdit}
              onClose={() => setEditOpen(false)}
            />
          )}
        </div>
      )
    }
    return <span>{String(value)}</span>
  }

  const preview = JSON.stringify(parsed)
  const truncated = preview.length > 55 ? preview.slice(0, 52) + '…' : preview

  return (
    <>
      <div className="flex items-center gap-1 w-full h-full group/cell">
        {/* Click preview → view-only dialog */}
        <button
          onClick={() => setViewOpen(true)}
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded px-1 -mx-1 transition-colors"
          title="Click to view JSON"
        >
          <Braces className="h-3 w-3 text-indigo-400 flex-shrink-0" />
          <span className="font-mono text-xs text-indigo-600 dark:text-indigo-300 truncate">
            {truncated}
          </span>
        </button>

        {/* Edit button — only when onEdit is provided */}
        {onEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); setEditOpen(true) }}
            className="flex-shrink-0 p-0.5 rounded opacity-0 group-hover/cell:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
            title="Edit JSON"
          >
            <Pencil className="h-3 w-3 text-gray-400 hover:text-indigo-500" />
          </button>
        )}
      </div>

      {/* View-only dialog */}
      <Dialog.Root open={viewOpen} onOpenChange={setViewOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 animate-in fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[560px] max-w-[90vw] max-h-[70vh] flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Braces className="h-4 w-4 text-indigo-500" />
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">JSON Value</span>
                <span className="text-xs text-gray-400 font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{columnName}</span>
              </div>
              <div className="flex items-center gap-1">
                {onEdit && (
                  <button
                    onClick={() => { setViewOpen(false); setEditOpen(true) }}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors mr-1"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                )}
                <Dialog.Close asChild>
                  <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <X className="h-4 w-4 text-gray-500" />
                  </button>
                </Dialog.Close>
              </div>
            </div>
            <div className="overflow-auto flex-1 p-4">
              <pre className="text-xs font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words leading-relaxed">
                {JSON.stringify(parsed, null, 2)}
              </pre>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Edit dialog */}
      {onEdit && (
        <JsonEditDialog
          open={editOpen}
          value={value}
          columnName={columnName}
          onSave={onEdit}
          onClose={() => setEditOpen(false)}
        />
      )}
    </>
  )
}
