'use client'

import { useEffect, useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

export default function OrganizerEventsPage() {
  const { t } = useI18n()
  const [events, setEvents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch(`${BACKEND}/campus-events/organizer`, {
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
  }, [t])

  async function publishEvent(id: string) {
    try {
      const res = await fetch(`${BACKEND}/campus-events/${id}/publish`, {
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
      const res = await fetch(`${BACKEND}/campus-events/${id}/confirm`, {
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

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5 pb-20">
      <div>
        <h1 className="text-xl font-bold text-foreground">{t('pages.myEvents')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('pages.eventsSubtitle')}</p>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <AlertCircle className="size-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">{t('pages.noEvents')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('pages.noEventsDesc')}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {events.map((ev) => (
              <div
                key={ev.id}
                className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{ev.title}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                    {ev.eventType && <span>{ev.eventType}</span>}
                    {ev.startAt && <span>{new Date(ev.startAt).toLocaleDateString()}</span>}
                    {ev.registrationCount != null && <span>{t('pages.registrations', { count: ev.registrationCount })}</span>}
                    {ev.locationText && <span>{ev.locationText}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={ev.status} />
                  {ev.status === 'DRAFT' && (
                    <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={() => publishEvent(ev.id)}>
                      {t('pages.publish')}
                    </Button>
                  )}
                  {ev.status === 'REGISTRATION_CLOSED' && (
                    <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={() => confirmEvent(ev.id)}>
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
