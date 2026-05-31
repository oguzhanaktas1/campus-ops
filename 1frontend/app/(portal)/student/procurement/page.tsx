'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { ShoppingCart, PlusCircle, Loader2, AlertCircle } from 'lucide-react'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { formatStudentDate } from '@/lib/student-i18n-utils'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

function formatCurrency(value: number | string | null | undefined, locale: 'tr' | 'en') {
  if (value === null || value === undefined) return '-'
  const amount = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(amount)) return '-'
  return new Intl.NumberFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function StudentProcurementPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { locale, t } = useI18n()

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${BACKEND}/procurement`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (res.ok) setRequests(await res.json())
      } catch {
        setRequests([])
      } finally {
        setIsLoading(false)
      }
    }
    void load()
  }, [])

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5 pb-20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('pages.procurementTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('pages.procurementSubtitle')}</p>
        </div>
        <Link href="/student/procurement/new" className="shrink-0">
          <Button size="sm" className="gap-1.5">
            <PlusCircle className="size-3.5" />
            {t('common.newRequest')}
          </Button>
        </Link>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <AlertCircle className="size-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">{t('pages.noProcurement')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('pages.noProcurementDesc')}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {requests.map((request) => (
              <Link
                key={request.id}
                href={`/student/requests/${request.id}`}
                className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {request.itemName || request.title}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                    {request.requestNo && <span className="font-mono">{request.requestNo}</span>}
                    {(request.itemCategory || 'General') && <span>{request.itemCategory || 'General'}</span>}
                    {request.quantity && <span>Qty {request.quantity}</span>}
                    {request.totalEstimate != null && <span>{formatCurrency(request.totalEstimate, locale)}</span>}
                    {request.createdAt && <span>{formatStudentDate(request.createdAt, locale)}</span>}
                  </div>
                </div>
                <StatusBadge status={request.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
