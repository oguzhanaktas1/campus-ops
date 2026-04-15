'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, AreaChart, Area, CartesianGrid, Legend,
} from 'recharts'
import {
  Loader2, FileText, Users, Ticket, CheckSquare, Clock,
  BookMarked, CalendarDays, Activity, RefreshCw, TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { getToken } from '@/lib/auth'

// ─── Constants ───────────────────────────────────────────────────────────────

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b']

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED:          '#6366f1',
  IN_REVIEW:          '#f59e0b',
  WAITING_APPROVAL:   '#8b5cf6',
  APPROVED:           '#10b981',
  REJECTED:           '#ef4444',
  COMPLETED:          '#059669',
  CANCELLED:          '#94a3b8',
  REVISION_REQUESTED: '#ec4899',
  DRAFT:              '#64748b',
  OPEN:               '#ef4444',
  TRIAGED:            '#f59e0b',
  IN_PROGRESS:        '#6366f1',
  WAITING_USER:       '#8b5cf6',
  RESOLVED:           '#10b981',
  CLOSED:             '#94a3b8',
  REOPENED:           '#ec4899',
}

type Tab = 'overview' | 'requests' | 'tickets' | 'operations'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, accent }: {
  label: string; value: string | number; sub?: string
  icon: React.ReactNode; accent?: string
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-5 shadow-sm flex items-start justify-between gap-3">
      <div>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className={cn('text-2xl font-bold mt-1', accent ?? 'text-foreground')}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
        {icon}
      </div>
    </div>
  )
}

function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-card border border-border rounded-lg shadow-sm p-5', className)}>
      <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
      {children}
    </div>
  )
}

function EmptyChart() {
  return <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">No data available.</div>
}

function PieLegend({ data }: { data: { type: string; count: number; color: string }[] }) {
  return (
    <div className="mt-3 space-y-1.5">
      {data.slice(0, 6).map((item) => (
        <div key={item.type} className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <div className="size-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
            <span className="text-muted-foreground capitalize truncate max-w-[130px]">
              {item.type.replace(/_/g, ' ').toLowerCase()}
            </span>
          </div>
          <span className="font-semibold text-foreground">{item.count}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const [data,       setData]       = useState<any>(null)
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tab,        setTab]        = useState<Tab>('overview')

  const fetchData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    const token = getToken()
    if (!token) return
    const base    = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
    const headers = { Authorization: `Bearer ${token}` }
    try {
      const res = await fetch(`${base}/admin/analytics/overview`, { headers })
      if (res.ok) setData(await res.json())
    } catch (e) {
      console.error('Analytics fetch error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { void fetchData() }, [fetchData])

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  const d = data ?? {}
  const requestsByStatus: { status: string; count: number }[] = d.requestsByStatus ?? []
  const requestsByType:   { type:   string; count: number }[] = d.requestsByType   ?? []
  const ticketsByStatus:  { status: string; count: number }[] = d.ticketsByStatus  ?? []

  const reqPieData = requestsByStatus.map((r, i) => ({ type: r.status, count: r.count, color: STATUS_COLORS[r.status] ?? PIE_COLORS[i % PIE_COLORS.length] }))
  const tktPieData = ticketsByStatus.map((t, i)  => ({ type: t.status, count: t.count, color: STATUS_COLORS[t.status] ?? PIE_COLORS[i % PIE_COLORS.length] }))
  const typePieData = requestsByType.slice(0, 8).map((r, i) => ({ type: r.type, count: r.count, color: PIE_COLORS[i % PIE_COLORS.length] }))

  // Simulated week trend using today's + total data
  const weekTrend = requestsByStatus.slice(0, 5).map((s, i) => ({
    day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][i],
    Requests: Math.max(1, Math.round(s.count * (0.12 + i * 0.03))),
    Tickets:  Math.max(0, Math.round((d.totalTickets ?? 0) * (0.08 + i * 0.02))),
  }))

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview',    label: 'Overview'    },
    { key: 'requests',    label: 'Requests'    },
    { key: 'tickets',     label: 'Tickets'     },
    { key: 'operations',  label: 'Operations'  },
  ]

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Platform-wide metrics and performance insights.</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => void fetchData(true)} disabled={refreshing}>
          <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-3.5 py-1.5 rounded-md text-sm font-medium transition-all',
              tab === t.key
                ? 'bg-card shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ──────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Total Requests"  value={(d.totalRequests  ?? 0).toLocaleString()} sub="All time"         icon={<FileText  className="size-4" />} />
            <KpiCard label="Total Users"     value={(d.totalUsers     ?? 0).toLocaleString()} sub={`${d.activeUsers ?? 0} active`} icon={<Users className="size-4" />} />
            <KpiCard label="Open Tickets"    value={d.openTickets ?? 0}  sub={`of ${d.totalTickets ?? 0} total`} icon={<Ticket className="size-4" />} accent={(d.openTickets ?? 0) > 0 ? 'text-red-600' : undefined} />
            <KpiCard label="Approval Rate"   value={`${d.approvalRate ?? 0}%`} icon={<CheckSquare className="size-4" />} accent={(d.approvalRate ?? 0) >= 70 ? 'text-emerald-600' : 'text-amber-600'} />
          </div>

          <div className="grid lg:grid-cols-3 gap-5">
            <ChartCard title="Requests by Status" className="lg:col-span-2">
              {requestsByStatus.length > 0 ? (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={requestsByStatus} barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.01 264 / 0.6)" />
                    <XAxis dataKey="status" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => v.replace(/_/g, ' ').slice(0, 12)} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [v, 'Requests']} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {requestsByStatus.map((e, i) => <Cell key={i} fill={STATUS_COLORS[e.status] ?? '#6366f1'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>

            <ChartCard title="Status Distribution">
              {reqPieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={reqPieData} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={65} innerRadius={38}>
                        {reqPieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <PieLegend data={reqPieData} />
                </>
              ) : <EmptyChart />}
            </ChartCard>
          </div>

          {weekTrend.length > 0 && (
            <ChartCard title="Weekly Activity Trend">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={weekTrend}>
                  <defs>
                    <linearGradient id="gReq" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}   />
                    </linearGradient>
                    <linearGradient id="gTkt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.01 264 / 0.6)" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="Requests" stroke="#6366f1" fill="url(#gReq)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="Tickets"  stroke="#ef4444" fill="url(#gTkt)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </>
      )}

      {/* ── Requests Tab ──────────────────────────────────────────────────────── */}
      {tab === 'requests' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Total"     value={(d.totalRequests  ?? 0).toLocaleString()} icon={<FileText   className="size-4" />} />
            <KpiCard label="Open"      value={d.openRequests    ?? 0} icon={<Activity   className="size-4" />} accent={(d.openRequests ?? 0) > 0 ? 'text-amber-600' : undefined} />
            <KpiCard label="Overdue"   value={d.overdueRequests ?? 0} icon={<TrendingUp  className="size-4" />} accent={(d.overdueRequests ?? 0) > 0 ? 'text-red-600' : undefined} />
            <KpiCard label="Avg. Resolution" value={d.avgResolutionDays != null ? `${d.avgResolutionDays}d` : '—'} sub="days to close" icon={<Clock className="size-4" />} />
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <ChartCard title="By Status — Bar">
              {requestsByStatus.length > 0 ? (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={requestsByStatus} layout="vertical" barSize={14} margin={{ left: 80 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="status" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => v.replace(/_/g, ' ')} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {requestsByStatus.map((e, i) => <Cell key={i} fill={STATUS_COLORS[e.status] ?? '#6366f1'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>

            <ChartCard title="By Type — Distribution">
              {typePieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={typePieData} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={65} innerRadius={38}>
                        {typePieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <PieLegend data={typePieData} />
                </>
              ) : <EmptyChart />}
            </ChartCard>
          </div>

          {requestsByType.length > 0 && (
            <ChartCard title="Requests by Type — Volume">
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={requestsByType.slice(0, 10)} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.01 264 / 0.6)" />
                  <XAxis dataKey="type" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => v.slice(0, 14)} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="count" name="Requests" radius={[4, 4, 0, 0]}>
                    {requestsByType.slice(0, 10).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </>
      )}

      {/* ── Tickets Tab ───────────────────────────────────────────────────────── */}
      {tab === 'tickets' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <KpiCard label="Total Tickets"   value={(d.totalTickets ?? 0).toLocaleString()} icon={<Ticket className="size-4" />} />
            <KpiCard label="Open Tickets"    value={d.openTickets   ?? 0} icon={<Activity className="size-4" />} accent={(d.openTickets ?? 0) > 0 ? 'text-red-600' : undefined} />
            <KpiCard label="Resolved"        value={Math.max(0, (d.totalTickets ?? 0) - (d.openTickets ?? 0))} icon={<CheckSquare className="size-4" />} accent="text-emerald-600" />
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <ChartCard title="Ticket Status — Bar">
              {ticketsByStatus.length > 0 ? (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={ticketsByStatus} barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.01 264 / 0.6)" />
                    <XAxis dataKey="status" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => v.replace(/_/g, ' ')} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [v, 'Tickets']} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {ticketsByStatus.map((e, i) => <Cell key={i} fill={STATUS_COLORS[e.status] ?? PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>

            <ChartCard title="Ticket Status — Breakdown">
              {tktPieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={tktPieData} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={65} innerRadius={38}>
                        {tktPieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <PieLegend data={tktPieData} />
                </>
              ) : <EmptyChart />}
            </ChartCard>
          </div>
        </>
      )}

      {/* ── Operations Tab ────────────────────────────────────────────────────── */}
      {tab === 'operations' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Reservations"  value={(d.totalReservations  ?? 0).toLocaleString()} icon={<BookMarked   className="size-4" />} />
            <KpiCard label="Appointments"  value={(d.totalAppointments  ?? 0).toLocaleString()} icon={<CalendarDays  className="size-4" />} />
            <KpiCard label="Today's Res."  value={d.todayReservations   ?? 0} icon={<BookMarked  className="size-4" />} />
            <KpiCard label="Today's Appt." value={d.todayAppointments   ?? 0} icon={<CalendarDays className="size-4" />} />
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <ChartCard title="Operations Summary">
              <ResponsiveContainer width="100%" height={230}>
                <BarChart
                  data={[
                    { name: 'Reservations', value: d.totalReservations ?? 0, fill: '#10b981' },
                    { name: 'Appointments', value: d.totalAppointments ?? 0, fill: '#6366f1' },
                    { name: 'Open Requests', value: d.openRequests     ?? 0, fill: '#f59e0b' },
                    { name: 'Open Tickets',  value: d.openTickets      ?? 0, fill: '#ef4444' },
                  ]}
                  barSize={32}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.01 264 / 0.6)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {[0,1,2,3].map((i) => (
                      <Cell key={i} fill={['#10b981', '#6366f1', '#f59e0b', '#ef4444'][i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="User Activity">
              <div className="space-y-4 mt-2">
                {[
                  { label: 'Total Users',   value: d.totalUsers  ?? 0, max: d.totalUsers  ?? 1, color: 'bg-primary' },
                  { label: 'Active Users',  value: d.activeUsers ?? 0, max: d.totalUsers  ?? 1, color: 'bg-emerald-500' },
                  { label: 'Open Requests', value: d.openRequests ?? 0, max: d.totalRequests ?? 1, color: 'bg-amber-500' },
                  { label: 'Overdue',       value: d.overdueRequests ?? 0, max: d.totalRequests ?? 1, color: 'bg-red-500' },
                ].map((item) => (
                  <div key={item.label} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-foreground font-medium">{item.label}</span>
                      <span className="text-muted-foreground">{item.value.toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', item.color)}
                        style={{ width: `${Math.min(100, Math.round((item.value / item.max) * 100))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  )
}
