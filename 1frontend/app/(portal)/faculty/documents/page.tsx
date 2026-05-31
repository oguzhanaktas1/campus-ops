'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { FileText, Loader2, Search, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { StatusBadge, PriorityBadge } from '@/components/status-badge'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
const PAGE_SIZE = 20

function fmtDate(d: string | null | undefined) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function FacultyDocumentsPage() {
  const { t } = useI18n()
  const [requests, setRequests] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/faculty/requests/all`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) {
        const data = await res.json()
        setRequests(data.filter((r: any) => r.type === 'DOCUMENT_REQUEST'))
      } else {
        setRequests([])
      }
    } catch {
      toast.error(t('documents.loadFail'))
      setRequests([])
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => { void fetchRequests() }, [fetchRequests])

  const tabs = [
    { key: '', label: t('common.all'), count: requests.length },
    { key: 'APPROVED', label: t('common.approved'), count: requests.filter((r) => r.status === 'APPROVED').length },
    { key: 'REJECTED', label: t('common.rejected'), count: requests.filter((r) => r.status === 'REJECTED').length },
  ]

  const filtered = requests.filter((r) => {
    if (activeTab && r.status?.toUpperCase() !== activeTab) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      r.title?.toLowerCase().includes(q) ||
      r.requestNo?.toLowerCase().includes(q) ||
      (r.submittedByName ?? r.requesterName ?? '').toLowerCase().includes(q) ||
      r.typeName?.toLowerCase().includes(q)
    )
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5 pb-20">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('documents.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('documents.subtitle', { count: requests.length })}
          </p>
        </div>
        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder={t('common.search')}
            className="pl-9 h-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
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
            <p className="text-sm font-medium text-foreground">{t('documents.noDocuments')}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {paged.map((r) => (
              <Link
                key={r.id}
                href={`/faculty/requests/${r.id}?from=/faculty/documents`}
                className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {r.title || t('documents.title')}
                    </p>
                    {r.requestNo && (
                      <span className="text-xs text-muted-foreground font-mono shrink-0">{r.requestNo}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {(r.submittedByName ?? r.requesterName) && <span>{r.submittedByName ?? r.requesterName}</span>}
                    {r.createdAt && <span>{fmtDate(r.createdAt)}</span>}
                    {r.typeName && <span>{r.typeName}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <PriorityBadge priority={r.priority} />
                  <StatusBadge status={r.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} / {filtered.length}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded hover:bg-muted disabled:opacity-30">
              <ChevronLeft className="size-4" />
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded hover:bg-muted disabled:opacity-30">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
