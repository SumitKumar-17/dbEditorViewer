import * as React from 'react'
import Editor from '@monaco-editor/react'
import { Play, Terminal, Clock } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { ResultsPanel } from './ResultsPanel'
import { HistoryPanel } from './HistoryPanel'
import { api } from '@/lib/api'
import { useUIStore } from '@/stores/ui'
import { useConnectionsStore } from '@/stores/connections'
import { useQueryHistoryStore } from '@/stores/queryHistory'
import { useSchemaCompletion } from '@/hooks/useSchemaCompletion'
import { toast } from '@/hooks/useToast'
import type { QueryResult } from '@/types'
import { cn } from '@/lib/utils'

export function QueryEditor() {
  const { activeConnectionId, activeSchema, activeTable, theme } = useUIStore()
  const { connections } = useConnectionsStore()
  const [query, setQuery] = React.useState(() => {
    if (activeTable && activeSchema) {
      return `SELECT *\nFROM "${activeSchema}"."${activeTable}"\nLIMIT 100;`
    }
    return '-- Write your SQL query here\nSELECT 1;'
  })
  const [result, setResult] = React.useState<QueryResult | null>(null)
  const [showHistory, setShowHistory] = React.useState(false)

  const activeConn = connections.find((c) => c.id === activeConnectionId)
  const language = activeConn?.type === 'mongodb' ? 'javascript' : 'sql'
  const editorTheme = theme === 'dark' ? 'vs-dark' : 'light'

  const addHistoryEntry = useQueryHistoryStore((s) => s.addEntry)
  const completions = useSchemaCompletion(activeConnectionId)
  const completionsRef = React.useRef(completions)
  React.useEffect(() => { completionsRef.current = completions }, [completions])
  const completionDisposableRef = React.useRef<{ dispose(): void } | null>(null)

  // Update query when table changes
  React.useEffect(() => {
    if (activeTable && activeSchema) {
      setQuery(`SELECT *\nFROM "${activeSchema}"."${activeTable}"\nLIMIT 100;`)
    }
  }, [activeTable, activeSchema])

  const executeMutation = useMutation({
    mutationFn: () => api.executeQuery(activeConnectionId!, query),
    onSuccess: (data) => {
      setResult(data)
      if (activeConnectionId) {
        addHistoryEntry({
          connectionId: activeConnectionId,
          query,
          durationMs: data.durationMs,
          rowCount: data.rows.length > 0 ? data.rows.length : (data.rowsAffected ?? 0),
          hadError: false,
        })
      }
      if (!data.error) {
        toast({
          title: 'Query complete',
          description: `${data.rows.length > 0 ? `${data.rows.length} rows` : `${data.rowsAffected} rows affected`} in ${data.durationMs}ms`,
        })
      }
    },
    onError: (err) => {
      if (activeConnectionId) {
        addHistoryEntry({
          connectionId: activeConnectionId,
          query,
          durationMs: 0,
          rowCount: 0,
          hadError: true,
        })
      }
      toast({ title: 'Query failed', description: String(err), variant: 'destructive' })
    },
  })

  // Use a ref so the Monaco keybinding always sees the latest query/connectionId
  const runRef = React.useRef<() => void>(() => {})
  runRef.current = () => {
    if (!activeConnectionId) {
      toast({ title: 'No connection', description: 'Select a connection first', variant: 'destructive' })
      return
    }
    if (!query.trim()) return
    executeMutation.mutate()
  }

  const handleRun = () => runRef.current()

  const handleEditorMount = (_editor: unknown, monaco: unknown) => {
    const m = monaco as {
      KeyMod: { CtrlCmd: number }
      KeyCode: { Enter: number }
      languages: {
        CompletionItemKind: { Class: number; Field: number }
        registerCompletionItemProvider(lang: string, p: unknown): { dispose(): void }
      }
    }
    const ed = _editor as { addCommand: (mask: number, handler: () => void) => void }
    ed.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.Enter, () => runRef.current())

    completionDisposableRef.current = m.languages.registerCompletionItemProvider('sql', {
      triggerCharacters: [' ', '.', '\n'],
      provideCompletionItems: (_model: unknown, _position: unknown) => {
        const suggestions = []
        for (const { schema, table, columns } of completionsRef.current) {
          suggestions.push({
            label: table,
            kind: m.languages.CompletionItemKind.Class,
            insertText: `"${schema}"."${table}"`,
            detail: `table · ${schema}`,
          })
          for (const col of columns) {
            suggestions.push({
              label: col,
              kind: m.languages.CompletionItemKind.Field,
              insertText: `"${col}"`,
              detail: `column · ${table}`,
            })
          }
        }
        return { suggestions }
      },
    })
  }

  React.useEffect(() => {
    return () => { completionDisposableRef.current?.dispose() }
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
        <Terminal className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Query Editor
        </span>
        {activeConn && (
          <span className="text-xs text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">
            {activeConn.name}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-400 hidden sm:inline">Ctrl+Enter to run</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowHistory((v) => !v)}
            disabled={!activeConnectionId}
            className={cn(
              'h-8 px-2 text-gray-500',
              showHistory && 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
            )}
          >
            <Clock className="h-3.5 w-3.5 mr-1" />
            History
          </Button>
          <Button
            size="sm"
            onClick={handleRun}
            loading={executeMutation.isPending}
            disabled={!activeConnectionId || !query.trim()}
            className="h-8 bg-indigo-600 hover:bg-indigo-500 text-white border-0"
          >
            <Play className="h-3.5 w-3.5 mr-1" />
            Run
          </Button>
        </div>
      </div>

      {/* Editor area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: editor + results */}
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          {/* Monaco Editor - 40% height */}
          <div className="flex-none" style={{ height: '40%', minHeight: '160px' }}>
            <Editor
              height="100%"
              language={language}
              value={query}
              onChange={(v) => setQuery(v || '')}
              theme={editorTheme}
              onMount={handleEditorMount}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                padding: { top: 8 },
                suggestOnTriggerCharacters: true,
                quickSuggestions: true,
                tabSize: 2,
                fontFamily: '"JetBrains Mono", "Fira Code", Consolas, "Courier New", monospace',
                renderLineHighlight: 'line',
                folding: false,
              }}
            />
          </div>

          {/* Results - 60% height */}
          <div className="flex-1 overflow-hidden">
            <ResultsPanel result={result} loading={executeMutation.isPending} />
          </div>
        </div>

        {/* Right: history panel */}
        {showHistory && activeConnectionId && (
          <div className="w-60 border-l border-gray-200 dark:border-gray-700 flex-shrink-0 overflow-hidden">
            <HistoryPanel
              connectionId={activeConnectionId}
              onSelect={(q) => setQuery(q)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
