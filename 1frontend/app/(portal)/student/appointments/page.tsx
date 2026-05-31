'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { Calendar, PlusCircle, Clock, User, Loader2, AlertCircle } from 'lucide-react'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { formatStudentDate, formatStudentTime } from '@/lib/student-i18n-utils'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

export default function StudentAppointmentsPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { locale, t } = useI18n()

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const res = await fetch(`${BACKEND}/appointment-requests/my`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (res.ok) setRequests(await res.json())
      } catch {
        // silent
      } finally {
        setIsLoading(false)
      }
    }
    void fetchRequests()
  }, [])

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5 pb-20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('pages.appointmentsTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('pages.appointmentsSubtitle')}</p>
        </div>
        <Link href="/student/appointments/new" className="shrink-0">
          <Button size="sm" className="gap-1.5">
            <PlusCircle className="size-3.5" />
            {t('pages.bookAppointment')}
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
            <p className="text-sm font-medium text-foreground">{t('pages.noAppointments')}</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">{t('pages.bookOneNow')}</p>
            <Link href="/student/appointments/new">
              <Button variant="outline" size="sm">{t('pages.bookAppointment')}</Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {requests.map((r) => (
              <Link
                key={r.id}
                href={`/student/requests/${r.id}`}
                className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{r.topic}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                    {r.requestNo && <span className="font-mono">{r.requestNo}</span>}
                    {r.appointmentType && <span>{r.appointmentType}</span>}
                    {r.preferredStartAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatStudentDate(r.preferredStartAt, locale)} · {formatStudentTime(r.preferredStartAt, locale)}
                      </span>
                    )}
                    {r.targetUser?.fullName && (
                      <span className="flex items-center gap-1">
                        <User className="size-3" />
                        {r.targetUser.fullName}
                      </span>
                    )}
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
