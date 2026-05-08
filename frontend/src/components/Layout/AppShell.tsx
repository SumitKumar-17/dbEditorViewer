import * as React from 'react'
import { ChevronRight, Database, Table2 } from 'lucide-react'
import { Header } from './Header'
import { ConnectionList } from '@/components/ConnectionManager/ConnectionList'
import { AddConnectionDialog } from '@/components/ConnectionManager/AddConnectionDialog'
import { DataGrid } from '@/components/DataGrid/DataGrid'
import { QueryEditor } from '@/components/QueryEditor/QueryEditor'
import { SchemaViewer } from '@/components/SchemaViewer/SchemaViewer'
import { useUIStore } from '@/stores/ui'
import { useConnectionsStore } from '@/stores/connections'
import { cn } from '@/lib/utils'

export function AppShell() {
  const [addDialogOpen, setAddDialogOpen] = React.useState(false)
  const { activeConnectionId, activeSchema, activeTable, activeTab, setActiveTab } = useUIStore()
  const { connections } = useConnectionsStore()

  const activeConn = connections.find((c) => c.id === activeConnectionId)

  return (
    <div className="flex flex-col h-screen bg-gray-950 overflow-hidden">
      <Header onAddConnection={() => setAddDialogOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[280px] flex-shrink-0 bg-gray-950 border-r border-gray-800 flex flex-col overflow-hidden">
          <ConnectionList />
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-900">
          {activeTable ? (
            <>
              {/* Breadcrumb */}
              <div className="flex items-center gap-1.5 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-sm flex-shrink-0">
                <Database className="h-3.5 w-3.5 text-gray-500" />
                <span className="text-gray-600 dark:text-gray-400">{activeConn?.name || activeConnectionId}</span>
                {activeSchema && (
                  <>
                    <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-400">{activeSchema}</span>
                  </>
                )}
                <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                <Table2 className="h-3.5 w-3.5 text-indigo-500" />
                <span className="font-medium text-gray-900 dark:text-gray-100">{activeTable}</span>
              </div>

              {/* Tab bar */}
              <div className="flex items-center gap-0 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 flex-shrink-0">
                {(['data', 'schema', 'query'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize',
                      activeTab === tab
                        ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    )}
                  >
                    {tab === 'data' ? 'Data' : tab === 'schema' ? 'Schema' : 'Query'}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-hidden">
                {activeTab === 'data' && <DataGrid />}
                {activeTab === 'schema' && <SchemaViewer />}
                {activeTab === 'query' && <QueryEditor />}
              </div>
            </>
          ) : (
            <WelcomeState onAddConnection={() => setAddDialogOpen(true)} hasConnections={connections.length > 0} />
          )}
        </main>
      </div>

      <AddConnectionDialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} />
    </div>
  )
}

function WelcomeState({
  onAddConnection,
  hasConnections,
}: {
  onAddConnection: () => void
  hasConnections: boolean
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-950">
        <Database className="h-10 w-10 text-indigo-500" />
      </div>
      <div className="max-w-md">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {hasConnections ? 'Select a table to get started' : 'Welcome to DBEditor'}
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          {hasConnections
            ? 'Click on a table in the sidebar to view and edit your data, run SQL queries, and inspect the schema.'
            : 'Connect to PostgreSQL, MySQL, SQLite, or MongoDB databases to browse, edit, and query your data.'}
        </p>
      </div>
      {!hasConnections && (
        <button
          onClick={onAddConnection}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
        >
          <Database className="h-4 w-4" />
          Add Your First Connection
        </button>
      )}
      {hasConnections && (
        <div className="text-sm text-gray-400 flex items-center gap-2">
          <ChevronRight className="h-4 w-4" />
          Expand a connection in the sidebar to see tables
        </div>
      )}
    </div>
  )
}
