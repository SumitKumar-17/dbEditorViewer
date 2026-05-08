import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

type Theme = 'dark' | 'light'
type Tab = 'data' | 'schema' | 'query'

interface UIStore {
  theme: Theme
  toggleTheme: () => void
  activeConnectionId: string | null
  activeSchema: string | null
  activeTable: string | null
  activeTab: Tab
  setActiveConnection: (id: string | null) => void
  setActiveSchema: (schema: string | null) => void
  setActiveTable: (table: string | null) => void
  setActiveTab: (tab: Tab) => void
}

function applyTheme(theme: Theme) {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }
}

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      theme: 'dark' as Theme,
      toggleTheme: () => {
        const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
        applyTheme(next)
        set({ theme: next })
      },
      activeConnectionId: null,
      activeSchema: null,
      activeTable: null,
      activeTab: 'data' as Tab,
      setActiveConnection: (id: string | null) =>
        set({ activeConnectionId: id, activeSchema: null, activeTable: null }),
      setActiveSchema: (schema: string | null) => set({ activeSchema: schema, activeTable: null }),
      setActiveTable: (table: string | null) => set({ activeTable: table }),
      setActiveTab: (tab: Tab) => set({ activeTab: tab }),
    }),
    {
      name: 'db-editor-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ theme: state.theme }),
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme)
      },
    }
  )
)
