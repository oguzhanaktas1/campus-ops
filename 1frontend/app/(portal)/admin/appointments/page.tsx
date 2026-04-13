'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { CalendarDays, Search, Loader2, Clock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Appointment {
  id: string
  requestId?: string | null
  hostName: string
  requesterName: string
  scheduledAt: string
  status: string
  notes?: string
  createdAt: string
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
  REQUESTED: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
  CONFIRMED: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
  REJECTED: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800',
  CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-700',
  COMPLETED: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
}

function formatDateTime(d: string) {
  if (!d) return '-'
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function formatDate(d: string) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function AdminAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const fetchAppointments = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token')
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const res = await fetch(`${backendUrl}/admin/appointments`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      setAppointments(await res.json())
    } catch {
      toast.error('Failed to load appointments.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void fetchAppointments() }, [fetchAppointments])

  const filtered = useMemo(() => {
    return appointments.filter(a => {
      const matchSearch =
        search === '' ||
        a.hostName?.toLowerCase().includes(search.toLowerCase()) ||
        a.requesterName?.toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === 'all' || a.status?.toUpperCase() === statusFilter
      const matchFrom = !dateFrom || new Date(a.scheduledAt) >= new Date(dateFrom)
      const matchTo = !dateTo || new Date(a.scheduledAt) <= new Date(dateTo + 'T23:59:59')
      return matchSearch && matchStatus && matchFrom && matchTo
    })
  }, [appointments, search, statusFilter, dateFrom, dateTo])

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading appointments...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto pb-20">
      <div>
        <h1 className="text-xl font-bold text-foreground">Appointments</h1>
        <p className="text-sm text-muted-foreground mt-0.5">All appointments across the platform.</p>
        <p className="text-xs text-muted-foreground mt-1">Use the request link to open the unified admin request detail.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by host or requester..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-background border border-input rounded-md px-3 h-10 text-sm focus:ring-2 focus:ring-primary outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="REQUESTED">Requested</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="COMPLETED">Completed</option>
        </select>
        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-auto" title="From date" />
        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-auto" title="To date" />
      </div>

      <p className="text-xs text-muted-foreground font-medium">{filtered.length} appointments</p>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Request</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Host</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Requester</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Scheduled</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Notes</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden xl:table-cell">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(a => (
                <tr key={a.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3.5">
                    {a.requestId ? (
                      <Link href={`/admin/requests/${a.requestId}`} className="text-xs font-mono text-primary hover:underline">
                        Open request
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary border border-primary/20">
                        {a.hostName?.charAt(0) ?? '?'}
                      </div>
                      <p className="font-medium text-foreground">{a.hostName}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden sm:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                        {a.requesterName?.charAt(0) ?? '?'}
                      </div>
                      <span className="text-sm">{a.requesterName}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="size-3.5" /> {formatDateTime(a.scheduledAt)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={cn(
                      'text-xs font-semibold px-2.5 py-1 rounded-full border',
                      STATUS_BADGE[a.status?.toUpperCase()] ?? STATUS_BADGE.PENDING,
                    )}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 hidden lg:table-cell max-w-[180px]">
                    <p className="text-xs text-muted-foreground truncate">{a.notes || '-'}</p>
                  </td>
                  <td className="px-5 py-3.5 hidden xl:table-cell text-xs text-muted-foreground">
                    {formatDate(a.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-16">
              <CalendarDays className="size-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">No appointments found.</p>
              <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or date range.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
