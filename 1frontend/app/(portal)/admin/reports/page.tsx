'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  BarChart2, FileText, Ticket, BookMarked, CalendarDays,
  Loader2, TrendingUp, Clock, Users, CheckCircle2, XCircle,
  AlertTriangle, RefreshCw, Download,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportData {
  totalUsers:          number
  totalRequests:       number
  openRequests:        number
  resolvedRequests:    number
  avgResolutionDays:   number | null
  overdueRequests?:    number
  approvalRate?:       number
  totalTickets:        number
  openTickets:         number
  totalReservations:   number
  totalAppointments:   number
  requestsByStatus:    { status: string; count: number }[]
  requestsByType:      { type:   string; count: number }[]
  ticketsByStatus:     { status: string; count: number }[]
}

// ─── Styling maps ─────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  SUBMITTED:          'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800',
  IN_REVIEW:          'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
  WAITING_APPROVAL:   'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800',
  APPROVED:           'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
  REJECTED:           'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800',
  COMPLETED:          'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
  CANCELLED:          'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-700',
  REVISION_REQUESTED: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/30 dark:text-pink-400 dark:border-pink-800',
  DRAFT:              'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-700',
  OPEN:               'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800',
  TRIAGED:            'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
  IN_PROGRESS:        'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800',
  WAITING_USER:       'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800',
  RESOLVED:           'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
  CLOSED:             'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-700',
  REOPENED:           'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/30 dark:text-pink-400 dark:border-pink-800',
}

const BAR_COLORS = [
  'bg-primary', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500',
  'bg-blue-500', 'bg-red-500', 'bg-pink-500', 'bg-cyan-500',
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; accent?: string
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-5 shadow-sm flex items-start justify-between gap-3">
      <div>
        <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
        <p className={cn('text-2xl font-bold text-foreground', accent)}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      <div className="size-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary flex-shrink-0">
        {icon}
      </div>
    </div>
  )
}

function ProgressRow({ label, count, max, colorClass, badge }: {
  label: string; count: number; max: number; colorClass: string; badge?: string
}) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {badge ? (
            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0', STATUS_BADGE[badge] ?? 'bg-muted text-muted-foreground border-border')}>
              {label}
            </span>
          ) : (
            <span className="text-xs font-medium text-foreground truncate">{label}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-muted-foreground">{pct}%</span>
          <span className="text-sm font-bold text-foreground w-8 text-right">{count}</span>
        </div>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', colorClass)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
        <span className="text-muted-foreground/70">{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  )
}

// ─── Export helper ────────────────────────────────────────────────────────────

function exportCSV(data: ReportData) {
  const rows: string[][] = [
    ['Metric', 'Value'],
    ['Total Requests',      String(data.totalRequests)],
    ['Open Requests',       String(data.openRequests)],
    ['Resolved Requests',   String(data.resolvedRequests)],
    ['Overdue Requests',    String(data.overdueRequests ?? 0)],
    ['Avg Resolution Days', String(data.avgResolutionDays ?? '—')],
    ['Total Users',         String(data.totalUsers)],
    ['Total Tickets',       String(data.totalTickets)],
    ['Open Tickets',        String(data.openTickets)],
    ['Total Reservations',  String(data.totalReservations)],
    ['Total Appointments',  String(data.totalAppointments)],
    [],
    ['Status', 'Count'],
    ...data.requestsByStatus.map(r => [r.status, String(r.count)]),
    [],
    ['Type', 'Count'],
    ...data.requestsByType.map(r => [r.type, String(r.count)]),
  ]
  const csv = rows.map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `campus-ops-report-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminReportsPage() {
  const [data,       setData]       = useState<ReportData | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchReport = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    try {
      const base    = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const headers = { Authorization: `Bearer ${getToken()}` }
      const [repRes, sumRes] = await Promise.all([
        fetch(`${base}/admin/reports`,          { headers }),
        fetch(`${base}/admin/dashboard/summary`, { headers }),
      ])
      if (!repRes.ok) throw new Error()
      const report  = await repRes.json()
      const summary = sumRes.ok ? await sumRes.json() : {}
      setData({ ...report, overdueRequests: summary.overdueRequests ?? 0, approvalRate: summary.approvalRate ?? 0 })
    } catch {
      toast.error('Failed to load report data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { void fetchReport() }, [fetchReport])

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Generating report...</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  const maxStatus = Math.max(...(data.requestsByStatus?.map(s => s.count) ?? [1]), 1)
  const maxType   = Math.max(...(data.requestsByType?.map(t => t.count)   ?? [1]), 1)
  const maxTicket = Math.max(...(data.ticketsByStatus?.map(t => t.count)  ?? [1]), 1)

  const resolveRate = data.totalRequests > 0
    ? Math.round((data.resolvedRequests / data.totalRequests) * 100)
    : 0

  const ticketResolveRate = data.totalTickets > 0
    ? Math.round(((data.totalTickets - data.openTickets) / data.totalTickets) * 100)
    : 0

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto pb-20">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Operational summary generated on {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => void fetchReport(true)} disabled={refreshing}>
            <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
            Refresh
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => exportCSV(data)}>
            <Download className="size-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Health summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3.5 flex items-center gap-2.5">
          <CheckCircle2 className="size-4 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="text-base font-bold text-emerald-700 dark:text-emerald-400">{resolveRate}%</p>
            <p className="text-[11px] text-emerald-600/80 dark:text-emerald-500">Resolution Rate</p>
          </div>
        </div>
        <div className={cn('border rounded-lg p-3.5 flex items-center gap-2.5',
          (data.overdueRequests ?? 0) > 0
            ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
            : 'bg-muted/30 border-border')}>
          <AlertTriangle className={cn('size-4 flex-shrink-0', (data.overdueRequests ?? 0) > 0 ? 'text-red-600' : 'text-muted-foreground')} />
          <div>
            <p className={cn('text-base font-bold', (data.overdueRequests ?? 0) > 0 ? 'text-red-700 dark:text-red-400' : 'text-foreground')}>
              {data.overdueRequests ?? 0}
            </p>
            <p className="text-[11px] text-muted-foreground">Overdue</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-3.5 flex items-center gap-2.5">
          <Clock className="size-4 text-primary flex-shrink-0" />
          <div>
            <p className="text-base font-bold text-foreground">
              {data.avgResolutionDays != null ? `${data.avgResolutionDays}d` : '—'}
            </p>
            <p className="text-[11px] text-muted-foreground">Avg. Resolution</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-3.5 flex items-center gap-2.5">
          <Users className="size-4 text-primary flex-shrink-0" />
          <div>
            <p className="text-base font-bold text-foreground">{data.totalUsers.toLocaleString()}</p>
            <p className="text-[11px] text-muted-foreground">Total Users</p>
          </div>
        </div>
      </div>

      {/* ── Requests ──────────────────────────────────────────────────────────── */}
      <Section title="Requests" icon={<FileText className="size-3.5" />}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <StatCard icon={<FileText    className="size-5" />} label="Total"      value={(data.totalRequests    ?? 0).toLocaleString()} />
          <StatCard icon={<TrendingUp  className="size-5" />} label="Open"       value={data.openRequests      ?? 0} sub="Awaiting action"
            accent={(data.openRequests ?? 0) > 0 ? 'text-amber-600' : undefined} />
          <StatCard icon={<CheckCircle2 className="size-5" />} label="Resolved"  value={data.resolvedRequests  ?? 0} sub={`${resolveRate}% of total`}
            accent="text-emerald-600" />
          <StatCard icon={<Clock       className="size-5" />} label="Avg. Time"  value={data.avgResolutionDays != null ? `${data.avgResolutionDays}d` : '—'}
            sub="Days to close" />
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          {/* By Status */}
          <div className="bg-card border border-border rounded-lg p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-foreground">By Status</h3>
            {data.requestsByStatus?.length > 0 ? (
              <div className="space-y-3">
                {data.requestsByStatus.map(row => (
                  <ProgressRow
                    key={row.status}
                    label={row.status.replace(/_/g, ' ')}
                    count={row.count}
                    max={maxStatus}
                    colorClass="bg-primary"
                    badge={row.status}
                  />
                ))}
              </div>
            ) : <p className="text-xs text-muted-foreground text-center py-6">No data.</p>}
          </div>

          {/* By Type */}
          <div className="bg-card border border-border rounded-lg p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-foreground">By Type</h3>
            {data.requestsByType?.length > 0 ? (
              <div className="space-y-3">
                {data.requestsByType.slice(0, 10).map((row, i) => (
                  <ProgressRow
                    key={row.type}
                    label={row.type}
                    count={row.count}
                    max={maxType}
                    colorClass={BAR_COLORS[i % BAR_COLORS.length]}
                  />
                ))}
              </div>
            ) : <p className="text-xs text-muted-foreground text-center py-6">No data.</p>}
          </div>
        </div>
      </Section>

      {/* ── IT Tickets ────────────────────────────────────────────────────────── */}
      <Section title="IT Tickets" icon={<Ticket className="size-3.5" />}>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <StatCard icon={<Ticket       className="size-5" />} label="Total"    value={(data.totalTickets ?? 0).toLocaleString()} />
          <StatCard icon={<XCircle      className="size-5" />} label="Open"     value={data.openTickets   ?? 0} sub="Unresolved"
            accent={(data.openTickets ?? 0) > 0 ? 'text-red-600' : undefined} />
          <StatCard icon={<CheckCircle2 className="size-5" />} label="Resolved" value={Math.max(0, (data.totalTickets ?? 0) - (data.openTickets ?? 0))}
            sub={`${ticketResolveRate}% of total`} accent="text-emerald-600" />
        </div>

        {data.ticketsByStatus?.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-foreground">By Ticket Status</h3>
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
              {data.ticketsByStatus.map((row, i) => (
                <ProgressRow
                  key={row.status}
                  label={row.status.replace(/_/g, ' ')}
                  count={row.count}
                  max={maxTicket}
                  colorClass={BAR_COLORS[i % BAR_COLORS.length]}
                  badge={row.status}
                />
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* ── Operations ────────────────────────────────────────────────────────── */}
      <Section title="Operations" icon={<BarChart2 className="size-3.5" />}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<BookMarked   className="size-5" />} label="Total Reservations"  value={(data.totalReservations ?? 0).toLocaleString()} />
          <StatCard icon={<CalendarDays className="size-5" />} label="Total Appointments"  value={(data.totalAppointments ?? 0).toLocaleString()} />
          <StatCard icon={<Users        className="size-5" />} label="Total Users"         value={(data.totalUsers        ?? 0).toLocaleString()} />
          <StatCard icon={<FileText     className="size-5" />} label="All Requests"        value={(data.totalRequests     ?? 0).toLocaleString()} />
        </div>
      </Section>

      {/* ── Summary table ─────────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Full Summary</h3>
          <span className="text-xs text-muted-foreground">
            Generated {new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/40 border-b border-border">
              <th className="text-left py-2.5 px-5 font-medium text-muted-foreground">Metric</th>
              <th className="text-right py-2.5 px-5 font-medium text-muted-foreground">Value</th>
            </tr>
          </thead>
          <tbody>
            {[
              { label: 'Total Requests',     value: (data.totalRequests    ?? 0).toLocaleString() },
              { label: 'Open Requests',      value: data.openRequests      ?? 0 },
              { label: 'Resolved Requests',  value: data.resolvedRequests  ?? 0 },
              { label: 'Overdue Requests',   value: data.overdueRequests   ?? 0 },
              { label: 'Avg. Resolution',    value: data.avgResolutionDays != null ? `${data.avgResolutionDays} days` : '—' },
              { label: 'Total Users',        value: (data.totalUsers        ?? 0).toLocaleString() },
              { label: 'Total Tickets',      value: (data.totalTickets      ?? 0).toLocaleString() },
              { label: 'Open Tickets',       value: data.openTickets        ?? 0 },
              { label: 'Total Reservations', value: (data.totalReservations ?? 0).toLocaleString() },
              { label: 'Total Appointments', value: (data.totalAppointments ?? 0).toLocaleString() },
            ].map((row, i) => (
              <tr key={row.label} className={cn('border-b border-border/50', i % 2 === 0 ? '' : 'bg-muted/10')}>
                <td className="py-2.5 px-5 text-muted-foreground">{row.label}</td>
                <td className="py-2.5 px-5 text-right font-semibold text-foreground">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
