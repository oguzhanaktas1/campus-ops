'use client'

import { useEffect, useState, useCallback } from 'react'
import { FileText } from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { StaffListShell } from '@/components/staff/staff-list-shell'
import { StaffRequestRow, formatDate } from '@/components/staff/staff-request-row'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
const PAGE_SIZE = 20
const ALL_STATUSES = ['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL', 'REVISION_REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED', 'CLOSED']

export default function FacultyRequestsPage() {
  const { t } = useI18n()
  const [requests, setRequests] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [activeStatus, setActiveStatus] = useState('')
  const [activePriority, setActivePriority] = useState('')

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/faculty/requests/all`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) setRequests(await res.json())
    } catch {
      toast.error(t('requests.loadFail'))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => { void fetchRequests() }, [fetchRequests])

  const byStatus = filter === 'all' ? requests : requests.filter((r) => r.status === filter)

  const filtered = byStatus.filter((r) => {
    if (activeStatus && r.status !== activeStatus) return false
    if (activePriority && r.priority !== activePriority) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      r.title?.toLowerCase().includes(q) ||
      r.requestNo?.toLowerCase().includes(q) ||
      (r.submittedByName ?? r.requesterName ?? '').toLowerCase().includes(q) ||
      r.typeName?.toLowerCase().includes(q)
    )
  })

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const tabs = [
    { key: 'all', label: t('common.all'), count: requests.length },
    ...ALL_STATUSES.map((s) => ({
      key: s,
      label: s.replace(/_/g, ' '),
      count: requests.filter((r) => r.status === s).length,
    })).filter((tab) => tab.count > 0),
  ]

  return (
    <StaffListShell
      title={t('requests.title')}
      subtitle={t('requests.subtitle', { count: requests.length })}
      tabs={tabs}
      activeTab={filter}
      onTabChange={(k) => { setFilter(k); setPage(1) }}
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
      emptyIcon={<FileText className="size-8" />}
      emptyTitle={t('requests.noRequests')}
      emptyDesc={search ? t('requests.searchHint') : undefined}
    >
      {paged.map((r) => (
        <StaffRequestRow
          key={r.id}
          href={`/faculty/requests/${r.id}?from=/faculty/requests`}
          title={r.title}
          requestNo={r.requestNo}
          badge={r.typeName}
          metaLeft={[
            r.submittedByName ?? r.requesterName,
            r.createdAt ? formatDate(r.createdAt) : undefined,
          ]}
          status={r.status}
          priority={r.priority}
        />
      ))}
    </StaffListShell>
  )
}
