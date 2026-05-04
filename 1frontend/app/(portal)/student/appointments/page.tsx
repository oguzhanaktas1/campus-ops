'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { Calendar, PlusCircle, Clock, User, Loader2 } from 'lucide-react'
import { getToken } from '@/lib/auth'
import { cn } from '@/lib/utils'
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

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  const active = requests.filter((r) =>
    ['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL'].includes(
      (r.status ?? '').toUpperCase(),
    ),
  )
  const confirmed = requests.filter(
    (r) => r.status?.toUpperCase() === 'APPROVED',
  )
  const past = requests.filter((r) =>
    ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(
      (r.status ?? '').toUpperCase(),
    ),
  )

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('pages.appointmentsTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('pages.appointmentsSubtitle')}
          </p>
        </div>
        <Link href="/student/appointments/new">
          <Button size="sm" className="gap-1.5">
            <PlusCircle className="size-3.5" />
            {t('pages.bookAppointment')}
          </Button>
        </Link>
      </div>

      {active.length > 0 && (
        <CardSection title={`${t('pages.pending')} (${active.length})`} items={active} locale={locale} />
      )}
      {confirmed.length > 0 && (
        <CardSection title={`${t('pages.confirmed')} (${confirmed.length})`} items={confirmed} locale={locale} />
      )}

      {active.length === 0 && confirmed.length === 0 && (
        <div className="flex flex-col items-center py-10 bg-card border border-border rounded-lg text-center">
          <Calendar className="size-7 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">{t('pages.noAppointments')}</p>
          <Link href="/student/appointments/new" className="mt-3">
            <Button variant="outline" size="sm">
              {t('pages.bookOneNow')}
            </Button>
          </Link>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">{t('common.past')}</h2>
          <div className="space-y-2">
            {past.map((r) => (
              <Link
                key={r.id}
                href={`/student/requests/${r.id}`}
                className="block bg-card border border-border rounded-lg p-4 opacity-70 hover:opacity-100 hover:bg-muted/20 transition-all"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{r.topic}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.preferredStartAt ? formatStudentDate(r.preferredStartAt, locale) : ''}
                      {r.targetUser?.fullName ? ` - ${r.targetUser.fullName}` : ''}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CardSection({ title, items, locale }: { title: string; items: any[]; locale: 'tr' | 'en' }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-foreground mb-3">{title}</h2>
      <div className="space-y-3">
        {items.map((r) => (
          <Link
            key={r.id}
            href={`/student/requests/${r.id}`}
            className={cn(
              'block bg-card border border-border rounded-lg p-4 transition-colors hover:bg-muted/20',
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {r.requestNo}
                  </span>
                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    {r.appointmentType}
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground">{r.topic}</p>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {r.preferredStartAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {formatStudentDate(r.preferredStartAt, locale)} - {formatStudentTime(r.preferredStartAt, locale)}
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
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
