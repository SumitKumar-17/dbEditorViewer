import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface QueryHistoryEntry {
  id: string
  connectionId: string
  query: string
  executedAt: number
  durationMs: number
  rowCount: number
  hadError: boolean
}

interface QueryHistoryStore {
  entries: QueryHistoryEntry[]
  addEntry(e: Omit<QueryHistoryEntry, 'id' | 'executedAt'>): void
  clearForConnection(connectionId: string): void
  clearAll(): void
}

const MAX_ENTRIES = 100

export const useQueryHistoryStore = create<QueryHistoryStore>()(
  persist(
    (set) => ({
      entries: [],
      addEntry(e) {
        set((state) => {
          const newEntry: QueryHistoryEntry = {
            ...e,
            id: crypto.randomUUID(),
            executedAt: Date.now(),
          }
          const next = [newEntry, ...state.entries]
          return { entries: next.slice(0, MAX_ENTRIES) }
        })
      },
      clearForConnection(connectionId) {
        set((state) => ({
          entries: state.entries.filter((e) => e.connectionId !== connectionId),
        }))
      },
      clearAll() {
        set({ entries: [] })
      },
    }),
    {
      name: 'dbeditor-query-history',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
