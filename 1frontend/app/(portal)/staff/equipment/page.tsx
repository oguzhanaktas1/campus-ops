'use client'

import { useState, useEffect, useCallback } from 'react'
import { Package } from 'lucide-react'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { StaffListShell } from '@/components/staff/staff-list-shell'
import { StaffRequestRow, formatDate } from '@/components/staff/staff-request-row'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
const PAGE_SIZE = 20
const ALL_STATUSES = ['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL', 'APPROVED', 'REJECTED', 'COMPLETED', 'CLOSED']

const STOCK_LABEL: Record<string, string> = {
  IN_STOCK: 'In Stock',
  LOW_STOCK: 'Low Stock',
  OUT_OF_STOCK: 'Out of Stock',
  PROCUREMENT_REQ: 'Needs Procurement',
}

export default function StaffEquipmentPage() {
  const { t } = useI18n()
  const [requests, setRequests] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [activeStatus, setActiveStatus] = useState('')
  const [activePriority, setActivePriority] = useState('')

  const fetchInbox = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/equipment-requests/inbox`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      setRequests(res.ok ? await res.json() : [])
    } catch {
      setRequests([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void fetchInbox() }, [fetchInbox])

  const byStatus = filter === 'all' ? requests : requests.filter((r) => r.status === filter)

  const filtered = byStatus.filter((r) => {
    if (activeStatus && r.status !== activeStatus) return false
    if (activePriority && r.priority !== activePriority) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      r.equipmentName?.toLowerCase().includes(q) ||
      r.equipmentCategory?.toLowerCase().includes(q) ||
      r.requesterName?.toLowerCase().includes(q) ||
      r.requestNo?.toLowerCase().includes(q)
    )
  })

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const tabs = [
    { key: 'all', label: t('common.all'), count: requests.length },
    ...ALL_STATUSES.map((s) => ({
      key: s,
      label: s.replace(/_/g, ' '),
      count: requests.filter((r) => r.status === s).length,
    })).filter((tab) => tab.count > 0),
  ]

  return (
    <StaffListShell
      title={t('pages.equipmentRequests')}
      subtitle={t('pages.equipmentSubtitle', { count: requests.length })}
      tabs={tabs}
      activeTab={filter}
      onTabChange={setFilter}
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder={t('pages.equipmentSearchPlaceholder')}
      statusOptions={ALL_STATUSES}
      activeStatus={activeStatus}
      onStatusChange={(s) => { setActiveStatus(s); setPage(1) }}
      activePriority={activePriority}
      onPriorityChange={(p) => { setActivePriority(p); setPage(1) }}
      isLoading={isLoading}
      totalCount={filtered.length}
      page={page}
      pageSize={PAGE_SIZE}
      onPageChange={setPage}
      emptyIcon={<Package className="size-8" />}
      emptyTitle={search ? t('pages.noMatchingEquipment') : t('pages.noOpenEquipment')}
    >
      {paged.map((req) => {
        const stockBadge = req.stockCheckStatus ? STOCK_LABEL[req.stockCheckStatus] : undefined
        return (
          <StaffRequestRow
            key={req.id}
            href={`/staff/requests/equipment/${req.id}`}
            title={req.equipmentName || 'Equipment Request'}
            requestNo={req.requestNo}
            badge={req.equipmentCategory}
            metaLeft={[
              req.requesterName,
              req.neededFrom ? `Needed: ${formatDate(req.neededFrom)}` : undefined,
              stockBadge,
              req.quantity ? `Qty: ${req.quantity}` : undefined,
            ]}
            status={req.status}
            priority={req.priority}
          />
        )
      })}
    </StaffListShell>
  )
}
