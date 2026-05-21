'use client'

import { useEffect, useState, useCallback } from 'react'
import { PartyPopper } from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { StaffListShell } from '@/components/staff/staff-list-shell'
import { StaffRequestRow, formatDate } from '@/components/staff/staff-request-row'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
const PAGE_SIZE = 20
const ALL_STATUSES = ['SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED']

export default function FacultyEventsPage() {
  const { t } = useI18n()
  const [events, setEvents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [activeStatus, setActiveStatus] = useState('')
  const [activePriority, setActivePriority] = useState('')

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/events`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) setEvents(await res.json())
    } catch {
      toast.error(t('events.loadFail'))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => { void fetchEvents() }, [fetchEvents])

  const byStatus = filter === 'all' ? events : events.filter((e) => e.status === filter)

  const filtered = byStatus.filter((e) => {
    if (activeStatus && e.status !== activeStatus) return false
    if (activePriority && e.priority !== activePriority) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      e.eventName?.toLowerCase().includes(q) ||
      e.requestNo?.toLowerCase().includes(q) ||
      e.requesterName?.toLowerCase().includes(q) ||
      e.eventType?.toLowerCase().includes(q)
    )
  })

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const tabs = [
    { key: 'all', label: t('common.all'), count: events.length },
    ...ALL_STATUSES.map((s) => ({
      key: s,
      label: s.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      count: events.filter((e) => e.status === s).length,
    })).filter((tab) => tab.count > 0),
  ]

  return (
    <StaffListShell
      title={t('events.title')}
      subtitle={t('events.subtitle', { count: events.length })}
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
      emptyIcon={<PartyPopper className="size-8" />}
      emptyTitle={t('events.noEvents')}
    >
      {paged.map((ev) => (
        <StaffRequestRow
          key={ev.id}
          href={`/faculty/requests/${ev.id}?from=/faculty/events`}
          title={ev.eventName || 'Event Request'}
          requestNo={ev.requestNo}
          badge={ev.eventType}
          metaLeft={[
            ev.requesterName,
            ev.startAt ? formatDate(ev.startAt) : undefined,
            ev.expectedAttendance ? `~${ev.expectedAttendance} attendees` : undefined,
          ]}
          status={ev.status}
        />
      ))}
    </StaffListShell>
  )
}
