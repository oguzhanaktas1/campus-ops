'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Inbox, Clock, AlertTriangle, Users, UserCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n'
import { StaffListShell } from '@/components/staff/staff-list-shell'
import { StaffRequestRow, formatDate } from '@/components/staff/staff-request-row'

const PAGE_SIZE = 20
const INBOX_STATUSES = ['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'COMPLETED', 'CLOSED', 'CANCELLED']

const CATEGORY_LABELS: Record<string, string> = {
  it_support: 'IT Support',
  IT_SUPPORT: 'IT Support',
  maintenance: 'Maintenance',
  equipment: 'Equipment',
  room_reservation: 'Room',
  reservation: 'Room',
  administrative: 'Administrative',
  internship: 'Internship',
  appointment: 'Appointment',
  transcript: 'Transcript',
  enrollment: 'Enrollment',
}

type TabKey = 'assigned' | 'pending' | 'department' | 'overdue'

function isOverdue(req: any) {
  if (!req.dueDate && !req.dueAt) return false
  const s = req.status?.toLowerCase()
  return new Date(req.dueDate ?? req.dueAt) < new Date() && s !== 'completed' && s !== 'closed'
}

export default function StaffInboxPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [requests, setRequests] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('assigned')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [activeStatus, setActiveStatus] = useState('')
  const [activePriority, setActivePriority] = useState('')

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const token = localStorage.getItem('access_token')
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
        const res = await fetch(`${backendUrl}/requests/inbox`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setRequests(
            Array.isArray(data)
              ? data.map((item: any) => ({
                  id: item.id,
                  requestNo: item.requestNo,
                  title: item.title,
                  category: item.requestType?.category || item.requestType?.key || 'general',
                  status: item.status,
                  priority: item.priority,
                  createdAt: item.createdAt,
                  dueAt: item.dueAt,
                  requesterName: item.requester?.fullName ?? item.requesterName,
                  assignedToMe: item.assignedToMe === true,
                }))
              : [],
          )
        }
      } catch {
        toast.error(t('pages.inboxLoadFail'))
      } finally {
        setIsLoading(false)
      }
    }
    void fetchRequests()
  }, [t])

  const assigned = requests.filter((r) => r.assignedToMe === true)
  const pending = requests.filter((r) =>
    ['pending', 'submitted', 'waiting_approval'].includes(r.status?.toLowerCase()),
  )
  const department = requests.filter((r) =>
    ['pending', 'submitted', 'in_review', 'in_progress'].includes(r.status?.toLowerCase()),
  )
  const overdue = requests.filter(isOverdue)

  const counts: Record<TabKey, number> = {
    assigned: assigned.length,
    pending: pending.length,
    department: department.length,
    overdue: overdue.length,
  }

  const baseRows: any[] =
    activeTab === 'assigned' ? assigned :
    activeTab === 'pending' ? pending :
    activeTab === 'department' ? department :
    overdue

  const filtered = baseRows.filter((r) => {
    if (activeStatus && r.status?.toUpperCase() !== activeStatus) return false
    if (activePriority && r.priority !== activePriority) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      r.title?.toLowerCase().includes(q) ||
      r.requestNo?.toLowerCase().includes(q) ||
      r.requesterName?.toLowerCase().includes(q) ||
      r.category?.toLowerCase().includes(q)
    )
  })

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const tabs = [
    { key: 'assigned', label: t('pages.assignedToMe'), count: counts.assigned },
    { key: 'pending', label: t('pages.pendingApproval'), count: counts.pending },
    { key: 'department', label: t('pages.departmentQueue'), count: counts.department },
    { key: 'overdue', label: t('pages.overdue'), count: counts.overdue, danger: true },
  ]

  return (
    <StaffListShell
      title={t('pages.inboxTitle')}
      subtitle={t('pages.inboxSubtitle')}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(k) => setActiveTab(k as TabKey)}
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder={t('requests.searchPlaceholder')}
      statusOptions={INBOX_STATUSES}
      activeStatus={activeStatus}
      onStatusChange={(s) => { setActiveStatus(s); setPage(1) }}
      activePriority={activePriority}
      onPriorityChange={(p) => { setActivePriority(p); setPage(1) }}
      isLoading={isLoading}
      totalCount={filtered.length}
      page={page}
      pageSize={PAGE_SIZE}
      onPageChange={setPage}
      emptyIcon={<Inbox className="size-8" />}
      emptyTitle={
        activeTab === 'assigned' ? t('pages.noAssignedRequests') :
        activeTab === 'pending' ? t('pages.noPendingApprovals') :
        activeTab === 'department' ? t('pages.departmentQueueEmpty') :
        t('pages.noOverdueItems')
      }
      emptyDesc={
        activeTab === 'overdue' ? t('pages.allWithinDeadlines') :
        t('pages.newRequestsAppear')
      }
    >
      {paged.map((req) => {
        const overdueMark = isOverdue(req)
        const cat = CATEGORY_LABELS[req.category] ?? req.category ?? ''
        const slug = req.category?.toLowerCase().replace('_', '-') || 'general'
        return (
          <StaffRequestRow
            key={req.id}
            href={`/staff/requests/${slug}/${req.id}`}
            title={req.title}
            requestNo={req.requestNo ? `#${req.requestNo}` : `#${req.id.slice(-6).toUpperCase()}`}
            badge={cat || undefined}
            metaLeft={[
              req.requesterName || 'Unknown',
              req.dueAt ? `Due ${formatDate(req.dueAt)}` : formatDate(req.createdAt),
            ]}
            status={req.status}
            priority={req.priority}
            isOverdue={overdueMark}
          />
        )
      })}
    </StaffListShell>
  )
}
