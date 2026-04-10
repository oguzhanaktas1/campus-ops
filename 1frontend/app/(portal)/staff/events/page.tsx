'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PartyPopper, Loader2, AlertCircle, CheckCircle, XCircle } from 'lucide-react'
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

export default function StaffEventsPage() {
  const router = useRouter()
  const [events, setEvents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [filter, setFilter] = useState('all')

  const fetchEvents = useCallback(async () => {
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
  }, [])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const updateStatus = async (id: string, status: string) => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const res = await fetch(`${backendUrl}/events/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ status, note }),
      })
      if (!res.ok) throw new Error()
      toast.success('Event request updated.')
      setActionId(null)
      setNote('')
      fetchEvents()
    } catch {
      toast.error('Failed to update status.')
    }
  }

  const filtered = filter === 'all' ? events : events.filter((e) => e.status === filter)

  if (isLoading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><PartyPopper className="size-5 text-primary" /> Event Requests</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Review and manage campus event requests.</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['all', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED'].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={cn('text-xs px-3 py-1.5 rounded-full border font-semibold transition-colors',
              filter === s ? 'bg-foreground text-background border-foreground' : 'bg-background text-muted-foreground border-border hover:border-foreground')}>
            {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm divide-y divide-border overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center text-center opacity-50">
            <AlertCircle className="size-10 mb-3" />
            <p className="text-sm font-medium">No event requests found.</p>
          </div>
        ) : (
          filtered.map((ev) => (
            <div
              key={ev.id}
              onClick={() => router.push(`/staff/requests/events/${ev.id}`)}
              className="px-5 py-4 space-y-3 cursor-pointer hover:bg-muted/20 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{ev.eventName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {ev.requestNo} · {ev.eventType} · {ev.requesterName}
                    {ev.startAt && ` · ${new Date(ev.startAt).toLocaleDateString()}`}
                    {ev.expectedAttendance && ` · ~${ev.expectedAttendance} people`}
                  </p>
                </div>
                <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0', STATUS_BADGE[ev.status] ?? STATUS_BADGE.SUBMITTED)}>
                  {ev.status?.replace(/_/g, ' ')}
                </span>
              </div>

              {['SUBMITTED', 'IN_REVIEW'].includes(ev.status) && (
                actionId === ev.id ? (
                  <div className="space-y-2">
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Note (optional)..."
                      className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700" onClick={(event) => { event.stopPropagation(); void updateStatus(ev.id, 'APPROVED') }}>
                        <CheckCircle className="size-3.5" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" className="gap-1.5" onClick={(event) => { event.stopPropagation(); void updateStatus(ev.id, 'REJECTED') }}>
                        <XCircle className="size-3.5" /> Reject
                      </Button>
                      <Button size="sm" variant="ghost" onClick={(event) => { event.stopPropagation(); setActionId(null); setNote('') }}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); setActionId(ev.id) }}>Process</Button>
                )
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
