'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
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
  CheckCircle2,
  XCircle,
  RotateCcw,
} from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

type ActionType = 'approve' | 'reject' | 'revision' | null

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

const TERMINAL = ['APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED', 'COMPLETED']

export default function FacultyInternshipDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const { t } = useI18n()

  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [comment, setComment] = useState('')
  const [doneAction, setDoneAction] = useState<ActionType>(null)

  useEffect(() => {
    if (!id) return
    fetch(`${BACKEND}/faculty/internships/${id}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [id])

  const handleAction = async (action: NonNullable<ActionType>) => {
    if ((action === 'reject' || action === 'revision') && !comment.trim()) {
      toast.error(t('approvals.revisionNotesPlaceholder'))
      return
    }

    setIsProcessing(true)
    try {
      const res = await fetch(`${BACKEND}/faculty/requests/${id}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ action, comment: comment.trim() || undefined }),
      })

      if (res.ok) {
        const result = await res.json().catch(() => ({}))
        toast.success(
          action === 'approve'
            ? t('approvals.successApprove')
            : action === 'reject'
            ? t('approvals.successReject')
            : t('approvals.successRevision')
        )
        const nextStatus = result.status ?? (action === 'approve' ? 'APPROVED' : action === 'reject' ? 'REJECTED' : 'REVISION_REQUESTED')
        if (TERMINAL.includes(nextStatus)) setDoneAction(action)
        setData((prev: any) => ({
          ...prev,
          status: nextStatus,
          displayStatus: result.nextStep === 'Internship Coordinator Review'
            ? 'COORDINATOR_REVIEW'
            : nextStatus,
          canAct: false,
        }))
        setComment('')
      } else {
        const err = await res.json().catch(() => ({})) as { message?: string }
        toast.error(err.message ?? t('approvals.failApprove'))
      }
    } catch {
      toast.error(t('detail.networkError'))
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
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex flex-col items-center py-16 text-center">
          <AlertTriangle className="size-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-foreground">{t('internships.noInternships')}</p>
          <Link href="/faculty/internships" className="mt-3">
            <Button variant="outline" size="sm">{t('common.back')}</Button>
          </Link>
        </div>
      </div>
    )
  }

  const canAct = data.canAct === true && !TERMINAL.includes(data.status) && !doneAction

  return (
    <div className="p-6 space-y-5 max-w-3xl mx-auto pb-20">
      <div className="flex items-center gap-3">
        <Link href="/faculty/internships">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="size-4" /> {t('common.back')}
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
              {data.requestNo} · {t('common.created')} {formatDate(data.createdAt)}
            </p>
          </div>
        </div>
        <StatusBadge status={data.displayStatus ?? data.status} />
      </div>

      {/* Student info */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-3">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
          <User className="size-4 text-muted-foreground" /> {t('internships.colStudent')}
        </p>
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
            {data.student?.fullName?.charAt(0) ?? 'S'}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{data.student?.fullName}</p>
            <div className="flex gap-2 text-xs text-muted-foreground">
              {data.student?.studentNumber && <span>{data.student.studentNumber}</span>}
              {data.student?.faculty && <span>· {data.student.faculty}</span>}
              {data.student?.department && <span>· {data.student.department}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Company info */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Building2 className="size-4 text-muted-foreground" /> {t('internships.colCompany')}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <InfoRow label={t('internships.colCompany')} value={data.companyName} />
          <InfoRow label={t('detail.sector')} value={data.companySector} />
          <InfoRow label={t('detail.contact')} value={data.companyContactName} />
          <InfoRow label={t('detail.contactEmail')} value={data.companyContactEmail} />
        </div>
      </div>

      {/* Internship details */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Calendar className="size-4 text-muted-foreground" /> {t('internships.title')}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <InfoRow label={t('common.type')} value={data.internshipType} />
          <InfoRow label={t('detail.workMode')} value={data.workMode} />
          <InfoRow label={t('detail.startDate')} value={formatDate(data.startDate)} />
          <InfoRow label={t('detail.endDate')} value={formatDate(data.endDate)} />
          <InfoRow label={t('common.duration')} value={data.durationDays ? `${data.durationDays} days` : null} />
          <InfoRow label={t('detail.insurance')} value={data.insuranceRequired ? t('detail.required') : t('detail.notRequired')} />
        </div>
      </div>

      {/* Action panel */}
      {canAct && (
        <div className="bg-card border border-border rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm font-semibold text-foreground">{t('approvals.title')}</p>
            {!comment.trim() && (
              <p className="text-[10px] text-amber-600 font-medium bg-amber-50 px-2 py-1 rounded">
                {t('approvals.revisionNotesPlaceholder')}
              </p>
            )}
          </div>
          <Textarea
            placeholder={t('approvals.notesPlaceholder')}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="resize-none min-h-[100px]"
            disabled={isProcessing}
          />
          <div className="flex gap-3 flex-wrap">
            <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white flex-1 sm:flex-none" disabled={isProcessing} onClick={() => handleAction('approve')}>
              {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} {t('approvals.approveBtn')}
            </Button>
            <Button variant="destructive" className="gap-2 flex-1 sm:flex-none" disabled={isProcessing} onClick={() => handleAction('reject')}>
              {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />} {t('approvals.rejectBtn')}
            </Button>
            <Button variant="outline" className="gap-2 flex-1 sm:flex-none border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800" disabled={isProcessing} onClick={() => handleAction('revision')}>
              {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} {t('approvals.revisionBtn')}
            </Button>
          </div>
        </div>
      )}

      {/* Comments */}
      {data.comments?.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground">{t('detail.comments')}</p>
          {data.comments.map((c: any) => (
            <div key={c.id} className="border-l-2 border-border pl-3">
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium text-foreground">{c.author}</p>
                {c.authorRole && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground capitalize">{c.authorRole}</span>}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{c.content}</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">{formatDate(c.createdAt)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      {data.timeline?.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-5">
          <p className="text-sm font-semibold text-foreground mb-4">{t('detail.statusHistory')}</p>
          <RequestTimeline events={data.timeline} />
        </div>
      )}
    </div>
  )
}
