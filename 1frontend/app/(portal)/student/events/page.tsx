'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, PartyPopper, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'

const STATUS_BADGE: Record<string, string> = {
  SUBMITTED:  'bg-blue-50 text-blue-700 border-blue-200',
  IN_REVIEW:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  APPROVED:   'bg-green-50 text-green-700 border-green-200',
  REJECTED:   'bg-red-50 text-red-700 border-red-200',
  COMPLETED:  'bg-gray-50 text-gray-500 border-gray-200',
}

export default function StudentEventsPage() {
  const [events, setEvents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
        const res = await fetch(`${backendUrl}/events`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (res.ok) setEvents(await res.json())
      } catch {
        toast.error('Failed to load events.')
      } finally {
        setIsLoading(false)
      }
    }
    fetchEvents()
  }, [])

  if (isLoading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <PartyPopper className="size-5 text-primary" /> Event Requests
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Submit campus event or activity approval requests.</p>
        </div>
        <Link href="/student/events/new">
          <Button size="sm" className="gap-2"><Plus className="size-4" /> New Event</Button>
        </Link>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {events.length === 0 ? (
          <div className="py-16 flex flex-col items-center text-center opacity-50">
            <AlertCircle className="size-10 mb-3" />
            <p className="text-sm font-medium">No event requests yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Submit a request to organize a campus event.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {events.map((ev) => (
              <div key={ev.id} className="flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{ev.eventName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {ev.requestNo} · {ev.eventType}
                    {ev.startAt && ` · ${new Date(ev.startAt).toLocaleDateString()}`}
                  </p>
                </div>
                <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border ml-4 shrink-0', STATUS_BADGE[ev.status] ?? STATUS_BADGE.SUBMITTED)}>
                  {ev.status?.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
