'use client'

import { useEffect, useState, useCallback } from 'react'
import { CalendarDays } from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { StaffListShell } from '@/components/staff/staff-list-shell'
import { StaffRequestRow, formatDateTime } from '@/components/staff/staff-request-row'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
const PAGE_SIZE = 20
const ALL_STATUSES = ['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL', 'APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED']

export default function StaffAppointmentsPage() {
  const { t } = useI18n()
  const [appointments, setAppointments] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [activeStatus, setActiveStatus] = useState('')
  const [activePriority, setActivePriority] = useState('')

  const fetchAppointments = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/appointment-requests/incoming`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) setAppointments(await res.json())
    } catch {
      toast.error(t('pages.appointmentLoadFail'))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => { void fetchAppointments() }, [fetchAppointments])

  const pending = appointments.filter((a) =>
    ['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL'].includes(a.status)
  )

  const byStatus = filter === 'all' ? appointments : appointments.filter((a) => a.status === filter)

  const filtered = byStatus.filter((a) => {
    if (activeStatus && a.status !== activeStatus) return false
    if (activePriority && a.priority !== activePriority) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      a.topic?.toLowerCase().includes(q) ||
      a.requestNo?.toLowerCase().includes(q) ||
      a.requesterName?.toLowerCase().includes(q) ||
      a.appointmentType?.toLowerCase().includes(q)
    )
  })

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const tabs = [
    { key: 'all', label: t('common.all'), count: appointments.length },
    ...ALL_STATUSES.map((s) => ({
      key: s,
      label: s.replace(/_/g, ' '),
      count: appointments.filter((a) => a.status === s).length,
    })).filter((tab) => tab.count > 0),
  ]

  return (
    <StaffListShell
      title={t('pages.appointmentRequests')}
      subtitle={t('pages.appointmentSubtitle')}
      actionButton={
        pending.length > 0 ? (
          <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 font-semibold px-2.5 py-1 rounded-full self-center">
            {t('pages.pendingCount', { count: pending.length })}
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
      emptyIcon={<CalendarDays className="size-8" />}
      emptyTitle={t('pages.appointmentEmpty')}
      emptyDesc={search ? t('tickets.searchHint') : undefined}
    >
      {paged.map((a) => (
        <StaffRequestRow
          key={a.id}
          href={`/staff/requests/appointments/${a.id}`}
          title={a.topic || 'Appointment Request'}
          requestNo={a.requestNo}
          badge={a.appointmentType}
          metaLeft={[
            a.requesterName,
            a.preferredStartAt ? formatDateTime(a.preferredStartAt) : undefined,
          ]}
          status={a.status}
        />
      ))}
    </StaffListShell>
  )
}
