'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { RequestTimeline } from '@/components/request-timeline'
import { ArrowLeft, Loader2, AlertTriangle, Package, User } from 'lucide-react'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

function fmt(d: any) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm text-foreground">{value || '-'}</p>
    </div>
  )
}

export default function FacultyEquipmentDetailPage() {
  const { t } = useI18n()
  const { id } = useParams() as { id: string }
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    fetch(`${BACKEND}/faculty/requests/${id}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [id])

  if (isLoading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>
  if (!data) return (
    <div className="p-6 max-w-3xl mx-auto flex flex-col items-center py-16">
      <AlertTriangle className="size-8 text-muted-foreground/40 mb-3" />
      <p className="text-sm font-medium">{t('detail.equipmentNotFound')}</p>
      <Link href="/faculty/equipment"><Button variant="outline" size="sm" className="mt-3">{t('common.back')}</Button></Link>
    </div>
  )

  const eq = data.formData ?? {}

  return (
    <div className="p-6 space-y-5 max-w-3xl mx-auto pb-20">
      <Link href="/faculty/equipment"><Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="size-4" /> {t('common.back')}</Button></Link>

      <div className="bg-card border border-border rounded-lg p-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
            <Package className="size-5 text-amber-700 dark:text-amber-300" />
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
        <p className="text-sm font-semibold flex items-center gap-2"><Package className="size-4 text-muted-foreground" /> {t('detail.equipmentDetails')}</p>
        <div className="grid grid-cols-2 gap-4">
          <InfoRow label={t('detail.equipmentName')} value={eq.equipmentName} />
          <InfoRow label={t('detail.category')} value={eq.equipmentCategory} />
          <InfoRow label={t('detail.quantity')} value={eq.quantity?.toString()} />
          <InfoRow label={t('detail.purpose')} value={eq.purpose} />
          <InfoRow label={t('detail.neededFrom')} value={fmt(eq.neededFrom)} />
          <InfoRow label={t('detail.neededUntil')} value={fmt(eq.neededUntil)} />
          {eq.estimatedCost && <InfoRow label="Est. Cost" value={`$${eq.estimatedCost}`} />}
        </div>
        {eq.urgencyReason && <div><p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{t('detail.urgencyReason')}</p><p className="text-sm text-muted-foreground">{eq.urgencyReason}</p></div>}
      </div>

      {data.description && (
        <div className="bg-card border border-border rounded-lg p-5">
          <p className="text-sm font-semibold mb-2">{t('detail.description')}</p>
          <p className="text-sm text-muted-foreground">{data.description}</p>
        </div>
      )}

      {data.timeline?.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-5">
          <p className="text-sm font-semibold mb-4">{t('detail.statusHistory')}</p>
          <RequestTimeline events={data.timeline} />
        </div>
      )}
    </div>
  )
}
