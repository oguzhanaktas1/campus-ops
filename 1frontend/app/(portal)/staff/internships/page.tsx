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

const ACTIVE_STATUSES = ['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL']
const ALL_STATUSES = ['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL', 'REVISION_REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED', 'CLOSED']

export default function StaffInternshipsPage() {
  const { t } = useI18n()
  const [internships, setInternships] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [activeStatus, setActiveStatus] = useState('')
  const [activePriority, setActivePriority] = useState('')

  const fetchInternships = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/internships`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) setInternships(await res.json())
    } catch {
      toast.error(t('pages.internshipLoadFail'))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => { void fetchInternships() }, [fetchInternships])

  const active = internships.filter((r) => ACTIVE_STATUSES.includes(r.status))

  const byStatus = filter === 'all' ? internships : internships.filter((r) => r.status === filter)

  const filtered = byStatus.filter((r) => {
    if (activeStatus && r.status !== activeStatus) return false
    if (activePriority && r.priority !== activePriority) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (r.companyName ?? r.title ?? '').toLowerCase().includes(q) ||
      r.requestNo?.toLowerCase().includes(q) ||
      (r.studentName ?? r.requesterName ?? '').toLowerCase().includes(q)
    )
  })

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const tabs = [
    { key: 'all', label: t('common.all'), count: internships.length },
    ...ALL_STATUSES.map((s) => ({
      key: s,
      label: s.replace(/_/g, ' '),
      count: internships.filter((r) => r.status === s).length,
    })).filter((tab) => tab.count > 0),
  ]

  return (
    <StaffListShell
      title={t('pages.internshipRequests')}
      subtitle={t('pages.internshipSubtitle')}
      actionButton={
        active.length > 0 ? (
          <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 font-semibold px-2.5 py-1 rounded-full self-center">
            {t('pages.pendingCount', { count: active.length })}
          </span>
        ) : undefined
      }
      tabs={tabs}
      activeTab={filter}
      onTabChange={setFilter}
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder={t('tickets.searchPlaceholder')}
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
      emptyTitle={t('pages.noInternships')}
      emptyDesc={search ? t('tickets.searchHint') : undefined}
    >
      {paged.map((r) => (
        <StaffRequestRow
          key={r.id}
          href={`/staff/requests/internships/${r.id}`}
          title={r.companyName ?? r.title ?? 'Internship Application'}
          requestNo={r.requestNo}
          badge={r.internshipType}
          metaLeft={[
            r.studentName ?? r.requesterName,
            r.startDate ? `Starts ${formatDate(r.startDate)}` : undefined,
          ]}
          status={r.status}
        />
      ))}
    </StaffListShell>
  )
}
