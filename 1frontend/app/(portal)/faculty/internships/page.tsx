'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Briefcase, Loader2, Search, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/status-badge'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
const PAGE_SIZE = 20

const PENDING_STATUSES = ['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL']

function fmtDate(d: string | null | undefined) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

type FilterKey = 'all' | 'pending' | 'approved' | 'rejected'

export default function FacultyInternshipsPage() {
  const { t } = useI18n()
  const [internships, setInternships] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const fetchInternships = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/faculty/internships`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      setInternships(res.ok ? await res.json() : [])
    } catch {
      setInternships([])
      toast.error(t('internships.loadFail'))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => { void fetchInternships() }, [fetchInternships])

  const pending = internships.filter((r) => PENDING_STATUSES.includes(r.status))

  const tabs = [
    { key: 'all' as FilterKey, label: t('common.all'), count: internships.length },
    { key: 'pending' as FilterKey, label: t('internships.tabPending'), count: pending.length },
    { key: 'approved' as FilterKey, label: t('common.approved'), count: internships.filter((r) => r.status === 'APPROVED').length },
    { key: 'rejected' as FilterKey, label: t('common.rejected'), count: internships.filter((r) => r.status === 'REJECTED').length },
  ]

  const baseList = (() => {
    if (activeTab === 'pending') return internships.filter((r) => PENDING_STATUSES.includes(r.status))
    if (activeTab === 'approved') return internships.filter((r) => r.status === 'APPROVED')
    if (activeTab === 'rejected') return internships.filter((r) => r.status === 'REJECTED')
    return internships
  })()

  const filtered = baseList.filter((r) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (r.companyName ?? r.title ?? '').toLowerCase().includes(q) ||
      r.requestNo?.toLowerCase().includes(q) ||
      (r.submittedByName ?? r.studentName ?? '').toLowerCase().includes(q)
    )
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5 pb-20">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('internships.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('internships.subtitle', { count: internships.length })}
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {pending.length > 0 && (
            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
              {pending.length} {t('common.pending')}
            </span>
          )}
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
            <p className="text-sm font-medium text-foreground">{t('internships.noInternships')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {search ? t('internships.noInternshipsDesc') : undefined}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {paged.map((r) => (
              <Link
                key={r.id}
                href={`/faculty/requests/${r.id}?from=/faculty/internships`}
                className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {r.companyName ?? r.title ?? 'Internship Application'}
                    </p>
                    {r.requestNo && (
                      <span className="text-xs text-muted-foreground font-mono shrink-0">{r.requestNo}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {(r.submittedByName ?? r.studentName) && <span>{r.submittedByName ?? r.studentName}</span>}
                    {r.startDate && <span>Starts {fmtDate(r.startDate)}</span>}
                    {r.internshipType && <span>{r.internshipType}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
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
