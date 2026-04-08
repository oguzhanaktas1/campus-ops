'use client'

import { useEffect, useState, useCallback } from 'react'
import { BarChart2, FileText, Ticket, BookMarked, CalendarDays, Loader2, TrendingUp, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getToken } from '@/lib/auth'

interface ReportData {
  totalRequests: number
  openRequests: number
  resolvedRequests: number
  avgResolutionDays: number
  totalTickets: number
  openTickets: number
  totalReservations: number
  totalAppointments: number
  requestsByStatus: { status: string; count: number }[]
  requestsByType: { type: string; count: number }[]
}

const STATUS_BADGE: Record<string, string> = {
  SUBMITTED: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
  IN_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
  REJECTED: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
  CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-700',
  REVISION_REQUESTED: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800',
}

function StatCard({ icon, label, value, sub, iconClass }: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  iconClass?: string
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={cn('size-10 rounded-lg flex items-center justify-center', iconClass ?? 'bg-primary/10 text-primary')}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdminReportsPage() {
  const [data, setData] = useState<ReportData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchReport = useCallback(async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const res = await fetch(`${backendUrl}/admin/reports`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      toast.error('Failed to load report data.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchReport() }, [fetchReport])

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Generating reports...</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  const maxStatusCount = Math.max(...(data.requestsByStatus?.map(s => s.count) ?? [1]))
  const maxTypeCount = Math.max(...(data.requestsByType?.map(t => t.count) ?? [1]))

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto pb-20">
      <div>
        <h1 className="text-xl font-bold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Platform-wide analytics and operational summary.</p>
      </div>

      {/* Stat Cards Row 1 — Requests */}
      <div>
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
          <FileText className="size-3.5" /> Requests
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<FileText className="size-5" />}
            label="Total Requests"
            value={data.totalRequests ?? 0}
            iconClass="bg-primary/10 text-primary"
          />
          <StatCard
            icon={<TrendingUp className="size-5" />}
            label="Open Requests"
            value={data.openRequests ?? 0}
            sub="Awaiting action"
            iconClass="bg-amber-100 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400"
          />
          <StatCard
            icon={<BarChart2 className="size-5" />}
            label="Resolved"
            value={data.resolvedRequests ?? 0}
            iconClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
          />
          <StatCard
            icon={<Clock className="size-5" />}
            label="Avg. Resolution"
            value={data.avgResolutionDays != null ? `${data.avgResolutionDays}d` : '—'}
            sub="Days to resolve"
            iconClass="bg-blue-100 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400"
          />
        </div>
      </div>

      {/* Stat Cards Row 2 — Other */}
      <div>
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
          <BarChart2 className="size-3.5" /> Platform Overview
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            icon={<Ticket className="size-5" />}
            label="Total Tickets"
            value={data.totalTickets ?? 0}
            sub={`${data.openTickets ?? 0} open`}
            iconClass="bg-purple-100 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400"
          />
          <StatCard
            icon={<BookMarked className="size-5" />}
            label="Total Reservations"
            value={data.totalReservations ?? 0}
            iconClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
          />
          <StatCard
            icon={<CalendarDays className="size-5" />}
            label="Total Appointments"
            value={data.totalAppointments ?? 0}
            iconClass="bg-blue-100 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400"
          />
        </div>
      </div>

      {/* Breakdown Tables */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* By Status */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Requests by Status</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {data.requestsByStatus?.length > 0 ? (
              <div className="space-y-3">
                {data.requestsByStatus.map(row => (
                  <div key={row.status} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        'text-xs font-semibold px-2 py-0.5 rounded-full border',
                        STATUS_BADGE[row.status] ?? 'bg-muted text-muted-foreground border-border'
                      )}>
                        {row.status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm font-bold text-foreground">{row.count}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${Math.round((row.count / maxStatusCount) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-6">No data available.</p>
            )}
          </CardContent>
        </Card>

        {/* By Type */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Requests by Type</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {data.requestsByType?.length > 0 ? (
              <div className="space-y-3">
                {data.requestsByType.map((row, i) => {
                  const colors = [
                    'bg-primary', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500',
                    'bg-blue-500', 'bg-red-500', 'bg-pink-500', 'bg-cyan-500',
                  ]
                  return (
                    <div key={row.type} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-foreground truncate max-w-[180px]">
                          {row.type?.replace(/_/g, ' ')}
                        </span>
                        <span className="text-sm font-bold text-foreground">{row.count}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', colors[i % colors.length])}
                          style={{ width: `${Math.round((row.count / maxTypeCount) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-6">No data available.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
