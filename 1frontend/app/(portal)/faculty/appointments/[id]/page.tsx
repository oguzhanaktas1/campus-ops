'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/status-badge'
import { RequestTimeline } from '@/components/request-timeline'
import {
  ArrowLeft, Loader2, AlertTriangle, CalendarDays,
  User, CheckCircle2, XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

function fmt(d: any) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm text-foreground">{value || '—'}</p>
    </div>
  )
}

export default function FacultyAppointmentDetailPage() {
  const { id } = useParams() as { id: string }
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [confirmState, setConfirmState] = useState({ startAt: '', endAt: '', locationText: '', note: '' })
  const [declineReason, setDeclineReason] = useState('')
  const [showDecline, setShowDecline] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`${BACKEND}/appointment-requests/${id}`, { headers: { Authorization: `Bearer ${getToken()}` } })
    if (res.ok) {
      const d = await res.json()
      setData(d)
      setConfirmState({
        startAt: d.preferredStartAt ? new Date(d.preferredStartAt).toISOString().slice(0, 16) : '',
        endAt: d.preferredEndAt ? new Date(d.preferredEndAt).toISOString().slice(0, 16) : '',
        locationText: '',
        note: '',
      })
    }
    setIsLoading(false)
  }, [id])

  useEffect(() => { void load() }, [load])

  const handleConfirm = async () => {
    if (!confirmState.startAt || !confirmState.endAt) { toast.error('Start and end times are required.'); return }
    setIsProcessing(true)
    try {
      const res = await fetch(`${BACKEND}/appointment-requests/${id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          confirmedStartAt: confirmState.startAt,
          confirmedEndAt: confirmState.endAt,
          locationText: confirmState.locationText || undefined,
          note: confirmState.note || undefined,
        }),
      })
      if (res.ok) { toast.success('Appointment confirmed.'); await load() }
      else {
        const err = await res.json().catch(() => ({})) as { message?: string }
        toast.error(err.message ?? 'Failed to confirm.')
      }
    } catch { toast.error('Network error.') }
    finally { setIsProcessing(false) }
  }

  const handleDecline = async () => {
    if (!declineReason.trim()) { toast.error('Reason required.'); return }
    setIsProcessing(true)
    try {
      const res = await fetch(`${BACKEND}/appointment-requests/${id}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ reason: declineReason.trim() }),
      })
      if (res.ok) { toast.success('Appointment declined.'); setShowDecline(false); await load() }
      else {
        const err = await res.json().catch(() => ({})) as { message?: string }
        toast.error(err.message ?? 'Failed to decline.')
      }
    } catch { toast.error('Network error.') }
    finally { setIsProcessing(false) }
  }

  if (isLoading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>
  if (!data) return (
    <div className="p-6 max-w-3xl mx-auto flex flex-col items-center py-16">
      <AlertTriangle className="size-8 text-muted-foreground/40 mb-3" />
      <p className="text-sm font-medium">Request not found</p>
      <Link href="/faculty/appointments"><Button variant="outline" size="sm" className="mt-3">Back</Button></Link>
    </div>
  )

  const canAct = ['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL'].includes(data.status)

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto pb-20">
      <Link href="/faculty/appointments"><Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="size-4" /> Back</Button></Link>

      <div className="bg-card border border-border rounded-lg p-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
            <CalendarDays className="size-5 text-emerald-700 dark:text-emerald-300" />
          </div>
          <div>
            <h1 className="text-lg font-bold">{data.topic}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{data.requestNo} · {fmt(data.preferredStartAt)}</p>
          </div>
        </div>
        <StatusBadge status={data.status} />
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 space-y-5">
          {data.requester && (
            <div className="bg-card border border-border rounded-lg p-5 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2"><User className="size-4 text-muted-foreground" /> Requester</p>
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                  {data.requester?.fullName?.charAt(0) ?? 'R'}
                </div>
                <div>
                  <p className="text-sm font-medium">{data.requester?.fullName}</p>
                  <p className="text-xs text-muted-foreground">{data.requester?.email}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <p className="text-sm font-semibold">Appointment Details</p>
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Type" value={data.appointmentType} />
              <InfoRow label="Preferred Start" value={fmt(data.preferredStartAt)} />
              <InfoRow label="Preferred End" value={fmt(data.preferredEndAt)} />
            </div>
            {data.details && <div><p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Details</p><p className="text-sm text-muted-foreground">{data.details}</p></div>}
          </div>

          {data.actualAppointment && (
            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-2">Confirmed Appointment</p>
              <div className="grid grid-cols-2 gap-3">
                <InfoRow label="Start" value={fmt(data.actualAppointment.startAt)} />
                <InfoRow label="End" value={fmt(data.actualAppointment.endAt)} />
                {data.actualAppointment.locationText && <InfoRow label="Location" value={data.actualAppointment.locationText} />}
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

        {canAct && (
          <div className="lg:col-span-2">
            {!showDecline ? (
              <div className="bg-card border border-border rounded-lg p-5 space-y-4">
                <p className="text-sm font-semibold">Confirm Appointment</p>
                <div className="space-y-1.5">
                  <Label>Confirmed Start</Label>
                  <Input type="datetime-local" value={confirmState.startAt} onChange={(e) => setConfirmState((p) => ({ ...p, startAt: e.target.value }))} disabled={isProcessing} />
                </div>
                <div className="space-y-1.5">
                  <Label>Confirmed End</Label>
                  <Input type="datetime-local" value={confirmState.endAt} onChange={(e) => setConfirmState((p) => ({ ...p, endAt: e.target.value }))} disabled={isProcessing} />
                </div>
                <div className="space-y-1.5">
                  <Label>Location (optional)</Label>
                  <Input placeholder="e.g. Office 204" value={confirmState.locationText} onChange={(e) => setConfirmState((p) => ({ ...p, locationText: e.target.value }))} disabled={isProcessing} />
                </div>
                <div className="space-y-1.5">
                  <Label>Note (optional)</Label>
                  <Textarea className="resize-none min-h-[70px]" value={confirmState.note} onChange={(e) => setConfirmState((p) => ({ ...p, note: e.target.value }))} disabled={isProcessing} />
                </div>
                <div className="flex gap-3">
                  <Button className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleConfirm} disabled={isProcessing}>
                    {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Confirm
                  </Button>
                  <Button variant="outline" className="flex-1 gap-2 border-destructive text-destructive hover:bg-destructive/10" onClick={() => setShowDecline(true)} disabled={isProcessing}>
                    <XCircle className="size-4" /> Decline
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-lg p-5 space-y-4">
                <p className="text-sm font-semibold">Decline Request</p>
                <div className="space-y-1.5">
                  <Label>Reason <span className="text-destructive">*</span></Label>
                  <Textarea className="resize-none min-h-[80px]" placeholder="Explain why..." value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} disabled={isProcessing} />
                </div>
                <div className="flex gap-3">
                  <Button className="flex-1 gap-2 bg-destructive hover:bg-destructive/90 text-white" onClick={handleDecline} disabled={isProcessing}>
                    {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />} Decline
                  </Button>
                  <Button variant="outline" onClick={() => setShowDecline(false)} disabled={isProcessing}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
