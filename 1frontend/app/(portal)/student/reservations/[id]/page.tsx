'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { ArrowLeft, Loader2, MapPin, Users, Clock, Calendar, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { getToken } from '@/lib/auth'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

function formatDateTime(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function StudentReservationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch(`${BACKEND}/room-reservation-requests/${id}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (res.ok) setData(await res.json())
      } catch {
        // silent
      } finally {
        setIsLoading(false)
      }
    }
    void fetch_()
  }, [id])

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Reservation not found.</p>
        <Link href="/student/reservations"><Button variant="outline" className="mt-4">Back</Button></Link>
      </div>
    )
  }

  const r = data.reservation

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <Link href="/student/reservations">
          <Button variant="ghost" size="icon" className="size-8"><ArrowLeft className="size-4" /></Button>
        </Link>
        <div>
          <p className="font-mono text-xs text-muted-foreground">{data.requestNo}</p>
          <h1 className="text-xl font-bold text-foreground">{r?.eventName ?? data.title}</h1>
        </div>
        <div className="ml-auto">
          <StatusBadge status={r?.reservationStatus ?? data.status} />
        </div>
      </div>

      {/* Conflict warning */}
      {data.conflicts?.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {data.conflicts.length} scheduling conflict(s) detected
              </p>
              <ul className="mt-1 space-y-0.5">
                {data.conflicts.map((c: any) => (
                  <li key={c.id} className="text-xs text-amber-700 dark:text-amber-400">
                    {c.conflicting?.title} · {formatDateTime(c.conflicting?.startAt)} – {formatDateTime(c.conflicting?.endAt)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Approved confirmation */}
      {data.actualReservation && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Reservation Confirmed</p>
            {data.actualReservation.approvedAt && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400">Approved on {formatDate(data.actualReservation.approvedAt)}</p>
            )}
          </div>
        </div>
      )}

      {/* Reservation details */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Reservation Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {r?.resource && (
            <div className="flex items-start gap-2">
              <MapPin className="size-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Room / Resource</p>
                <p className="font-medium text-foreground">{r.resource.name}</p>
                {r.resource.locationText && <p className="text-xs text-muted-foreground">{r.resource.locationText}</p>}
                {r.resource.campus && <p className="text-xs text-muted-foreground">{r.resource.campus}</p>}
              </div>
            </div>
          )}
          {r?.attendeeCount && (
            <div className="flex items-start gap-2">
              <Users className="size-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Expected Attendees</p>
                <p className="font-medium text-foreground">{r.attendeeCount}</p>
              </div>
            </div>
          )}
          {r?.startAt && (
            <div className="flex items-start gap-2">
              <Clock className="size-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Start</p>
                <p className="font-medium text-foreground">{formatDateTime(r.startAt)}</p>
              </div>
            </div>
          )}
          {r?.endAt && (
            <div className="flex items-start gap-2">
              <Clock className="size-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">End</p>
                <p className="font-medium text-foreground">{formatDateTime(r.endAt)}</p>
              </div>
            </div>
          )}
        </div>
        {r?.reservationPurpose && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Purpose</p>
            <p className="text-sm text-foreground">{r.reservationPurpose}</p>
          </div>
        )}
        {r?.setupNotes && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Setup Notes</p>
            <p className="text-sm text-foreground">{r.setupNotes}</p>
          </div>
        )}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {r?.requiresSecurityApproval && <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full">Security Approval Required</span>}
          {r?.requiresTechnicalSupport && <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-full">Technical Support Required</span>}
        </div>
      </div>

      {/* Status history */}
      {data.statusHistory?.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Status History</h2>
          <div className="space-y-2">
            {data.statusHistory.map((h: any) => (
              <div key={h.id} className="flex items-start gap-3 text-sm">
                <Calendar className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={h.status} />
                    <span className="text-xs text-muted-foreground">{formatDateTime(h.date)}</span>
                  </div>
                  {h.note && <p className="text-xs text-muted-foreground mt-0.5">{h.note}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comments */}
      {data.comments?.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Comments</h2>
          <div className="space-y-3">
            {data.comments.map((c: any) => (
              <div key={c.id} className="text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                    {c.author?.charAt(0)}
                  </div>
                  <span className="font-medium text-foreground">{c.author}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</span>
                </div>
                <p className="text-muted-foreground pl-8">{c.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
