'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, PartyPopper, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { formatStudentDate, translateStatus } from '@/lib/student-i18n-utils'

const EVENT_STATUS_BADGE: Record<string, string> = {
  PUBLISHED:          'bg-blue-50 text-blue-700 border-blue-200',
  REGISTRATION_OPEN:  'bg-green-50 text-green-700 border-green-200',
  REGISTRATION_CLOSED:'bg-orange-50 text-orange-700 border-orange-200',
  CONFIRMED:          'bg-emerald-50 text-emerald-700 border-emerald-200',
  COMPLETED:          'bg-gray-50 text-gray-500 border-gray-200',
  RESCHEDULED:        'bg-yellow-50 text-yellow-700 border-yellow-200',
  CANCELLED:          'bg-red-50 text-red-700 border-red-200',
}

const REQ_STATUS_BADGE: Record<string, string> = {
  SUBMITTED:  'bg-blue-50 text-blue-700 border-blue-200',
  IN_REVIEW:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  APPROVED:   'bg-green-50 text-green-700 border-green-200',
  REJECTED:   'bg-red-50 text-red-700 border-red-200',
  COMPLETED:  'bg-gray-50 text-gray-500 border-gray-200',
}

type Tab = 'events' | 'requests'

export default function StudentEventsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('events')
  const [events, setEvents] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [isLoadingEvents, setIsLoadingEvents] = useState(true)
  const [isLoadingRequests, setIsLoadingRequests] = useState(true)
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
  const headers = { Authorization: `Bearer ${getToken()}` }
  const { locale, t } = useI18n()

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch(`${backend}/campus-events`, { headers })
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
        const res = await fetch(`${backend}/events`, { headers })
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
    <div className="p-6 max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <PartyPopper className="size-5 text-primary" /> {t('pages.eventsTitle')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('pages.eventsSubtitle')}</p>
        </div>
        <Link href="/student/events/new">
          <Button size="sm" className="gap-2"><Plus className="size-4" /> {t('common.newRequest')}</Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {[
          { key: 'events', label: t('pages.campusEvents') },
          { key: 'requests', label: t('pages.myEventRequests') },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as Tab)}
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

      {/* Campus Events Tab */}
      {activeTab === 'events' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {isLoadingEvents ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : events.length === 0 ? (
            <div className="py-16 flex flex-col items-center text-center opacity-50">
              <AlertCircle className="size-10 mb-3" />
              <p className="text-sm font-medium">{t('pages.noCampusEvents')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('pages.noCampusEventsDesc')}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {events.map((ev) => (
                <Link
                  key={ev.id}
                  href={`/student/events/${ev.id}`}
                  className="flex items-start justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{ev.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ev.eventType}
                      {ev.startAt && ` · ${formatStudentDate(ev.startAt, locale)}`}
                      {ev.locationText && ` · ${ev.locationText}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {locale === 'tr' ? 'Kayitlar' : 'Registrations'}: {ev.registrationCount}
                      {ev.minimumAttendance && ` / min ${ev.minimumAttendance}`}
                    </p>
                  </div>
                  <span className={cn(
                    'text-xs font-semibold px-2 py-0.5 rounded-full border ml-4 shrink-0',
                    EVENT_STATUS_BADGE[ev.status] ?? EVENT_STATUS_BADGE.PUBLISHED,
                  )}>
                    {translateStatus(ev.status, t)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* My Event Requests Tab */}
      {activeTab === 'requests' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {isLoadingRequests ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : requests.length === 0 ? (
            <div className="py-16 flex flex-col items-center text-center opacity-50">
              <AlertCircle className="size-10 mb-3" />
              <p className="text-sm font-medium">{t('pages.noEventRequests')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('pages.noEventRequestsDesc')}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {requests.map((req) => (
                <Link
                  key={req.id}
                  href={`/student/requests/${req.id}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{req.eventName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {req.requestNo} · {req.eventType}
                      {req.startAt && ` · ${formatStudentDate(req.startAt, locale)}`}
                    </p>
                  </div>
                  <span className={cn(
                    'text-xs font-semibold px-2 py-0.5 rounded-full border ml-4 shrink-0',
                    REQ_STATUS_BADGE[req.status] ?? REQ_STATUS_BADGE.SUBMITTED,
                  )}>
                    {translateStatus(req.status, t)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
