'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { StatusBadge } from '@/components/status-badge'
import { EmptyState } from '@/components/empty-state'
import { CalendarDays, Filter, Loader2, BookOpen, ChevronRight, Clock, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

interface ReservationRequest {
  id: string
  reservationRequestId: string
  requestNo: string
  title: string
  status: string
  reservationStatus: string
  priority: string
  eventName: string
  startAt: string
  endAt: string
  resource: { id: string; name: string; resourceType: string } | null
  requesterName: string
  createdAt: string
}

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected'

const FILTER_TABS: { key: FilterStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
]

function formatDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(d: string) {
  if (!d) return ''
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export default function StaffReservationsPage() {
  const router = useRouter()
  const [reservations, setReservations] = useState<ReservationRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all')

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch(`${BACKEND}/room-reservation-requests`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (res.ok) setReservations(await res.json())
        else setReservations([])
      } catch {
        toast.error('Failed to load reservations.')
        setReservations([])
      } finally {
        setIsLoading(false)
      }
    }
    void fetch_()
  }, [])

  const filtered = reservations.filter((r) => {
    if (activeFilter === 'all') return true
    const s = (r.reservationStatus ?? r.status ?? '').toLowerCase()
    if (activeFilter === 'pending') return ['pending', 'submitted'].includes(s)
    if (activeFilter === 'approved') return s === 'approved'
    if (activeFilter === 'rejected') return s === 'rejected'
    return true
  })

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto pb-20">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <CalendarDays className="size-5 text-primary" /> Reservations
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage room and resource reservation requests</p>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        {/* Filter bar */}
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-border flex-wrap">
          <div className="flex items-center gap-1">
            <Filter className="size-3.5 text-muted-foreground mr-1" />
            {FILTER_TABS.map((tab) => {
              const count =
                tab.key === 'all'
                  ? reservations.length
                  : reservations.filter((r) => {
                      const s = (r.reservationStatus ?? r.status ?? '').toLowerCase()
                      if (tab.key === 'pending') return ['pending', 'submitted'].includes(s)
                      return s === tab.key
                    }).length
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5',
                    activeFilter === tab.key
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  {tab.label}
                  {count > 0 && (
                    <span className={cn(
                      'text-[9px] font-bold px-1 rounded-full',
                      activeFilter === tab.key
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <span className="text-xs text-muted-foreground">{filtered.length} records</span>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="No reservations found"
            description="Room and resource reservation requests will appear here."
            icon={<BookOpen className="size-6" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Request No</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Room / Resource</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Requester</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Date &amp; Time</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="sr-only">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((req) => (
                  <tr
                    key={req.id}
                    onClick={() => router.push(`/staff/requests/reservations/${req.id}`)}
                    className="hover:bg-muted/20 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                        {req.requestNo}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-foreground">{req.eventName ?? req.title}</p>
                      {req.resource?.name && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="size-3" />{req.resource.name}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                          {req.requesterName?.charAt(0) || 'U'}
                        </div>
                        <span className="text-muted-foreground">{req.requesterName || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell text-muted-foreground text-xs whitespace-nowrap">
                      {req.startAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {formatDate(req.startAt)} · {formatTime(req.startAt)} – {formatTime(req.endAt)}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={req.reservationStatus ?? req.status} />
                    </td>
                    <td className="px-5 py-4">
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
