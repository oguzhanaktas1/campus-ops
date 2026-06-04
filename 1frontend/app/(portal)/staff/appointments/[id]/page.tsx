'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { StatusBadge } from '@/components/status-badge'
import { RequestTimeline } from '@/components/request-timeline'
import {
  ArrowLeft, Loader2, AlertTriangle, CalendarDays,
  User, CheckCircle2, XCircle, ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

function fmt(d: any) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm text-foreground">{value || '—'}</p>
    </div>
  )
}

export default function StaffAppointmentDetailPage() {
  const { id } = useParams() as { id: string }
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [note, setNote] = useState('')
  const [declineReason, setDeclineReason] = useState('')
  const [showDecline, setShowDecline] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`${BACKEND}/appointment-requests/${id}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    if (res.ok) setData(await res.json())
    setIsLoading(false)
  }, [id])

  useEffect(() => { void load() }, [load])

  const handleApprove = async () => {
    setIsProcessing(true)
    try {
      const res = await fetch(`${BACKEND}/appointment-requests/${id}/manager-approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ note: note.trim() || undefined }),
      })
      if (res.ok) {
        toast.success('Appointment approved.')
        setNote('')
        await load()
      } else {
        const err = await res.json().catch(() => ({})) as { message?: string }
        toast.error(err.message ?? 'Failed to approve.')
      }
    } catch {
      toast.error('Network error.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDecline = async () => {
    if (!declineReason.trim()) { toast.error('Reason is required.'); return }
    setIsProcessing(true)
    try {
      const res = await fetch(`${BACKEND}/appointment-requests/${id}/manager-decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ reason: declineReason.trim() }),
      })
      if (res.ok) {
        toast.success('Appointment declined.')
        setShowDecline(false)
        setDeclineReason('')
        await load()
      } else {
        const err = await res.json().catch(() => ({})) as { message?: string }
        toast.error(err.message ?? 'Failed to decline.')
      }
    } catch {
      toast.error('Network error.')
    } finally {
      setIsProcessing(false)
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
      <div className="p-6 max-w-3xl mx-auto flex flex-col items-center py-16">
        <AlertTriangle className="size-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium">Appointment request not found.</p>
        <Link href="/staff/appointments">
          <Button variant="outline" size="sm" className="mt-3">Back</Button>
        </Link>
      </div>
    )
  }

  const calendar = data.calendar ?? {}
  const isWaitingManager =
    data.status === 'WAITING_APPROVAL' || data.awaitingManagerApproval
  const canManagerAct = isWaitingManager && data.isResourceManagerViewer
  const confirmedStart = calendar.confirmedStartAt ?? data.preferredStartAt
  const confirmedEnd = calendar.confirmedEndAt ?? data.preferredEndAt

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto pb-20">
      <Link href="/staff/appointments">
        <Button variant="ghost" size="sm" className="gap-1.5">
          <ArrowLeft className="size-4" /> Back
        </Button>
      </Link>

      <div className="bg-card border border-border rounded-lg p-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
            <CalendarDays className="size-5 text-violet-700 dark:text-violet-300" />
          </div>
          <div>
            <h1 className="text-lg font-bold">{data.topic}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.requestNo} · {fmt(confirmedStart)}
            </p>
          </div>
        </div>
        <StatusBadge status={data.status} />
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 space-y-5">
          <div className="bg-card border border-border rounded-lg p-5 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-2">
              <User className="size-4 text-muted-foreground" /> Participants
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Requester</p>
                <p className="text-sm font-medium">{data.requester?.fullName ?? '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Target / Host</p>
                <p className="text-sm font-medium">{data.targetUser?.fullName ?? '—'}</p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <p className="text-sm font-semibold">Appointment Details</p>
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Type" value={data.appointmentType} />
              <InfoRow label="Location" value={calendar.confirmedLocationText} />
              <InfoRow label="Preferred Start" value={fmt(data.preferredStartAt)} />
              <InfoRow label="Preferred End" value={fmt(data.preferredEndAt)} />
              {calendar.confirmedStartAt && (
                <>
                  <InfoRow label="Confirmed Start" value={fmt(calendar.confirmedStartAt)} />
                  <InfoRow label="Confirmed End" value={fmt(calendar.confirmedEndAt)} />
                </>
              )}
            </div>
            {data.details && (
              <div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                <p className="text-sm text-muted-foreground">{data.details}</p>
              </div>
            )}
          </div>

          {isWaitingManager && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-2">
                <ShieldCheck className="size-4" /> Awaiting Resource Manager Approval
              </p>
              <p className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-1">
                The target user has confirmed. As a Resource Manager you can give the final approval or decline.
              </p>
            </div>
          )}

          {data.actualAppointment && (
            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-2">Confirmed Appointment</p>
              <div className="grid grid-cols-2 gap-3">
                <InfoRow label="Start" value={fmt(data.actualAppointment.startAt)} />
                <InfoRow label="End" value={fmt(data.actualAppointment.endAt)} />
                {data.actualAppointment.locationText && (
                  <InfoRow label="Location" value={data.actualAppointment.locationText} />
                )}
              </div>
            </div>
          )}

          {data.statusHistory?.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-5">
              <p className="text-sm font-semibold mb-4">Status History</p>
              <RequestTimeline events={data.statusHistory} />
            </div>
          )}
        </div>

        {canManagerAct && (
          <div className="lg:col-span-2">
            {!showDecline ? (
              <div className="bg-card border border-border rounded-lg p-5 space-y-4">
                <p className="text-sm font-semibold">Manager Decision</p>
                <p className="text-xs text-muted-foreground">
                  Approving will create the appointment for {fmt(confirmedStart)} – {fmt(confirmedEnd)}.
                </p>
                <div className="space-y-1.5">
                  <Label>Note (optional)</Label>
                  <Textarea
                    className="resize-none min-h-[70px]"
                    placeholder="Add a note for the requester and host."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={isProcessing}
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={handleApprove}
                    disabled={isProcessing}
                  >
                    {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 gap-2 border-destructive text-destructive hover:bg-destructive/10"
                    onClick={() => setShowDecline(true)}
                    disabled={isProcessing}
                  >
                    <XCircle className="size-4" /> Decline
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-lg p-5 space-y-4">
                <p className="text-sm font-semibold">Decline Appointment</p>
                <div className="space-y-1.5">
                  <Label>Reason <span className="text-destructive">*</span></Label>
                  <Textarea
                    className="resize-none min-h-[80px]"
                    placeholder="Explain why this appointment cannot proceed."
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    disabled={isProcessing}
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    className="flex-1 gap-2 bg-destructive hover:bg-destructive/90 text-white"
                    onClick={handleDecline}
                    disabled={isProcessing}
                  >
                    {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
                    Decline
                  </Button>
                  <Button variant="outline" onClick={() => setShowDecline(false)} disabled={isProcessing}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
