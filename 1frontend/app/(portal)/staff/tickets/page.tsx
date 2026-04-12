'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { StatusBadge, PriorityBadge } from '@/components/status-badge'
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
  Archive,
} from 'lucide-react'
import { getStoredUser, getToken } from '@/lib/auth'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

const FILTERS = ['all', 'unassigned', 'urgent', 'mine', 'completed'] as const
type FilterTab = typeof FILTERS[number]

function formatRelative(d: string) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000 / 60
  if (diff < 60) return `${Math.round(diff)}m ago`
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`
  return `${Math.round(diff / 1440)}d ago`
}

export default function StaffTicketsPage() {
  const [activeTickets, setActiveTickets] = useState<any[]>([])
  const [completedTickets, setCompletedTickets] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')
  const currentUser = getStoredUser()

  const fetchTickets = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${getToken()}` }
      const [activeRes, completedRes] = await Promise.all([
        fetch(`${BACKEND}/it-tickets/inbox`, { headers }),
        fetch(`${BACKEND}/it-tickets/completed`, { headers }),
      ])

      setActiveTickets(activeRes.ok ? await activeRes.json() : [])
      setCompletedTickets(completedRes.ok ? await completedRes.json() : [])
    } catch {
      setActiveTickets([])
      setCompletedTickets([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void fetchTickets() }, [fetchTickets])

  const allTickets = [...activeTickets, ...completedTickets]
  const unassigned = activeTickets.filter((t) => !t.assignedTo)
  const urgent = activeTickets.filter((t) => t.priority === 'URGENT' || t.priority === 'HIGH')
  const mine = activeTickets.filter((t) => t.assignedTo?.id === currentUser?.id)

  const baseList =
    activeFilter === 'unassigned' ? unassigned :
    activeFilter === 'urgent' ? urgent :
    activeFilter === 'mine' ? mine :
    activeFilter === 'completed' ? completedTickets :
    activeTickets

  const filtered = baseList.filter(
    (t) =>
      search === '' ||
      t.title?.toLowerCase().includes(search.toLowerCase()) ||
      t.requestNo?.toLowerCase().includes(search.toLowerCase()) ||
      t.requesterName?.toLowerCase().includes(search.toLowerCase()) ||
      t.reporter?.toLowerCase().includes(search.toLowerCase()) ||
      t.category?.toLowerCase().includes(search.toLowerCase()),
  )

  const counts = {
    all: activeTickets.length,
    unassigned: unassigned.length,
    urgent: urgent.length,
    mine: mine.length,
    completed: completedTickets.length,
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
            {allTickets.length} IT tickets visible to your team.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px whitespace-nowrap',
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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by title, ID, requester, or category..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

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
            {filtered.map((ticket) => {
              const isCompleted = ['RESOLVED', 'CLOSED'].includes(ticket.ticketStatus)
              const dateLabel = isCompleted ? 'Completed' : 'Opened'
              const dateValue = ticket.completedAt ?? ticket.createdAt

              return (
                <Link key={ticket.id} href={`/staff/tickets/${ticket.id}`}>
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
                          {isCompleted ? (
                            <span className="inline-flex items-center gap-1 text-[10px] border border-border rounded px-1.5 py-0.5 text-muted-foreground">
                              <Archive className="size-3" /> Completed
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <User className="size-3" />
                            {ticket.requesterName ?? ticket.reporter ?? 'Unknown'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {dateLabel}: {formatRelative(dateValue)}
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
                          {ticket.slaPolicy?.name ? (
                            <span className="text-[10px] text-muted-foreground border border-border px-1.5 py-0.5 rounded">
                              SLA: {ticket.slaPolicy.name}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <StatusBadge status={ticket.ticketStatus ?? ticket.status} />
                        <PriorityBadge priority={ticket.priority} />
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
