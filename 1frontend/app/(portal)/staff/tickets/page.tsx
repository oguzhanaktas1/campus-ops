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
  Plus,
} from 'lucide-react'
import { getStoredUser, getToken } from '@/lib/auth'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

const FILTERS = ['all', 'unassigned', 'urgent', 'mine', 'completed'] as const
type FilterTab = typeof FILTERS[number]

function formatRelative(d: string) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000 / 60
  if (diff < 60) return `${Math.round(diff)}m ago`
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`
  return `${Math.round(diff / 1440)}d ago`
}

function getAssignee(ticket: any) {
  const raw =
    ticket.assignedTo ??
    ticket.currentAssignee ??
    ticket.assignee ??
    null

  if (!raw) return null

  if (typeof raw === 'string') {
    return {
      id: ticket.assignedToUserId ?? ticket.assignedItUserId ?? null,
      fullName: raw,
    }
  }

  const fullName =
    raw.fullName ??
    raw.name ??
    raw.profile?.fullName ??
    raw.email ??
    null

  if (!fullName) return null

  return {
    id: raw.id ?? raw.userId ?? ticket.assignedToUserId ?? ticket.assignedItUserId ?? null,
    fullName,
  }
}

export default function StaffTicketsPage() {
  const { t } = useI18n()
  const [activeTickets, setActiveTickets] = useState<any[]>([])
  const [completedTickets, setCompletedTickets] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')
  const currentUser = getStoredUser()
  const IT_STAFF_ROLES = ['IT_AGENT', 'IT_MANAGER']
  const isItStaff = currentUser?.roles?.some((r) => IT_STAFF_ROLES.includes(r)) ?? false

  const fetchTickets = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${getToken()}` }
      const [activeRes, completedRes] = await Promise.all([
        fetch(`${BACKEND}/it-tickets/inbox`, { headers }),
        fetch(`${BACKEND}/it-tickets/completed`, { headers }),
      ])

      if (!activeRes.ok) {
        const err = await activeRes.json().catch(() => ({}))
        toast.error(t('tickets.inboxFail', { status: activeRes.status, message: err.message ?? t('tickets.loadFail') }))
        setActiveTickets([])
      } else {
        setActiveTickets(await activeRes.json())
      }

      setCompletedTickets(completedRes.ok ? await completedRes.json() : [])
    } catch (e) {
      toast.error(t('tickets.networkFail'))
      setActiveTickets([])
      setCompletedTickets([])
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => { void fetchTickets() }, [fetchTickets])

  const allTickets = [...activeTickets, ...completedTickets]
  const unassigned = activeTickets.filter((t) => !getAssignee(t))
  const urgent = activeTickets.filter((t) => t.priority === 'URGENT' || t.priority === 'HIGH')
  const mine = activeTickets.filter((t) => getAssignee(t)?.id === currentUser?.id)

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
          <h1 className="text-xl font-bold text-foreground">{t('tickets.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('tickets.subtitle', { count: allTickets.length })}
          </p>
        </div>
        {!isItStaff && (
          <Button asChild size="sm">
            <Link href="/staff/tickets/new">
              <Plus className="size-4 mr-1" /> {t('tickets.newTicket')}
            </Link>
          </Button>
        )}
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
            {f === 'all' ? t('common.all') : f === 'unassigned' ? t('common.unassigned') : f === 'urgent' ? t('common.urgent') : f === 'mine' ? t('common.mine') : t('common.completed')}
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
          placeholder={t('tickets.searchPlaceholder')}
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <TicketIcon className="size-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">{t('tickets.noTickets')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {search ? t('tickets.searchHint') : t('tickets.emptyHint')}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((ticket) => {
              const isCompleted = ['RESOLVED', 'CLOSED'].includes(ticket.ticketStatus)
              const dateLabel = isCompleted ? t('tickets.completed') : t('tickets.opened')
              const dateValue = ticket.completedAt ?? ticket.createdAt
              const assignee = getAssignee(ticket)

              return (
                <Link key={ticket.id} href={`/staff/requests/it-support/${ticket.id}`}>
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
                              <Archive className="size-3" /> {t('common.completed')}
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
                          {assignee ? (
                            <span className="flex items-center gap-1 text-emerald-600">
                              <CheckCircle2 className="size-3" />
                              {assignee.fullName}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-amber-600 font-medium">
                              <AlertTriangle className="size-3" />
                              {t('common.unassigned')}
                            </span>
                          )}
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
