import { create } from 'zustand'
import type { Connection } from '@/types'

interface ConnectionsStore {
  connections: Connection[]
  setConnections: (c: Connection[]) => void
  addConnection: (c: Connection) => void
  removeConnection: (id: string) => void
}

export const useConnectionsStore = create<ConnectionsStore>((set) => ({
  connections: [],
  setConnections: (connections) => set({ connections }),
  addConnection: (connection) =>
    set((state) => ({ connections: [...state.connections, connection] })),
  removeConnection: (id) =>
    set((state) => ({ connections: state.connections.filter((c) => c.id !== id) })),
}))
