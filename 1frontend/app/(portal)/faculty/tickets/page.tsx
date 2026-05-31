'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Ticket as TicketIcon, Plus, Loader2, Search, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { StatusBadge, PriorityBadge } from '@/components/status-badge'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
const PAGE_SIZE = 20
const TERMINAL = new Set(['APPROVED', 'REJECTED', 'COMPLETED', 'CLOSED', 'RESOLVED', 'CANCELLED', 'EXPIRED'])

function getDisplayStatus(ticket: any) {
  const requestStatus = String(ticket.status ?? '').toUpperCase()
  if (TERMINAL.has(requestStatus)) return requestStatus
  return String(ticket.ticketStatus ?? ticket.status ?? 'OPEN').toUpperCase()
}

function fmtRel(ts: string | null | undefined) {
  if (!ts) return ''
  const diff = (Date.now() - new Date(ts).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

type TabKey = 'all' | 'active' | 'completed'

export default function FacultyTicketsPage() {
  const { t } = useI18n()
  const [tickets, setTickets] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const fetchTickets = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/it-tickets/my`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) setTickets(await res.json())
      else setTickets([])
    } catch {
      toast.error(t('tickets.loadFail'))
      setTickets([])
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => { void fetchTickets() }, [fetchTickets])

  const active = tickets.filter((t) => !TERMINAL.has(getDisplayStatus(t)))
  const completed = tickets.filter((t) => TERMINAL.has(getDisplayStatus(t)))

  const tabs = [
    { key: 'all' as TabKey, label: t('common.all'), count: tickets.length },
    { key: 'active' as TabKey, label: 'Active', count: active.length },
    { key: 'completed' as TabKey, label: t('common.completed'), count: completed.length },
  ]

  const baseList = activeTab === 'active' ? active : activeTab === 'completed' ? completed : tickets

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
            {t('tickets.subtitle', { count: tickets.length })}
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button asChild size="sm" className="shrink-0">
            <Link href="/faculty/tickets/new">
              <Plus className="size-4 mr-1" /> {t('tickets.newTicket')}
            </Link>
          </Button>
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder={t('common.search')}
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
            onClick={() => { setActiveTab(tab.key); setPage(1) }}
            className={cn(
              'px-3 py-1 text-sm font-medium rounded-md transition-all',
              activeTab === tab.key
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
              const status = getDisplayStatus(ticket)
              const isDone = TERMINAL.has(status)
              return (
                <Link
                  key={ticket.id}
                  href={`/faculty/requests/${ticket.requestId ?? ticket.id}?from=/faculty/tickets`}
                  className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {ticket.title || ticket.category || t('tickets.title')}
                      </p>
                      {ticket.requestNo && (
                        <span className="text-xs text-muted-foreground font-mono shrink-0">{ticket.requestNo}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{ticket.requesterName ?? 'Unknown'}</span>
                      <span>
                        {isDone
                          ? `${t('tickets.completed')}: ${fmtRel(ticket.completedAt ?? ticket.createdAt)}`
                          : `${t('tickets.opened')}: ${fmtRel(ticket.createdAt)}`}
                      </span>
                      {ticket.category && <span>{ticket.category}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <PriorityBadge priority={ticket.priority} />
                    <StatusBadge status={status} />
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
