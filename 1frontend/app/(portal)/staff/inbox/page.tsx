'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { StatusBadge, PriorityBadge } from '@/components/status-badge'
import { EmptyState } from '@/components/empty-state'
import {
  Inbox,
  Loader2,
  Clock,
  AlertTriangle,
  Users,
  UserCheck,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n'

interface StaffRequest {
  id: string
  requestNo?: string
  title: string
  category: string
  status: string
  priority: string
  createdAt: string
  dueDate?: string
  requesterName?: string
  assignedToMe?: boolean
}

type TabKey = 'assigned' | 'pending' | 'department' | 'overdue'

const TABS: { key: TabKey; icon: React.ReactNode }[] = [
  { key: 'assigned', icon: <UserCheck className="size-3.5" /> },
  { key: 'pending', icon: <Clock className="size-3.5" /> },
  { key: 'department', icon: <Users className="size-3.5" /> },
  { key: 'overdue', icon: <AlertTriangle className="size-3.5" /> },
]

const PRIORITY_PULSE: Record<string, string> = {
  CRITICAL: 'animate-pulse',
}

const CATEGORY_LABELS: Record<string, string> = {
  it_support: 'IT Support',
  maintenance: 'Maintenance',
  equipment: 'Equipment',
  room_reservation: 'Room Reservation',
  reservation: 'Reservation',
  administrative: 'Administrative',
  internship: 'Internship',
  appointment: 'Appointment',
  transcript: 'Transcript',
  enrollment: 'Enrollment',
}

function formatDate(d: string) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getRequestNumber(id: string) {
  return `#${id.slice(-6).toUpperCase()}`
}

function getDisplayRequestNumber(req: StaffRequest) {
  return req.requestNo || getRequestNumber(req.id)
}

function isOverdue(req: StaffRequest) {
  if (!req.dueDate) return false
  const s = req.status?.toLowerCase()
  return new Date(req.dueDate) < new Date() && s !== 'completed' && s !== 'closed'
}

export default function StaffInboxPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [requests, setRequests] = useState<StaffRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('assigned')

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
                  dueDate: item.dueAt,
                  requesterName: item.requester?.fullName,
                  assignedToMe: item.assignedToMe === true,
                }))
              : [],
          )
        } else {
          setRequests([])
        }
      } catch {
        toast.error(t('pages.inboxLoadFail'))
        setRequests([])
      } finally {
        setIsLoading(false)
      }
    }
    void fetchRequests()
  }, [t])

  const getTabRequests = (tab: TabKey): StaffRequest[] => {
    switch (tab) {
      case 'assigned':
        return requests.filter((r) => r.assignedToMe === true)
      case 'pending':
        return requests.filter((r) =>
          ['pending', 'submitted', 'waiting_approval'].includes(r.status?.toLowerCase()),
        )
      case 'department':
        return requests.filter((r) =>
          ['pending', 'submitted', 'in_review', 'in_progress'].includes(r.status?.toLowerCase()),
        )
      case 'overdue':
        return requests.filter(isOverdue)
      default:
        return []
    }
  }

  const tabCounts = TABS.reduce<Record<TabKey, number>>((acc, tab) => {
    acc[tab.key] = getTabRequests(tab.key).length
    return acc
  }, {} as Record<TabKey, number>)

  const rows = getTabRequests(activeTab)

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 pb-20">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
          <Inbox className="size-5 text-primary" /> {t('pages.inboxTitle')}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {t('pages.inboxSubtitle')}
        </p>
      </div>

      {tabCounts.overdue > 0 && activeTab !== 'overdue' && (
        <button
          onClick={() => setActiveTab('overdue')}
          className="flex w-full items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/8 p-3 text-left transition-colors hover:bg-destructive/12"
        >
          <AlertTriangle className="size-4 flex-shrink-0 text-destructive" />
          <p className="text-sm font-medium text-destructive">
            {t('pages.overdueAttention', { count: tabCounts.overdue, suffix: tabCounts.overdue > 1 ? 's' : '' })}
          </p>
          <span className="ml-auto text-xs text-destructive underline">{t('pages.viewOverdue')}</span>
        </button>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="flex overflow-x-auto border-b border-border">
          {TABS.map((tab) => {
            const count = tabCounts[tab.key]
            const isOverdueTab = tab.key === 'overdue'
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex flex-shrink-0 items-center gap-2 whitespace-nowrap px-4 py-3.5 text-xs font-medium transition-colors',
                  activeTab === tab.key
                    ? isOverdueTab
                      ? 'border-b-2 border-destructive bg-destructive/5 text-destructive'
                      : 'border-b-2 border-primary bg-primary/5 text-primary'
                    : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground',
                )}
              >
                {tab.icon}
                {tab.key === 'assigned' ? t('pages.assignedToMe') : tab.key === 'pending' ? t('pages.pendingApproval') : tab.key === 'department' ? t('pages.departmentQueue') : t('pages.overdue')}
                {count > 0 && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[9px] font-bold',
                      activeTab === tab.key
                        ? isOverdueTab
                          ? 'bg-destructive/15 text-destructive'
                          : 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground',
                      isOverdueTab && PRIORITY_PULSE.CRITICAL,
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title={
              activeTab === 'assigned'
                ? t('pages.noAssignedRequests')
                : activeTab === 'pending'
                  ? t('pages.noPendingApprovals')
                  : activeTab === 'department'
                    ? t('pages.departmentQueueEmpty')
                    : t('pages.noOverdueItems')
            }
            description={
              activeTab === 'overdue'
                ? t('pages.allWithinDeadlines')
                : t('pages.newRequestsAppear')
            }
            icon={
              activeTab === 'overdue' ? (
                <CheckCircle2 className="size-6 text-emerald-500" />
              ) : (
                <Inbox className="size-6" />
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('pages.requestNo')}
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('common.title')}
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('requests.type')}
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('common.priority')}
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('pages.dueDate')}
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('common.status')}
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('common.requester')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((req) => {
                  const overdue = isOverdue(req)
                  const isCritical = req.priority?.toUpperCase() === 'CRITICAL'
                  const catLabel =
                    CATEGORY_LABELS[req.category?.toLowerCase()] || req.category || '-'
                  const detailHref = `/staff/requests/${req.category?.toLowerCase() || 'general'}/${req.id}`

                  return (
                    <tr
                      key={req.id}
                      onClick={() => router.push(detailHref)}
                      className={cn(
                        'cursor-pointer transition-colors hover:bg-muted/20',
                        overdue && 'bg-destructive/5 hover:bg-destructive/10',
                      )}
                    >
                      <td className="px-5 py-4">
                        <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                          {getDisplayRequestNumber(req)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <p className="max-w-[200px] truncate font-medium text-foreground">
                            {req.title}
                          </p>
                          {isCritical && (
                            <span className="size-2 flex-shrink-0 rounded-full bg-destructive animate-pulse" />
                          )}
                          {overdue && (
                            <span className="flex-shrink-0 rounded border border-destructive/20 bg-destructive/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-destructive">
                              Overdue
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs text-muted-foreground">{catLabel}</td>
                      <td className="px-5 py-4">
                        <PriorityBadge priority={req.priority} />
                      </td>
                      <td className="px-5 py-4">
                        {req.dueDate ? (
                          <span
                            className={cn(
                              'text-xs',
                              overdue ? 'font-semibold text-destructive' : 'text-muted-foreground',
                            )}
                          >
                            {formatDate(req.dueDate)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">-</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={req.status} />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <div className="flex size-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
                            {req.requesterName?.charAt(0) || 'U'}
                          </div>
                          <span className="max-w-[100px] truncate text-xs text-muted-foreground">
                            {req.requesterName || 'Unknown'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
