'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Ticket as TicketIcon, Plus, Loader2, Search, AlertCircle, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { StatusBadge, PriorityBadge } from '@/components/status-badge'
import { getStoredUser, getToken } from '@/lib/auth'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n'
import { getActiveSocket } from '@/lib/socket'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
const PAGE_SIZE = 20

function resolveAssignee(ticket: any): string | null {
  const raw = ticket.assignedTo ?? ticket.currentAssignee ?? ticket.assignee ?? null
  if (!raw) return null
  if (typeof raw === 'string') return raw
  return raw.fullName ?? raw.name ?? raw.profile?.fullName ?? raw.email ?? null
}

function fmtRel(ts: string | null | undefined) {
  if (!ts) return ''
  const diff = (Date.now() - new Date(ts).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

type FilterKey = 'all' | 'unassigned' | 'urgent' | 'mine' | 'completed'

export default function StaffTicketsPage() {
  const { t } = useI18n()
  const [activeTickets, setActiveTickets] = useState<any[]>([])
  const [completedTickets, setCompletedTickets] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const currentUser = getStoredUser()
  const isItStaff = currentUser?.roles?.some((r: string) => ['IT_AGENT', 'IT_MANAGER'].includes(r)) ?? false

  const fetchTickets = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${getToken()}` }
      const [activeRes, completedRes] = await Promise.all([
        fetch(`${BACKEND}/it-tickets/inbox`, { headers }),
        fetch(`${BACKEND}/it-tickets/completed`, { headers }),
      ])
      setActiveTickets(activeRes.ok ? await activeRes.json() : [])
      setCompletedTickets(completedRes.ok ? await completedRes.json() : [])
      if (!activeRes.ok) toast.error(t('tickets.loadFail'))
    } catch {
      toast.error(t('tickets.networkFail'))
      setActiveTickets([])
      setCompletedTickets([])
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => { void fetchTickets() }, [fetchTickets])

  useEffect(() => {
    const sock = getActiveSocket()
    if (!sock) return
    const refresh = () => void fetchTickets()
    const onSla = (payload: any) => {
      toast.warning(`SLA ihlali: ${payload?.data?.message ?? 'Bir ticket SLA süresini aştı'}`)
      void fetchTickets()
    }
    sock.on('ticket.assigned', refresh)
    sock.on('ticket.status.changed', refresh)
    sock.on('sla.breached', onSla)
    sock.on('sla.warning', refresh)
    return () => {
      sock.off('ticket.assigned', refresh)
      sock.off('ticket.status.changed', refresh)
      sock.off('sla.breached', onSla)
      sock.off('sla.warning', refresh)
    }
  }, [fetchTickets])

  const unassigned = activeTickets.filter((t) => !resolveAssignee(t))
  const urgent = activeTickets.filter((t) => t.priority === 'URGENT' || t.priority === 'HIGH')
  const mine = activeTickets.filter((t) =>
    currentUser && (
      t.assignedItUserId === currentUser.id ||
      t.assignedToUserId === currentUser.id
    )
  )

  const tabs = [
    { key: 'all' as FilterKey, label: t('common.all'), count: activeTickets.length },
    { key: 'unassigned' as FilterKey, label: t('common.unassigned'), count: unassigned.length },
    { key: 'urgent' as FilterKey, label: t('common.urgent'), count: urgent.length },
    { key: 'mine' as FilterKey, label: t('common.mine'), count: mine.length },
    { key: 'completed' as FilterKey, label: t('common.completed'), count: completedTickets.length },
  ]

  const baseList: any[] =
    activeFilter === 'unassigned' ? unassigned :
    activeFilter === 'urgent' ? urgent :
    activeFilter === 'mine' ? mine :
    activeFilter === 'completed' ? completedTickets :
    activeTickets

  const filtered = baseList.filter((t) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      t.title?.toLowerCase().includes(q) ||
      t.requestNo?.toLowerCase().includes(q) ||
      t.requesterName?.toLowerCase().includes(q) ||
      t.category?.toLowerCase().includes(q)
    )
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5 pb-20">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('tickets.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('tickets.subtitle', { count: activeTickets.length + completedTickets.length })}
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {!isItStaff && (
            <Button asChild size="sm" className="shrink-0">
              <Link href="/staff/tickets/new">
                <Plus className="size-4 mr-1" /> {t('tickets.newTicket')}
              </Link>
            </Button>
          )}
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder={t('tickets.searchPlaceholder')}
              className="pl-9 h-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 bg-muted/50 p-1 rounded-lg border border-border w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveFilter(tab.key); setPage(1) }}
            className={cn(
              'px-3 py-1 text-sm font-medium rounded-md transition-all',
              activeFilter === tab.key
                ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
          >
            {tab.label}
            {tab.count > 0 && <span className="ml-1.5 text-xs opacity-60">{tab.count}</span>}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <AlertCircle className="size-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">{t('tickets.noTickets')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {search ? t('tickets.searchHint') : t('tickets.emptyHint')}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {paged.map((ticket) => {
              const isCompleted = ['RESOLVED', 'CLOSED'].includes(ticket.ticketStatus)
              const assignee = resolveAssignee(ticket)
              const isUnassigned = !assignee && !isCompleted
              return (
                <Link
                  key={ticket.id}
                  href={`/staff/requests/it-support/${ticket.id}`}
                  className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-foreground truncate">{ticket.title}</p>
                      {ticket.requestNo && (
                        <span className="text-xs text-muted-foreground font-mono shrink-0">{ticket.requestNo}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{ticket.requesterName ?? ticket.reporter ?? 'Unknown'}</span>
                      <span>
                        {isCompleted
                          ? `${t('tickets.completed')}: ${fmtRel(ticket.completedAt ?? ticket.createdAt)}`
                          : `${t('tickets.opened')}: ${fmtRel(ticket.createdAt)}`}
                      </span>
                      {ticket.category && <span>{ticket.category}</span>}
                      {assignee ? (
                        <span className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 className="size-3" /> {assignee}
                        </span>
                      ) : isUnassigned ? (
                        <span className="flex items-center gap-1 text-amber-600 font-medium">
                          <AlertTriangle className="size-3" /> {t('common.unassigned')}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <PriorityBadge priority={ticket.priority} />
                    <StatusBadge status={ticket.ticketStatus ?? ticket.status} />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} / {filtered.length}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded hover:bg-muted disabled:opacity-30">
              <ChevronLeft className="size-4" />
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded hover:bg-muted disabled:opacity-30">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
