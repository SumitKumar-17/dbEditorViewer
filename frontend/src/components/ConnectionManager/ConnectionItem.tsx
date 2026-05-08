import * as React from 'react'
import {
  ChevronRight,
  ChevronDown,
  Database,
  Layers,
  Table2,
  MoreVertical,
  Trash2,
  Unplug,
  Loader2,
} from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useUIStore } from '@/stores/ui'
import { useConnectionsStore } from '@/stores/connections'
import { toast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'
import type { Connection } from '@/types'

interface ConnectionItemProps {
  connection: Connection
}

function dbTypeColor(type: Connection['type']) {
  switch (type) {
    case 'postgres': return 'text-blue-400'
    case 'mysql': return 'text-orange-400'
    case 'mongodb': return 'text-green-400'
    case 'sqlite': return 'text-amber-400'
    default: return 'text-gray-400'
  }
}

function dbTypeLabel(type: Connection['type']) {
  switch (type) {
    case 'postgres': return 'PG'
    case 'mysql': return 'MY'
    case 'mongodb': return 'MG'
    case 'sqlite': return 'SQ'
    default: return '??'
  }
}

export function ConnectionItem({ connection }: ConnectionItemProps) {
  const [expanded, setExpanded] = React.useState(false)
  const { activeConnectionId, activeSchema, activeTable, setActiveConnection, setActiveSchema, setActiveTable, setActiveTab } = useUIStore()
  const { removeConnection } = useConnectionsStore()

  const isActive = activeConnectionId === connection.id

  const { data: schemas, isLoading: loadingSchemas, error: schemasError } = useQuery({
    queryKey: ['schemas', connection.id],
    queryFn: () => api.getSchemas(connection.id),
    enabled: expanded,
    staleTime: 30000,
    retry: 1,
  })

  const handleExpand = () => {
    setExpanded((e) => !e)
    if (!isActive) {
      setActiveConnection(connection.id)
    }
  }

  const handleDelete = async () => {
    try {
      await api.deleteConnection(connection.id)
      removeConnection(connection.id)
      if (isActive) setActiveConnection(null)
      toast({ title: 'Connection removed', description: connection.name })
    } catch (err) {
      toast({ title: 'Error', description: String(err), variant: 'destructive' })
    }
  }

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-800 rounded-md mx-1 transition-colors',
          isActive && !activeTable && 'bg-gray-800'
        )}
      >
        <button
          onClick={handleExpand}
          className="flex items-center gap-2 flex-1 min-w-0"
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
          )}
          <span className={cn('text-xs font-bold flex-shrink-0', dbTypeColor(connection.type))}>
            {dbTypeLabel(connection.type)}
          </span>
          <Database className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
          <span className="text-sm text-gray-200 truncate">{connection.name}</span>
          <span className="ml-auto h-2 w-2 rounded-full bg-green-500 flex-shrink-0 opacity-0 group-hover:opacity-0" />
        </button>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-700 transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3.5 w-3.5 text-gray-400" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="z-50 min-w-[140px] rounded-md border border-gray-700 bg-gray-900 p-1 shadow-lg"
              sideOffset={4}
            >
              <DropdownMenu.Item
                className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-300 hover:bg-gray-800 rounded cursor-pointer"
                onClick={() => {
                  setActiveConnection(null)
                  setExpanded(false)
                }}
              >
                <Unplug className="h-3.5 w-3.5" />
                Disconnect
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-gray-700" />
              <DropdownMenu.Item
                className="flex items-center gap-2 px-2 py-1.5 text-sm text-red-400 hover:bg-gray-800 rounded cursor-pointer"
                onClick={handleDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {expanded && (
        <div className="ml-4 mt-0.5">
          {loadingSchemas ? (
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading schemas...
            </div>
          ) : schemasError ? (
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-red-400">
              <span>⚠ Connection lost — try reconnecting</span>
            </div>
          ) : schemas && schemas.length > 0 ? (
            schemas.map((schema) => (
              <SchemaItem
                key={schema}
                schema={schema}
                connectionId={connection.id}
                dbType={connection.type}
              />
            ))
          ) : (
            <div className="px-3 py-1.5 text-xs text-gray-500">No schemas found</div>
          )}
        </div>
      )}
    </div>
  )
}

interface SchemaItemProps {
  schema: string
  connectionId: string
  dbType: Connection['type']
}

function SchemaItem({ schema, connectionId, dbType }: SchemaItemProps) {
  const [expanded, setExpanded] = React.useState(false)
  const { activeSchema, activeTable, setActiveSchema, setActiveTable, setActiveTab } = useUIStore()

  const isActive = activeSchema === schema

  // For SQLite/MongoDB, schemas might just be the database name
  const showSchemaLevel = dbType !== 'sqlite' && dbType !== 'mongodb'

  const { data: tables, isLoading } = useQuery({
    queryKey: ['tables', connectionId, schema],
    queryFn: () => api.getTables(connectionId, schema),
    enabled: expanded || !showSchemaLevel,
    staleTime: 30000,
  })

  React.useEffect(() => {
    if (!showSchemaLevel) {
      setExpanded(true)
    }
  }, [showSchemaLevel])

  const handleTableClick = (table: string) => {
    setActiveSchema(schema)
    setActiveTable(table)
    setActiveTab('data')
  }

  if (!showSchemaLevel) {
    return (
      <div>
        {isLoading ? (
          <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading tables...
          </div>
        ) : tables?.map((table) => (
          <TableItem
            key={table}
            table={table}
            isActive={activeTable === table && activeSchema === schema}
            onClick={() => handleTableClick(table)}
          />
        ))}
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={() => {
          setExpanded((e) => !e)
          setActiveSchema(schema)
        }}
        className={cn(
          'flex items-center gap-2 w-full px-3 py-1.5 hover:bg-gray-800 rounded-md mx-0 text-left transition-colors',
          isActive && 'bg-gray-800/50'
        )}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-gray-500 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-gray-500 flex-shrink-0" />
        )}
        <Layers className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
        <span className="text-xs text-gray-400">{schema}</span>
        {tables && (
          <span className="ml-auto text-xs text-gray-600">{tables.length}</span>
        )}
      </button>

      {expanded && (
        <div className="ml-4">
          {isLoading ? (
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading tables...
            </div>
          ) : tables?.map((table) => (
            <TableItem
              key={table}
              table={table}
              isActive={activeTable === table && activeSchema === schema}
              onClick={() => handleTableClick(table)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface TableItemProps {
  table: string
  isActive: boolean
  onClick: () => void
}

function TableItem({ table, isActive, onClick }: TableItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-gray-800 rounded-md transition-colors',
        isActive && 'bg-indigo-900/40 text-indigo-300'
      )}
    >
      <Table2 className={cn('h-3.5 w-3.5 flex-shrink-0', isActive ? 'text-indigo-400' : 'text-gray-500')} />
      <span className={cn('text-xs truncate', isActive ? 'text-indigo-200 font-medium' : 'text-gray-400')}>
        {table}
      </span>
    </button>
  )
}
