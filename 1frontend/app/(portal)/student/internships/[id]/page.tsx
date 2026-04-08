'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { RequestTimeline } from '@/components/request-timeline'
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Building2,
  Calendar,
  Briefcase,
  User,
} from 'lucide-react'
import { getToken } from '@/lib/auth'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

function formatDate(d: string | Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm text-foreground">{value || '—'}</p>
    </div>
  )
}

export default function StudentInternshipDetailPage() {
  const params = useParams()
  const id = params?.id as string

  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    fetch(`${BACKEND}/student/internships/${id}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {})
      .finally(() => setIsLoading(false))
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
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex flex-col items-center py-16 text-center">
          <AlertTriangle className="size-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-foreground">Internship not found</p>
          <Link href="/student/internships" className="mt-3">
            <Button variant="outline" size="sm">Back to internships</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5 max-w-3xl mx-auto pb-20">
      <div className="flex items-center gap-3">
        <Link href="/student/internships">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="size-4" /> Back
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="bg-card border border-border rounded-lg p-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
            <Briefcase className="size-5 text-amber-700 dark:text-amber-300" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">{data.title}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.requestNo} · Submitted {formatDate(data.createdAt)}
            </p>
          </div>
        </div>
        <StatusBadge status={data.status} />
      </div>

      {/* Company info */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Building2 className="size-4 text-muted-foreground" /> Company Details
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <InfoRow label="Company" value={data.companyName} />
          <InfoRow label="Sector" value={data.companySector} />
          <InfoRow label="Contact" value={data.companyContactName} />
          <InfoRow label="Contact Email" value={data.companyContactEmail} />
        </div>
      </div>

      {/* Internship details */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Calendar className="size-4 text-muted-foreground" /> Internship Details
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <InfoRow label="Type" value={data.internshipType} />
          <InfoRow label="Work Mode" value={data.workMode} />
          <InfoRow label="Start Date" value={formatDate(data.startDate)} />
          <InfoRow label="End Date" value={formatDate(data.endDate)} />
          <InfoRow label="Duration" value={data.durationDays ? `${data.durationDays} days` : null} />
          <InfoRow label="Insurance" value={data.insuranceRequired ? 'Required' : 'Not Required'} />
          {data.term && <InfoRow label="Academic Term" value={data.term.name} />}
        </div>
      </div>

      {/* Advisor */}
      {data.advisor && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <User className="size-4 text-muted-foreground" /> Faculty Advisor
          </p>
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
              {data.advisor.fullName?.charAt(0) ?? 'A'}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{data.advisor.fullName}</p>
              {data.advisor.title && (
                <p className="text-xs text-muted-foreground">{data.advisor.title}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Advisor notes */}
      {(data.currentStageNote || data.finalDecisionNote) && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground">Advisor Notes</p>
          {data.currentStageNote && (
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Current Stage Note</p>
              <p className="text-sm text-muted-foreground">{data.currentStageNote}</p>
            </div>
          )}
          {data.finalDecisionNote && (
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Decision Note</p>
              <p className="text-sm text-muted-foreground">{data.finalDecisionNote}</p>
            </div>
          )}
        </div>
      )}

      {/* Comments */}
      {data.comments?.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground">Comments</p>
          {data.comments.map((c: any) => (
            <div key={c.id} className="border-l-2 border-border pl-3">
              <p className="text-xs font-medium text-foreground">{c.author}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{c.content}</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                {formatDate(c.createdAt)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      {data.timeline?.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-5">
          <p className="text-sm font-semibold text-foreground mb-4">Status History</p>
          <RequestTimeline events={data.timeline} />
        </div>
      )}
    </div>
  )
}
