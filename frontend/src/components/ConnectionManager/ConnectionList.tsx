import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Database, PlugZap } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ConnectionItem } from './ConnectionItem'
import { useConnectionsStore } from '@/stores/connections'
import { api } from '@/lib/api'

export function ConnectionList() {
  const { connections, setConnections } = useConnectionsStore()

  const { isLoading, data } = useQuery({
    queryKey: ['connections'],
    queryFn: () => api.listConnections(),
    staleTime: 60000,
    refetchOnWindowFocus: false,
  })

  React.useEffect(() => {
    if (data) setConnections(data)
  }, [data, setConnections])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
        <PlugZap className="h-4 w-4 text-gray-500" />
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Connections
        </span>
        {connections.length > 0 && (
          <span className="ml-auto text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded-full">
            {connections.length}
          </span>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="py-2">
          {isLoading ? (
            <div className="flex flex-col gap-1.5 px-3 py-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-9 bg-gray-800 animate-pulse rounded-md" />
              ))}
            </div>
          ) : connections.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
              <Database className="h-8 w-8 text-gray-700" />
              <p className="text-xs text-gray-600 leading-relaxed">
                No connections yet.
                <br />
                Click "+ Add Connection" to get started.
              </p>
            </div>
          ) : (
            connections.map((conn) => (
              <ConnectionItem key={conn.id} connection={conn} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
