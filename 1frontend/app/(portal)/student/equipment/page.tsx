'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Package, PlusCircle, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { formatStudentDate, formatStudentTimeAgo } from '@/lib/student-i18n-utils'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

export default function StudentEquipmentPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { locale, t } = useI18n()

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const res = await fetch(`${BACKEND}/equipment-requests/my`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (res.ok) setRequests(await res.json())
      } catch {
        toast.error(t('messages.loadEquipmentFail'))
      } finally {
        setIsLoading(false)
      }
    }
    fetchRequests()
  }, [])

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5 pb-20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('pages.equipmentTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('pages.equipmentSubtitle')}</p>
        </div>
        <Link href="/student/equipment/new" className="shrink-0">
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
            <p className="text-sm font-medium text-foreground">{t('pages.noEquipment')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('pages.noEquipmentDesc')}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {requests.map((r) => (
              <Link
                key={r.equipmentRequestId ?? r.id}
                href={`/student/requests/${r.id}`}
                className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{r.equipmentName}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                    {r.requestNo && <span className="font-mono">{r.requestNo}</span>}
                    {r.equipmentCategory && <span>{r.equipmentCategory}</span>}
                    {r.quantity && <span>Qty {r.quantity}</span>}
                    {r.neededFrom && <span>{formatStudentDate(r.neededFrom, locale)}</span>}
                    {r.createdAt && <span>{formatStudentTimeAgo(r.createdAt, t)}</span>}
                  </div>
                </div>
                <StatusBadge status={r.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
