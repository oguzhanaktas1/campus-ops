'use client'

import { useEffect, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { StaffListShell } from '@/components/staff/staff-list-shell'
import { StaffRequestRow, formatDateTime } from '@/components/staff/staff-request-row'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
const PAGE_SIZE = 20
const ALL_STATUSES = ['SUBMITTED', 'IN_REVIEW', 'PENDING', 'WAITING_APPROVAL', 'APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED']

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected'

export default function StaffReservationsPage() {
  const { t } = useI18n()
  const [reservations, setReservations] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [activeStatus, setActiveStatus] = useState('')
  const [activePriority, setActivePriority] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${BACKEND}/room-reservation-requests`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (res.ok) setReservations(await res.json())
      } catch {
        toast.error(t('pages.reservationLoadFail'))
      } finally {
        setIsLoading(false)
      }
    }
    void load()
  }, [t])

  const byFilter = (items: any[]) => {
    if (filter === 'all') return items
    if (filter === 'pending') return items.filter((r) =>
      ['SUBMITTED', 'IN_REVIEW', 'PENDING', 'WAITING_APPROVAL'].includes(r.status ?? r.reservationStatus)
    )
    if (filter === 'approved') return items.filter((r) =>
      ['APPROVED', 'COMPLETED'].includes(r.status ?? r.reservationStatus)
    )
    return items.filter((r) => ['REJECTED', 'CANCELLED'].includes(r.status ?? r.reservationStatus))
  }

  const filtered = byFilter(reservations).filter((r) => {
    if (activeStatus && (r.status ?? r.reservationStatus) !== activeStatus) return false
    if (activePriority && r.priority !== activePriority) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (r.title ?? r.eventName ?? '').toLowerCase().includes(q) ||
      r.requestNo?.toLowerCase().includes(q) ||
      r.requesterName?.toLowerCase().includes(q) ||
      r.resource?.name?.toLowerCase().includes(q)
    )
  })

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const pending = reservations.filter((r) =>
    ['SUBMITTED', 'IN_REVIEW', 'PENDING', 'WAITING_APPROVAL'].includes(r.status ?? r.reservationStatus)
  )
  const approved = reservations.filter((r) =>
    ['APPROVED', 'COMPLETED'].includes(r.status ?? r.reservationStatus)
  )
  const rejected = reservations.filter((r) =>
    ['REJECTED', 'CANCELLED'].includes(r.status ?? r.reservationStatus)
  )

  const tabs = [
    { key: 'all', label: t('common.all'), count: reservations.length },
    { key: 'pending', label: t('common.pending'), count: pending.length },
    { key: 'approved', label: t('common.approved'), count: approved.length },
    { key: 'rejected', label: t('common.rejected'), count: rejected.length },
  ]

  return (
    <StaffListShell
      title={t('pages.reservationRequests')}
      subtitle={t('pages.reservationSubtitle')}
      tabs={tabs}
      activeTab={filter}
      onTabChange={(k) => setFilter(k as FilterStatus)}
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
      emptyIcon={<BookOpen className="size-8" />}
      emptyTitle={t('pages.noReservations')}
      emptyDesc={search ? t('tickets.searchHint') : undefined}
    >
      {paged.map((r) => (
        <StaffRequestRow
          key={r.id}
          href={`/staff/requests/reservations/${r.id}`}
          title={r.title ?? r.eventName ?? 'Reservation Request'}
          requestNo={r.requestNo}
          badge={r.resource?.name}
          metaLeft={[
            r.requesterName,
            r.startAt ? formatDateTime(r.startAt) : undefined,
          ]}
          status={r.status ?? r.reservationStatus}
          priority={r.priority}
        />
      ))}
    </StaffListShell>
  )
}
