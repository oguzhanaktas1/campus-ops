'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MetricCard } from '@/components/metric-card'
import { EmptyState } from '@/components/empty-state'
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  UserCheck,
  Users,
  CalendarCheck,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Appointment {
  id: string
  appointmentRequestId: string
  requestNo: string
  topic: string
  details?: string
  appointmentType: string
  status: string
  preferredStartAt: string
  preferredEndAt?: string
  durationMin?: number
  requester: { id: string; fullName: string }
  targetUser: { id: string; fullName: string }
  actualAppointmentId?: string
  createdAt: string
}

type TabKey = 'requests' | 'confirmed' | 'past'

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING: {
    label: 'Pending',
    className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
  },
  APPROVED: {
    label: 'Confirmed',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
  },
  CONFIRMED: {
    label: 'Confirmed',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
  },
  REJECTED: {
    label: 'Declined',
    className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800',
  },
  COMPLETED: {
    label: 'Completed',
    className: 'bg-muted text-muted-foreground border-border',
  },
}

function formatDateTime(d: string) {
  if (!d) return '—'
  const date = new Date(d)
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function AppointmentStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status?.toUpperCase()] || null
  if (!cfg)
    return (
      <Badge variant="outline" className="text-xs">
        {status}
      </Badge>
    )
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', cfg.className)}>
      {cfg.label}
    </Badge>
  )
}

export default function FacultyAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('requests')

  const fetchAppointments = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const res = await fetch(`${backendUrl}/appointment-requests/incoming`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setAppointments(Array.isArray(data) ? data : [])
      } else {
        setAppointments([])
      }
    } catch {
      setAppointments([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAppointments()
  }, [])

  const handleAction = async (id: string, action: 'CONFIRM' | 'DECLINE') => {
    setProcessingId(id)
    try {
      const token = localStorage.getItem('access_token')
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const endpoint = action === 'CONFIRM' ? 'confirm' : 'decline'
      const res = await fetch(`${backendUrl}/appointment-requests/${id}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        toast.success(action === 'CONFIRM' ? 'Appointment confirmed.' : 'Appointment declined.')
        setAppointments((prev) =>
          prev.map((a) =>
            a.id === id ? { ...a, status: action === 'CONFIRM' ? 'APPROVED' : 'REJECTED' } : a
          )
        )
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err?.message || 'Failed to process appointment.')
      }
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setProcessingId(null)
    }
  }

  const now = new Date()

  const pending = appointments.filter((a) =>
    ['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL'].includes(a.status?.toUpperCase())
  )
  const confirmed = appointments.filter((a) => {
    const s = a.status?.toUpperCase()
    return (s === 'APPROVED') && (!a.preferredStartAt || new Date(a.preferredStartAt) >= now)
  })
  const past = appointments.filter((a) => {
    const s = a.status?.toUpperCase()
    return s === 'COMPLETED' || s === 'REJECTED' || s === 'CANCELLED' ||
      (s === 'APPROVED' && a.preferredStartAt && new Date(a.preferredStartAt) < now)
  })

  const todayConfirmed = confirmed.filter((a) => {
    if (!a.preferredStartAt) return false
    const d = new Date(a.preferredStartAt)
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })

  const tabData: Record<TabKey, Appointment[]> = {
    requests: pending,
    confirmed,
    past,
  }

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'requests', label: 'Requests', count: pending.length },
    { key: 'confirmed', label: 'Confirmed', count: confirmed.length },
    { key: 'past', label: 'Past', count: past.length },
  ]

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  const rows = tabData[activeTab]

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto pb-20">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Calendar className="size-5 text-primary" /> My Appointments
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage student appointment requests and scheduled meetings
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Total Appointments"
          value={appointments.length}
          description="All time"
          icon={<Users className="size-4" />}
        />
        <MetricCard
          title="Pending Requests"
          value={pending.length}
          description="Awaiting your decision"
          icon={<Clock className="size-4" />}
          valueClassName={pending.length > 0 ? 'text-amber-600' : undefined}
        />
        <MetricCard
          title="Confirmed Today"
          value={todayConfirmed.length}
          description="Scheduled for today"
          icon={<CalendarCheck className="size-4" />}
        />
      </div>

      {/* Tabs */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="flex border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'text-primary border-b-2 border-primary bg-primary/5'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
              )}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={cn(
                    'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                    activeTab === tab.key
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title={
              activeTab === 'requests'
                ? 'No pending requests'
                : activeTab === 'confirmed'
                ? 'No confirmed appointments'
                : 'No past appointments'
            }
            description={
              activeTab === 'requests'
                ? 'When students request appointments, they will appear here.'
                : activeTab === 'confirmed'
                ? 'Accepted appointments will appear here.'
                : 'Completed and past appointments will appear here.'
            }
            icon={<Calendar className="size-6" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Requester
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Topic
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Preferred Time
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  {activeTab === 'requests' && (
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((apt) => {
                  const isProcessing = processingId === apt.id
                  return (
                    <tr
                      key={apt.id}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                            {apt.requester?.fullName?.charAt(0) || 'S'}
                          </div>
                          <span className="font-medium text-foreground">
                            {apt.requester?.fullName || 'Unknown'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 max-w-[180px]">
                        <p className="font-medium text-foreground text-sm truncate">{apt.topic}</p>
                        <p className="text-xs text-muted-foreground">{apt.appointmentType}</p>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground whitespace-nowrap text-xs">
                        {apt.preferredStartAt ? formatDateTime(apt.preferredStartAt) : '—'}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground text-xs">
                        {apt.durationMin ? `${apt.durationMin} min` : '—'}
                      </td>
                      <td className="px-5 py-4">
                        <AppointmentStatusBadge status={apt.status} />
                      </td>
                      {activeTab === 'requests' && (
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              className="h-7 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                              disabled={isProcessing}
                              onClick={() => handleAction(apt.id, 'CONFIRM')}
                            >
                              {isProcessing ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="size-3" />
                              )}
                              Confirm
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                              disabled={isProcessing}
                              onClick={() => handleAction(apt.id, 'DECLINE')}
                            >
                              {isProcessing ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <XCircle className="size-3" />
                              )}
                              Decline
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
