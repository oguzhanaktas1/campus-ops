'use client'

import { useEffect, useState, useCallback } from 'react'
import { Package } from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { StaffListShell } from '@/components/staff/staff-list-shell'
import { StaffRequestRow, formatDate } from '@/components/staff/staff-request-row'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
const PAGE_SIZE = 20
const ALL_STATUSES = ['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL', 'APPROVED', 'COMPLETED', 'REJECTED']

export default function FacultyEquipmentPage() {
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
      if (res.ok) {
        const data = await res.json()
        setRequests(data.filter((r: any) => r.type === 'EQUIPMENT'))
      } else {
        setRequests([])
      }
    } catch {
      toast.error(t('equipment.loadFail'))
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
      title={t('equipment.title')}
      subtitle={t('equipment.subtitle', { count: requests.length })}
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
      emptyIcon={<Package className="size-8" />}
      emptyTitle={t('equipment.noEquipment')}
      emptyDesc={search ? undefined : undefined}
    >
      {paged.map((r) => (
        <StaffRequestRow
          key={r.id}
          href={`/faculty/requests/${r.id}?from=/faculty/equipment`}
          title={r.title || t('equipment.title')}
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
