import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/toaster'
import { AppShell } from '@/components/Layout/AppShell'
import { useUIStore } from '@/stores/ui'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen items-center justify-center bg-gray-950 text-white p-8">
          <div className="max-w-lg space-y-4">
            <h1 className="text-xl font-bold text-red-400">Something went wrong</h1>
            <pre className="text-xs bg-gray-900 rounded p-4 overflow-auto text-gray-300 whitespace-pre-wrap">
              {this.state.error.message}
              {'\n'}
              {this.state.error.stack}
            </pre>
            <button
              onClick={() => this.setState({ error: null })}
              className="px-4 py-2 bg-indigo-600 rounded text-sm hover:bg-indigo-500"
            >
              Retry
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function ThemeInitializer() {
  const { theme } = useUIStore()
  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])
  return null
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ThemeInitializer />
          <AppShell />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
