'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { FileText, Loader2, AlertCircle, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SmartSearchInput } from '@/components/smart-search-input'
import { smartFilter } from '@/lib/smart-search'
import { StatusBadge, PriorityBadge } from '@/components/status-badge'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
const PAGE_SIZE = 20
const TERMINAL = new Set(['APPROVED', 'REJECTED', 'COMPLETED', 'CLOSED', 'CANCELLED'])

const categorySlugMap: Record<string, string> = {
  IT_SUPPORT: 'it-support',
  ADMINISTRATIVE: 'administrative',
  INVENTORY: 'inventory',
  CAMPUS_SERVICES: 'campus-services',
  STUDENT_LIFE: 'student-life',
}

function fmtDate(d: string | null | undefined) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

type TabKey = 'active' | 'unassigned' | 'all' | 'closed'

export default function StaffRequestsPage() {
  const { t } = useI18n()
  const [requests, setRequests] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('active')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const fetchRequests = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`${BACKEND}/staff/requests?filter=${activeTab}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) setRequests(await res.json())
      else setRequests([])
    } catch {
      toast.error(t('requests.loadFail'))
      setRequests([])
    } finally {
      setIsLoading(false)
    }
  }, [activeTab, t])

  useEffect(() => { void fetchRequests() }, [fetchRequests])

  const tabs = [
    { key: 'active' as TabKey, label: t('requests.active'), count: requests.filter((r) => !TERMINAL.has(r.status)).length },
    { key: 'unassigned' as TabKey, label: t('requests.needsAssignment'), count: requests.filter((r) => !r.assignedTo && !TERMINAL.has(r.status)).length },
    { key: 'all' as TabKey, label: t('requests.allRequests'), count: requests.length },
    { key: 'closed' as TabKey, label: t('requests.closed'), count: requests.filter((r) => TERMINAL.has(r.status)).length },
  ]

  const filtered = (() => {
    if (!search.trim()) return requests
    return smartFilter(requests, search, [
      { getValue: (r: any) => r.title, weight: 2 },
      { getValue: (r: any) => r.requestNo, weight: 1.5 },
      { getValue: (r: any) => r.requesterName, weight: 1 },
      { getValue: (r: any) => r.typeName, weight: 0.8 },
      { getValue: (r: any) => r.assignedTo, weight: 0.7 },
    ])
  })()

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5 pb-20">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('requests.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('requests.subtitle')}</p>
        </div>
        <SmartSearchInput
          value={search}
          onChange={(v) => { setSearch(v); setPage(1) }}
          placeholder={t('common.search')}
          resultCount={search.trim() ? filtered.length : undefined}
          className="w-full sm:w-64 shrink-0"
        />
      </div>

      <div className="flex flex-wrap gap-1 bg-muted/50 p-1 rounded-lg border border-border w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setPage(1) }}
            className={cn(
              'px-3 py-1 text-sm font-medium rounded-md transition-all',
              activeTab === tab.key
                ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
          >
            {tab.label}
            {tab.count > 0 && <span className="ml-1.5 text-xs opacity-60">{tab.count}</span>}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <AlertCircle className="size-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">{t('requests.noRequests')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {search ? t('requests.searchHint') : t('requests.emptyHint')}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {paged.map((req) => {
              const slug = categorySlugMap[req.category] || 'general'
              const isUnassigned = !req.assignedTo && !TERMINAL.has(req.status)
              return (
                <Link
                  key={req.id}
                  href={`/staff/requests/${slug}/${req.id}`}
                  className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-foreground truncate">{req.title}</p>
                      {req.requestNo && (
                        <span className="text-xs text-muted-foreground font-mono shrink-0">{req.requestNo}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {req.requesterName && <span>{req.requesterName}</span>}
                      {req.createdAt && <span>{fmtDate(req.createdAt)}</span>}
                      {req.typeName && <span>{req.typeName}</span>}
                      {req.assignedTo ? (
                        <span className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 className="size-3" /> {req.assignedTo}
                        </span>
                      ) : isUnassigned ? (
                        <span className="flex items-center gap-1 text-amber-600 font-medium">
                          <AlertTriangle className="size-3" /> {t('common.unassigned')}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <PriorityBadge priority={req.priority} />
                    <StatusBadge status={req.status} />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} / {filtered.length}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded hover:bg-muted disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded hover:bg-muted disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
