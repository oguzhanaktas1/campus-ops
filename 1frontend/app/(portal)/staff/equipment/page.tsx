'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Package, Loader2, Search, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { StatusBadge, PriorityBadge } from '@/components/status-badge'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
const PAGE_SIZE = 20

function fmtDate(d: string | null | undefined) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

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
  const [activeTab, setActiveTab] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

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

  const tabs = [
    { key: '', label: t('common.all'), count: requests.length },
    { key: 'APPROVED', label: t('common.approved'), count: requests.filter((r) => r.status === 'APPROVED').length },
    { key: 'REJECTED', label: t('common.rejected'), count: requests.filter((r) => r.status === 'REJECTED').length },
  ]

  const filtered = requests.filter((r) => {
    if (activeTab && r.status !== activeTab) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      r.equipmentName?.toLowerCase().includes(q) ||
      r.equipmentCategory?.toLowerCase().includes(q) ||
      r.requesterName?.toLowerCase().includes(q) ||
      r.requestNo?.toLowerCase().includes(q)
    )
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5 pb-20">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('pages.equipmentRequests')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('pages.equipmentSubtitle', { count: requests.length })}
          </p>
        </div>
        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder={t('pages.equipmentSearchPlaceholder')}
            className="pl-9 h-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
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
            <p className="text-sm font-medium text-foreground">
              {search ? t('pages.noMatchingEquipment') : t('pages.noOpenEquipment')}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {paged.map((req) => {
              const stockBadge = req.stockCheckStatus ? STOCK_LABEL[req.stockCheckStatus] : undefined
              return (
                <Link
                  key={req.id}
                  href={`/staff/requests/equipment/${req.id}`}
                  className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {req.equipmentName || 'Equipment Request'}
                      </p>
                      {req.requestNo && (
                        <span className="text-xs text-muted-foreground font-mono shrink-0">{req.requestNo}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {req.requesterName && <span>{req.requesterName}</span>}
                      {req.neededFrom && <span>Needed: {fmtDate(req.neededFrom)}</span>}
                      {stockBadge && <span>{stockBadge}</span>}
                      {req.quantity && <span>Qty: {req.quantity}</span>}
                      {req.equipmentCategory && <span>{req.equipmentCategory}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <PriorityBadge priority={req.priority} />
                    <StatusBadge status={req.status} />
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
