'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Webhook, Search, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface WebhookLog {
  id: string
  url: string
  method: string
  statusCode: number
  responseTime: number
  success: boolean
  createdAt: string
  payload?: string
}

function formatDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function statusCodeColor(code: number): string {
  if (code >= 200 && code < 300) return 'text-emerald-600 dark:text-emerald-400'
  if (code >= 300 && code < 400) return 'text-blue-600 dark:text-blue-400'
  if (code >= 400 && code < 500) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

export default function AdminWebhookLogsPage() {
  const [logs, setLogs] = useState<WebhookLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [successFilter, setSuccessFilter] = useState<'all' | 'success' | 'failure'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchLogs = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token')
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const res = await fetch(`${backendUrl}/admin/webhook-logs`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      setLogs(await res.json())
    } catch {
      toast.error('Failed to load webhook logs.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const filtered = useMemo(() => {
    return logs.filter(l => {
      const matchSearch = search === '' || l.url?.toLowerCase().includes(search.toLowerCase())
      const matchSuccess =
        successFilter === 'all' ||
        (successFilter === 'success' && l.success) ||
        (successFilter === 'failure' && !l.success)
      return matchSearch && matchSuccess
    })
  }, [logs, search, successFilter])

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading webhook logs...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto pb-20">
      <div>
        <h1 className="text-xl font-bold text-foreground">Webhook Logs</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Outgoing webhook call history and delivery status.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by URL..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'success', 'failure'] as const).map(f => (
            <button
              key={f}
              onClick={() => setSuccessFilter(f)}
              className={cn(
                'text-xs px-3 py-1.5 rounded-full border font-semibold capitalize transition-colors',
                successFilter === f
                  ? f === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-400'
                    : f === 'failure'
                    ? 'bg-red-50 text-red-700 border-red-300 dark:bg-red-950/30 dark:text-red-400'
                    : 'bg-foreground text-background border-foreground'
                  : 'bg-background text-muted-foreground border-border hover:border-foreground'
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground font-medium">{filtered.length} log entries</p>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">URL</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Method</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Code</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Response Time</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden xl:table-cell">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(l => (
                <>
                  <tr
                    key={l.id}
                    className={cn(
                      'hover:bg-muted/20 transition-colors cursor-pointer',
                      !l.success && 'bg-red-50/20 dark:bg-red-950/10'
                    )}
                    onClick={() => setExpandedId(expandedId === l.id ? null : l.id)}
                  >
                    <td className="px-5 py-3.5">
                      {l.success
                        ? <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="size-4" /> Success
                          </span>
                        : <span className="flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-400">
                            <XCircle className="size-4" /> Failed
                          </span>
                      }
                    </td>
                    <td className="px-5 py-3.5 max-w-[220px]">
                      <p className="text-xs font-mono text-muted-foreground truncate" title={l.url}>{l.url}</p>
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded font-semibold">{l.method}</span>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className={cn('text-sm font-bold font-mono', statusCodeColor(l.statusCode))}>
                        {l.statusCode || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="size-3.5" />
                        {l.responseTime != null ? `${l.responseTime}ms` : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 hidden xl:table-cell text-xs text-muted-foreground">
                      {formatDate(l.createdAt)}
                    </td>
                  </tr>
                  {expandedId === l.id && l.payload && (
                    <tr key={`${l.id}-payload`} className="bg-muted/30">
                      <td colSpan={6} className="px-5 py-3">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Payload</p>
                        <pre className="text-xs font-mono bg-background border border-border rounded p-3 overflow-x-auto max-h-40 text-foreground">
                          {(() => {
                            try { return JSON.stringify(JSON.parse(l.payload!), null, 2) }
                            catch { return l.payload }
                          })()}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-16">
              <Webhook className="size-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">No webhook logs found.</p>
              <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or filters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
