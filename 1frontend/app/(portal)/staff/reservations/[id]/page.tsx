'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge } from '@/components/status-badge'
import {
  ArrowLeft, Loader2, MapPin, Users, Clock, Calendar,
  CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
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

export default function StaffReservationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [approveNote, setApproveNote] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [isActioning, setIsActioning] = useState(false)

  const fetchDetail = async () => {
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

  useEffect(() => { void fetchDetail() }, [id])

  const handleApprove = async () => {
    setIsActioning(true)
    try {
      const res = await fetch(`${BACKEND}/room-reservation-requests/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ note: approveNote.trim() || undefined }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.message ?? 'Failed')
      if (result.hasConflicts) {
        toast.warning(`Approved with ${result.conflictCount} conflict(s).`)
      } else {
        toast.success('Reservation approved.')
      }
      void fetchDetail()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsActioning(false)
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) { toast.error('Rejection reason is required.'); return }
    setIsActioning(true)
    try {
      const res = await fetch(`${BACKEND}/room-reservation-requests/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.message ?? 'Failed')
      toast.success('Reservation rejected.')
      setShowReject(false)
      void fetchDetail()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsActioning(false)
    }
  }

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
        <Link href="/staff/reservations"><Button variant="outline" className="mt-4">Back</Button></Link>
      </div>
    )
  }

  const r = data.reservation
  const isPending = r?.reservationStatus === 'PENDING'

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <Link href="/staff/reservations">
          <Button variant="ghost" size="icon" className="size-8"><ArrowLeft className="size-4" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-xs text-muted-foreground">{data.requestNo}</p>
          <h1 className="text-xl font-bold text-foreground truncate">{r?.eventName ?? data.title}</h1>
        </div>
        <StatusBadge status={r?.reservationStatus ?? data.status} />
      </div>

      {/* Requester info */}
      <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
        <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
          {data.requester?.fullName?.charAt(0) ?? 'U'}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{data.requester?.fullName}</p>
          <p className="text-xs text-muted-foreground">
            {[data.requester?.faculty, data.requester?.department].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="ml-auto text-xs text-muted-foreground">
          Submitted {formatDate(data.submittedAt ?? data.createdAt)}
        </div>
      </div>

      {/* Conflicts warning */}
      {data.conflicts?.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {data.conflicts.length} scheduling conflict(s)
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

      {/* Actual reservation confirmed */}
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

      {/* Details */}
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
                {r.resource.capacity && <p className="text-xs text-muted-foreground">Capacity: {r.resource.capacity}</p>}
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
        <div className="flex flex-wrap gap-2 text-xs">
          {r?.requiresSecurityApproval && (
            <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full">Security Approval Required</span>
          )}
          {r?.requiresTechnicalSupport && (
            <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-full">Technical Support Required</span>
          )}
        </div>
      </div>

      {/* Approve/Reject actions */}
      {isPending && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Action</h2>

          {!showReject ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Approval note (optional)</label>
                <Textarea
                  placeholder="Add a note for the requester..."
                  className="resize-none min-h-[72px]"
                  value={approveNote}
                  onChange={(e) => setApproveNote(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <Button
                  className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleApprove}
                  disabled={isActioning}
                >
                  {isActioning ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  Approve
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 gap-2 border-destructive text-destructive hover:bg-destructive/10"
                  onClick={() => setShowReject(true)}
                  disabled={isActioning}
                >
                  <XCircle className="size-4" /> Reject
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Rejection reason <span className="text-destructive">*</span></label>
                <Textarea
                  placeholder="Explain why this reservation is being rejected..."
                  className="resize-none min-h-[80px]"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <Button
                  className="flex-1 gap-2 bg-destructive hover:bg-destructive/90 text-white"
                  onClick={handleReject}
                  disabled={isActioning}
                >
                  {isActioning ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
                  Confirm Rejection
                </Button>
                <Button variant="outline" onClick={() => setShowReject(false)} disabled={isActioning}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

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
                  <span className="text-xs text-muted-foreground capitalize">{c.authorRole}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{formatDate(c.createdAt)}</span>
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
