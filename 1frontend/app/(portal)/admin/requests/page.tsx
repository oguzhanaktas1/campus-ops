'use client'

import { useEffect, useState, useMemo } from 'react'
import { StatusBadge, PriorityBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Trash2, Loader2, AlertCircle, AlertTriangle, ChevronLeft, ChevronRight, CheckSquare, Square } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { SmartSearchInput } from '@/components/smart-search-input'
import { smartFilter } from '@/lib/smart-search'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
const PAGE_SIZE = 20

function useRequestTypeLabel() {
  const { t } = useI18n()
  return (request: { type?: string; typeName?: string }) => {
    if (request.type) {
      const key = `requests.typeLabels.${request.type}`
      const label = t(key)
      if (label !== key) return label
    }
    return request.typeName ?? request.type ?? t('common.unknown')
  }
}

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total]
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '...', current - 1, current, current + 1, '...', total]
}

export default function AdminRequestsPage() {
  const { t } = useI18n()
  const getRequestTypeLabel = useRequestTypeLabel()
  const [requests, setRequests] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isDeleting, setIsDeleting] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const res = await fetch(`${BACKEND}/admin/requests`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (res.ok) setRequests(await res.json())
      } catch {
        toast.error(t('requests.loadFail'))
      } finally {
        setIsLoading(false)
      }
    }
    void fetchRequests()
  }, [])

  const handleBulkDelete = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`${BACKEND}/admin/requests/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ ids: selectedIds }),
      })
      if (res.ok) {
        toast.success(t('requests.deleteSuccess', { count: selectedIds.length }))
        setRequests((prev) => prev.filter((r) => !selectedIds.includes(r.id)))
        setSelectedIds([])
      } else {
        toast.error(t('requests.deleteFail'))
      }
    } catch {
      toast.error(t('requests.networkError'))
    } finally {
      setIsDeleting(false)
      setShowConfirmModal(false)
    }
  }

  const filtered = useMemo(() => {
    const byStatus = requests.filter((r) => {
      const matchesStatus = statusFilter === 'all' || r.status?.toLowerCase() === statusFilter.toLowerCase()
      const matchesType = typeFilter === 'all' || r.type === typeFilter || r.typeName?.toLowerCase() === typeFilter.toLowerCase()
      return matchesStatus && matchesType
    })
    if (!search.trim()) return byStatus
    return smartFilter(byStatus, search, [
      { getValue: (r: any) => r.title, weight: 2 },
      { getValue: (r: any) => r.requestNo, weight: 1.5 },
      { getValue: (r: any) => r.submittedByName, weight: 1 },
      { getValue: (r: any) => r.typeName, weight: 0.8 },
    ])
  }, [requests, search, statusFilter, typeFilter])

  useEffect(() => { setPage(1) }, [search, statusFilter, typeFilter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const requestTypes = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of requests) {
      if (r.type) map.set(r.type, getRequestTypeLabel(r))
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [requests])

  const allPageSelected = paginated.length > 0 && paginated.every((r) => selectedIds.includes(r.id))

  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !paginated.some((r) => r.id === id)))
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...paginated.map((r) => r.id)])))
    }
  }

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id])

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5 pb-20">

      {showConfirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background border border-border rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="size-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                <AlertTriangle className="size-6" />
              </div>
              <h2 className="text-lg font-bold">{t('requests.deleteConfirmTitle', { count: selectedIds.length })}</h2>
              <p className="text-sm text-muted-foreground">{t('requests.deleteConfirmDesc')}</p>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1" disabled={isDeleting} onClick={() => setShowConfirmModal(false)}>{t('common.cancel')}</Button>
              <Button variant="destructive" className="flex-1" disabled={isDeleting} onClick={handleBulkDelete}>
                {isDeleting ? <Loader2 className="size-4 animate-spin" /> : t('common.deleteSelected')}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('requests.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('requests.subtitle', { count: requests.length })}</p>
        </div>
        {selectedIds.length > 0 && (
          <Button variant="destructive" size="sm" className="gap-2 shrink-0" onClick={() => setShowConfirmModal(true)}>
            <Trash2 className="size-4" /> {t('common.deleteSelected')} ({selectedIds.length})
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <SmartSearchInput
          value={search}
          onChange={setSearch}
          placeholder={t('requests.searchPlaceholder')}
          resultCount={search.trim() ? filtered.length : undefined}
          className="flex-1"
        />
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring shrink-0"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">{t('requests.allStatuses')}</option>
          {['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL', 'REVISION_REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED'].map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring shrink-0"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="all">{t('requests.allTypes')}</option>
          {requestTypes.map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <AlertCircle className="size-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">{t('common.noResults')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('requests.adjustSearch')}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-muted/20">
              <button onClick={toggleSelectAll} className="flex items-center justify-center">
                {allPageSelected
                  ? <CheckSquare className="size-4 text-primary" />
                  : <Square className="size-4 text-muted-foreground" />}
              </button>
              <span className="text-sm font-medium text-muted-foreground cursor-pointer select-none" onClick={toggleSelectAll}>
                {allPageSelected ? t('pages.deselectAll') : t('pages.selectAll')}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} / {filtered.length}
              </span>
            </div>
            <div className="divide-y divide-border">
              {paginated.map((req) => (
                <div
                  key={req.id}
                  className={cn('flex items-stretch transition-colors', selectedIds.includes(req.id) ? 'bg-primary/5' : 'hover:bg-muted/30')}
                >
                  <div className="pl-5 py-4 flex items-start cursor-default">
                    <button onClick={() => toggleSelect(req.id)} className="mt-0.5">
                      {selectedIds.includes(req.id)
                        ? <CheckSquare className="size-4 text-primary" />
                        : <Square className="size-4 text-muted-foreground/40" />}
                    </button>
                  </div>
                  <Link
                    href={`/admin/requests/${req.id}`}
                    className="flex-1 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 px-4 py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{req.title}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                        <span className="font-mono">{req.requestNo}</span>
                        <span className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-medium">{getRequestTypeLabel(req)}</span>
                        {req.submittedByName && <span>{req.submittedByName}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {req.priority && <PriorityBadge priority={req.priority} />}
                      <StatusBadge status={req.status} />
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1">
          <Button variant="outline" size="icon" className="size-8" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="size-4" />
          </Button>
          {getPageNumbers(page, totalPages).map((p, i) =>
            p === '...' ? (
              <span key={`e-${i}`} className="px-1 text-xs text-muted-foreground select-none">…</span>
            ) : (
              <Button key={p} variant={page === p ? 'default' : 'outline'} size="icon" className="size-8 text-xs" onClick={() => setPage(p as number)}>
                {p}
              </Button>
            )
          )}
          <Button variant="outline" size="icon" className="size-8" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
