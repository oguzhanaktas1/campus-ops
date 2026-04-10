'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { StatusBadge, PriorityBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  Search,
  Clock,
  User,
  Ticket as TicketIcon,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { getToken } from '@/lib/auth'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

const FILTERS = ['all', 'unassigned', 'urgent', 'mine'] as const
type FilterTab = typeof FILTERS[number]

const TICKET_STATUS_LABEL: Record<string, string> = {
  OPEN: 'Open',
  TRIAGED: 'Triaged',
  IN_PROGRESS: 'In Progress',
  WAITING_USER: 'Waiting User',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  REOPENED: 'Reopened',
}

const TICKET_STATUS_CLASS: Record<string, string> = {
  OPEN: 'bg-blue-50 text-blue-700 border-blue-200',
  TRIAGED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
  WAITING_USER: 'bg-orange-50 text-orange-700 border-orange-200',
  RESOLVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CLOSED: 'bg-muted text-muted-foreground border-border',
  REOPENED: 'bg-red-50 text-red-700 border-red-200',
}

function formatRelative(d: string) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000 / 60
  if (diff < 60) return `${Math.round(diff)}m ago`
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`
  return `${Math.round(diff / 1440)}d ago`
}

export default function StaffTicketsPage() {
  const [tickets, setTickets] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')

  const fetchTickets = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/it-tickets/inbox`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      setTickets(res.ok ? await res.json() : [])
    } catch {
      setTickets([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void fetchTickets() }, [fetchTickets])

  const unassigned = tickets.filter((t) => !t.assignedTo)
  const urgent = tickets.filter((t) => t.priority === 'URGENT' || t.priority === 'HIGH')
  // "mine" filter: no current user context easily available; show all for now
  const mine = tickets

  const baseList =
    activeFilter === 'unassigned' ? unassigned :
    activeFilter === 'urgent' ? urgent :
    activeFilter === 'mine' ? mine :
    tickets

  const filtered = baseList.filter(
    (t) =>
      search === '' ||
      t.title?.toLowerCase().includes(search.toLowerCase()) ||
      t.requestNo?.toLowerCase().includes(search.toLowerCase()) ||
      t.requesterName?.toLowerCase().includes(search.toLowerCase()) ||
      t.category?.toLowerCase().includes(search.toLowerCase()),
  )

  const counts = {
    all: tickets.length,
    unassigned: unassigned.length,
    urgent: urgent.length,
    mine: mine.length,
  }

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Ticket Queue</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tickets.length} open IT support tickets.
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px',
              activeFilter === f
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {f}
            <span className={cn(
              'ml-1.5 text-xs rounded-full px-1.5 py-0.5 font-medium',
              activeFilter === f ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
            )}>
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by title, ID, requester, or category..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Ticket list */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <TicketIcon className="size-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">No tickets found</p>
            <p className="text-xs text-muted-foreground mt-1">
              {search ? 'Try adjusting your search.' : 'The queue is empty.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((ticket) => (
              <Link key={ticket.id} href={`/staff/requests/tickets/${ticket.id}`}>
                <div className="px-5 py-4 hover:bg-muted/20 transition-colors cursor-pointer">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground">{ticket.title}</p>
                        <span className="text-xs text-muted-foreground font-mono">{ticket.requestNo}</span>
                        {ticket.category && (
                          <span className="text-[10px] bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded font-medium">
                            {ticket.category}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <User className="size-3" />
                          {ticket.requesterName ?? 'Unknown'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {formatRelative(ticket.createdAt)}
                        </span>
                        {ticket.assignedTo ? (
                          <span className="flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 className="size-3" />
                            {ticket.assignedTo.fullName}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-600 font-medium">
                            <AlertTriangle className="size-3" />
                            Unassigned
                          </span>
                        )}
                        {ticket.slaPolicy && (
                          <span className="text-[10px] text-muted-foreground border border-border px-1.5 py-0.5 rounded">
                            SLA: {ticket.slaPolicy.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded border',
                        TICKET_STATUS_CLASS[ticket.ticketStatus ?? ticket.status] ?? TICKET_STATUS_CLASS['OPEN'],
                      )}>
                        {TICKET_STATUS_LABEL[ticket.ticketStatus ?? ticket.status] ?? ticket.ticketStatus}
                      </span>
                      <PriorityBadge priority={ticket.priority} />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
