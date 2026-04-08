'use client'

import { useEffect, useState, useCallback } from 'react'
import { Calendar, Clock, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface CalendarEvent {
  id: string
  title: string
  date: string
  time?: string
  type: 'appointment' | 'reservation' | 'deadline'
  status: string
}

const TYPE_COLORS: Record<string, string> = {
  appointment: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800',
  reservation: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
  deadline: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function formatDateHeader(year: number, month: number) {
  return new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
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

  const fetchEvents = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token')
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const headers = { Authorization: `Bearer ${token}` }

      const [aptRes, resRes] = await Promise.all([
        fetch(`${backendUrl}/student/appointments`, { headers }),
        fetch(`${backendUrl}/student/reservations`, { headers }),
      ])

      const combined: CalendarEvent[] = []

      if (aptRes.ok) {
        const apts = await aptRes.json()
        for (const a of apts) {
          combined.push({
            id: `apt-${a.id}`,
            title: a.title || 'Appointment',
            date: a.scheduledAt || a.date,
            time: a.scheduledAt ? formatTime(a.scheduledAt) : a.time,
            type: 'appointment',
            status: a.status,
          })
        }
      }

      if (resRes.ok) {
        const ress = await resRes.json()
        for (const r of ress) {
          combined.push({
            id: `res-${r.id}`,
            title: r.resourceName || r.title || 'Reservation',
            date: r.startTime || r.date,
            time: r.startTime ? formatTime(r.startTime) : r.time,
            type: 'reservation',
            status: r.status,
          })
        }
      }

      setEvents(combined)
    } catch {
      toast.error('Failed to load calendar events.')
    } finally {
      setIsLoading(false)
    }
  }, [])

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

  const eventsForDay = (day: number) => {
    return events.filter(e => {
      if (!e.date) return false
      const d = new Date(e.date)
      return d.getFullYear() === viewYear && d.getMonth() === viewMonth && d.getDate() === day
    })
  }

  const selectedEvents = selectedDay ? eventsForDay(selectedDay) : []

  const totalDays = daysInMonth(viewYear, viewMonth)
  const startDay = firstDayOfMonth(viewYear, viewMonth)
  const cells = Array.from({ length: startDay + totalDays }, (_, i) =>
    i < startDay ? null : i - startDay + 1
  )

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading calendar...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-foreground">My Calendar</h1>
        <p className="text-sm text-muted-foreground mt-0.5">View your appointments and reservations.</p>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        {[
          { label: 'Appointment', type: 'appointment' },
          { label: 'Reservation', type: 'reservation' },
        ].map(({ label, type }) => (
          <span key={type} className={cn('text-xs px-2.5 py-1 rounded-full border font-medium', TYPE_COLORS[type])}>
            {label}
          </span>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Calendar grid */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {/* Month nav */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <ChevronLeft className="size-4 text-muted-foreground" />
            </button>
            <h2 className="text-sm font-semibold text-foreground">{formatDateHeader(viewYear, viewMonth)}</h2>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <ChevronRight className="size-4 text-muted-foreground" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-[10px] font-bold text-muted-foreground py-2 uppercase tracking-wide">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
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
                    'min-h-[64px] p-1.5 border-b border-r border-border last:border-r-0 transition-colors',
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
                        !isToday && !isSelected && 'text-foreground',
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

        {/* Selected day events */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Calendar className="size-4 text-primary" />
              {selectedDay
                ? new Date(viewYear, viewMonth, selectedDay).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
                : 'Select a day'}
            </h3>
          </div>
          <div className="divide-y divide-border">
            {selectedDay && selectedEvents.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-10">No events on this day.</p>
            )}
            {!selectedDay && (
              <p className="text-xs text-muted-foreground text-center py-10">Click a day to see events.</p>
            )}
            {selectedEvents.map(ev => (
              <div key={ev.id} className="px-4 py-3.5 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground leading-tight">{ev.title}</p>
                  <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-semibold whitespace-nowrap', TYPE_COLORS[ev.type])}>
                    {ev.type}
                  </span>
                </div>
                {ev.time && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Clock className="size-3" /> {ev.time}
                  </p>
                )}
                <Badge variant="outline" className="text-[10px] h-5">
                  {ev.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
