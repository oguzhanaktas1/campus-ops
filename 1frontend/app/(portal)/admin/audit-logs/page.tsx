'use client'

import { cn } from '@/lib/utils'
import { ScrollText, CheckCircle2, XCircle, User, Clock, Loader2, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'

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

const ACTION_LABEL: Record<string, string> = {
  CREATE: 'Created Record',
  UPDATE: 'Updated Record',
  DELETE: 'Deleted Record',
  LOGIN: 'System Login',
  LOGOUT: 'System Logout',
  APPROVE: 'Approved Request',
  REJECT: 'Rejected Request',
}

export default function AdminAuditPage() {
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
      toast.error('Failed to load audit trail.')
    } finally {
      setIsLoading(false)
    }
  }, [])

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

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto pb-20">
      <div>
        <h1 className="text-xl font-bold text-foreground">Audit Log</h1>
        <p className="text-sm text-muted-foreground mt-0.5">System-wide activity and security event trail.</p>
      </div>

      {/* Search + stats */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by action, actor, target or IP..."
            className="pl-9"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
          {total} entries
        </span>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-7 animate-spin text-primary" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">Action</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground hidden sm:table-cell">Actor</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground hidden md:table-cell">Target</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground hidden lg:table-cell">IP Address</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground hidden md:table-cell">Time</th>
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
                        {ACTION_LABEL[log.action] ?? log.action}
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
          )}
          {!isLoading && logs.length === 0 && (
            <div className="text-center py-16">
              <ScrollText className="size-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">No audit entries found.</p>
              <p className="text-xs text-muted-foreground mt-1">Try adjusting your search terms.</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline" size="icon" className="size-8"
                onClick={() => goToPage(page - 1)} disabled={page <= 1 || isLoading}
              >
                <ChevronLeft className="size-4" />
              </Button>
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
