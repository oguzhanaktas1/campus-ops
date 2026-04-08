'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import Link from 'next/link'

interface StaffRequest {
  id: string
  title: string
  category: string
  status: string
  priority: string
  createdAt: string
  dueDate?: string
  requesterName?: string
}

const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
  HIGH: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
  MEDIUM: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  LOW: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function formatDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function isToday(date: Date | null) {
  if (!date) return false
  const t = new Date()
  return (
    date.getDate() === t.getDate() &&
    date.getMonth() === t.getMonth() &&
    date.getFullYear() === t.getFullYear()
  )
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  )
}

export default function StaffCalendarPage() {
  const [requests, setRequests] = useState<StaffRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedRequest, setSelectedRequest] = useState<StaffRequest | null>(null)

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const token = localStorage.getItem('access_token')
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
        const res = await fetch(`${backendUrl}/staff/requests`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setRequests(Array.isArray(data) ? data : [])
        } else {
          setRequests([])
        }
      } catch {
        toast.error('Failed to load calendar data.')
        setRequests([])
      } finally {
        setIsLoading(false)
      }
    }
    fetchRequests()
  }, [])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startingDay = firstDay.getDay()
  const offset = startingDay === 0 ? 6 : startingDay - 1

  const daysArray: (Date | null)[] = []
  for (let i = 0; i < offset; i++) daysArray.push(null)
  for (let i = 1; i <= daysInMonth; i++) daysArray.push(new Date(year, month, i))

  const getRequestsForDay = (date: Date | null) => {
    if (!date) return []
    return requests.filter((r) => {
      const due = r.dueDate ? new Date(r.dueDate) : null
      if (due && isSameDay(due, date)) return true
      return false
    })
  }

  // Upcoming tasks — next 14 days with a due date
  const now = new Date()
  const upcoming = requests
    .filter((r) => r.dueDate && new Date(r.dueDate) >= now)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 10)

  const overdue = requests.filter(
    (r) => r.dueDate && new Date(r.dueDate) < now && r.status?.toUpperCase() !== 'COMPLETED'
  )

  if (isLoading) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <Loader2 className="size-10 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <CalendarIcon className="size-5 text-primary" /> Calendar
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Upcoming deadlines and assigned tasks
          </p>
        </div>
        <div className="flex items-center gap-2 bg-card border border-border p-1.5 rounded-lg shadow-sm">
          <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())} className="text-xs font-semibold">
            Today
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

      {/* Overdue alert */}
      {overdue.length > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/8 border border-destructive/20">
          <AlertTriangle className="size-4 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive font-medium">
            {overdue.length} overdue item{overdue.length > 1 ? 's' : ''} — past due date
          </p>
          <Link href="/staff/inbox" className="ml-auto">
            <Button variant="outline" size="sm" className="text-xs border-destructive/30 text-destructive hover:bg-destructive/10 h-7">
              View Overdue <ArrowRight className="size-3 ml-1" />
            </Button>
          </Link>
        </div>
      )}

      <div className="grid lg:grid-cols-4 gap-6 items-start">
        {/* Calendar grid */}
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
              const dayRequests = getRequestsForDay(date)
              return (
                <div
                  key={idx}
                  className={cn(
                    'min-h-[100px] bg-card p-2 flex flex-col gap-1 overflow-hidden',
                    !date && 'bg-muted/20'
                  )}
                >
                  {date && (
                    <span
                      className={cn(
                        'text-xs font-semibold size-6 flex items-center justify-center rounded-full self-start shrink-0',
                        isToday(date)
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground'
                      )}
                    >
                      {date.getDate()}
                    </span>
                  )}
                  <div className="flex flex-col gap-1 overflow-hidden">
                    {dayRequests.map((req) => (
                      <button
                        key={req.id}
                        onClick={() => setSelectedRequest(req)}
                        className={cn(
                          'text-left text-[10px] px-1.5 py-1 rounded truncate border transition-all',
                          selectedRequest?.id === req.id
                            ? 'bg-primary text-primary-foreground border-primary'
                            : PRIORITY_COLOR[req.priority?.toUpperCase()] ||
                              'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20'
                        )}
                      >
                        {req.title}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="flex flex-col gap-6">
          {/* Selected detail */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
              Task Details
            </h2>
            {!selectedRequest ? (
              <div className="flex flex-col items-center justify-center text-center gap-2 opacity-40 py-8">
                <CalendarIcon className="size-8" />
                <p className="text-xs">Click a task to see details</p>
              </div>
            ) : (
              <div className="space-y-3">
                <h3 className="font-bold text-foreground text-sm leading-tight">
                  {selectedRequest.title}
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3.5" />
                  Due: {selectedRequest.dueDate ? formatDate(selectedRequest.dueDate) : 'No deadline'}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <FileText className="size-3.5" />
                  {selectedRequest.category} · {selectedRequest.requesterName || 'Unknown'}
                </div>
                <Link href={`/staff/requests/${selectedRequest.category?.toLowerCase()}/${selectedRequest.id}`}>
                  <Button variant="outline" className="w-full gap-2 text-xs h-8 mt-2">
                    View Request <ArrowRight className="size-3" />
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Upcoming */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Upcoming Deadlines
              </h2>
              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[10px] font-medium">
                {upcoming.length}
              </span>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {upcoming.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 opacity-40">
                  <CheckCircle2 className="size-6" />
                  <p className="text-xs text-center">No upcoming deadlines</p>
                </div>
              ) : (
                upcoming.map((req) => (
                  <button
                    key={req.id}
                    onClick={() => setSelectedRequest(req)}
                    className="w-full text-left p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/50 transition-colors"
                  >
                    <p className="text-xs font-bold text-foreground truncate">{req.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="size-3" />
                      {formatDate(req.dueDate!)} · {req.category}
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
