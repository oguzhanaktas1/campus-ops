'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge } from '@/components/status-badge'
import { RequestTimeline } from '@/components/request-timeline'
import {
  ArrowLeft, Loader2, AlertTriangle, ShoppingCart,
  User, CheckCircle2, XCircle, RotateCcw, Lock,
} from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

type ActionType = 'approve' | 'reject' | 'revision'
const TERMINAL = ['APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED']

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

export default function FacultyProcurementDetailPage() {
  const { id } = useParams() as { id: string }
  const { t } = useI18n()
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [comment, setComment] = useState('')
  const [doneAction, setDoneAction] = useState<ActionType | null>(null)

  useEffect(() => {
    if (!id) return
    fetch(`${BACKEND}/procurement-requests/${id}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [id])

  const handleAction = async (action: ActionType) => {
    if ((action === 'reject' || action === 'revision') && !comment.trim()) {
      toast.error(t('detail.commentRequiredToAction', { action }))
      return
    }
    setIsProcessing(true)
    try {
      const res = await fetch(`${BACKEND}/faculty/requests/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ action, comment: comment.trim() || undefined }),
      })
      if (res.ok) {
        toast.success(action === 'approve' ? t('detail.approvedToast') : action === 'reject' ? t('detail.rejectedToast') : t('detail.revisionRequested'))
        setDoneAction(action)
        setData((prev: any) => ({
          ...prev,
          status: action === 'approve' ? 'APPROVED' : action === 'reject' ? 'REJECTED' : 'REVISION_REQUESTED',
        }))
        setComment('')
      } else {
        const err = await res.json().catch(() => ({})) as { message?: string }
        toast.error(err.message ?? t('detail.failed'))
      }
    } catch { toast.error(t('detail.networkError')) }
    finally { setIsProcessing(false) }
  }

  if (isLoading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>
  if (!data) return (
    <div className="p-6 max-w-3xl mx-auto flex flex-col items-center py-16">
      <AlertTriangle className="size-8 text-muted-foreground/40 mb-3" />
      <p className="text-sm font-medium">{t('detail.requestNotFound')}</p>
      <Link href="/faculty/procurement"><Button variant="outline" size="sm" className="mt-3">{t('common.back')}</Button></Link>
    </div>
  )

  const pr = data.procurementRequest ?? data
  const isTerminal = TERMINAL.includes(data.status) || !!doneAction

  return (
    <div className="p-6 space-y-5 max-w-3xl mx-auto pb-20">
      <Link href="/faculty/procurement"><Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="size-4" /> {t('common.back')}</Button></Link>

      <div className="bg-card border border-border rounded-lg p-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
            <ShoppingCart className="size-5 text-green-700 dark:text-green-300" />
          </div>
          <div>
            <h1 className="text-lg font-bold">{data.title}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{data.requestNo} · {t('detail.submitted')} {fmt(data.createdAt)}</p>
          </div>
        </div>
        <StatusBadge status={data.status} />
      </div>

      {data.requester && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-3">
          <p className="text-sm font-semibold flex items-center gap-2"><User className="size-4 text-muted-foreground" /> {t('detail.requester')}</p>
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
        <p className="text-sm font-semibold">{t('detail.procurementDetails')}</p>
        <div className="grid grid-cols-2 gap-4">
          <InfoRow label={t('detail.itemName')} value={pr.itemName} />
          <InfoRow label={t('detail.category')} value={pr.category} />
          <InfoRow label={t('detail.quantity')} value={pr.quantity?.toString()} />
          <InfoRow label={t('detail.unitPrice')} value={pr.unitPrice ? `$${pr.unitPrice}` : null} />
          <InfoRow label={t('detail.totalBudget')} value={pr.totalBudget ? `$${pr.totalBudget}` : null} />
          <InfoRow label={t('detail.vendor')} value={pr.preferredVendor} />
          <InfoRow label={t('detail.requiredBy')} value={fmt(pr.requiredByDate)} />
          <InfoRow label={t('detail.priority')} value={data.priority} />
        </div>
        {pr.justification && <div><p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{t('detail.justification')}</p><p className="text-sm text-muted-foreground">{pr.justification}</p></div>}
      </div>

      {isTerminal ? (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 p-6 rounded-lg flex flex-col items-center text-center gap-3">
          <Lock className="size-7 text-emerald-600" />
          <p className="text-sm font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">{t('detail.actionRecorded')}</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg p-5 shadow-sm space-y-4">
          <p className="text-sm font-semibold">{t('detail.facultyDecision')}</p>
          <Textarea
            placeholder={t('detail.reasoningPlaceholder')}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="resize-none min-h-[100px]"
            disabled={isProcessing}
          />
          <div className="flex gap-3 flex-wrap">
            <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white flex-1 sm:flex-none" disabled={isProcessing} onClick={() => handleAction('approve')}>
              {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} {t('common.approve')}
            </Button>
            <Button variant="destructive" className="gap-2 flex-1 sm:flex-none" disabled={isProcessing} onClick={() => handleAction('reject')}>
              {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />} {t('common.reject')}
            </Button>
            <Button variant="outline" className="gap-2 flex-1 sm:flex-none border-amber-200 text-amber-700 hover:bg-amber-50" disabled={isProcessing} onClick={() => handleAction('revision')}>
              {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} {t('approvals.revisionBtn')}
            </Button>
          </div>
        </div>
      )}

      {data.statusHistory?.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-5">
          <p className="text-sm font-semibold mb-4">{t('detail.statusHistory')}</p>
          <RequestTimeline events={data.statusHistory} />
        </div>
      )}
    </div>
  )
}
