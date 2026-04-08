'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { ArrowLeft, FileText, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react'
import Link from 'next/link'
import { getToken } from '@/lib/auth'
import { toast } from 'sonner'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

function formatDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function StaffDocumentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [doc, setDoc] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [action, setAction] = useState<'review' | 'approve' | 'reject' | null>(null)
  const [note, setNote] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  async function load() {
    try {
      const res = await fetch(`${BACKEND}/document-requests/${id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) setDoc(await res.json())
      else toast.error('Failed to load document request.')
    } catch {
      toast.error('Failed to load document request.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { void load() }, [id])

  async function handleProcess(status: string) {
    setIsProcessing(true)
    try {
      const res = await fetch(`${BACKEND}/document-requests/${id}/process`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ status, note: note.trim() || undefined }),
      })
      if (!res.ok) throw new Error('Failed to update status.')
      toast.success(`Status updated to ${status}.`)
      setAction(null)
      setNote('')
      await load()
    } catch {
      toast.error('Failed to update status.')
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

  if (!doc) {
    return (
      <div className="p-6 text-center text-muted-foreground">Document request not found.</div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/staff/documents">
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-foreground">{doc.title}</h1>
            <span className="font-mono text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
              {doc.requestNo}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">Document request details</p>
        </div>
        <StatusBadge status={doc.status} />
      </div>

      {/* Document Info */}
      <div className="bg-card border border-border rounded-lg shadow-sm divide-y divide-border">
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <FileText className="size-4 text-primary" /> Document Details
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: 'Document Type', value: doc.documentType?.replace(/_/g, ' ') },
              { label: 'Language', value: doc.language ?? '—' },
              { label: 'Copies', value: doc.copiesCount ?? 1 },
              { label: 'Delivery Method', value: doc.deliveryMethod },
              { label: 'Delivery Address', value: doc.deliveryAddress ?? '—' },
              { label: 'Submitted', value: formatDate(doc.submittedAt ?? doc.createdAt) },
              { label: 'Issued At', value: doc.issuedAt ? formatDate(doc.issuedAt) : '—' },
            ].map((f) => (
              <div key={f.label}>
                <p className="text-xs text-muted-foreground">{f.label}</p>
                <p className="text-sm font-medium text-foreground mt-0.5">{f.value}</p>
              </div>
            ))}
          </div>
          {doc.description && (
            <div className="mt-4">
              <p className="text-xs text-muted-foreground">Notes</p>
              <p className="text-sm text-foreground mt-0.5">{doc.description}</p>
            </div>
          )}
        </div>

        {/* Requester */}
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Requester</h2>
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
              {doc.requester?.fullName?.charAt(0) ?? 'U'}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{doc.requester?.fullName ?? '—'}</p>
              <p className="text-xs text-muted-foreground">
                {[doc.requester?.faculty, doc.requester?.department].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Status History */}
        {doc.statusHistory?.length > 0 && (
          <div className="px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" /> Status History
            </h2>
            <div className="space-y-2">
              {doc.statusHistory.map((h: any) => (
                <div key={h.id} className="flex items-start gap-3 text-sm">
                  <StatusBadge status={h.status} />
                  <div className="min-w-0">
                    {h.note && <p className="text-muted-foreground text-xs">{h.note}</p>}
                    <p className="text-xs text-muted-foreground/60">{formatDate(h.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {!['COMPLETED', 'CANCELLED', 'REJECTED'].includes(doc.status) && (
        <div className="bg-card border border-border rounded-lg shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Process Request</h2>

          {action && (
            <div className="space-y-2">
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note (optional)..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {doc.status === 'SUBMITTED' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => action === 'review' ? handleProcess('IN_REVIEW') : setAction('review')}
                disabled={isProcessing}
              >
                {isProcessing && action === 'review' ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
                Mark as In Review
              </Button>
            )}
            <Button
              size="sm"
              className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
              onClick={() => action === 'approve' ? handleProcess('COMPLETED') : setAction('approve')}
              disabled={isProcessing}
            >
              {isProcessing && action === 'approve' ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CheckCircle className="size-3.5" />
              )}
              {action === 'approve' ? 'Confirm Issue' : 'Mark as Issued'}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="gap-1.5"
              onClick={() => action === 'reject' ? handleProcess('REJECTED') : setAction('reject')}
              disabled={isProcessing}
            >
              {isProcessing && action === 'reject' ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <XCircle className="size-3.5" />
              )}
              {action === 'reject' ? 'Confirm Reject' : 'Reject'}
            </Button>
            {action && (
              <Button size="sm" variant="ghost" onClick={() => { setAction(null); setNote('') }}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
