'use client'

import { Fragment, useEffect, useState, useCallback, useMemo } from 'react'
import { Webhook, Search, Loader2, CheckCircle2, XCircle, Clock, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

interface WebhookLog {
  id: string
  url: string
  method: string
  statusCode: number | null
  responseTime: number | null
  success: boolean
  retryCount: number
  direction: string
  createdAt: string
  payload?: string | null
  response?: string | null
  integration?: { id: string; name: string; provider: string } | null
}

const PAGE_SIZE = 20

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
  const { t } = useI18n()
  const [logs, setLogs] = useState<WebhookLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [successFilter, setSuccessFilter] = useState<'all' | 'success' | 'failure'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'

  const fetchLogs = useCallback(async () => {
    try {
      const params = successFilter !== 'all' ? `?success=${successFilter}` : ''
      const res = await fetch(`${backendUrl}/admin/webhook-logs${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error()
      setLogs(await res.json())
    } catch {
      toast.error(t('webhookLogs.noLogs'))
    } finally {
      setIsLoading(false)
    }
  }, [backendUrl, successFilter, t])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const filtered = useMemo(() => {
    if (!search) return logs
    const q = search.toLowerCase()
    return logs.filter(l =>
      l.url?.toLowerCase().includes(q) ||
      l.integration?.name?.toLowerCase().includes(q) ||
      l.integration?.provider?.toLowerCase().includes(q)
    )
  }, [logs, search])

  useEffect(() => {
    setPage(1)
    setExpandedId(null)
  }, [search, successFilter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

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

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">{t('webhookLogs.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('webhookLogs.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('webhookLogs.subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchLogs()} className="gap-2 self-start">
          <RefreshCw className="size-4" /> {t('common.refresh')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={t('webhookLogs.searchPlaceholder')}
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
              {f === 'all' ? t('common.all') : f === 'success' ? t('webhookLogs.success') : t('webhookLogs.failed')}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground font-medium">{t('webhookLogs.logEntries', { count: filtered.length })}</p>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('webhookLogs.colStatus')}</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('webhookLogs.colEndpoint')}</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">{t('webhookLogs.integration')}</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">{t('webhookLogs.colMethod')}</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">{t('webhookLogs.code')}</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">{t('webhookLogs.responseTime')}</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden xl:table-cell">{t('webhookLogs.colTime')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated.map(l => (
                <Fragment key={l.id}>
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
                            <CheckCircle2 className="size-4" /> {t('webhookLogs.success')}
                          </span>
                        : <span className="flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-400">
                            <XCircle className="size-4" /> {t('webhookLogs.failed')}
                          </span>
                      }
                    </td>
                    <td className="px-5 py-3.5 max-w-[200px]">
                      <p className="text-xs font-mono text-muted-foreground truncate" title={l.url}>{l.url}</p>
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      {l.integration
                        ? <div>
                            <p className="text-xs font-medium text-foreground truncate max-w-[140px]">{l.integration.name}</p>
                            <p className="text-[11px] text-muted-foreground capitalize">{l.integration.provider}</p>
                          </div>
                        : <span className="text-xs text-muted-foreground">—</span>
                      }
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded font-semibold">{l.method}</span>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className={cn('text-sm font-bold font-mono', l.statusCode ? statusCodeColor(l.statusCode) : 'text-muted-foreground')}>
                        {l.statusCode ?? '—'}
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
                  {expandedId === l.id && (l.payload || l.response) && (
                    <tr key={`${l.id}-detail`} className="bg-muted/30">
                      <td colSpan={7} className="px-5 py-3 space-y-2">
                        {l.payload && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-1">{t('webhookLogs.requestPayload')}</p>
                            <pre className="text-xs font-mono bg-background border border-border rounded p-3 overflow-x-auto max-h-40 text-foreground">
                              {(() => { try { return JSON.stringify(JSON.parse(l.payload), null, 2) } catch { return l.payload } })()}
                            </pre>
                          </div>
                        )}
                        {l.response && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-1">{t('webhookLogs.responseBody')}</p>
                            <pre className="text-xs font-mono bg-background border border-border rounded p-3 overflow-x-auto max-h-40 text-foreground">
                              {(() => { try { return JSON.stringify(JSON.parse(l.response), null, 2) } catch { return l.response } })()}
                            </pre>
                          </div>
                        )}
                        {l.retryCount > 0 && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                            {t('webhookLogs.retried', { count: l.retryCount, suffix: l.retryCount > 1 ? 's' : '' })}
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-16">
              <Webhook className="size-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">{t('webhookLogs.noLogs')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('webhookLogs.emptyHint')}</p>
            </div>
          )}
        </div>
        {totalPages > 1 && (
          <div className="relative border-t border-border px-5 py-3 flex items-center justify-center gap-4">
            <span className="absolute left-5 text-xs text-muted-foreground">
              {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filtered.length)} / {filtered.length}
            </span>
            <div className="flex items-center justify-center gap-1">
              <Button variant="outline" size="icon" className="size-8" disabled={page === 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="size-4" />
              </Button>
              {getPages().map((p, i) =>
                p === '...' ? (
                  <span key={`e-${i}`} className="px-2 text-xs text-muted-foreground">...</span>
                ) : (
                  <Button
                    key={p}
                    variant={p === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPage(p as number)}
                    className="min-w-[32px] h-8 text-xs"
                  >
                    {p}
                  </Button>
                )
              )}
              <Button variant="outline" size="icon" className="size-8" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
