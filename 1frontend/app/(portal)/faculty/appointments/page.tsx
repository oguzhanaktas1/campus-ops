'use client'

import { useEffect, useState, useCallback } from 'react'
import { CalendarDays, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { StaffListShell } from '@/components/staff/staff-list-shell'
import { StaffRequestRow, formatDateTime } from '@/components/staff/staff-request-row'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
const PAGE_SIZE = 20
const ALL_STATUSES = ['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL', 'APPROVED', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED']

const PENDING_STATUSES = ['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL']
const CONFIRMED_STATUSES = ['APPROVED', 'CONFIRMED']
const PAST_STATUSES = ['COMPLETED', 'REJECTED', 'CANCELLED']

type TabKey = 'all' | 'requests' | 'confirmed' | 'past'

export default function FacultyAppointmentsPage() {
  const { t } = useI18n()
  const [appointments, setAppointments] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('all')
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
      else setAppointments([])
    } catch {
      setAppointments([])
      toast.error(t('appointments.actionFail'))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => { void fetchAppointments() }, [fetchAppointments])

  const handleAction = async (id: string, action: 'CONFIRM' | 'DECLINE') => {
    setProcessingId(id)
    try {
      const endpoint = action === 'CONFIRM' ? 'confirm' : 'decline'
      const res = await fetch(`${BACKEND}/appointment-requests/${id}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        toast.success(action === 'CONFIRM' ? t('appointments.confirmSuccess') : t('appointments.declineSuccess'))
        setAppointments((prev) =>
          prev.map((a) => a.id === id ? { ...a, status: action === 'CONFIRM' ? 'APPROVED' : 'REJECTED' } : a),
        )
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error((err as any)?.message || t('appointments.actionFail'))
      }
    } catch {
      toast.error(t('appointments.actionFail'))
    } finally {
      setProcessingId(null)
    }
  }

  const pending = appointments.filter((a) => PENDING_STATUSES.includes(a.status?.toUpperCase()))
  const confirmed = appointments.filter((a) => CONFIRMED_STATUSES.includes(a.status?.toUpperCase()))
  const past = appointments.filter((a) => PAST_STATUSES.includes(a.status?.toUpperCase()))

  const baseList =
    activeTab === 'requests' ? pending :
    activeTab === 'confirmed' ? confirmed :
    activeTab === 'past' ? past :
    appointments

  const filtered = baseList.filter((a) => {
    if (activeStatus && a.status?.toUpperCase() !== activeStatus) return false
    if (activePriority && a.priority !== activePriority) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      a.topic?.toLowerCase().includes(q) ||
      a.requestNo?.toLowerCase().includes(q) ||
      (a.requester?.fullName ?? '').toLowerCase().includes(q) ||
      a.appointmentType?.toLowerCase().includes(q)
    )
  })

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const tabs = [
    { key: 'all', label: t('common.all'), count: appointments.length },
    { key: 'requests', label: t('appointments.tabRequests'), count: pending.length },
    { key: 'confirmed', label: t('appointments.tabConfirmed'), count: confirmed.length },
    { key: 'past', label: t('appointments.tabPast'), count: past.length },
  ]

  return (
    <StaffListShell
      title={t('appointments.title')}
      subtitle={t('appointments.subtitle')}
      actionButton={
        pending.length > 0 ? (
          <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 font-semibold px-2.5 py-1 rounded-full self-center">
            {pending.length} {t('common.pending')}
          </span>
        ) : undefined
      }
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(k) => { setActiveTab(k as TabKey); setPage(1) }}
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
      emptyIcon={<CalendarDays className="size-8" />}
      emptyTitle={
        activeTab === 'requests' ? t('appointments.noRequests') :
        activeTab === 'confirmed' ? t('appointments.noConfirmed') :
        activeTab === 'past' ? t('appointments.noPast') :
        t('appointments.noRequests')
      }
    >
      {paged.map((apt) => {
        const isPending = PENDING_STATUSES.includes(apt.status?.toUpperCase())
        const isProcessing = processingId === apt.id
        return (
          <div key={apt.id}>
            <StaffRequestRow
              href={`/faculty/requests/${apt.id}?from=/faculty/appointments`}
              title={apt.topic || 'Appointment Request'}
              requestNo={apt.requestNo}
              badge={apt.appointmentType}
              metaLeft={[
                apt.requester?.fullName ?? apt.requesterName ?? 'Unknown',
                apt.preferredStartAt ? formatDateTime(apt.preferredStartAt) : undefined,
                apt.durationMin ? `${apt.durationMin} min` : undefined,
              ]}
              status={apt.status}
            />
            {isPending && (
              <div className="px-5 pb-3 flex gap-2">
                <Button size="sm" className="h-7 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                  disabled={isProcessing} onClick={() => handleAction(apt.id, 'CONFIRM')}>
                  {isProcessing ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
                  {t('appointments.confirmBtn')}
                </Button>
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                  disabled={isProcessing} onClick={() => handleAction(apt.id, 'DECLINE')}>
                  {isProcessing ? <Loader2 className="size-3 animate-spin" /> : <XCircle className="size-3" />}
                  {t('appointments.declineBtn')}
                </Button>
              </div>
            )}
          </div>
        )
      })}
    </StaffListShell>
  )
}
