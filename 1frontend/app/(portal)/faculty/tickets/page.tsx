'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Ticket as TicketIcon, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { StaffListShell } from '@/components/staff/staff-list-shell'
import { StaffRequestRow, formatRel } from '@/components/staff/staff-request-row'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
const PAGE_SIZE = 20
const TICKET_STATUSES = ['OPEN', 'TRIAGED', 'IN_PROGRESS', 'WAITING_USER', 'REOPENED', 'RESOLVED', 'CLOSED']
const TERMINAL = new Set(['APPROVED', 'REJECTED', 'COMPLETED', 'CLOSED', 'RESOLVED', 'CANCELLED', 'EXPIRED'])

function getDisplayStatus(ticket: any) {
  const requestStatus = String(ticket.status ?? '').toUpperCase()
  if (TERMINAL.has(requestStatus)) return requestStatus
  return String(ticket.ticketStatus ?? ticket.status ?? 'OPEN').toUpperCase()
}

type TabKey = 'all' | 'active' | 'completed'

export default function FacultyTicketsPage() {
  const { t } = useI18n()
  const [tickets, setTickets] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [activeStatus, setActiveStatus] = useState('')
  const [activePriority, setActivePriority] = useState('')

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

  useEffect(() => { void fetchTickets() }, [fetchTickets])

  const active = tickets.filter((t) => !TERMINAL.has(getDisplayStatus(t)))
  const completed = tickets.filter((t) => TERMINAL.has(getDisplayStatus(t)))

  const baseList = activeTab === 'active' ? active : activeTab === 'completed' ? completed : tickets

  const filtered = baseList.filter((t) => {
    const status = getDisplayStatus(t)
    if (activeStatus && status !== activeStatus) return false
    if (activePriority && t.priority !== activePriority) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      t.title?.toLowerCase().includes(q) ||
      t.requestNo?.toLowerCase().includes(q) ||
      t.requesterName?.toLowerCase().includes(q) ||
      t.category?.toLowerCase().includes(q)
    )
  })

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const tabs = [
    { key: 'all', label: t('common.all'), count: tickets.length },
    { key: 'active', label: 'Active', count: active.length },
    { key: 'completed', label: t('common.completed'), count: completed.length },
  ]

  return (
    <StaffListShell
      title={t('tickets.title')}
      subtitle={t('tickets.subtitle', { count: tickets.length })}
      actionButton={
        <Button asChild size="sm">
          <Link href="/faculty/tickets/new">
            <Plus className="size-4 mr-1" /> {t('tickets.newTicket')}
          </Link>
        </Button>
      }
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(k) => { setActiveTab(k as TabKey); setPage(1) }}
      search={search}
      onSearchChange={(v) => { setSearch(v); setPage(1) }}
      searchPlaceholder={t('common.search')}
      statusOptions={TICKET_STATUSES}
      activeStatus={activeStatus}
      onStatusChange={(s) => { setActiveStatus(s); setPage(1) }}
      activePriority={activePriority}
      onPriorityChange={(p) => { setActivePriority(p); setPage(1) }}
      isLoading={isLoading}
      totalCount={filtered.length}
      page={page}
      pageSize={PAGE_SIZE}
      onPageChange={setPage}
      emptyIcon={<TicketIcon className="size-8" />}
      emptyTitle={t('tickets.noTickets')}
      emptyDesc={search ? t('tickets.searchHint') : t('tickets.emptyHint')}
    >
      {paged.map((ticket) => {
        const status = getDisplayStatus(ticket)
        const isDone = TERMINAL.has(status)
        return (
          <StaffRequestRow
            key={ticket.id}
            href={`/faculty/requests/${ticket.requestId ?? ticket.id}?from=/faculty/tickets`}
            title={ticket.title || ticket.category || t('tickets.title')}
            requestNo={ticket.requestNo}
            badge={ticket.category}
            metaLeft={[
              ticket.requesterName ?? 'Unknown',
              isDone
                ? `${t('tickets.completed')}: ${formatRel(ticket.completedAt ?? ticket.createdAt)}`
                : `${t('tickets.opened')}: ${formatRel(ticket.createdAt)}`,
            ]}
            status={status}
            priority={ticket.priority}
          />
        )
      })}
    </StaffListShell>
  )
}
