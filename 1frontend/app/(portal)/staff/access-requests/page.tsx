'use client'

import { useEffect, useState, useCallback } from 'react'
import { ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { StaffListShell } from '@/components/staff/staff-list-shell'
import { StaffRequestRow } from '@/components/staff/staff-request-row'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
const PAGE_SIZE = 20
const ALL_STATUSES = ['SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED']

export default function StaffAccessRequestsPage() {
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
      const res = await fetch(`${BACKEND}/access-requests`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) setRequests(await res.json())
    } catch {
      toast.error(t('pages.accessLoadFail'))
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
      r.targetResource?.toLowerCase().includes(q) ||
      r.requestNo?.toLowerCase().includes(q) ||
      r.requesterName?.toLowerCase().includes(q) ||
      r.accessType?.toLowerCase().includes(q)
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
      title={t('pages.accessRequests')}
      subtitle={t('pages.accessSubtitle')}
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
      emptyIcon={<ShieldCheck className="size-8" />}
      emptyTitle={t('pages.noAccessRequests')}
      emptyDesc={search ? t('tickets.searchHint') : undefined}
    >
      {paged.map((r) => (
        <StaffRequestRow
          key={r.id}
          href={`/staff/requests/access-requests/${r.id}`}
          title={r.targetResource || 'Access Request'}
          requestNo={r.requestNo}
          badge={r.accessType}
          metaLeft={[r.requesterName, r.justification ? `"${r.justification.slice(0, 60)}…"` : undefined]}
          status={r.status}
        />
      ))}
    </StaffListShell>
  )
}
