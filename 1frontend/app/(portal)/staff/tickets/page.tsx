'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Ticket as TicketIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getStoredUser, getToken } from '@/lib/auth'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n'
import { getActiveSocket } from '@/lib/socket'
import { StaffListShell } from '@/components/staff/staff-list-shell'
import { StaffRequestRow, formatRel } from '@/components/staff/staff-request-row'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
const PAGE_SIZE = 20
const TICKET_STATUSES = ['OPEN', 'TRIAGED', 'IN_PROGRESS', 'WAITING_USER', 'REOPENED', 'RESOLVED', 'CLOSED']

function resolveAssignee(ticket: any): string | null {
  const raw = ticket.assignedTo ?? ticket.currentAssignee ?? ticket.assignee ?? null
  if (!raw) return null
  if (typeof raw === 'string') return raw
  return raw.fullName ?? raw.name ?? raw.profile?.fullName ?? raw.email ?? null
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
  const [activeStatus, setActiveStatus] = useState('')
  const [activePriority, setActivePriority] = useState('')
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
  const mine = activeTickets.filter((t) => {
    const a = resolveAssignee(t)
    return a && currentUser && (
      t.assignedItUserId === currentUser.id ||
      t.assignedToUserId === currentUser.id
    )
  })

  const baseList: any[] =
    activeFilter === 'unassigned' ? unassigned :
    activeFilter === 'urgent' ? urgent :
    activeFilter === 'mine' ? mine :
    activeFilter === 'completed' ? completedTickets :
    activeTickets

  const filtered = baseList.filter((t) => {
    if (activeStatus && (t.ticketStatus ?? t.status) !== activeStatus) return false
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
    { key: 'all', label: t('common.all'), count: activeTickets.length },
    { key: 'unassigned', label: t('common.unassigned'), count: unassigned.length },
    { key: 'urgent', label: t('common.urgent'), count: urgent.length },
    { key: 'mine', label: t('common.mine'), count: mine.length },
    { key: 'completed', label: t('common.completed'), count: completedTickets.length },
  ]

  return (
    <StaffListShell
      title={t('tickets.title')}
      subtitle={t('tickets.subtitle', { count: activeTickets.length + completedTickets.length })}
      actionButton={
        !isItStaff ? (
          <Button asChild size="sm">
            <Link href="/staff/tickets/new">
              <Plus className="size-4 mr-1" /> {t('tickets.newTicket')}
            </Link>
          </Button>
        ) : undefined
      }
      tabs={tabs}
      activeTab={activeFilter}
      onTabChange={(k) => setActiveFilter(k as FilterKey)}
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder={t('tickets.searchPlaceholder')}
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
        const isCompleted = ['RESOLVED', 'CLOSED'].includes(ticket.ticketStatus)
        const assignee = resolveAssignee(ticket)
        return (
          <StaffRequestRow
            key={ticket.id}
            href={`/staff/requests/it-support/${ticket.id}`}
            title={ticket.title}
            requestNo={ticket.requestNo}
            badge={ticket.category}
            metaLeft={[
              ticket.requesterName ?? ticket.reporter ?? 'Unknown',
              isCompleted
                ? `${t('tickets.completed')}: ${formatRel(ticket.completedAt ?? ticket.createdAt)}`
                : `${t('tickets.opened')}: ${formatRel(ticket.createdAt)}`,
            ]}
            assignee={assignee ?? undefined}
            unassigned={!assignee && !isCompleted}
            status={ticket.ticketStatus ?? ticket.status}
            priority={ticket.priority}
          />
        )
      })}
    </StaffListShell>
  )
}
