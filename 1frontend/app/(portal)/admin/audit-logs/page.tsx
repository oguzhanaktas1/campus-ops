'use client'

import { cn } from '@/lib/utils'
import { TopScrollTable } from '@/components/ui/top-scroll-table'
import { ScrollText, CheckCircle2, XCircle, User, Clock, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SmartSearchInput } from '@/components/smart-search-input'
import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

interface AuditLog {
  id: string
  action: string
  actor: string
  target: string
  ip: string
  status: 'success' | 'failed'
  timestamp: string
}

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
const LIMIT = 50

function formatDate(d: string) {
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export default function AdminAuditPage() {
  const { t } = useI18n()
  const actionLabel: Record<string, string> = {
    CREATE: t('auditLogs.actionCreate'),
    UPDATE: t('auditLogs.actionUpdate'),
    DELETE: t('auditLogs.actionDelete'),
    LOGIN: t('auditLogs.actionLogin'),
    LOGOUT: t('auditLogs.actionLogout'),
    APPROVE: t('auditLogs.actionApprove'),
    REJECT: t('auditLogs.actionReject'),
  }
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchLogs = useCallback(async (pg: number, q: string) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(pg), limit: String(LIMIT) })
      if (q.trim()) params.set('search', q.trim())
      const res = await fetch(`${BACKEND}/admin/audit-logs?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setLogs(data.data ?? [])
      setTotal(data.total ?? 0)
      setTotalPages(data.totalPages ?? 1)
    } catch {
      toast.error(t('auditLogs.noLogs'))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => { fetchLogs(1, '') }, [fetchLogs])

  function handleSearchChange(val: string) {
    setSearch(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setPage(1)
      fetchLogs(1, val)
    }, 400)
  }

  function goToPage(pg: number) {
    setPage(pg)
    fetchLogs(pg, search)
  }

  const paginationPages = Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
    const pg = totalPages <= 7
      ? i + 1
      : page <= 4
        ? i + 1
        : page >= totalPages - 3
          ? totalPages - 6 + i
          : page - 3 + i
    return pg < 1 || pg > totalPages ? null : pg
  })

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto pb-20">
      <div>
        <h1 className="text-xl font-bold text-foreground">{t('auditLogs.title')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('auditLogs.subtitle')}</p>
      </div>

      {/* Search + stats */}
      <div className="flex items-center gap-3 flex-wrap">
        <SmartSearchInput
          value={search}
          onChange={handleSearchChange}
          placeholder={t('auditLogs.searchPlaceholder')}
          debounceMs={400}
          isLoading={isLoading && search.length > 0}
          resultCount={search.trim() ? total : undefined}
          className="max-w-sm flex-1"
        />
        <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
          {t('auditLogs.entries', { count: total })}
        </span>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-7 animate-spin text-primary" />
          </div>
        ) : (
          <TopScrollTable>
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">{t('auditLogs.colAction')}</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground hidden sm:table-cell">{t('auditLogs.colUser')}</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground hidden md:table-cell">{t('auditLogs.colResource')}</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground hidden lg:table-cell">{t('auditLogs.ipAddress')}</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">{t('auditLogs.status')}</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground hidden md:table-cell">{t('auditLogs.colTime')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className={cn(
                      'hover:bg-muted/20 transition-colors',
                      log.status === 'failed' && 'bg-destructive/5 hover:bg-destructive/10'
                    )}
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-foreground tracking-wide">
                        {actionLabel[log.action] ?? log.action}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <span className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                        <User className="size-3.5 text-muted-foreground" />
                        {log.actor}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell max-w-[200px]">
                      <span className="text-xs text-muted-foreground truncate block" title={log.target}>
                        {log.target}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <span className="text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                        {log.ip}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={cn(
                        'flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-md w-fit border',
                        log.status === 'success'
                          ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
                          : 'text-red-700 bg-red-50 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
                      )}>
                        {log.status === 'success' ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
                        {log.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Clock className="size-3.5" />
                        {formatDate(log.timestamp)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TopScrollTable>
        )}
        {!isLoading && logs.length === 0 && (
          <div className="text-center py-16">
            <ScrollText className="size-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">{t('auditLogs.noLogs')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('auditLogs.emptyHint')}</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="relative px-5 py-3 border-t border-border flex items-center justify-center gap-4">
            <span className="absolute left-5 text-xs text-muted-foreground">
              {t('auditLogs.pageOf', { page, total: totalPages })}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline" size="icon" className="size-8"
                onClick={() => goToPage(page - 1)} disabled={page <= 1 || isLoading}
              >
                <ChevronLeft className="size-4" />
              </Button>
              {paginationPages.map((pg, i) => pg === null ? null : (
                <Button
                  key={`${pg}-${i}`}
                  variant={pg === page ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 min-w-[32px] text-xs"
                  disabled={isLoading}
                  onClick={() => goToPage(pg)}
                >
                  {pg}
                </Button>
              ))}
              <Button
                variant="outline" size="icon" className="size-8"
                onClick={() => goToPage(page + 1)} disabled={page >= totalPages || isLoading}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
