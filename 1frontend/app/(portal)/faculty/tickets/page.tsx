'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Ticket, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

const STATUS_BADGE: Record<string, string> = {
  OPEN:         'bg-blue-50 text-blue-700 border-blue-200',
  TRIAGED:      'bg-purple-50 text-purple-700 border-purple-200',
  IN_PROGRESS:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  WAITING_USER: 'bg-amber-50 text-amber-700 border-amber-200',
  RESOLVED:     'bg-green-50 text-green-700 border-green-200',
  CLOSED:       'bg-gray-50 text-gray-500 border-gray-200',
  REOPENED:     'bg-red-50 text-red-700 border-red-200',
}

function fmt(d: any) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function FacultyTicketsPage() {
  const [tickets, setTickets] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const fetchTickets = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/it-tickets/my`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) setTickets(await res.json())
    } catch {
      toast.error('Failed to load tickets.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchTickets() }, [fetchTickets])

  const filtered = filter === 'all' ? tickets : tickets.filter((t) =>
    (t.ticketStatus ?? t.status) === filter
  )

  if (isLoading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Ticket className="size-5 text-primary" /> IT Tickets
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Create and track your IT support tickets.
        </p>
      </div>

      <div className="flex justify-end">
        <Button asChild>
          <Link href="/faculty/tickets/new">New Ticket</Link>
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['all', 'OPEN', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              'text-xs px-3 py-1.5 rounded-full border font-semibold transition-colors',
              filter === s
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-muted-foreground border-border hover:border-foreground'
            )}
          >
            {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm divide-y divide-border overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center text-center opacity-50">
            <AlertCircle className="size-10 mb-3" />
            <p className="text-sm font-medium">No tickets found.</p>
          </div>
        ) : (
          filtered.map((t) => {
            const status = t.ticketStatus ?? t.status
            return (
              <Link
                key={t.id}
                href={`/faculty/tickets/${t.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {t.title || t.category || 'IT Ticket'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t.requestNo} · {t.requesterName}
                    {t.category && ` · ${t.category}`}
                    {t.createdAt && ` · ${fmt(t.createdAt)}`}
                  </p>
                </div>
                <span className={cn(
                  'text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ml-4',
                  STATUS_BADGE[status] ?? STATUS_BADGE.OPEN
                )}>
                  {status?.replace(/_/g, ' ')}
                </span>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
