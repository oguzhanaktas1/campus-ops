'use client'

import { useEffect, useState, useCallback } from 'react'
import { Clock, AlertTriangle, AlertCircle, Info, Loader2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

const PAGE_SIZE = 20

interface SystemEvent {
  id: string
  eventType: string
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'
  message: string
  source: string
  entityType?: string | null
  entityId?: string | null
  metadata?: unknown
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

function PaginationBar({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null
  const getPages = (): (number | '...')[] => {
    const pages: (number | '...')[] = []
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) {
        pages.push(i)
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...')
      }
    }
    return pages
  }
  return (
    <div className="flex items-center justify-center gap-1">
      <Button variant="outline" size="icon" className="size-8" disabled={page === 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft className="size-4" />
      </Button>
      {getPages().map((p, i) =>
        p === '...' ? (
          <span key={`e-${i}`} className="px-2 text-xs text-muted-foreground">…</span>
        ) : (
          <Button
            key={p}
            variant={p === page ? 'default' : 'outline'}
            size="sm"
            onClick={() => onChange(p as number)}
            className="min-w-[32px] h-8 text-xs"
          >
            {p}
          </Button>
        )
      )}
      <Button variant="outline" size="icon" className="size-8" disabled={page === totalPages} onClick={() => onChange(page + 1)}>
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}

const SEVERITIES = ['INFO', 'WARNING', 'ERROR', 'CRITICAL'] as const

export default function AdminSystemEventsPage() {
  const { t } = useI18n()
  const [events, setEvents] = useState<SystemEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [severityFilter, setSeverityFilter] = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [, setTick] = useState(0)
  const [page, setPage] = useState(1)

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'

  const fetchEvents = useCallback(async () => {
    try {
      const params = severityFilter !== 'all' ? `?severity=${severityFilter}` : ''
      const res = await fetch(`${backendUrl}/admin/system-events${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error()
      setEvents(await res.json())
    } catch {
      toast.error(t('systemEvents.noEvents'))
    } finally {
      setIsLoading(false)
    }
  }, [backendUrl, severityFilter, t])

  useEffect(() => {
    fetchEvents()
    const interval = setInterval(() => { fetchEvents() }, 30000)
    const tickInterval = setInterval(() => setTick(t => t + 1), 60000)
    return () => {
      clearInterval(interval)
      clearInterval(tickInterval)
    }
  }, [fetchEvents])

  // Reset page when filter changes
  useEffect(() => { setPage(1) }, [severityFilter])

  const filtered = events
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('systemEvents.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('systemEvents.subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchEvents} className="gap-2 self-start">
          <RefreshCw className="size-4" /> {t('common.refresh')}
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
          {t('systemEvents.all')}
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

      <p className="text-xs text-muted-foreground font-medium">
        {t('systemEvents.eventsCount', { count: filtered.length })}
        {totalPages > 1 && ` — page ${page} of ${totalPages}`}
      </p>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : (
        <>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('systemEvents.severity')}</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('systemEvents.colEvent')}</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">{t('systemEvents.colActor')}</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">{t('systemEvents.colTarget')}</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">{t('systemEvents.colTime')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated.map(e => (
                <>
                  <tr
                    key={e.id}
                    className={cn(
                      'transition-colors',
                      (e.entityType || e.metadata) ? 'cursor-pointer hover:bg-muted/20' : 'hover:bg-muted/20',
                      SEVERITY_ROW[e.severity] ?? ''
                    )}
                    onClick={() => (e.entityType || e.metadata) && setExpandedId(expandedId === e.id ? null : e.id)}
                  >
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
                      <div>
                        <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-foreground">
                          {e.eventType}
                        </span>
                        {e.entityType && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">{e.entityType}</p>
                        )}
                      </div>
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
                  {expandedId === e.id && (
                    <tr key={`${e.id}-detail`} className="bg-muted/30">
                      <td colSpan={5} className="px-5 py-3 space-y-2">
                        {e.entityType && e.entityId && (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">{e.entityType}</span>{' '}
                            <span className="font-mono">{e.entityId}</span>
                          </p>
                        )}
                        {e.metadata && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-1">{t('systemEvents.metadata')}</p>
                            <pre className="text-xs font-mono bg-background border border-border rounded p-3 overflow-x-auto max-h-40 text-foreground">
                              {JSON.stringify(e.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-16">
              <AlertCircle className="size-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">{t('systemEvents.noEvents')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('systemEvents.emptyHint')}</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="relative border-t border-border px-5 py-3 flex items-center justify-center gap-4">
            <span className="absolute left-5 text-xs text-muted-foreground">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} / {filtered.length}
            </span>
            <PaginationBar page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        )}
        </>
        )}
      </div>
    </div>
  )
}
