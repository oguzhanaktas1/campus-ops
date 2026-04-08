'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, AlignLeft, ArrowUpRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import Link from 'next/link'

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  requestId?: string;
}

export default function FacultyCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)

  // Etkinlikleri Backend'den Çek
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const token = localStorage.getItem('access_token')
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
        const res = await fetch(`${backendUrl}/calendar/events`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) setEvents(await res.json())
      } catch (error) {
        toast.error('Failed to load calendar events')
      } finally {
        setIsLoading(false)
      }
    }
    fetchEvents()
  }, [])

  // Takvim Matematiği
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  
  const firstDayOfMonth = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  
  const startingDay = firstDayOfMonth.getDay() 
  const offset = startingDay === 0 ? 6 : startingDay - 1 

  const daysArray = []
  for (let i = 0; i < offset; i++) daysArray.push(null) 
  for (let i = 1; i <= daysInMonth; i++) daysArray.push(new Date(year, month, i))

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const goToday = () => setCurrentDate(new Date())

  const isToday = (date: Date | null) => {
    if (!date) return false
    const today = new Date()
    return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear()
  }

  const getEventsForDay = (date: Date | null) => {
    if (!date) return []
    return events.filter(e => {
      const eDate = new Date(e.startDate)
      return eDate.getDate() === date.getDate() && eDate.getMonth() === date.getMonth() && eDate.getFullYear() === date.getFullYear()
    })
  }

  if (isLoading) return <div className="h-[80vh] flex items-center justify-center"><Loader2 className="size-10 animate-spin text-primary" /></div>

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 pb-20 h-full flex flex-col">
      
      {/* ÜST BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
            <CalendarIcon className="size-7 text-primary" /> My Calendar
          </h1>
          <p className="text-sm text-muted-foreground">Manage your approved requests, appointments, and events.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-card border border-border p-1.5 rounded-lg shadow-sm">
          <Button variant="ghost" size="sm" onClick={goToday} className="text-xs font-semibold">Today</Button>
          <div className="w-px h-4 bg-border mx-1"></div>
          <Button variant="ghost" size="icon" onClick={prevMonth} className="size-8"><ChevronLeft className="size-4" /></Button>
          <span className="text-sm font-bold w-36 text-center">{monthNames[month]} {year}</span>
          <Button variant="ghost" size="icon" onClick={nextMonth} className="size-8"><ChevronRight className="size-4" /></Button>
        </div>
      </div>

      {/* ANA İÇERİK: items-start KULLANILARAK UZAMA ENGELLENDİ */}
      <div className="grid lg:grid-cols-4 gap-6 items-start">
        
        {/* SOL: TAKVİM IZGARASI (GRID) - Sabit Yükseklikli */}
        <div className="lg:col-span-3 bg-card border border-border rounded-xl shadow-lg overflow-hidden flex flex-col h-fit">
          <div className="grid grid-cols-7 bg-muted/50 border-b border-border">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} className="py-3 text-center text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 bg-border gap-px">
            {daysArray.map((date, index) => {
              const dayEvents = getEventsForDay(date)
              return (
                <div 
                  key={index} 
                  className={cn(
                    "min-h-[120px] max-h-[160px] bg-card p-2 flex flex-col gap-1 transition-colors hover:bg-muted/10 overflow-hidden",
                    !date && "bg-muted/20"
                  )}
                >
                  {date && (
                    <div className="flex justify-between items-start shrink-0">
                      <span className={cn(
                        "text-xs font-semibold size-6 flex items-center justify-center rounded-full",
                        isToday(date) ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                      )}>
                        {date.getDate()}
                      </span>
                    </div>
                  )}
                  
                  {/* Etkinlik Hapları - Kendi İçinde Kaydırılabilir */}
                  <div className="flex flex-col gap-1 overflow-y-auto pr-1 no-scrollbar mt-1">
                    {dayEvents.map(ev => (
                      <button 
                        key={ev.id}
                        onClick={() => setSelectedEvent(ev)}
                        className={cn(
                          "text-left text-[10px] px-1.5 py-1 rounded truncate border transition-all shrink-0",
                          selectedEvent?.id === ev.id 
                            ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary/20" 
                            : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                        )}
                      >
                        {new Date(ev.startDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {ev.title}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* SAĞ: ETKİNLİK DETAYLARI & YAKLAŞANLAR - Kendi İçinde Scrollable */}
        <div className="flex flex-col gap-6 sticky top-6">
          
          {/* SEÇİLEN ETKİNLİK DETAYI */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-lg flex flex-col max-h-[500px]">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 shrink-0">Event Details</h2>
            
            {!selectedEvent ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 opacity-50 py-10">
                <CalendarIcon className="size-8" />
                <p className="text-sm">Select an event from the calendar to see details.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4 overflow-y-auto pr-2 no-scrollbar animate-in fade-in slide-in-from-right-4 duration-300">
                <div>
                  <h3 className="font-bold text-foreground leading-tight">{selectedEvent.title}</h3>
                  <p className="text-xs text-primary font-medium mt-1 flex items-center gap-1.5">
                    <Clock className="size-3.5" />
                    {new Date(selectedEvent.startDate).toLocaleDateString()} · {new Date(selectedEvent.startDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <p className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground"><AlignLeft className="size-3.5" /> Description</p>
                  <p className="text-sm text-foreground bg-muted/40 p-3 rounded-lg border border-border whitespace-pre-wrap leading-relaxed">
                    {selectedEvent.description}
                  </p>
                </div>

                {selectedEvent.requestId && (
                  <div className="pt-2 shrink-0">
                    <Link href={`/faculty/requests/${selectedEvent.requestId}`} className="block">
                      <Button variant="outline" className="w-full gap-2 text-xs h-9">
                        View Original Request <ArrowUpRight className="size-3.5" />
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* YAKLAŞAN ETKİNLİKLER (UPCOMING) */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 flex justify-between items-center">
              Upcoming
              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[10px]">{events.filter(e => new Date(e.startDate) > new Date()).length}</span>
            </h2>
            <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1 no-scrollbar">
              {events
                .filter(e => new Date(e.startDate) > new Date())
                .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                .slice(0, 5) 
                .map(ev => (
                <button 
                  key={ev.id} 
                  onClick={() => setSelectedEvent(ev)}
                  className="w-full text-left p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/50 transition-colors"
                >
                  <p className="text-xs font-bold text-foreground truncate">{ev.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(ev.startDate).toLocaleDateString()} · {new Date(ev.startDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </p>
                </button>
              ))}
              {events.filter(e => new Date(e.startDate) > new Date()).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No upcoming events.</p>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}