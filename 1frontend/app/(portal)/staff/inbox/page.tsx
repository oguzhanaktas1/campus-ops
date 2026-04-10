'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { StatusBadge } from '@/components/status-badge'
import { PriorityBadge } from '@/components/status-badge'
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

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'assigned', label: 'Assigned to Me', icon: <UserCheck className="size-3.5" /> },
  { key: 'pending', label: 'Pending Approval', icon: <Clock className="size-3.5" /> },
  { key: 'department', label: 'Department Queue', icon: <Users className="size-3.5" /> },
  { key: 'overdue', label: 'Overdue', icon: <AlertTriangle className="size-3.5" /> },
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
  if (!d) return '—'
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
              : []
          )
        } else {
          setRequests([])
        }
      } catch {
        toast.error('Failed to load inbox.')
        setRequests([])
      } finally {
        setIsLoading(false)
      }
    }
    fetchRequests()
  }, [])

  const getTabRequests = (tab: TabKey): StaffRequest[] => {
    switch (tab) {
      case 'assigned':
        return requests.filter((r) => r.assignedToMe === true)
      case 'pending':
        return requests.filter((r) =>
          ['pending', 'submitted', 'waiting_approval'].includes(r.status?.toLowerCase())
        )
      case 'department':
        return requests.filter((r) =>
          ['pending', 'submitted', 'in_review', 'in_progress'].includes(r.status?.toLowerCase())
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
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto pb-20">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Inbox className="size-5 text-primary" /> Inbox — Work Queue
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Prioritized work queue and department assignments
        </p>
      </div>

      {/* Overdue banner */}
      {tabCounts.overdue > 0 && activeTab !== 'overdue' && (
        <button
          onClick={() => setActiveTab('overdue')}
          className="w-full flex items-center gap-3 p-3 rounded-lg bg-destructive/8 border border-destructive/20 hover:bg-destructive/12 transition-colors text-left"
        >
          <AlertTriangle className="size-4 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive font-medium">
            {tabCounts.overdue} overdue item{tabCounts.overdue > 1 ? 's' : ''} require immediate attention
          </p>
          <span className="ml-auto text-xs text-destructive underline">View overdue</span>
        </button>
      )}

      {/* Main card */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-border overflow-x-auto">
          {TABS.map((tab) => {
            const count = tabCounts[tab.key]
            const isOverdueTab = tab.key === 'overdue'
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3.5 text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0',
                  activeTab === tab.key
                    ? isOverdueTab
                      ? 'text-destructive border-b-2 border-destructive bg-destructive/5'
                      : 'text-primary border-b-2 border-primary bg-primary/5'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                )}
              >
                {tab.icon}
                {tab.label}
                {count > 0 && (
                  <span
                    className={cn(
                      'text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                      activeTab === tab.key
                        ? isOverdueTab
                          ? 'bg-destructive/15 text-destructive'
                          : 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground',
                      isOverdueTab && PRIORITY_PULSE['CRITICAL']
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Table */}
        {rows.length === 0 ? (
          <EmptyState
            title={
              activeTab === 'assigned'
                ? 'No assigned requests'
                : activeTab === 'pending'
                ? 'No pending approvals'
                : activeTab === 'department'
                ? 'Department queue is empty'
                : 'No overdue items'
            }
            description={
              activeTab === 'overdue'
                ? 'All items are within their deadlines.'
                : 'New requests will appear here as they come in.'
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
                <tr className="bg-muted/40 border-b border-border">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Request No
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Title
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Requester
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((req) => {
                  const overdue = isOverdue(req)
                  const isCritical = req.priority?.toUpperCase() === 'CRITICAL'
                  const catLabel =
                    CATEGORY_LABELS[req.category?.toLowerCase()] || req.category || '—'

                  return (
                    <Link
                      key={req.id}
                      href={`/staff/requests/${req.category?.toLowerCase() || 'general'}/${req.id}`}
                      legacyBehavior
                    >
                      <tr
                        className={cn(
                          'hover:bg-muted/20 transition-colors cursor-pointer',
                          overdue && 'bg-destructive/5 hover:bg-destructive/10'
                        )}
                      >
                        <td className="px-5 py-4">
                          <span className="font-mono text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                            {getDisplayRequestNumber(req)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground max-w-[200px] truncate">
                              {req.title}
                            </p>
                            {isCritical && (
                              <span className="flex-shrink-0 size-2 rounded-full bg-destructive animate-pulse" />
                            )}
                            {overdue && (
                              <span className="flex-shrink-0 text-[9px] font-bold text-destructive bg-destructive/10 border border-destructive/20 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                Overdue
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-muted-foreground text-xs">{catLabel}</td>
                        <td className="px-5 py-4">
                          <PriorityBadge priority={req.priority} />
                        </td>
                        <td className="px-5 py-4">
                          {req.dueDate ? (
                            <span
                              className={cn(
                                'text-xs',
                                overdue ? 'text-destructive font-semibold' : 'text-muted-foreground'
                              )}
                            >
                              {formatDate(req.dueDate)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={req.status} />
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            <div className="size-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[9px] font-bold flex-shrink-0">
                              {req.requesterName?.charAt(0) || 'U'}
                            </div>
                            <span className="text-muted-foreground text-xs truncate max-w-[100px]">
                              {req.requesterName || 'Unknown'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    </Link>
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
