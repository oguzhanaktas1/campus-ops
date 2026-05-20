'use client'

import { useEffect, useState, useCallback } from 'react'
import { PartyPopper, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { StaffListShell } from '@/components/staff/staff-list-shell'
import { StaffRequestRow, formatDate } from '@/components/staff/staff-request-row'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
const PAGE_SIZE = 20
const ALL_STATUSES = ['SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED']

export default function StaffEventsPage() {
  const { t } = useI18n()
  const [events, setEvents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [actionId, setActionId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [activeStatus, setActiveStatus] = useState('')
  const [activePriority, setActivePriority] = useState('')

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/events`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) setEvents(await res.json())
    } catch {
      toast.error(t('pages.eventsLoadFail'))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => { void fetchEvents() }, [fetchEvents])

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`${BACKEND}/events/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ status, note }),
      })
      if (!res.ok) throw new Error()
      toast.success(t('pages.eventUpdateSuccess'))
      setActionId(null)
      setNote('')
      void fetchEvents()
    } catch {
      toast.error(t('pages.eventUpdateFail'))
    }
  }

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
      label: s.replace(/_/g, ' '),
      count: events.filter((e) => e.status === s).length,
    })).filter((tab) => tab.count > 0),
  ]

  return (
    <StaffListShell
      title={t('pages.eventRequests')}
      subtitle={t('pages.eventRequestsSubtitle')}
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
      emptyIcon={<PartyPopper className="size-8" />}
      emptyTitle={t('pages.noEventRequests')}
      emptyDesc={search ? t('tickets.searchHint') : undefined}
    >
      {paged.map((ev) => (
        <div key={ev.id}>
          <StaffRequestRow
            href={`/staff/requests/events/${ev.id}`}
            title={ev.eventName || 'Event Request'}
            requestNo={ev.requestNo}
            badge={ev.eventType}
            metaLeft={[
              ev.requesterName,
              ev.startAt ? formatDate(ev.startAt) : undefined,
              ev.expectedAttendance ? `~${ev.expectedAttendance} people` : undefined,
            ]}
            status={ev.status}
          />
          {['SUBMITTED', 'IN_REVIEW'].includes(ev.status) && (
            <div className="px-5 pb-3">
              {actionId === ev.id ? (
                <div className="space-y-2">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder={t('common.noteOptional')}
                    className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700"
                      onClick={() => void updateStatus(ev.id, 'APPROVED')}>
                      <CheckCircle className="size-3.5" /> {t('common.approve')}
                    </Button>
                    <Button size="sm" variant="destructive" className="gap-1.5"
                      onClick={() => void updateStatus(ev.id, 'REJECTED')}>
                      <XCircle className="size-3.5" /> {t('common.reject')}
                    </Button>
                    <Button size="sm" variant="ghost"
                      onClick={() => { setActionId(null); setNote('') }}>
                      {t('common.cancel')}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setActionId(ev.id)}>
                  {t('common.process')}
                </Button>
              )}
            </div>
          )}
        </div>
      ))}
    </StaffListShell>
  )
}
