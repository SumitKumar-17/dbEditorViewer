import * as React from 'react'
import Editor from '@monaco-editor/react'
import { Play, Terminal } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { ResultsPanel } from './ResultsPanel'
import { api } from '@/lib/api'
import { useUIStore } from '@/stores/ui'
import { useConnectionsStore } from '@/stores/connections'
import { toast } from '@/hooks/useToast'
import type { QueryResult } from '@/types'
import { cn } from '@/lib/utils'

export function QueryEditor() {
  const { activeConnectionId, activeSchema, activeTable, theme } = useUIStore()
  const { connections } = useConnectionsStore()
  const [query, setQuery] = React.useState(() => {
    if (activeTable) {
      return `SELECT *\nFROM ${activeSchema ? `${activeSchema}.` : ''}${activeTable}\nLIMIT 100;`
    }
    return '-- Write your SQL query here\nSELECT 1;'
  })
  const [result, setResult] = React.useState<QueryResult | null>(null)

  const activeConn = connections.find((c) => c.id === activeConnectionId)
  const language = activeConn?.type === 'mongodb' ? 'javascript' : 'sql'
  const editorTheme = theme === 'dark' ? 'vs-dark' : 'light'

  // Update query when table changes
  React.useEffect(() => {
    if (activeTable && activeSchema) {
      setQuery(`SELECT *\nFROM ${activeSchema}.${activeTable}\nLIMIT 100;`)
    } else if (activeTable) {
      setQuery(`SELECT *\nFROM ${activeTable}\nLIMIT 100;`)
    }
  }, [activeTable, activeSchema])

  const executeMutation = useMutation({
    mutationFn: () => api.executeQuery(activeConnectionId!, query),
    onSuccess: (data) => {
      setResult(data)
      if (!data.error) {
        toast({
          title: 'Query complete',
          description: `${data.rows.length > 0 ? `${data.rows.length} rows` : `${data.rowsAffected} rows affected`} in ${data.durationMs}ms`,
        })
      }
    },
    onError: (err) => {
      toast({ title: 'Query failed', description: String(err), variant: 'destructive' })
    },
  })

  const handleRun = () => {
    if (!activeConnectionId) {
      toast({ title: 'No connection', description: 'Select a connection first', variant: 'destructive' })
      return
    }
    if (!query.trim()) return
    executeMutation.mutate()
  }

  const handleEditorMount = (_editor: unknown, monaco: unknown) => {
    const m = monaco as {
      editor: {
        addCommand: (mask: number, handler: () => void) => void
      }
      KeyMod: { CtrlCmd: number }
      KeyCode: { Enter: number }
    }
    // Ctrl+Enter / Cmd+Enter to run
    const monacoEditor = _editor as {
      addCommand: (mask: number, handler: () => void) => void
    }
    monacoEditor.addCommand(
      m.KeyMod.CtrlCmd | m.KeyCode.Enter,
      handleRun
    )
  }

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
      <div className="flex flex-col flex-1 overflow-hidden">
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
    </div>
  )
}
