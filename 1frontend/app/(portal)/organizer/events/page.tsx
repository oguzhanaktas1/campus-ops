'use client'

import { useEffect, useState } from 'react'
import { Loader2, AlertCircle, PartyPopper } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

const STATUS_BADGE: Record<string, string> = {
  DRAFT:              'bg-gray-50 text-gray-600 border-gray-200',
  PUBLISHED:          'bg-blue-50 text-blue-700 border-blue-200',
  REGISTRATION_OPEN:  'bg-green-50 text-green-700 border-green-200',
  REGISTRATION_CLOSED:'bg-orange-50 text-orange-700 border-orange-200',
  CONFIRMED:          'bg-emerald-50 text-emerald-700 border-emerald-200',
  RESCHEDULED:        'bg-yellow-50 text-yellow-700 border-yellow-200',
  CANCELLED:          'bg-red-50 text-red-700 border-red-200',
  COMPLETED:          'bg-gray-50 text-gray-500 border-gray-200',
}

export default function OrganizerEventsPage() {
  const { t } = useI18n()
  const [events, setEvents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch(`${backend}/campus-events/organizer`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (res.ok) setEvents(await res.json())
      } catch {
        toast.error(t('pages.eventsLoadFail'))
      } finally {
        setIsLoading(false)
      }
    }
    fetchEvents()
  }, [backend, t])

  async function publishEvent(id: string) {
    try {
      const res = await fetch(`${backend}/campus-events/${id}/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error()
      toast.success(t('pages.eventPublished'))
      setEvents((prev) => prev.map((e) => e.id === id ? { ...e, status: 'REGISTRATION_OPEN' } : e))
    } catch {
      toast.error(t('pages.eventPublishFail'))
    }
  }

  async function confirmEvent(id: string) {
    try {
      const res = await fetch(`${backend}/campus-events/${id}/confirm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error()
      toast.success(t('pages.eventConfirmed'))
      setEvents((prev) => prev.map((e) => e.id === id ? { ...e, status: 'CONFIRMED' } : e))
    } catch {
      toast.error(t('pages.eventConfirmFail'))
    }
  }

  if (isLoading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <PartyPopper className="size-5 text-primary" /> {t('pages.myEvents')}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('pages.eventsSubtitle')}</p>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {events.length === 0 ? (
          <div className="py-16 flex flex-col items-center text-center opacity-50">
            <AlertCircle className="size-10 mb-3" />
            <p className="text-sm font-medium">{t('pages.noEvents')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('pages.noEventsDesc')}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {events.map((ev) => (
              <div key={ev.id} className="px-5 py-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{ev.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {ev.eventType}
                    {ev.startAt && ` · ${new Date(ev.startAt).toLocaleDateString()}`}
                    {' · '}{t('pages.registrations', { count: ev.registrationCount })}
                    {ev.locationText && ` · ${ev.locationText}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', STATUS_BADGE[ev.status] ?? STATUS_BADGE.DRAFT)}>
                    {ev.status?.replace(/_/g, ' ')}
                  </span>
                  {ev.status === 'DRAFT' && (
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => publishEvent(ev.id)}>
                      {t('pages.publish')}
                    </Button>
                  )}
                  {ev.status === 'REGISTRATION_CLOSED' && (
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => confirmEvent(ev.id)}>
                      {t('pages.confirm')}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
