'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingCart, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

const STATUS_BADGE: Record<string, string> = {
  SUBMITTED:    'bg-blue-50 text-blue-700 border-blue-200',
  IN_REVIEW:    'bg-yellow-50 text-yellow-700 border-yellow-200',
  APPROVED:     'bg-green-50 text-green-700 border-green-200',
  REJECTED:     'bg-red-50 text-red-700 border-red-200',
  IN_PROGRESS:  'bg-purple-50 text-purple-700 border-purple-200',
  COMPLETED:    'bg-gray-50 text-gray-500 border-gray-200',
}

export default function StaffProcurementPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [requests, setRequests] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const fetchRequests = useCallback(async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const res = await fetch(`${backendUrl}/procurement`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) setRequests(await res.json())
    } catch {
      toast.error(t('pages.procurementLoadFail'))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  const filtered = filter === 'all' ? requests : requests.filter((r) => r.status === filter)

  if (isLoading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><ShoppingCart className="size-5 text-primary" /> {t('pages.procurementRequests')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('pages.procurementSubtitle')}</p>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED'].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={cn('text-xs px-3 py-1.5 rounded-full border font-semibold transition-colors',
              filter === s ? 'bg-foreground text-background border-foreground' : 'bg-background text-muted-foreground border-border hover:border-foreground')}>
            {s === 'all' ? t('common.all') : s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center text-center opacity-50">
            <AlertCircle className="size-10 mb-3" />
            <p className="text-sm font-medium">{t('pages.noProcurement')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('pages.requestNumber')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('pages.item')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">{t('common.requester')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">{t('pages.estTotal')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('common.status')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => router.push(`/staff/requests/procurement/${r.id}`)}
                    className="hover:bg-muted/20 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 font-mono text-xs">{r.requestNo}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium truncate max-w-[180px]">{r.itemName}</p>
                      <p className="text-xs text-muted-foreground">{r.itemCategory} · qty {r.quantity}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">{r.requesterName}</td>
                    <td className="px-4 py-3 text-xs hidden md:table-cell">
                      {r.totalEstimate ? `$${Number(r.totalEstimate).toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', STATUS_BADGE[r.status] ?? STATUS_BADGE.SUBMITTED)}>
                        {r.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-primary font-medium">{t('common.view')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
