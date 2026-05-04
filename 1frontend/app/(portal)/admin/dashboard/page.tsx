'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  FileText, Users, CheckSquare, Activity, CheckCircle2, Loader2,
  Workflow, BarChart3, AlertTriangle, Ticket, CalendarDays,
  BookMarked, Clock, TrendingUp, ArrowRight, ShieldCheck, Monitor,
  RefreshCw,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { cn } from '@/lib/utils'
import { getToken } from '@/lib/auth'
import { MetricCard } from '@/components/metric-card'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'

const ADMIN_AI_SUMMARY_CACHE_KEY = 'campusops-ai-summary:admin-dashboard'

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
  const [reports, setReports]   = useState<any>(null)
  const [aiNarration, setAiNarration] = useState<any>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const readCachedAiNarration = () => {
    if (typeof window === 'undefined') return null
    const raw = sessionStorage.getItem(ADMIN_AI_SUMMARY_CACHE_KEY)
    if (!raw) return null

    try {
      return JSON.parse(raw)
    } catch {
      sessionStorage.removeItem(ADMIN_AI_SUMMARY_CACHE_KEY)
      return null
    }
  }

  const writeCachedAiNarration = (value: unknown) => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem(ADMIN_AI_SUMMARY_CACHE_KEY, JSON.stringify(value))
  }

  const fetchAiNarration = async (
    base: string,
    headers: Record<string, string>,
    force = false,
  ) => {
    if (!force) {
      const cached = readCachedAiNarration()
      if (cached) {
        setAiNarration(cached)
        setAiLoading(false)
        return
      }
    }

    setAiLoading(true)
    try {
      const aiRes = await fetch(`${base}/ai/analytics/admin-overview`, { headers })
      if (!aiRes.ok) {
        return
      }
      const next = await aiRes.json()
      setAiNarration(next)
      writeCachedAiNarration(next)
    } catch (e) {
      console.error('Admin AI summary fetch error:', e)
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
      const [mRes, reqRes, rRes] = await Promise.all([
        fetch(`${base}/admin/dashboard/summary`, { headers }),
        fetch(`${base}/admin/requests`,          { headers }),
        fetch(`${base}/admin/reports`,           { headers }),
      ])
      if (mRes.ok)   setMetrics(await mRes.json())
      if (reqRes.ok) {
        const all: any[] = await reqRes.json()
        setRecent(all.slice(0, 6))
      }
      if (rRes.ok) setReports(await rRes.json())
    } catch (e) {
      console.error('Dashboard fetch error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }

    void fetchAiNarration(base, headers, silent)
  }

  useEffect(() => { void fetchAll() }, [])

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  const m  = metrics ?? {}
  const r  = reports ?? {}
  const rbs = (r.requestsByStatus ?? []) as { status: string; count: number }[]
  const rbt = (r.requestsByType   ?? []) as { type: string;   count: number }[]

  // approval vs rejection split for mini chart
  const approvalData = [
    { name: 'Approved', value: m.approvalRate ?? 0,       fill: '#10b981' },
    { name: 'Rejected', value: 100 - (m.approvalRate ?? 0), fill: '#ef444422' },
  ]

  const today = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('dashboard.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{today} · {t('dashboard.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-600 font-medium bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="size-3" />
            {t('dashboard.systemHealthy')}
          </span>
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => void fetchAll(true)} disabled={refreshing}>
            <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
            {t('common.refresh')}
          </Button>
        </div>
      </div>

      {/* ── Today banner ───────────────────────────────────────────────────── */}
      {(aiLoading || aiNarration?.summary) && (
        <div className="rounded-xl border border-primary/15 bg-gradient-to-r from-primary/5 via-background to-emerald-500/5 p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">{t('dashboard.aiSummary')}</h2>
          </div>
          {aiNarration?.summary ? (
            <>
              <p className="mt-2 text-sm text-foreground">{aiNarration.summary}</p>
              {Array.isArray(aiNarration.highlights) && aiNarration.highlights.length > 0 && (
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {aiNarration.highlights.slice(0, 3).map((highlight: string) => (
                    <div key={highlight} className="rounded-lg border border-border/70 bg-background/80 px-3 py-2 text-xs text-muted-foreground">
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('dashboard.todayRequests'),     value: m.todayRequests     ?? 0, icon: FileText,     cls: 'text-primary' },
          { label: t('dashboard.todayReservations'), value: m.todayReservations ?? 0, icon: BookMarked,   cls: 'text-emerald-600' },
          { label: t('dashboard.todayAppointments'), value: m.todayAppointments ?? 0, icon: CalendarDays, cls: 'text-blue-600' },
          { label: t('dashboard.overdue'),           value: m.overdueRequests   ?? 0, icon: AlertTriangle, cls: m.overdueRequests > 0 ? 'text-red-600' : 'text-muted-foreground' },
        ].map(({ label, value, icon: Icon, cls }) => (
          <div key={label} className="bg-card border border-border rounded-lg p-3.5 flex items-center gap-3 shadow-sm">
            <Icon className={cn('size-4 flex-shrink-0', cls)} />
            <div>
              <p className={cn('text-lg font-bold', cls)}>{value}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main KPI row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title={t('dashboard.totalRequests')}
          value={(m.totalRequests ?? 0).toLocaleString()}
          description={t('dashboard.allTime')}
          icon={<FileText className="size-4" />}
        />
        <MetricCard
          title={t('dashboard.openRequests')}
          value={m.openRequests ?? 0}
          description={t('dashboard.awaitingAction')}
          icon={<Activity className="size-4" />}
          valueClassName={m.openRequests > 0 ? 'text-amber-600' : undefined}
        />
        <MetricCard
          title={t('dashboard.activeUsers')}
          value={(m.activeUsers ?? 0).toLocaleString()}
          description={t('dashboard.ofTotal', { total: (m.totalUsers ?? 0).toLocaleString() })}
          icon={<Users className="size-4" />}
        />
        <MetricCard
          title={t('dashboard.approvalRate')}
          value={`${m.approvalRate ?? 0}%`}
          description={t('dashboard.approvedTotalDecisions')}
          icon={<CheckSquare className="size-4" />}
          valueClassName={
            (m.approvalRate ?? 0) >= 70 ? 'text-emerald-600'
            : (m.approvalRate ?? 0) >= 40 ? 'text-amber-600'
            : 'text-red-600'
          }
        />
      </div>

      {/* ── Charts + ticket row ─────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-5">

        {/* Requests by Status */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">{t('dashboard.requestsByStatus')}</h2>
            <Link href="/admin/requests" className="text-xs text-primary hover:underline flex items-center gap-0.5">
              {t('common.viewAll')} <ArrowRight className="size-3" />
            </Link>
          </div>
          {rbs.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={rbs} barSize={22}>
                <XAxis dataKey="status" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => v.replace(/_/g, ' ').slice(0, 10)} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid oklch(0.9 0.01 264)' }}
                  cursor={{ fill: 'oklch(0.94 0.01 264 / 0.4)' }}
                />
                <Bar dataKey="count" name={t('dashboard.totalRequests')} radius={[4, 4, 0, 0]}>
                  {rbs.map((entry, i) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.status] ?? '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">{t('dashboard.noData')}</div>
          )}
        </div>

        {/* Right column: approval donut + open tickets */}
        <div className="space-y-4">
          {/* Approval Rate mini gauge */}
          <div className="bg-card border border-border rounded-lg shadow-sm p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">{t('dashboard.approvalRate')}</h2>
            <div className="flex items-center gap-4">
              <div className="relative size-[72px] flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={approvalData} layout="vertical" barSize={12} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {approvalData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">{m.approvalRate ?? 0}<span className="text-base font-normal text-muted-foreground">%</span></p>
                <p className="text-xs text-muted-foreground">{t('dashboard.ofTotalDecisions')}</p>
              </div>
            </div>
          </div>

          {/* Open IT tickets */}
          <div className="bg-card border border-border rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">{t('dashboard.itTickets')}</h2>
              <Link href="/admin/requests" className="text-xs text-primary hover:underline">{t('common.view')}</Link>
            </div>
            <div className="flex items-end gap-3">
              <p className={cn('text-3xl font-bold', (m.openTickets ?? 0) > 0 ? 'text-red-600' : 'text-foreground')}>
                {m.openTickets ?? 0}
              </p>
              <div className="pb-0.5">
                <p className="text-xs text-muted-foreground">{t('dashboard.openTickets')}</p>
                <p className="text-xs text-muted-foreground">{t('dashboard.ofTotalTickets', { total: r.totalTickets ?? 0 })}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Request by Type ─────────────────────────────────────────────────── */}
      {rbt.length > 0 && (
        <div className="bg-card border border-border rounded-lg shadow-sm p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">{t('dashboard.requestsByType')}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {rbt.slice(0, 8).map((item, i) => {
              const max = rbt[0]?.count ?? 1
              const pct = Math.round((item.count / max) * 100)
              const colors = ['bg-primary', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-blue-500', 'bg-red-500', 'bg-pink-500', 'bg-cyan-500']
              return (
                <div key={item.type} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground font-medium truncate">{item.type}</span>
                    <span className="text-muted-foreground ml-2">{item.count}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full', colors[i % colors.length])} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Recent Requests ─────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">{t('dashboard.recentRequests')}</h2>
          <Link href="/admin/requests" className="text-xs text-primary hover:underline flex items-center gap-0.5">
            {t('dashboard.allRequests')} <ArrowRight className="size-3" />
          </Link>
        </div>
        {recent.length > 0 ? (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left py-2.5 px-5 font-medium text-muted-foreground">{t('dashboard.colRequest')}</th>
                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground hidden sm:table-cell">{t('dashboard.colType')}</th>
                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground hidden md:table-cell">{t('dashboard.colRequester')}</th>
                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">{t('dashboard.colStatus')}</th>
                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground hidden lg:table-cell">{t('dashboard.colAssignee')}</th>
                <th className="text-right py-2.5 px-5 font-medium text-muted-foreground">{t('dashboard.colWhen')}</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((req) => (
                <tr
                  key={req.id}
                  className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => router.push(`/admin/requests/${req.id}`)}
                >
                  <td className="py-2.5 px-5">
                    <div className="flex items-center gap-2">
                      <span className={cn('size-1.5 rounded-full flex-shrink-0', PRIORITY_DOT[req.priority] ?? 'bg-slate-400')} />
                      <div>
                        <span className="font-medium text-foreground">
                          {req.title ?? req.requestNo}
                        </span>
                        <p className="text-muted-foreground text-[10px]">{req.requestNo}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-muted-foreground hidden sm:table-cell truncate max-w-[120px]">
                    {req.typeName ?? req.type}
                  </td>
                  <td className="py-2.5 px-3 text-muted-foreground hidden md:table-cell">
                    {req.submittedByName}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={cn(
                      'inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                      STATUS_BADGE[req.status] ?? 'bg-muted text-muted-foreground border-border'
                    )}>
                      {req.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-muted-foreground hidden lg:table-cell">
                    {req.assignedToName ?? '—'}
                  </td>
                  <td className="py-2.5 px-5 text-right text-muted-foreground">
                    {timeAgo(req.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileText className="size-7 opacity-30 mb-2" />
            <p className="text-sm">{t('dashboard.noRequests')}</p>
          </div>
        )}
      </div>

      {/* ── Quick links ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { labelKey: 'nav.users',      href: '/admin/users',      icon: Users,       color: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30' },
          { labelKey: 'nav.requests',   href: '/admin/requests',   icon: FileText,    color: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30' },
          { labelKey: 'nav.workflows',  href: '/admin/workflows',  icon: Workflow,    color: 'bg-purple-50 text-purple-600 dark:bg-purple-950/30' },
          { labelKey: 'nav.monitoring', href: '/admin/monitoring', icon: Monitor,     color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30' },
        ].map(({ labelKey, href, icon: Icon, color }) => (
          <Link key={href} href={href}>
            <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3 hover:shadow-md transition-all cursor-pointer group">
              <div className={cn('size-9 rounded-lg flex items-center justify-center flex-shrink-0', color)}>
                <Icon className="size-4" />
              </div>
              <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{t(labelKey)}</span>
              <ArrowRight className="size-3.5 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
