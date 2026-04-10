'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ShoppingCart, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

const STATUS_BADGE: Record<string, string> = {
  SUBMITTED:        'bg-blue-50 text-blue-700 border-blue-200',
  IN_REVIEW:        'bg-yellow-50 text-yellow-700 border-yellow-200',
  WAITING_APPROVAL: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED:         'bg-green-50 text-green-700 border-green-200',
  REJECTED:         'bg-red-50 text-red-700 border-red-200',
  COMPLETED:        'bg-gray-50 text-gray-500 border-gray-200',
}

function fmt(d: any) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtCurrency(v: any) {
  if (v == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(v)
}

export default function FacultyProcurementPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/procurement`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) setRequests(await res.json())
    } catch {
      toast.error('Failed to load procurement requests.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  const filtered = filter === 'all' ? requests : requests.filter((r) => r.status === filter)

  if (isLoading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ShoppingCart className="size-5 text-primary" /> Procurement Requests
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Review and approve purchasing requests in your faculty.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['all', 'SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL', 'APPROVED', 'REJECTED'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              'text-xs px-3 py-1.5 rounded-full border font-semibold transition-colors',
              filter === s
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-muted-foreground border-border hover:border-foreground'
            )}
          >
            {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm divide-y divide-border overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center text-center opacity-50">
            <AlertCircle className="size-10 mb-3" />
            <p className="text-sm font-medium">No procurement requests found.</p>
          </div>
        ) : (
          filtered.map((r) => (
            <Link
              key={r.id}
              href={`/faculty/procurement/${r.id}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">
                  {r.productName || r.title || 'Procurement Request'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {r.requestNo} · {r.requesterName}
                  {r.category && ` · ${r.category}`}
                  {r.quantity && ` · Qty: ${r.quantity}`}
                  {r.totalEstimatedCost != null && ` · ${fmtCurrency(r.totalEstimatedCost)}`}
                  {r.createdAt && ` · ${fmt(r.createdAt)}`}
                </p>
              </div>
              <span className={cn(
                'text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ml-4',
                STATUS_BADGE[r.status] ?? STATUS_BADGE.SUBMITTED
              )}>
                {r.status?.replace(/_/g, ' ')}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
