'use client'

import { useEffect, useState, useCallback } from 'react'
import { Briefcase } from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { StaffListShell } from '@/components/staff/staff-list-shell'
import { StaffRequestRow, formatDate } from '@/components/staff/staff-request-row'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
const PAGE_SIZE = 20
const PENDING_STATUSES = ['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL']
const ALL_STATUSES = ['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL', 'REVISION_REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED', 'CLOSED']

type FilterKey = 'all' | 'pending' | 'approved' | 'rejected'

export default function FacultyInternshipsPage() {
  const { t } = useI18n()
  const [internships, setInternships] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
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
      {paged.map((r) => (
        <StaffRequestRow
          key={r.id}
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
      ))}
    </StaffListShell>
  )
}
