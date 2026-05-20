'use client'

import { useEffect, useState, useCallback } from 'react'
import { Briefcase, CheckCircle2, XCircle, Loader2, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { StaffListShell } from '@/components/staff/staff-list-shell'
import { StaffRequestRow, formatDate } from '@/components/staff/staff-request-row'
import { useRouter } from 'next/navigation'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
const PAGE_SIZE = 20
const PENDING_STATUSES = ['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL']
const ALL_STATUSES = ['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL', 'REVISION_REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED', 'CLOSED']

type FilterKey = 'all' | 'pending' | 'approved' | 'rejected'

export default function FacultyInternshipsPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [internships, setInternships] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [activeStatus, setActiveStatus] = useState('')
  const [activePriority, setActivePriority] = useState('')

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

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setProcessingId(id)
    try {
      const res = await fetch(`${BACKEND}/faculty/requests/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        const result = await res.json().catch(() => ({}))
        toast.success(action === 'approve' ? t('internships.approveSuccess') : t('internships.rejectSuccess'))
        setInternships((prev) =>
          prev.map((r) =>
            r.id === id
              ? { ...r, status: result.status ?? (action === 'approve' ? 'APPROVED' : 'REJECTED'), canAct: false }
              : r,
          ),
        )
      } else {
        const err = await res.json().catch(() => ({})) as { message?: string }
        toast.error(err.message ?? t('internships.actionFail'))
      }
    } catch {
      toast.error(t('internships.actionFail'))
    } finally {
      setProcessingId(null)
    }
  }

  const pending = internships.filter((r) => PENDING_STATUSES.includes(r.status))

  const byFilter = (items: any[]) => {
    if (filter === 'all') return items
    if (filter === 'pending') return items.filter((r) => PENDING_STATUSES.includes(r.status))
    if (filter === 'approved') return items.filter((r) => r.status === 'APPROVED')
    return items.filter((r) => r.status === 'REJECTED')
  }

  const filtered = byFilter(internships).filter((r) => {
    if (activeStatus && r.status !== activeStatus) return false
    if (activePriority && r.priority !== activePriority) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (r.companyName ?? r.title ?? '').toLowerCase().includes(q) ||
      r.requestNo?.toLowerCase().includes(q) ||
      (r.submittedByName ?? r.studentName ?? '').toLowerCase().includes(q)
    )
  })

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const tabs = [
    { key: 'all', label: t('common.all'), count: internships.length },
    { key: 'pending', label: t('internships.tabPending'), count: pending.length },
    { key: 'approved', label: t('common.approved'), count: internships.filter((r) => r.status === 'APPROVED').length },
    { key: 'rejected', label: t('common.rejected'), count: internships.filter((r) => r.status === 'REJECTED').length },
  ]

  return (
    <StaffListShell
      title={t('internships.title')}
      subtitle={t('internships.subtitle', { count: internships.length })}
      actionButton={
        pending.length > 0 ? (
          <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 font-semibold px-2.5 py-1 rounded-full self-center">
            {pending.length} {t('common.pending')}
          </span>
        ) : undefined
      }
      tabs={tabs}
      activeTab={filter}
      onTabChange={(k) => { setFilter(k as FilterKey); setPage(1) }}
      search={search}
      onSearchChange={(v) => { setSearch(v); setPage(1) }}
      searchPlaceholder={t('common.search')}
      statusOptions={ALL_STATUSES}
      activeStatus={activeStatus}
      onStatusChange={(s) => { setActiveStatus(s); setPage(1) }}
      activePriority={activePriority}
      onPriorityChange={(p) => { setActivePriority(p); setPage(1) }}
      isLoading={isLoading}
      totalCount={filtered.length}
      page={page}
      pageSize={PAGE_SIZE}
      onPageChange={setPage}
      emptyIcon={<Briefcase className="size-8" />}
      emptyTitle={t('internships.noInternships')}
      emptyDesc={search ? t('internships.noInternshipsDesc') : undefined}
    >
      {paged.map((r) => {
        const canAct = r.canAct === true && PENDING_STATUSES.includes(r.status)
        const isProcessing = processingId === r.id
        return (
          <div key={r.id}>
            <StaffRequestRow
              href={`/faculty/requests/${r.id}?from=/faculty/internships`}
              title={r.companyName ?? r.title ?? 'Internship Application'}
              requestNo={r.requestNo}
              badge={r.internshipType}
              metaLeft={[
                r.submittedByName ?? r.studentName,
                r.startDate ? `Starts ${formatDate(r.startDate)}` : undefined,
              ]}
              status={r.status}
            />
            {canAct && (
              <div className="px-5 pb-3 flex gap-2">
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs"
                  onClick={() => router.push(`/faculty/requests/${r.id}?from=/faculty/internships`)}>
                  <Eye className="size-3" /> {t('common.view')}
                </Button>
                <Button size="sm" className="h-7 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                  disabled={isProcessing} onClick={() => handleAction(r.id, 'approve')}>
                  {isProcessing ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
                  {t('common.approve')}
                </Button>
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                  disabled={isProcessing} onClick={() => handleAction(r.id, 'reject')}>
                  {isProcessing ? <Loader2 className="size-3 animate-spin" /> : <XCircle className="size-3" />}
                  {t('common.reject')}
                </Button>
              </div>
            )}
          </div>
        )
      })}
    </StaffListShell>
  )
}
