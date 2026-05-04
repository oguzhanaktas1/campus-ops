'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calendar, Clock, ChevronLeft, ChevronRight, Download, Loader2, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'
import { formatStudentTime, translateStatus } from '@/lib/student-i18n-utils'

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

const TYPE_COLORS: Record<string, string> = {
  appointment: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800',
  reservation: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
}

function formatDateHeader(year: number, month: number, locale: 'tr' | 'en') {
  return new Date(year, month).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', { month: 'long', year: 'numeric' })
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function firstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

export default function StudentCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate())
  const { locale, t } = useI18n()

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
      toast.error(t('messages.loadCalendarFail'))
    } finally {
      setIsLoading(false)
    }
  }, [backendUrl])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
    setSelectedDay(null)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
    setSelectedDay(null)
  }

  const eventsForDay = useCallback((day: number) => {
    return events.filter(e => {
      const d = new Date(e.startDate)
      return d.getFullYear() === viewYear && d.getMonth() === viewMonth && d.getDate() === day
    })
  }, [events, viewMonth, viewYear])

  const selectedEvents = useMemo(
    () => selectedDay ? eventsForDay(selectedDay) : [],
    [eventsForDay, selectedDay],
  )

  const totalDays = daysInMonth(viewYear, viewMonth)
  const startDay = firstDayOfMonth(viewYear, viewMonth)
  const cells = Array.from({ length: startDay + totalDays }, (_, i) =>
    i < startDay ? null : i - startDay + 1
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
      toast.error(t('messages.exportIcsFail'))
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">{t('pages.loadingCalendar')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('pages.calendarTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('pages.calendarSubtitle')}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={downloadIcs}>
          <Download className="size-4" />
          Export ICS
        </Button>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        {[
          { label: t('pages.appointmentsTitle'), type: 'appointment' },
          { label: t('pages.reservationsTitle'), type: 'reservation' },
        ].map(({ label, type }) => (
          <span key={type} className={cn('text-xs px-2.5 py-1 rounded-full border font-medium', TYPE_COLORS[type])}>
            {label}
          </span>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <ChevronLeft className="size-4 text-muted-foreground" />
            </button>
            <h2 className="text-sm font-semibold text-foreground">{formatDateHeader(viewYear, viewMonth, locale)}</h2>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <ChevronRight className="size-4 text-muted-foreground" />
            </button>
          </div>

          <div className="grid grid-cols-7 border-b border-border">
            {(locale === 'tr' ? ['Paz', 'Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']).map(d => (
              <div key={d} className="text-center text-[10px] font-bold text-muted-foreground py-2 uppercase tracking-wide">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              const dayEvents = day ? eventsForDay(day) : []
              const isToday = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear()
              const isSelected = day === selectedDay

              return (
                <div
                  key={idx}
                  onClick={() => day && setSelectedDay(day)}
                  className={cn(
                    'min-h-[72px] p-1.5 border-b border-r border-border last:border-r-0 transition-colors',
                    day ? 'cursor-pointer hover:bg-muted/40' : 'bg-muted/10',
                    isSelected && 'bg-primary/5',
                  )}
                >
                  {day && (
                    <>
                      <div className={cn(
                        'size-6 rounded-full flex items-center justify-center text-xs font-medium mx-auto mb-1',
                        isToday && 'bg-primary text-primary-foreground font-bold',
                        !isToday && isSelected && 'bg-primary/20 text-primary',
                      )}>
                        {day}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 2).map(e => (
                          <div key={e.id} className={cn('text-[9px] px-1 py-0.5 rounded truncate border', TYPE_COLORS[e.type])}>
                            {e.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-[9px] text-muted-foreground text-center">+{dayEvents.length - 2}</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Calendar className="size-4 text-primary" />
              {selectedDay
                ? new Date(viewYear, viewMonth, selectedDay).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', { month: 'long', day: 'numeric' })
                : t('pages.clickDay')}
            </h3>
          </div>
          <div className="divide-y divide-border">
            {selectedDay && selectedEvents.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-10">{t('pages.noEventsOnDay')}</p>
            )}
            {!selectedDay && (
              <p className="text-xs text-muted-foreground text-center py-10">{t('pages.clickDay')}</p>
            )}
            {selectedEvents.map(ev => (
              <div key={ev.id} className="px-4 py-3.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground leading-tight">{ev.title}</p>
                  <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-semibold whitespace-nowrap', TYPE_COLORS[ev.type])}>
                    {ev.type === 'appointment' ? t('pages.appointmentsTitle') : t('pages.reservationsTitle')}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Clock className="size-3" /> {formatStudentTime(ev.startDate, locale)} - {formatStudentTime(ev.endDate, locale)}
                </p>
                {ev.location && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="size-3" /> {ev.location}
                  </p>
                )}
                {ev.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{ev.description}</p>
                )}
                <Badge variant="outline" className="text-[10px] h-5">
                  {translateStatus(ev.status, t)}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
