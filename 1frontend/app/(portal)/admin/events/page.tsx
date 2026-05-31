'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Search, Loader2, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/status-badge'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

function fmt(d: string) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtDatetime(d: string) {
  if (!d) return '-'
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AdminEventsPage() {
  const { t } = useI18n()
  const [data, setData] = useState<{ items: any[]; metrics: any } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/admin/events`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      toast.error(t('events.loadFail'))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => { void fetchData() }, [fetchData])

  const filtered = useMemo(() => {
    if (!data) return []
    return data.items.filter((r) => {
      const status = r.request?.status ?? ''
      if (statusFilter !== 'all' && status !== statusFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          r.eventName?.toLowerCase().includes(q) ||
          r.organizer?.profile?.fullName?.toLowerCase().includes(q) ||
          r.request?.requestNo?.toLowerCase().includes(q) ||
          r.eventType?.toLowerCase().includes(q) ||
          r.club?.name?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [data, search, statusFilter])

  const m = data?.metrics ?? { total: 0, pending: 0, approved: 0, rejected: 0 }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5 pb-20">
      <div>
        <h1 className="text-xl font-bold text-foreground">{t('events.title')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('events.subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: t('events.total'),    value: m.total,    color: 'text-foreground' },
          { label: t('events.pending'),  value: m.pending,  color: 'text-amber-600' },
          { label: t('events.approved'), value: m.approved, color: 'text-emerald-600' },
          { label: t('events.rejected'), value: m.rejected, color: 'text-red-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-lg p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn('text-2xl font-bold mt-1', color)}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={t('events.searchPlaceholder')}
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring shrink-0"
        >
          <option value="all">{t('events.allStatuses')}</option>
          {['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL', 'APPROVED', 'REJECTED', 'COMPLETED', 'CLOSED'].map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <AlertCircle className="size-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">{t('events.noEvents')}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-muted/30 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">{r.eventName}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                    {r.request?.requestNo && (
                      r.request?.id ? (
                        <Link href={`/admin/requests/${r.request.id}`} className="font-mono text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                          {r.request.requestNo}
                        </Link>
                      ) : (
                        <span className="font-mono">{r.request.requestNo}</span>
                      )
                    )}
                    {r.eventType && <span>{r.eventType}</span>}
                    {r.organizer?.profile?.fullName && <span>{r.organizer.profile.fullName}</span>}
                    {r.startAt && <span>{fmtDatetime(r.startAt)}</span>}
                    {r.expectedAttendance && <span>{r.expectedAttendance} attendees</span>}
                    {r.createdAt && <span>{fmt(r.createdAt)}</span>}
                  </div>
                </div>
                <StatusBadge status={r.request?.status ?? 'SUBMITTED'} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
