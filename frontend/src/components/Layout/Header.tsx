import * as React from 'react'
import { Database, Sun, Moon, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/stores/ui'

interface HeaderProps {
  onAddConnection: () => void
}

export function Header({ onAddConnection }: HeaderProps) {
  const { theme, toggleTheme } = useUIStore()

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-800 bg-gray-950 px-4 flex-shrink-0">
      <div className="flex items-center gap-2">
        <Database className="h-5 w-5 text-indigo-400" />
        <span className="font-semibold text-white text-base tracking-tight">DBEditor</span>
        <span className="text-xs text-gray-500 ml-1">Universal Database Client</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="text-gray-400 hover:text-white hover:bg-gray-800"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button
          onClick={onAddConnection}
          size="sm"
          className="bg-indigo-600 hover:bg-indigo-500 text-white border-0"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Connection
        </Button>
      </div>
    </header>
  )
}
