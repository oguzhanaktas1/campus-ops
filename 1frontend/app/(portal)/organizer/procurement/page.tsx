'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { ShoppingCart, PlusCircle, Loader2, ReceiptText } from 'lucide-react'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

function formatDate(d: string) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatCurrency(value: number | string | null | undefined) {
  if (value === null || value === undefined) return '-'
  const amount = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(amount)) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function OrganizerProcurementPage() {
  const { t } = useI18n()
  const [requests, setRequests] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

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

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto pb-20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('pages.procurementTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('pages.procurementSubtitle')}
          </p>
        </div>
        <Link href="/organizer/procurement/new">
          <Button size="sm" className="gap-1.5">
            <PlusCircle className="size-3.5" />
            {t('common.newRequest')}
          </Button>
        </Link>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        {requests.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center">
            <ReceiptText className="size-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">
              {t('pages.noProcurement')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('pages.noProcurementDesc')}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {requests.map((request) => (
              <Link
                key={request.id}
                href={`/organizer/requests/${request.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-muted/20 transition-colors"
              >
                <div className="min-w-0 flex items-start gap-3">
                  <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <ShoppingCart className="size-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {request.itemName || request.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {request.requestNo} · {request.itemCategory || 'General'}
                      {request.quantity ? ` · Qty ${request.quantity}` : ''}
                      {request.totalEstimate != null
                        ? ` · ${formatCurrency(request.totalEstimate)}`
                        : ''}
                      {request.createdAt ? ` · ${formatDate(request.createdAt)}` : ''}
                    </p>
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
