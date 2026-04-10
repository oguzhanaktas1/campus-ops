'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { StatusBadge } from '@/components/status-badge'
import { RequestTimeline } from '@/components/request-timeline'
import {
  ArrowLeft, Loader2, AlertTriangle, FileText,
  User, CheckCircle2, XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

function fmt(d: any) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm text-foreground">{value || '—'}</p>
    </div>
  )
}

const TERMINAL = ['APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED', 'ISSUED']

export default function FacultyDocumentDetailPage() {
  const { id } = useParams() as { id: string }
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [note, setNote] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    if (!id) return
    fetch(`${BACKEND}/document-requests/${id}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [id])

  const handleProcess = async (newStatus: 'APPROVED' | 'REJECTED') => {
    if (newStatus === 'REJECTED' && !rejectReason.trim()) { toast.error('Rejection reason required.'); return }
    setIsProcessing(true)
    try {
      const res = await fetch(`${BACKEND}/document-requests/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ status: newStatus, note: newStatus === 'REJECTED' ? rejectReason.trim() : note.trim() || undefined }),
      })
      if (res.ok) {
        toast.success(newStatus === 'APPROVED' ? 'Document request approved.' : 'Document request rejected.')
        setData((prev: any) => ({ ...prev, status: newStatus }))
        setShowReject(false)
      } else {
        const err = await res.json().catch(() => ({})) as { message?: string }
        toast.error(err.message ?? 'Failed.')
      }
    } catch { toast.error('Network error.') }
    finally { setIsProcessing(false) }
  }

  if (isLoading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>
  if (!data) return (
    <div className="p-6 max-w-3xl mx-auto flex flex-col items-center py-16">
      <AlertTriangle className="size-8 text-muted-foreground/40 mb-3" />
      <p className="text-sm font-medium">Request not found</p>
      <Link href="/faculty/documents"><Button variant="outline" size="sm" className="mt-3">Back</Button></Link>
    </div>
  )

  const canAct = !TERMINAL.includes(data.status)

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto pb-20">
      <Link href="/faculty/documents"><Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="size-4" /> Back</Button></Link>

      <div className="bg-card border border-border rounded-lg p-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
            <FileText className="size-5 text-blue-700 dark:text-blue-300" />
          </div>
          <div>
            <h1 className="text-lg font-bold">{data.title || data.documentType}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{data.requestNo} · Submitted {fmt(data.createdAt)}</p>
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
                  <p className="text-xs text-muted-foreground">{[data.requester?.faculty, data.requester?.department].filter(Boolean).join(' · ')}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <p className="text-sm font-semibold">Document Details</p>
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Document Type" value={data.documentType} />
              <InfoRow label="Language" value={data.language} />
              <InfoRow label="Copies" value={data.copiesCount?.toString()} />
              <InfoRow label="Delivery Method" value={data.deliveryMethod} />
              {data.deliveryAddress && <InfoRow label="Delivery Address" value={data.deliveryAddress} />}
              {data.issuedAt && <InfoRow label="Issued At" value={fmt(data.issuedAt)} />}
            </div>
          </div>

          {data.description && (
            <div className="bg-card border border-border rounded-lg p-5">
              <p className="text-sm font-semibold mb-2">Notes</p>
              <p className="text-sm text-muted-foreground">{data.description}</p>
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
            {!showReject ? (
              <div className="bg-card border border-border rounded-lg p-5 space-y-4">
                <p className="text-sm font-semibold">Process Request</p>
                <div className="space-y-1.5">
                  <Label>Note (optional)</Label>
                  <Textarea className="resize-none min-h-[80px]" placeholder="Add a processing note..." value={note} onChange={(e) => setNote(e.target.value)} disabled={isProcessing} />
                </div>
                <div className="flex gap-3">
                  <Button className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleProcess('APPROVED')} disabled={isProcessing}>
                    {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Approve
                  </Button>
                  <Button variant="outline" className="flex-1 gap-2 border-destructive text-destructive hover:bg-destructive/10" onClick={() => setShowReject(true)} disabled={isProcessing}>
                    <XCircle className="size-4" /> Reject
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-lg p-5 space-y-4">
                <p className="text-sm font-semibold">Reject Request</p>
                <div className="space-y-1.5">
                  <Label>Reason <span className="text-destructive">*</span></Label>
                  <Textarea className="resize-none min-h-[80px]" placeholder="Explain why..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} disabled={isProcessing} />
                </div>
                <div className="flex gap-3">
                  <Button className="flex-1 gap-2 bg-destructive hover:bg-destructive/90 text-white" onClick={() => handleProcess('REJECTED')} disabled={isProcessing}>
                    {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />} Confirm
                  </Button>
                  <Button variant="outline" onClick={() => setShowReject(false)} disabled={isProcessing}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
