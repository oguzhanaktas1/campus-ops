'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/status-badge'
import { cn } from '@/lib/utils'
import {
  Boxes,
  Search,
  Loader2,
  Package,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { getToken } from '@/lib/auth'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STOCK_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  IN_STOCK:        { label: 'In Stock',       className: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  LOW_STOCK:       { label: 'Low Stock',       className: 'text-amber-600 bg-amber-50 border-amber-200' },
  OUT_OF_STOCK:    { label: 'Out of Stock',    className: 'text-destructive bg-destructive/5 border-destructive/20' },
  PROCUREMENT_REQ: { label: 'Needs Procurement', className: 'text-blue-600 bg-blue-50 border-blue-200' },
}

export default function StaffEquipmentPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')

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

  const filtered = requests.filter(
    (r) =>
      search === '' ||
      r.equipmentName?.toLowerCase().includes(search.toLowerCase()) ||
      r.equipmentCategory?.toLowerCase().includes(search.toLowerCase()) ||
      r.requesterName?.toLowerCase().includes(search.toLowerCase()),
  )

  const counts = {
    total: requests.length,
    withStock: requests.filter((r) => r.stockCheckStatus === 'IN_STOCK').length,
    needsProcurement: requests.filter((r) => r.procurementRequired).length,
    urgent: requests.filter((r) => r.priority === 'URGENT' || r.priority === 'HIGH').length,
  }

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Equipment Requests</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {requests.length} open equipment requests in queue.
          </p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Open', value: counts.total, icon: <Package className="size-4" />, className: '' },
          { label: 'In Stock', value: counts.withStock, icon: <CheckCircle2 className="size-4" />, className: 'text-emerald-600' },
          { label: 'Needs Procurement', value: counts.needsProcurement, icon: <AlertCircle className="size-4" />, className: 'text-amber-600' },
          { label: 'High Priority', value: counts.urgent, icon: <Clock className="size-4" />, className: counts.urgent > 0 ? 'text-destructive' : '' },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">{s.icon}{s.label}</div>
            <p className={cn('text-2xl font-bold', s.className || 'text-foreground')}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by equipment, category, or requester..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <Boxes className="size-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {search ? 'No matching equipment requests.' : 'No open equipment requests.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {['Equipment', 'Category', 'Qty', 'Requester', 'Needed From', 'Stock', 'Status', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((req) => {
                  const stockCfg = req.stockCheckStatus
                    ? STOCK_STATUS_CONFIG[req.stockCheckStatus]
                    : null

                  return (
                    <tr
                      key={req.id}
                      onClick={() => router.push(`/staff/requests/equipment/${req.id}`)}
                      className="hover:bg-muted/20 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-foreground truncate max-w-[180px]">
                          {req.equipmentName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{req.requestNo}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs bg-muted px-2 py-0.5 rounded font-medium">
                          {req.equipmentCategory}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center font-semibold">{req.quantity}</td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        {req.requesterName ?? '—'}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        {formatDate(req.neededFrom)}
                      </td>
                      <td className="px-4 py-3.5">
                        {stockCfg ? (
                          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded border', stockCfg.className)}>
                            {stockCfg.label}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                        {req.procurementRequired && (
                          <p className="text-[10px] text-amber-600 mt-0.5 font-medium">Procurement req.</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={req.status} />
                      </td>
                      <td className="px-4 py-3.5">
                        <Button variant="ghost" size="icon" className="size-7 pointer-events-none">
                          <ChevronRight className="size-4" />
                        </Button>
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
