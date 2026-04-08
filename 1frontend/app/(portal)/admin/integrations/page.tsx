'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Plug,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  Settings2,
  Loader2,
} from 'lucide-react'

function formatDate(d: string | null) {
  if (!d) return 'Never'
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AdminIntegrationsPage() {
  const [integrations, setIntegrations] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)

  useEffect(() => {
    const fetchIntegrations = async () => {
      const token = localStorage.getItem('access_token')
      if (!token) return

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      try {
        const res = await fetch(`${backendUrl}/admin/integrations`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) setIntegrations(await res.json())
      } catch (e) {
        console.error('Integrations fetch error:', e)
      } finally {
        setIsLoading(false)
      }
    }
    fetchIntegrations()
  }, [])

  const handleSync = (id: string) => {
    setSyncing(id)
    setTimeout(() => setSyncing(null), 1500)
  }

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  const active = integrations.filter((i) => i.isActive).length
  const inactive = integrations.filter((i) => !i.isActive).length

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Integrations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage external service connections and sync status.
          </p>
        </div>
        <Button size="sm" className="gap-1.5">
          <Plug className="size-3.5" />
          Add Integration
        </Button>
      </div>

      {/* Health summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-foreground">{integrations.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Total</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-emerald-600">{active}</p>
          <p className="text-xs text-muted-foreground mt-1">Active</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center shadow-sm">
          <p className={cn('text-2xl font-bold', inactive > 0 ? 'text-amber-600' : 'text-foreground')}>{inactive}</p>
          <p className="text-xs text-muted-foreground mt-1">Inactive</p>
        </div>
      </div>

      {integrations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-card border border-border rounded-lg">
          <Plug className="size-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-foreground">No integrations configured</p>
          <p className="text-xs text-muted-foreground mt-1">Add your first integration to get started.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {integrations.map((int) => {
            const isSyncing = syncing === int.id
            return (
              <div key={int.id} className="bg-card border border-border rounded-lg p-5 shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                      <Plug className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{int.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{int.provider}</p>
                      <p className="text-xs text-muted-foreground">Updated: {formatDate(int.updatedAt)}</p>
                    </div>
                  </div>
                  <span className={cn(
                    'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md border flex-shrink-0',
                    int.isActive
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400'
                      : 'text-muted-foreground bg-muted border-border'
                  )}>
                    {int.isActive ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
                    {int.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-7 text-xs gap-1"
                    onClick={() => handleSync(int.id)}
                    disabled={isSyncing}
                  >
                    <RefreshCw className={cn('size-3', isSyncing && 'animate-spin')} />
                    {isSyncing ? 'Syncing...' : 'Sync Now'}
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                    <Settings2 className="size-3" />
                    Configure
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
