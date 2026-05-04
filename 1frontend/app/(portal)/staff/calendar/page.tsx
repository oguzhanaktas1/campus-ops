'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Download,
  MapPin,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n'

interface CalendarEvent {
  id: string
  title: string
  description: string | null
  startDate: string
  endDate: string
  status: string
  type: 'appointment' | 'reservation'
  requestId: string | null
  location: string | null
}

const TYPE_CLASS: Record<string, string> = {
  appointment: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
  reservation: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function StaffCalendarPage() {
  const { t } = useI18n()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'

  const fetchEvents = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch(`${backendUrl}/calendar/events`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setEvents(Array.isArray(data) ? data : [])
    } catch {
      toast.error(t('pages.calendarLoadFail'))
    } finally {
      setIsLoading(false)
    }
  }, [backendUrl, t])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startingDay = firstDay.getDay()
  const offset = startingDay === 0 ? 6 : startingDay - 1

  const daysArray: (Date | null)[] = []
  for (let i = 0; i < offset; i++) daysArray.push(null)
  for (let i = 1; i <= daysInMonth; i++) daysArray.push(new Date(year, month, i))

  const getEventsForDay = useCallback((date: Date | null) => {
    if (!date) return []
    return events.filter((event) => {
      const when = new Date(event.startDate)
      return (
        when.getDate() === date.getDate() &&
        when.getMonth() === date.getMonth() &&
        when.getFullYear() === date.getFullYear()
      )
    })
  }, [events])

  const upcoming = useMemo(
    () => events
      .filter((event) => new Date(event.startDate) >= new Date())
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 10),
    [events],
  )

  const downloadIcs = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch(`${backendUrl}/calendar/events.ics`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'campusflow-calendar.ics'
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error(t('pages.calendarExportFail'))
    }
  }

  if (isLoading) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <Loader2 className="size-10 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <CalendarIcon className="size-5 text-primary" /> {t('nav.calendar')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('pages.calendarSubtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={downloadIcs}>
            <Download className="size-4" />
            {t('pages.exportIcs')}
          </Button>
          <div className="flex items-center gap-2 bg-card border border-border p-1.5 rounded-lg shadow-sm">
            <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())} className="text-xs font-semibold">
              {t('pages.today')}
            </Button>
            <div className="w-px h-4 bg-border" />
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="size-8">
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm font-bold w-36 text-center">
              {MONTH_NAMES[month]} {year}
            </span>
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="size-8">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6 items-start">
        <div className="lg:col-span-3 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          <div className="grid grid-cols-7 bg-muted/50 border-b border-border">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <div key={day} className="py-3 text-center text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 bg-border gap-px">
            {daysArray.map((date, idx) => {
              const dayEvents = getEventsForDay(date)
              return (
                <div
                  key={idx}
                  className={cn(
                    'min-h-[100px] bg-card p-2 flex flex-col gap-1 overflow-hidden',
                    !date && 'bg-muted/20'
                  )}
                >
                  {date && (
                    <span className="text-xs font-semibold size-6 flex items-center justify-center rounded-full self-start shrink-0 text-muted-foreground">
                      {date.getDate()}
                    </span>
                  )}
                  <div className="flex flex-col gap-1 overflow-hidden">
                    {dayEvents.map((event) => (
                      <button
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className={cn(
                          'text-left text-[10px] px-1.5 py-1 rounded truncate border transition-all',
                          selectedEvent?.id === event.id
                            ? 'bg-primary text-primary-foreground border-primary'
                            : TYPE_CLASS[event.type]
                        )}
                      >
                        {event.title}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
              {t('pages.eventDetails')}
            </h2>
            {!selectedEvent ? (
              <div className="flex flex-col items-center justify-center text-center gap-2 opacity-40 py-8">
                <CalendarIcon className="size-8" />
                <p className="text-xs">{t('pages.clickItemDetails')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <h3 className="font-bold text-foreground text-sm leading-tight">
                  {selectedEvent.title}
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3.5" />
                  {new Date(selectedEvent.startDate).toLocaleDateString()} · {new Date(selectedEvent.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                {selectedEvent.location && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="size-3.5" />
                    {selectedEvent.location}
                  </div>
                )}
                {selectedEvent.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{selectedEvent.description}</p>
                )}
                <div className="text-xs font-medium text-primary">{selectedEvent.status}</div>
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t('pages.upcoming')}
              </h2>
              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[10px] font-medium">
                {upcoming.length}
              </span>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {upcoming.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">{t('pages.noUpcomingEvents')}</p>
              ) : (
                upcoming.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => setSelectedEvent(event)}
                    className="w-full text-left p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/50 transition-colors"
                  >
                    <p className="text-xs font-bold text-foreground truncate">{event.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="size-3" />
                      {new Date(event.startDate).toLocaleDateString()} · {new Date(event.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
