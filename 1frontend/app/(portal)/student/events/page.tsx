'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PlusCircle, PartyPopper, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { formatStudentDate } from '@/lib/student-i18n-utils'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

type Tab = 'events' | 'requests'

export default function StudentEventsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('events')
  const [events, setEvents] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [isLoadingEvents, setIsLoadingEvents] = useState(true)
  const [isLoadingRequests, setIsLoadingRequests] = useState(true)
  const { locale, t } = useI18n()
  const headers = { Authorization: `Bearer ${getToken()}` }

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch(`${BACKEND}/campus-events`, { headers })
        if (res.ok) setEvents(await res.json())
      } catch {
        toast.error(t('messages.loadEventsFail'))
      } finally {
        setIsLoadingEvents(false)
      }
    }
    fetchEvents()
  }, [])

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const res = await fetch(`${BACKEND}/events`, { headers })
        if (res.ok) setRequests(await res.json())
      } catch {
        toast.error(t('messages.loadEventRequestsFail'))
      } finally {
        setIsLoadingRequests(false)
      }
    }
    fetchRequests()
  }, [])

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5 pb-20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('pages.eventsTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('pages.eventsSubtitle')}</p>
        </div>
        <Link href="/student/events/new" className="shrink-0">
          <Button size="sm" className="gap-1.5">
            <PlusCircle className="size-3.5" />
            {t('common.newRequest')}
          </Button>
        </Link>
      </div>

      <div className="flex gap-1 border-b border-border">
        {([
          { key: 'events', label: t('pages.campusEvents') },
          { key: 'requests', label: t('pages.myEventRequests') },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'events' && (
        <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
          {isLoadingEvents ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <AlertCircle className="size-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-foreground">{t('pages.noCampusEvents')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('pages.noCampusEventsDesc')}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {events.map((ev) => (
                <Link
                  key={ev.id}
                  href={`/student/events/${ev.id}`}
                  className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{ev.title}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                      {ev.eventType && <span>{ev.eventType}</span>}
                      {ev.startAt && <span>{formatStudentDate(ev.startAt, locale)}</span>}
                      {ev.locationText && <span>{ev.locationText}</span>}
                      {ev.registrationCount != null && (
                        <span>
                          {locale === 'tr' ? 'Kayıtlar' : 'Registrations'}: {ev.registrationCount}
                          {ev.minimumAttendance ? ` / min ${ev.minimumAttendance}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={ev.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
          {isLoadingRequests ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <AlertCircle className="size-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-foreground">{t('pages.noEventRequests')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('pages.noEventRequestsDesc')}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {requests.map((req) => (
                <Link
                  key={req.id}
                  href={`/student/requests/${req.id}`}
                  className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{req.eventName}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                      {req.requestNo && <span className="font-mono">{req.requestNo}</span>}
                      {req.eventType && <span>{req.eventType}</span>}
                      {req.startAt && <span>{formatStudentDate(req.startAt, locale)}</span>}
                    </div>
                  </div>
                  <StatusBadge status={req.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
