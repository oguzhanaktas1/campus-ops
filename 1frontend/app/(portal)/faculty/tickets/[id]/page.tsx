'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { RequestTimeline } from '@/components/request-timeline'
import { ArrowLeft, Loader2, AlertTriangle, Ticket as TicketIcon, Monitor, User } from 'lucide-react'
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

export default function FacultyTicketDetailPage() {
  const { id } = useParams() as { id: string }
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    fetch(`${BACKEND}/it-tickets/${id}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [id])

  if (isLoading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>
  if (!data) return (
    <div className="p-6 max-w-3xl mx-auto flex flex-col items-center py-16">
      <AlertTriangle className="size-8 text-muted-foreground/40 mb-3" />
      <p className="text-sm font-medium">Ticket not found</p>
      <Link href="/faculty/tickets"><Button variant="outline" size="sm" className="mt-3">Back</Button></Link>
    </div>
  )

  const t = data.ticket

  return (
    <div className="p-6 space-y-5 max-w-3xl mx-auto pb-20">
      <Link href="/faculty/tickets"><Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="size-4" /> Back</Button></Link>

      <div className="bg-card border border-border rounded-lg p-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
            <TicketIcon className="size-5 text-amber-700 dark:text-amber-300" />
          </div>
          <div>
            <h1 className="text-lg font-bold">{data.title}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{data.requestNo} · Submitted {fmt(data.createdAt)}</p>
          </div>
        </div>
        <StatusBadge status={data.status} />
      </div>

      {data.requester && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-3">
          <p className="text-sm font-semibold flex items-center gap-2"><User className="size-4 text-muted-foreground" /> Submitted By</p>
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
        <p className="text-sm font-semibold flex items-center gap-2"><Monitor className="size-4 text-muted-foreground" /> Ticket Details</p>
        <div className="grid grid-cols-2 gap-4">
          <InfoRow label="Category" value={t?.category} />
          {t?.subcategory && <InfoRow label="Subcategory" value={t.subcategory} />}
          {t?.affectedSystem && <InfoRow label="Affected System" value={t.affectedSystem} />}
          {t?.locationText && <InfoRow label="Location" value={t.locationText} />}
          <InfoRow label="Ticket Status" value={t?.ticketStatus?.replace(/_/g, ' ')} />
          {t?.assignedTo && <InfoRow label="Assigned To" value={t.assignedTo.fullName} />}
        </div>
        {t?.resolutionSummary && (
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Resolution</p>
            <p className="text-sm text-muted-foreground">{t.resolutionSummary}</p>
          </div>
        )}
      </div>

      {data.description && (
        <div className="bg-card border border-border rounded-lg p-5">
          <p className="text-sm font-semibold mb-2">Description</p>
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
  )
}
