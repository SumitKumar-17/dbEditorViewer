import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { api, detectDBType } from '@/lib/api'
import { useConnectionsStore } from '@/stores/connections'
import { useUIStore } from '@/stores/ui'
import { toast } from '@/hooks/useToast'
import type { DBType } from '@/types'
import { CheckCircle2, XCircle, Wifi } from 'lucide-react'

interface AddConnectionDialogProps {
  open: boolean
  onClose: () => void
}

function dbTypeBadge(type: DBType) {
  switch (type) {
    case 'postgres':
      return <Badge className="bg-blue-600 text-white border-0">PostgreSQL</Badge>
    case 'mysql':
      return <Badge className="bg-orange-500 text-white border-0">MySQL</Badge>
    case 'mongodb':
      return <Badge className="bg-green-600 text-white border-0">MongoDB</Badge>
    case 'sqlite':
      return <Badge className="bg-amber-500 text-white border-0">SQLite</Badge>
    default:
      return <Badge className="bg-gray-500 text-white border-0">Unknown</Badge>
  }
}

export function AddConnectionDialog({ open, onClose }: AddConnectionDialogProps) {
  const [name, setName] = React.useState('')
  const [url, setUrl] = React.useState('')
  const [error, setError] = React.useState('')
  const [testStatus, setTestStatus] = React.useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [testMessage, setTestMessage] = React.useState('')
  const [connecting, setConnecting] = React.useState(false)

  const { addConnection } = useConnectionsStore()
  const { setActiveConnection } = useUIStore()
  const queryClient = useQueryClient()

  const detectedType = detectDBType(url)

  const handleClose = () => {
    setName('')
    setUrl('')
    setError('')
    setTestStatus('idle')
    setTestMessage('')
    onClose()
  }

  const handleTest = async () => {
    if (!url) {
      setError('Please enter a database URL')
      return
    }
    setError('')
    setTestStatus('testing')
    try {
      const result = await api.testURL(url)
      if (result.ok) {
        setTestStatus('ok')
        setTestMessage(result.message || 'Connection successful!')
      } else {
        setTestStatus('fail')
        setTestMessage(result.message || 'Connection failed')
      }
    } catch (err) {
      setTestStatus('fail')
      setTestMessage(err instanceof Error ? err.message : 'Connection failed')
    }
  }

  const handleConnect = async () => {
    if (!name.trim()) {
      setError('Please enter a connection name')
      return
    }
    if (!url.trim()) {
      setError('Please enter a database URL')
      return
    }
    setError('')
    setConnecting(true)
    try {
      const conn = await api.addConnection({ name: name.trim(), url: url.trim() })
      addConnection(conn)
      setActiveConnection(conn.id)
      // Invalidate so ConnectionList re-syncs with backend
      queryClient.invalidateQueries({ queryKey: ['connections'] })
      toast({ title: 'Connected', description: `Successfully connected to ${name.trim()}` })
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect')
    } finally {
      setConnecting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add Database Connection</DialogTitle>
          <DialogDescription>
            Connect to PostgreSQL, MySQL, SQLite, or MongoDB
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-foreground">Connection Name</label>
            <Input
              placeholder="My Database"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Database URL</label>
              {url && dbTypeBadge(detectedType)}
            </div>
            <Input
              placeholder="postgres://user:pass@localhost:5432/mydb"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setTestStatus('idle')
              }}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Supported: postgres://, mysql://, mongodb://, sqlite:// or .sqlite/.db file paths
            </p>
          </div>

          {testStatus !== 'idle' && (
            <div
              className={`flex items-start gap-2 rounded-md p-3 text-sm ${
                testStatus === 'ok'
                  ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300'
                  : testStatus === 'fail'
                  ? 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300'
                  : 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
              }`}
            >
              {testStatus === 'ok' && <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />}
              {testStatus === 'fail' && <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
              {testStatus === 'testing' && (
                <svg className="h-4 w-4 mt-0.5 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              <span>{testStatus === 'testing' ? 'Testing connection...' : testMessage}</span>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive flex items-center gap-1.5">
              <XCircle className="h-4 w-4" />
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleTest}
            loading={testStatus === 'testing'}
            disabled={!url}
          >
            <Wifi className="h-4 w-4 mr-1.5" />
            Test
          </Button>
          <Button onClick={handleConnect} loading={connecting} className="bg-indigo-600 hover:bg-indigo-500">
            Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
