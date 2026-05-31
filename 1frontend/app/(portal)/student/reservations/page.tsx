'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { BookMarked, PlusCircle, Clock, MapPin, Loader2, AlertCircle } from 'lucide-react'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { formatStudentDate, formatStudentTime } from '@/lib/student-i18n-utils'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

export default function StudentReservationsPage() {
  const [reservations, setReservations] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { locale, t } = useI18n()

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch(`${BACKEND}/room-reservation-requests/my`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (res.ok) setReservations(await res.json())
      } catch {
        // silent
      } finally {
        setIsLoading(false)
      }
    }
    void fetch_()
  }, [])

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5 pb-20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('pages.reservationsTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('pages.reservationsSubtitle')}</p>
        </div>
        <Link href="/student/reservations/new" className="shrink-0">
          <Button size="sm" className="gap-1.5">
            <PlusCircle className="size-3.5" />
            {t('pages.reserveRoom')}
          </Button>
        </Link>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : reservations.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <AlertCircle className="size-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">{t('pages.noActiveReservations')}</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">{t('pages.reserveARoom')}</p>
            <Link href="/student/reservations/new">
              <Button variant="outline" size="sm">{t('pages.reserveRoom')}</Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {reservations.map((r) => (
              <Link
                key={r.id}
                href={`/student/requests/${r.id}`}
                className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{r.eventName ?? r.title}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                    {r.requestNo && <span className="font-mono">{r.requestNo}</span>}
                    {r.startAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatStudentDate(r.startAt, locale)} · {formatStudentTime(r.startAt, locale)}–{formatStudentTime(r.endAt, locale)}
                      </span>
                    )}
                    {r.resource?.name && (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" />
                        {r.resource.name}
                      </span>
                    )}
                  </div>
                </div>
                <StatusBadge status={r.reservationStatus ?? r.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
