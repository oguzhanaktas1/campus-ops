'use client'

import { useEffect, useState, useCallback } from 'react'
import { Clock, AlertTriangle, AlertCircle, Info, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getToken } from '@/lib/auth'

interface SystemEvent {
  id: string
  eventType: string
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'
  message: string
  source: string
  createdAt: string
}

const SEVERITY_BADGE: Record<string, string> = {
  INFO: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
  WARNING: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
  ERROR: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800',
  CRITICAL: 'bg-red-50 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-700',
}

const SEVERITY_ROW: Record<string, string> = {
  ERROR: 'bg-red-50/30 dark:bg-red-950/10',
  CRITICAL: 'bg-red-50/50 dark:bg-red-950/20',
}

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === 'CRITICAL') return <AlertCircle className="size-4 text-red-700 dark:text-red-400 shrink-0" />
  if (severity === 'ERROR') return <AlertCircle className="size-4 text-red-600 dark:text-red-400 shrink-0" />
  if (severity === 'WARNING') return <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
  return <Info className="size-4 text-blue-600 dark:text-blue-400 shrink-0" />
}

function relativeTime(d: string): string {
  if (!d) return '—'
  const diff = Date.now() - new Date(d).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const days = Math.floor(h / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

const SEVERITIES = ['INFO', 'WARNING', 'ERROR', 'CRITICAL'] as const

export default function AdminSystemEventsPage() {
  const [events, setEvents] = useState<SystemEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [severityFilter, setSeverityFilter] = useState('all')
  const [, setTick] = useState(0)

  const fetchEvents = useCallback(async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const res = await fetch(`${backendUrl}/admin/system-events`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error()
      setEvents(await res.json())
    } catch {
      toast.error('Failed to load system events.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents()
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchEvents()
    }, 30000)
    // Tick every minute for relative timestamps
    const tickInterval = setInterval(() => setTick(t => t + 1), 60000)
    return () => {
      clearInterval(interval)
      clearInterval(tickInterval)
    }
  }, [fetchEvents])

  const filtered = events.filter(e =>
    severityFilter === 'all' || e.severity === severityFilter
  )

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading system events...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">System Events</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Platform event log — auto-refreshes every 30 seconds.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchEvents} className="gap-2 self-start">
          <RefreshCw className="size-4" /> Refresh
        </Button>
      </div>

      {/* Severity filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setSeverityFilter('all')}
          className={cn(
            'text-xs px-3 py-1.5 rounded-full border font-semibold transition-colors',
            severityFilter === 'all'
              ? 'bg-foreground text-background border-foreground'
              : 'bg-background text-muted-foreground border-border hover:border-foreground'
          )}
        >
          All
        </button>
        {SEVERITIES.map(s => (
          <button
            key={s}
            onClick={() => setSeverityFilter(s)}
            className={cn(
              'text-xs px-3 py-1.5 rounded-full border font-semibold transition-colors',
              severityFilter === s
                ? SEVERITY_BADGE[s]
                : 'bg-background text-muted-foreground border-border hover:border-foreground'
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground font-medium">{filtered.length} events</p>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Severity</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Event</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Message</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Source</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(e => (
                <tr key={e.id} className={cn('hover:bg-muted/20 transition-colors', SEVERITY_ROW[e.severity] ?? '')}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <SeverityIcon severity={e.severity} />
                      <span className={cn(
                        'text-xs font-bold px-2 py-0.5 rounded-full border',
                        SEVERITY_BADGE[e.severity] ?? SEVERITY_BADGE.INFO,
                        e.severity === 'CRITICAL' && 'font-black'
                      )}>
                        {e.severity}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-foreground">
                      {e.eventType}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell max-w-[280px]">
                    <p className="text-xs text-muted-foreground truncate" title={e.message}>{e.message}</p>
                  </td>
                  <td className="px-5 py-3.5 hidden lg:table-cell">
                    <span className="text-xs font-mono text-muted-foreground">{e.source}</span>
                  </td>
                  <td className="px-5 py-3.5 hidden sm:table-cell">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                      <Clock className="size-3.5" /> {relativeTime(e.createdAt)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-16">
              <AlertCircle className="size-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">No events found.</p>
              <p className="text-xs text-muted-foreground mt-1">Try selecting a different severity level.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
