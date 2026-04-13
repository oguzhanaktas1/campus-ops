'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge } from '@/components/status-badge'
import { RequestTimeline } from '@/components/request-timeline'
import {
  ArrowLeft, Loader2, AlertTriangle, MapPin,
  Users, Clock, CheckCircle2, XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

function fmtDT(d: any) {
  if (!d) return '-'
  return new Date(d).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fmt(d: any) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function FacultyReservationDetailPage() {
  const { id } = useParams() as { id: string }
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [approveNote, setApproveNote] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [isActioning, setIsActioning] = useState(false)

  const fetchDetail = async () => {
    const res = await fetch(`${BACKEND}/faculty/requests/${id}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    if (res.ok) setData(await res.json())
    else setData(null)
    setIsLoading(false)
  }

  useEffect(() => {
    void fetchDetail()
  }, [id])

  const handleApprove = async () => {
    setIsActioning(true)
    try {
      const res = await fetch(`${BACKEND}/faculty/requests/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ action: 'approve', comment: approveNote.trim() || undefined }),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(result.message ?? 'Failed')
      toast.success('Reservation approved.')
      void fetchDetail()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsActioning(false)
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Reason required.')
      return
    }
    setIsActioning(true)
    try {
      const res = await fetch(`${BACKEND}/faculty/requests/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ action: 'reject', comment: rejectReason.trim() }),
      })
      const result = await res.json().catch(() => ({}))
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

  if (isLoading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>
  if (!data) return (
    <div className="p-6 text-center">
      <AlertTriangle className="size-8 text-muted-foreground/40 mb-3 mx-auto" />
      <p className="text-sm font-medium">Reservation not found</p>
      <Link href="/faculty/reservations"><Button variant="outline" className="mt-4">Back</Button></Link>
    </div>
  )

  const reservation = data.formData ?? {}
  const isPending = ['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL'].includes(data.status)

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <Link href="/faculty/reservations">
          <Button variant="ghost" size="icon" className="size-8"><ArrowLeft className="size-4" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-xs text-muted-foreground">{data.requestNo}</p>
          <h1 className="text-xl font-bold truncate">{reservation.eventName ?? data.title}</h1>
        </div>
        <StatusBadge status={data.status} />
      </div>

      {data.requester && (
        <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
          <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
            {data.requester?.fullName?.charAt(0) ?? 'U'}
          </div>
          <div>
            <p className="text-sm font-medium">{data.requester?.fullName}</p>
            <p className="text-xs text-muted-foreground">{[data.requester?.faculty, data.requester?.department].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="ml-auto text-xs text-muted-foreground">Submitted {fmt(data.createdAt)}</div>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-semibold">Reservation Details</h2>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          {reservation.resource && (
            <div className="flex items-start gap-2">
              <MapPin className="size-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Room / Resource</p>
                <p className="font-medium">{reservation.resource.name}</p>
                {reservation.resource.locationText && <p className="text-xs text-muted-foreground">{reservation.resource.locationText}</p>}
              </div>
            </div>
          )}
          {reservation.attendeeCount && (
            <div className="flex items-start gap-2">
              <Users className="size-4 text-muted-foreground shrink-0 mt-0.5" />
              <div><p className="text-xs text-muted-foreground">Attendees</p><p className="font-medium">{reservation.attendeeCount}</p></div>
            </div>
          )}
          {reservation.startAt && (
            <div className="flex items-start gap-2">
              <Clock className="size-4 text-muted-foreground shrink-0 mt-0.5" />
              <div><p className="text-xs text-muted-foreground">Start</p><p className="font-medium">{fmtDT(reservation.startAt)}</p></div>
            </div>
          )}
          {reservation.endAt && (
            <div className="flex items-start gap-2">
              <Clock className="size-4 text-muted-foreground shrink-0 mt-0.5" />
              <div><p className="text-xs text-muted-foreground">End</p><p className="font-medium">{fmtDT(reservation.endAt)}</p></div>
            </div>
          )}
        </div>
        {reservation.reservationPurpose && <div><p className="text-xs text-muted-foreground mb-1">Purpose</p><p className="text-sm">{reservation.reservationPurpose}</p></div>}
      </div>

      {isPending && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold">Action</h2>
          {!showReject ? (
            <div className="space-y-3">
              <Textarea placeholder="Approval note (optional)..." className="resize-none min-h-[72px]" value={approveNote} onChange={(e) => setApproveNote(e.target.value)} />
              <div className="flex gap-3">
                <Button className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleApprove} disabled={isActioning}>
                  {isActioning ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Approve
                </Button>
                <Button variant="outline" className="flex-1 gap-2 border-destructive text-destructive hover:bg-destructive/10" onClick={() => setShowReject(true)} disabled={isActioning}>
                  <XCircle className="size-4" /> Reject
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Textarea placeholder="Rejection reason (required)..." className="resize-none min-h-[80px]" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
              <div className="flex gap-3">
                <Button className="flex-1 gap-2 bg-destructive hover:bg-destructive/90 text-white" onClick={handleReject} disabled={isActioning}>
                  {isActioning ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />} Confirm Rejection
                </Button>
                <Button variant="outline" onClick={() => setShowReject(false)} disabled={isActioning}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {data.timeline?.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-5">
          <p className="text-sm font-semibold mb-4">Status History</p>
          <RequestTimeline events={data.timeline} />
        </div>
      )}
    </div>
  )
}
