'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n'
import { StaffListShell } from '@/components/staff/staff-list-shell'
import { StaffRequestRow, formatDate } from '@/components/staff/staff-request-row'

const PAGE_SIZE = 20
const TERMINAL = new Set(['APPROVED', 'REJECTED', 'COMPLETED', 'CLOSED', 'CANCELLED'])
const REQUEST_STATUSES = ['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL', 'APPROVED', 'REJECTED', 'COMPLETED', 'CLOSED', 'CANCELLED']

const categorySlugMap: Record<string, string> = {
  IT_SUPPORT: 'it-support',
  ADMINISTRATIVE: 'administrative',
  INVENTORY: 'inventory',
  CAMPUS_SERVICES: 'campus-services',
  STUDENT_LIFE: 'student-life',
}

type TabKey = 'active' | 'unassigned' | 'all' | 'closed'

export default function StaffRequestsPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [requests, setRequests] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('active')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [activeStatus, setActiveStatus] = useState('')
  const [activePriority, setActivePriority] = useState('')

  useEffect(() => {
    const fetchRequests = async () => {
      setIsLoading(true)
      try {
        const token = localStorage.getItem('access_token')
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
        const res = await fetch(`${backendUrl}/staff/requests?filter=${activeTab}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) setRequests(await res.json())
      } catch {
        toast.error(t('requests.loadFail'))
      } finally {
        setIsLoading(false)
      }
    }
    void fetchRequests()
  }, [activeTab, t])

  const allReqs = requests
  const active = requests.filter((r) => !TERMINAL.has(r.status))
  const unassigned = requests.filter((r) => !r.assignedTo && !TERMINAL.has(r.status))
  const closed = requests.filter((r) => TERMINAL.has(r.status))

  const filtered = allReqs.filter((r) => {
    if (activeStatus && r.status !== activeStatus) return false
    if (activePriority && r.priority !== activePriority) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      r.title?.toLowerCase().includes(q) ||
      r.requestNo?.toLowerCase().includes(q) ||
      r.requesterName?.toLowerCase().includes(q) ||
      r.typeName?.toLowerCase().includes(q)
    )
  })

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const tabs = [
    { key: 'active', label: t('requests.active'), count: allReqs.filter((r) => !TERMINAL.has(r.status)).length },
    { key: 'unassigned', label: t('requests.needsAssignment'), count: allReqs.filter((r) => !r.assignedTo && !TERMINAL.has(r.status)).length },
    { key: 'all', label: t('requests.allRequests'), count: allReqs.length },
    { key: 'closed', label: t('requests.closed'), count: allReqs.filter((r) => TERMINAL.has(r.status)).length },
  ]

  return (
    <StaffListShell
      title={t('requests.title')}
      subtitle={t('requests.subtitle')}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(k) => setActiveTab(k as TabKey)}
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder={t('requests.searchPlaceholder')}
      statusOptions={REQUEST_STATUSES}
      activeStatus={activeStatus}
      onStatusChange={(s) => { setActiveStatus(s); setPage(1) }}
      activePriority={activePriority}
      onPriorityChange={(p) => { setActivePriority(p); setPage(1) }}
      isLoading={isLoading}
      totalCount={filtered.length}
      page={page}
      pageSize={PAGE_SIZE}
      onPageChange={setPage}
      emptyIcon={<FileText className="size-8" />}
      emptyTitle={t('requests.noRequests')}
      emptyDesc={search ? t('requests.searchHint') : t('requests.emptyHint')}
    >
      {paged.map((req) => {
        const slug = categorySlugMap[req.category] || 'general'
        const isUnassigned = !req.assignedTo && !TERMINAL.has(req.status)
        return (
          <StaffRequestRow
            key={req.id}
            href={`/staff/requests/${slug}/${req.id}`}
            title={req.title}
            requestNo={req.requestNo}
            badge={req.typeName}
            metaLeft={[
              req.requesterName,
              formatDate(req.createdAt),
            ]}
            assignee={req.assignedTo}
            unassigned={isUnassigned}
            status={req.status}
            priority={req.priority}
          />
        )
      })}
    </StaffListShell>
  )
}
