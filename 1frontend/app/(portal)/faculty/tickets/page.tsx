'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Ticket, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PriorityBadge } from '@/components/status-badge'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

const STATUS_BADGE: Record<string, string> = {
  OPEN:         'bg-blue-50 text-blue-700 border-blue-200',
  TRIAGED:      'bg-purple-50 text-purple-700 border-purple-200',
  IN_PROGRESS:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  WAITING_USER: 'bg-amber-50 text-amber-700 border-amber-200',
  RESOLVED:     'bg-green-50 text-green-700 border-green-200',
  CLOSED:       'bg-gray-50 text-gray-500 border-gray-200',
  REOPENED:     'bg-red-50 text-red-700 border-red-200',
  APPROVED:     'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED:     'bg-red-50 text-red-700 border-red-200',
  COMPLETED:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED:    'bg-gray-50 text-gray-500 border-gray-200',
  EXPIRED:      'bg-red-50 text-red-700 border-red-200',
}

const TERMINAL_REQUEST_STATUSES = new Set([
  'APPROVED',
  'REJECTED',
  'COMPLETED',
  'CLOSED',
  'CANCELLED',
  'EXPIRED',
])

function fmt(d: any) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getDisplayStatus(ticket: any) {
  const requestStatus = String(ticket.status ?? '').toUpperCase()
  if (TERMINAL_REQUEST_STATUSES.has(requestStatus)) return requestStatus
  return String(ticket.ticketStatus ?? ticket.status ?? 'OPEN').toUpperCase()
}

export default function FacultyTicketsPage() {
  const { t } = useI18n()
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
      toast.error(t('tickets.loadFail'))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => { fetchTickets() }, [fetchTickets])

  const filtered = filter === 'all' ? tickets : tickets.filter((t) => getDisplayStatus(t) === filter)

  if (isLoading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Ticket className="size-5 text-primary" /> {t('tickets.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('tickets.subtitle', { count: tickets.length })}
          </p>
        </div>
        <Button asChild>
          <Link href="/faculty/tickets/new">{t('tickets.newTicket')}</Link>
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['all', 'OPEN', 'IN_PROGRESS', 'WAITING_USER', 'APPROVED', 'REJECTED', 'COMPLETED', 'CLOSED'].map((s) => (
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
            {s === 'all' ? t('common.all') : s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm divide-y divide-border overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center text-center opacity-50">
            <AlertCircle className="size-10 mb-3" />
            <p className="text-sm font-medium">{t('tickets.noTickets')}</p>
          </div>
        ) : (
          filtered.map((t) => {
            const status = getDisplayStatus(t)
            return (
              <Link
                key={t.id}
                href={`/faculty/requests/${t.requestId ?? t.id}?from=/faculty/tickets`}
                className="flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {t.title || t.category || t('tickets.title')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t.requestNo} · {t.requesterName}
                    {t.category && ` · ${t.category}`}
                    {t.createdAt && ` · ${fmt(t.createdAt)}`}
                  </p>
                </div>
                <div className="ml-4 flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                  <PriorityBadge priority={t.priority} />
                  <span className={cn(
                    'text-xs font-semibold px-2 py-0.5 rounded-full border',
                    STATUS_BADGE[status] ?? STATUS_BADGE.OPEN
                  )}>
                    {status?.replace(/_/g, ' ')}
                  </span>
                </div>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
