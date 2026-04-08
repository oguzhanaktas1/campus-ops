'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { ShoppingCart, Search, Loader2, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getToken } from '@/lib/auth'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

const STATUS_BADGE: Record<string, string> = {
  SUBMITTED:        'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
  IN_REVIEW:        'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
  WAITING_APPROVAL: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800',
  APPROVED:         'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
  REJECTED:         'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800',
  COMPLETED:        'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-700',
  CLOSED:           'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-700',
}

function fmt(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtCurrency(v?: any) {
  if (v == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(v))
}

export default function AdminProcurementPage() {
  const [data, setData] = useState<{ items: any[]; metrics: any } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/admin/procurement`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      toast.error('Failed to load procurement requests.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = useMemo(() => {
    if (!data) return []
    return data.items.filter((r) => {
      const status = r.request?.status ?? ''
      if (statusFilter !== 'all' && status !== statusFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          r.itemName?.toLowerCase().includes(q) ||
          r.requester?.profile?.fullName?.toLowerCase().includes(q) ||
          r.request?.requestNo?.toLowerCase().includes(q) ||
          r.itemCategory?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [data, search, statusFilter])

  const m = data?.metrics ?? { total: 0, pending: 0, approved: 0, rejected: 0, completed: 0 }

  // Total estimated budget of all items
  const totalBudget = useMemo(() => {
    if (!data) return 0
    return data.items.reduce((sum, r) => sum + (Number(r.totalEstimate) || 0), 0)
  }, [data])

  if (isLoading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <ShoppingCart className="size-5 text-primary" /> Procurement Requests
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Review and manage all campus procurement requests.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: 'Total', value: m.total, color: 'text-foreground' },
          { label: 'Pending', value: m.pending, color: 'text-amber-600' },
          { label: 'Approved', value: m.approved, color: 'text-emerald-600' },
          { label: 'Rejected', value: m.rejected, color: 'text-red-600' },
          { label: 'Est. Budget', value: fmtCurrency(totalBudget), color: 'text-primary' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn('text-2xl font-bold mt-1', color)}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by item, requester, category..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-background border border-input rounded-md px-3 h-9 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All Statuses</option>
          {['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL', 'APPROVED', 'REJECTED', 'COMPLETED', 'CLOSED'].map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center text-center opacity-50">
            <AlertCircle className="size-10 mb-3" />
            <p className="text-sm font-medium">No procurement requests found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Request #</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Item</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Requester</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Qty</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Total Est.</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.request?.requestNo ?? '—'}</td>
                    <td className="px-4 py-3 font-medium">{r.itemName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.itemCategory}</td>
                    <td className="px-4 py-3">{r.requester?.profile?.fullName ?? '—'}</td>
                    <td className="px-4 py-3">{r.quantity}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtCurrency(r.totalEstimate)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', STATUS_BADGE[r.request?.status] ?? STATUS_BADGE.SUBMITTED)}>
                        {(r.request?.status ?? 'SUBMITTED').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fmt(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
