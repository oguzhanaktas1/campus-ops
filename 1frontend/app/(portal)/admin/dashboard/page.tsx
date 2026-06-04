'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  FileText, Users, CheckSquare, Activity, Loader2,
  Workflow, BarChart3, AlertTriangle, CalendarDays,
  BookMarked, ArrowRight, Monitor,
  RefreshCw, Zap,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from 'recharts'
import { cn } from '@/lib/utils'
import { getToken } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'

const ADMIN_AI_SUMMARY_CACHE_KEY = 'campusops-ai-summary:admin-dashboard:v2'

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED:          '#6366f1',
  IN_REVIEW:          '#f59e0b',
  WAITING_APPROVAL:   '#8b5cf6',
  APPROVED:           '#10b981',
  REJECTED:           '#ef4444',
  COMPLETED:          '#10b981',
  CANCELLED:          '#94a3b8',
  REVISION_REQUESTED: '#ec4899',
  DRAFT:              '#64748b',
}

const STATUS_BADGE: Record<string, string> = {
  SUBMITTED:          'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400',
  IN_REVIEW:          'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400',
  WAITING_APPROVAL:   'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400',
  APPROVED:           'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400',
  REJECTED:           'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400',
  COMPLETED:          'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400',
  CANCELLED:          'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/30 dark:text-slate-400',
  REVISION_REQUESTED: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/30 dark:text-pink-400',
  DRAFT:              'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/30 dark:text-slate-400',
}

const PRIORITY_DOT: Record<string, string> = {
  CRITICAL: 'bg-red-500',
  HIGH:     'bg-orange-500',
  MEDIUM:   'bg-amber-400',
  LOW:      'bg-slate-400',
}

const PRIORITY_RING: Record<string, string> = {
  CRITICAL: 'ring-red-300',
  HIGH:     'ring-orange-300',
  MEDIUM:   'ring-amber-200',
  LOW:      'ring-slate-300',
}

function useTimeAgo() {
  const { t } = useI18n()
  return (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const mins  = Math.floor(diff / 60_000)
    const hours = Math.floor(diff / 3_600_000)
    const days  = Math.floor(diff / 86_400_000)
    if (mins  < 1)  return t('dashboard.justNow')
    if (mins  < 60) return t('dashboard.minutesAgo', { n: mins })
    if (hours < 24) return t('dashboard.hoursAgo', { n: hours })
    return t('dashboard.daysAgo', { n: days })
  }
}

export default function AdminDashboard() {
  const router = useRouter()
  const { t } = useI18n()
  const timeAgo = useTimeAgo()
  const [metrics, setMetrics]   = useState<any>(null)
  const [recent,  setRecent]    = useState<any[]>([])
  const [todayCount, setTodayCount] = useState(0)
  const [reports, setReports]   = useState<any>(null)
  const [monitoring, setMonitoring] = useState<any>(null)
  const [aiNarration, setAiNarration] = useState<any>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const writeCachedAiNarration = (value: unknown) => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem(ADMIN_AI_SUMMARY_CACHE_KEY, JSON.stringify(value))
  }

  const getMonitoringSummary = (snapshot: any) => {
    if (!snapshot) return { status: 'unknown', problems: ['Monitoring snapshot unavailable'], warnings: [] as string[] }

    const problems: string[] = []
    const warnings: string[] = []
    const serviceStatus = [
      ['Backend', snapshot.backend?.status],
      ['Workers', snapshot.workers?.status],
      ['AI service', snapshot.ai?.status],
    ]

    for (const [label, status] of serviceStatus) {
      if (!['ok', 'ready'].includes(String(status ?? '').toLowerCase())) {
        problems.push(`${label}: ${status ?? 'unknown'}`)
      }
    }
    if (snapshot.rabbitmq?.error) problems.push(`RabbitMQ: ${snapshot.rabbitmq.error}`)
    if ((snapshot.outbox?.failed ?? 0) > 0) problems.push(`Outbox failed: ${snapshot.outbox.failed}`)
    if ((snapshot.outbox?.pending ?? 0) > 0) warnings.push(`Outbox pending: ${snapshot.outbox.pending}`)

    return {
      status: problems.length > 0 ? 'problem' : warnings.length > 0 ? 'warning' : 'ok',
      problems,
      warnings,
    }
  }

  const buildLocalAiNarration = (dashboard: any, report: any, snapshot: any) => {
    const monitor = getMonitoringSummary(snapshot)
    const summary = `Dashboard summary: ${dashboard.totalRequests ?? 0} total requests, ${dashboard.openRequests ?? 0} open requests, ${dashboard.activeUsers ?? 0} active users, ${dashboard.urgentRequests ?? 0} urgent requests, ${dashboard.urgentItTickets ?? 0} urgent IT tickets, and ${dashboard.todayCount ?? 0} requests in the last 24h. Monitoring status is ${monitor.status === 'ok' ? 'healthy' : monitor.status}; ${monitor.problems.length ? `problems: ${monitor.problems.join(', ')}.` : 'no blocking problem detected.'}`
    return {
      summary,
      highlights: [
        `Approval rate is ${dashboard.approvalRate ?? 0}% from ${dashboard.approvedEndRequests ?? 0} APPROVED_END requests over ${dashboard.totalRequests ?? 0} total requests.`,
        `Open operational load: ${dashboard.openRequests ?? 0} requests and ${dashboard.openTickets ?? 0} IT tickets.`,
        `Top request type: ${report?.requestsByType?.[0]?.type ?? 'n/a'} (${report?.requestsByType?.[0]?.count ?? 0}).`,
      ],
      confidence: 0.8,
      fallbackUsed: true,
    }
  }

  const fetchAiNarration = async (
    base: string,
    headers: Record<string, string>,
    dashboardData: any,
    reportData: any,
    recentData: any[],
    monitoringData: any,
  ) => {
    const monitor = getMonitoringSummary(monitoringData)

    setAiLoading(true)
    try {
      const aiRes = await fetch(`${base}/ai/analytics/summary`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: 'ADMIN_DASHBOARD',
          kpis: {
            totalRequests: dashboardData.totalRequests ?? 0,
            openRequests: dashboardData.openRequests ?? 0,
            activeUsers: dashboardData.activeUsers ?? 0,
            urgentRequests: dashboardData.urgentRequests ?? 0,
            urgentItTickets: dashboardData.urgentItTickets ?? 0,
            todayRequests: dashboardData.todayCount ?? 0,
            openTickets: dashboardData.openTickets ?? 0,
            approvalRate: dashboardData.approvalRate ?? 0,
            approvedEndRequests: dashboardData.approvedEndRequests ?? 0,
            monitoringStatus: monitor.status,
            monitoringProblems: monitor.problems,
            monitoringWarnings: monitor.warnings,
          },
          chartData: {
            requestsByStatus: reportData?.requestsByStatus ?? [],
            requestsByType: reportData?.requestsByType ?? [],
            ticketsByStatus: reportData?.ticketsByStatus ?? [],
            recentRequests: recentData.map((item) => ({
              requestNo: item.requestNo,
              title: item.title,
              status: item.status,
              priority: item.priority,
              assignee: getAssigneeName(item),
            })),
            monitoring: monitoringData,
          },
          trendDeltas: {},
          groupedCounts: Object.fromEntries((reportData?.requestsByType ?? []).map((item: any) => [item.type, item.count])),
        }),
      })
      if (!aiRes.ok) {
        const fallback = buildLocalAiNarration(dashboardData, reportData, monitoringData)
        setAiNarration(fallback)
        writeCachedAiNarration(fallback)
        return
      }
      const next = await aiRes.json()
      const finalNarration = next?.fallbackUsed ? buildLocalAiNarration(dashboardData, reportData, monitoringData) : next
      setAiNarration(finalNarration)
      writeCachedAiNarration(finalNarration)
    } catch (e) {
      console.error('Admin AI summary fetch error:', e)
      const fallback = buildLocalAiNarration(dashboardData, reportData, monitoringData)
      setAiNarration(fallback)
      writeCachedAiNarration(fallback)
    } finally {
      setAiLoading(false)
    }
  }

  const fetchAll = async (silent = false) => {
    if (silent) setRefreshing(true)
    const token = getToken()
    if (!token) return
    const base    = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
    const headers = { Authorization: `Bearer ${token}` }
    try {
      const [mRes, reqRes, rRes, monRes] = await Promise.all([
        fetch(`${base}/admin/dashboard/summary`, { headers }),
        fetch(`${base}/admin/requests`,          { headers }),
        fetch(`${base}/admin/reports`,           { headers }),
        fetch(`${base}/admin/system/snapshot`,   { headers }),
      ])
      let nextMetrics: any = null
      let nextRecent: any[] = []
      let nextReports: any = null
      let nextMonitoring: any = null

      if (mRes.ok) {
        nextMetrics = await mRes.json()
        setMetrics(nextMetrics)
      }
      let nextTodayCount = 0
      if (reqRes.ok) {
        const all: any[] = await reqRes.json()
        nextRecent = all.slice(0, 6)
        setRecent(nextRecent)
        const startOfToday = new Date()
        startOfToday.setHours(0, 0, 0, 0)
        nextTodayCount = all.filter((r: any) => new Date(r.createdAt) >= startOfToday).length
        setTodayCount(nextTodayCount)
      }
      if (rRes.ok) {
        nextReports = await rRes.json()
        setReports(nextReports)
      }
      if (monRes.ok) {
        nextMonitoring = await monRes.json()
        setMonitoring(nextMonitoring)
      }

      if (nextMetrics) {
        void fetchAiNarration(base, headers, { ...nextMetrics, todayCount: nextTodayCount }, nextReports, nextRecent, nextMonitoring)
      }
    } catch (e) {
      console.error('Dashboard fetch error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { void fetchAll() }, [])

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading dashboard…</p>
        </div>
      </div>
    )
  }

  const m  = metrics ?? {}
  const r  = reports ?? {}
  const rbs = (r.requestsByStatus ?? []) as { status: string; count: number }[]
  const rbt = (r.requestsByType   ?? []) as { type: string;   count: number }[]

  const today = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })

  const approvalRate = m.approvalRate ?? 0
  const approvalColor = 'text-emerald-600'
  const requestTypeChart = rbt.slice(0, 10).map((item, i) => ({
    ...item,
    fill: ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#64748b', '#f97316', '#84cc16'][i % 10],
  }))

  const getAssigneeName = (req: any) => {
    const explicit = req.assignedToName || req.currentAssigneeName || req.assigneeName
    if (explicit && !/^unassigned|not assigned$/i.test(String(explicit))) return explicit
    if (Array.isArray(req.assignedToNames) && req.assignedToNames.length > 0) return req.assignedToNames.join(', ')
    return req.currentAssignee?.profile?.fullName
      || req.currentAssignee?.email
      || req.assignedTo?.profile?.fullName
      || req.assignedTo?.email
      || '—'
  }
  const monitoringSummary = getMonitoringSummary(monitoring)

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-6xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">{t('dashboard.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{today} · {t('dashboard.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            'hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border shadow-sm',
            monitoringSummary.status === 'problem'
              ? 'text-red-700 bg-red-50 dark:bg-red-950/30 dark:text-red-400 border-red-200 dark:border-red-800'
              : monitoringSummary.status === 'warning'
                ? 'text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                : 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
          )}>
            <Zap className={cn(
              'size-3',
              monitoringSummary.status === 'problem' ? 'text-red-500' : monitoringSummary.status === 'warning' ? 'text-amber-500' : 'fill-emerald-500 text-emerald-500',
            )} />
            {monitoringSummary.status === 'problem' ? 'Problem detected' : monitoringSummary.status === 'warning' ? 'Warnings' : t('dashboard.systemHealthy')}
          </span>
          <Button
            size="sm" variant="outline"
            className="gap-1.5 h-8 text-xs border-border/60 shadow-sm hover:shadow"
            onClick={() => void fetchAll(true)}
            disabled={refreshing}
          >
            <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
            {t('common.refresh')}
          </Button>
        </div>
      </div>

      {/* ── AI Summary Banner ──────────────────────────────────────────────── */}
      {(aiLoading || aiNarration?.summary) && (
        <div className="rounded-2xl border border-primary/15 bg-gradient-to-r from-primary/5 via-background to-emerald-500/5 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart3 className="size-4 text-primary" />
            </div>
            <h2 className="text-sm font-bold text-foreground">{t('dashboard.aiSummary')}</h2>
          </div>
          {aiNarration?.summary ? (
            <>
              <p className="mt-2 text-sm text-foreground/80 leading-relaxed">{aiNarration.summary}</p>
              {Array.isArray(aiNarration.highlights) && aiNarration.highlights.length > 0 && (
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {aiNarration.highlights.slice(0, 3).map((highlight: string) => (
                    <div
                      key={highlight}
                      className="rounded-xl border border-border/60 bg-background/70 backdrop-blur-sm px-3 py-2.5 text-xs text-muted-foreground leading-relaxed"
                    >
                      {highlight}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('dashboard.aiLoading')}
            </div>
          )}
        </div>
      )}

      {/* ── Today's Activity Strip ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          {
            label: t('dashboard.todayRequests'),
            value: todayCount,
            icon: FileText,
            gradient: 'from-primary/10 to-primary/5',
            border: 'border-primary/20',
            iconCls: 'text-primary',
          },
          {
            label: 'Urgent requests',
            value: m.urgentRequests ?? 0,
            icon: AlertTriangle,
            gradient: (m.urgentRequests ?? 0) > 0 ? 'from-red-500/10 to-red-500/5' : 'from-muted/30 to-muted/10',
            border: (m.urgentRequests ?? 0) > 0 ? 'border-red-500/20' : 'border-border',
            iconCls: (m.urgentRequests ?? 0) > 0 ? 'text-red-600' : 'text-muted-foreground',
          },
          {
            label: 'Urgent IT',
            value: m.urgentItTickets ?? 0,
            icon: Activity,
            gradient: (m.urgentItTickets ?? 0) > 0 ? 'from-orange-500/10 to-orange-500/5' : 'from-muted/30 to-muted/10',
            border: (m.urgentItTickets ?? 0) > 0 ? 'border-orange-500/20' : 'border-border',
            iconCls: (m.urgentItTickets ?? 0) > 0 ? 'text-orange-600' : 'text-muted-foreground',
          },
          {
            label: t('dashboard.todayReservations'),
            value: m.todayReservations ?? 0,
            icon: BookMarked,
            gradient: 'from-emerald-500/10 to-emerald-500/5',
            border: 'border-emerald-500/20',
            iconCls: 'text-emerald-600',
          },
          {
            label: t('dashboard.todayAppointments'),
            value: m.todayAppointments ?? 0,
            icon: CalendarDays,
            gradient: 'from-blue-500/10 to-blue-500/5',
            border: 'border-blue-500/20',
            iconCls: 'text-blue-600',
          },
          {
            label: t('dashboard.overdue'),
            value: m.overdueRequests ?? 0,
            icon: AlertTriangle,
            gradient: (m.overdueRequests ?? 0) > 0 ? 'from-red-500/10 to-red-500/5' : 'from-muted/30 to-muted/10',
            border: (m.overdueRequests ?? 0) > 0 ? 'border-red-500/20' : 'border-border',
            iconCls: (m.overdueRequests ?? 0) > 0 ? 'text-red-600' : 'text-muted-foreground',
          },
        ].map(({ label, value, icon: Icon, gradient, border, iconCls }) => (
          <div
            key={label}
            className={cn(
              'bg-gradient-to-br rounded-xl p-4 border shadow-sm flex items-center gap-3',
              gradient, border,
            )}
          >
            <div className="size-9 rounded-xl bg-background/60 border border-white/20 flex items-center justify-center flex-shrink-0 shadow-sm">
              <Icon className={cn('size-4', iconCls)} />
            </div>
            <div>
              <p className={cn('text-xl font-black leading-none', iconCls)}>{value}</p>
              <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 font-medium">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main KPI row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {[
          {
            label: t('dashboard.totalRequests'),
            value: (m.totalRequests ?? 0).toLocaleString(),
            sub: t('dashboard.allTime'),
            accent: 'bg-primary',
            icon: FileText,
            iconCls: 'text-primary',
          },
          {
            label: t('dashboard.openRequests'),
            value: m.openRequests ?? 0,
            sub: t('dashboard.awaitingAction'),
            accent: 'bg-amber-500',
            icon: Activity,
            iconCls: (m.openRequests ?? 0) > 0 ? 'text-amber-600' : 'text-muted-foreground',
            valueCls: (m.openRequests ?? 0) > 0 ? 'text-amber-600' : undefined,
          },
          {
            label: t('dashboard.activeUsers'),
            value: (m.activeUsers ?? 0).toLocaleString(),
            sub: t('dashboard.ofTotal', { total: (m.totalUsers ?? 0).toLocaleString() }),
            accent: 'bg-blue-500',
            icon: Users,
            iconCls: 'text-blue-600',
          },
          {
            label: t('dashboard.approvalRate'),
            value: `${approvalRate}%`,
            sub: `${m.approvedEndRequests ?? 0} APPROVED_END / ${m.totalRequests ?? 0} total`,
            accent: 'bg-emerald-500',
            icon: CheckSquare,
            iconCls: approvalColor,
            valueCls: approvalColor,
          },
        ].map(({ label, value, sub, accent, icon: Icon, iconCls, valueCls }) => (
          <div
            key={label}
            className="bg-card border border-border rounded-xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow"
          >
            <div className={cn('absolute left-0 inset-y-0 w-1 rounded-l-xl', accent)} />
            <div className="flex items-start justify-between pl-3">
              <div className="flex-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
                <p className={cn('text-3xl font-black text-foreground mt-1.5 leading-none', valueCls)}>{value}</p>
                <p className="text-[11px] text-muted-foreground mt-1.5 font-medium">{sub}</p>
              </div>
              <div className={cn(
                'size-9 rounded-xl flex items-center justify-center bg-muted/50 flex-shrink-0 ml-2',
              )}>
                <Icon className={cn('size-4', iconCls)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Charts + ticket row ─────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-5">

        {/* Requests by Status Bar Chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold text-foreground">{t('dashboard.requestsByStatus')}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{t('dashboard.allTime')}</p>
            </div>
            <Link
              href="/admin/requests"
              className="text-xs text-primary hover:text-primary/80 font-semibold flex items-center gap-1 bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors"
            >
              {t('common.viewAll')} <ArrowRight className="size-3" />
            </Link>
          </div>
          {rbs.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={rbs} barSize={24} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.01 264 / 0.5)" vertical={false} />
                <XAxis
                  dataKey="status"
                  tick={{ fontSize: 10, fill: 'oklch(0.55 0.02 264)' }}
                  axisLine={false} tickLine={false}
                  tickFormatter={(v) => v.replace(/_/g, ' ').slice(0, 10)}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'oklch(0.55 0.02 264)' }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12, borderRadius: 10,
                    border: '1px solid oklch(0.9 0.01 264)',
                    boxShadow: '0 4px 16px oklch(0 0 0 / 0.08)',
                  }}
                  cursor={{ fill: 'oklch(0.94 0.01 264 / 0.4)', radius: 6 }}
                />
                <Bar dataKey="count" name={t('dashboard.totalRequests')} radius={[6, 6, 0, 0]}>
                  {rbs.map((entry, i) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.status] ?? '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[220px] text-muted-foreground gap-2">
              <BarChart3 className="size-8 opacity-20" />
              <p className="text-sm">{t('dashboard.noData')}</p>
            </div>
          )}
        </div>

        {/* Right column: open tickets */}
        <div className="space-y-4">
          {/* Open IT Tickets */}
          <div className="bg-card border border-border rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-bold text-foreground">{t('dashboard.itTickets')}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t('dashboard.openTickets')}</p>
              </div>
              <Link
                href="/admin/requests"
                className="text-xs text-primary font-semibold hover:underline bg-primary/5 hover:bg-primary/10 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                {t('common.view')}
              </Link>
            </div>
            <div className="flex items-end gap-3">
              <p className={cn(
                'text-4xl font-black leading-none',
                (m.openTickets ?? 0) > 0 ? 'text-red-500' : 'text-foreground'
              )}>
                {m.openTickets ?? 0}
              </p>
              <div className="pb-1 space-y-0.5">
                <p className="text-xs font-medium text-muted-foreground">
                  {t('dashboard.ofTotalTickets', { total: r.totalTickets ?? 0 })}
                </p>
                {(m.openTickets ?? 0) > 0 && (
                  <p className="text-[10px] font-semibold text-red-500 flex items-center gap-1">
                    <AlertTriangle className="size-2.5" />
                    Needs attention
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Request by Type ─────────────────────────────────────────────────── */}
      {requestTypeChart.length > 0 && (
        <div className="bg-card border border-border rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold text-foreground">{t('dashboard.requestsByType')}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Top {Math.min(rbt.length, 10)} request categories</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={requestTypeChart} layout="vertical" barSize={18} margin={{ top: 4, right: 18, bottom: 4, left: 96 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.01 264 / 0.5)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'oklch(0.55 0.02 264)' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="type" width={92} tick={{ fontSize: 10, fill: 'oklch(0.55 0.02 264)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10 }} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                {requestTypeChart.map((entry) => <Cell key={entry.type} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Recent Requests ─────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
          <div>
            <h2 className="text-sm font-bold text-foreground">{t('dashboard.recentRequests')}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{recent.length} most recent</p>
          </div>
          <Link
            href="/admin/requests"
            className="text-xs text-primary font-semibold flex items-center gap-1 bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors"
          >
            {t('dashboard.allRequests')} <ArrowRight className="size-3" />
          </Link>
        </div>
        {recent.length > 0 ? (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/60">
                <th className="text-left py-3 px-5 font-semibold text-muted-foreground text-[11px] uppercase tracking-wide">{t('dashboard.colRequest')}</th>
                <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wide hidden sm:table-cell">{t('dashboard.colType')}</th>
                <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wide hidden md:table-cell">{t('dashboard.colRequester')}</th>
                <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wide">{t('dashboard.colStatus')}</th>
                <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wide hidden lg:table-cell">{t('dashboard.colAssignee')}</th>
                <th className="text-right py-3 px-5 font-semibold text-muted-foreground text-[11px] uppercase tracking-wide">{t('dashboard.colWhen')}</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((req, idx) => {
                const statusColor = STATUS_COLORS[req.status]
                return (
                  <tr
                    key={req.id}
                    className="border-b border-border/40 hover:bg-muted/25 transition-colors cursor-pointer group"
                    onClick={() => router.push(`/admin/requests/${req.id}`)}
                    style={{ borderLeft: `3px solid ${statusColor ?? '#e2e8f0'}` }}
                  >
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            'size-2 rounded-full flex-shrink-0 ring-2 ring-offset-1 ring-offset-background',
                            PRIORITY_DOT[req.priority] ?? 'bg-slate-400',
                            PRIORITY_RING[req.priority] ?? 'ring-slate-300',
                          )}
                        />
                        <div>
                          <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                            {req.title ?? req.requestNo}
                          </span>
                          <p className="text-muted-foreground text-[10px] font-mono mt-0.5">{req.requestNo}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-muted-foreground hidden sm:table-cell truncate max-w-[120px]">
                      {req.typeName ?? req.type}
                    </td>
                    <td className="py-3 px-3 text-muted-foreground hidden md:table-cell">
                      {req.submittedByName}
                    </td>
                    <td className="py-3 px-3">
                      <span className={cn(
                        'inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border',
                        STATUS_BADGE[req.status] ?? 'bg-muted text-muted-foreground border-border'
                      )}>
                        {req.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-muted-foreground hidden lg:table-cell">
                      {getAssigneeName(req)}
                    </td>
                    <td className="py-3 px-5 text-right text-muted-foreground font-medium">
                      {timeAgo(req.createdAt)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <div className="size-14 rounded-2xl bg-muted/50 flex items-center justify-center">
              <FileText className="size-7 opacity-40" />
            </div>
            <p className="text-sm font-medium">{t('dashboard.noRequests')}</p>
          </div>
        )}
      </div>

      {/* ── Quick Links ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            labelKey: 'nav.users',
            href: '/admin/users',
            icon: Users,
            iconBg: 'bg-blue-100 dark:bg-blue-950/40',
            iconCls: 'text-blue-600 dark:text-blue-400',
          },
          {
            labelKey: 'nav.requests',
            href: '/admin/requests',
            icon: FileText,
            iconBg: 'bg-indigo-100 dark:bg-indigo-950/40',
            iconCls: 'text-indigo-600 dark:text-indigo-400',
          },
          {
            labelKey: 'nav.workflows',
            href: '/admin/workflows',
            icon: Workflow,
            iconBg: 'bg-purple-100 dark:bg-purple-950/40',
            iconCls: 'text-purple-600 dark:text-purple-400',
          },
          {
            labelKey: 'nav.monitoring',
            href: '/admin/monitoring',
            icon: Monitor,
            iconBg: 'bg-emerald-100 dark:bg-emerald-950/40',
            iconCls: 'text-emerald-600 dark:text-emerald-400',
          },
        ].map(({ labelKey, href, icon: Icon, iconBg, iconCls }) => (
          <Link key={href} href={href}>
            <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group shadow-sm">
              <div className={cn('size-10 rounded-xl flex items-center justify-center flex-shrink-0', iconBg)}>
                <Icon className={cn('size-5', iconCls)} />
              </div>
              <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors flex-1">
                {t(labelKey)}
              </span>
              <ArrowRight className="size-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all opacity-0 group-hover:opacity-100" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
