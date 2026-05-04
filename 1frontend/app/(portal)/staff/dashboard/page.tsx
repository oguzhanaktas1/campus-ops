'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { MetricCard } from '@/components/metric-card'
import { StatusBadge, PriorityBadge } from '@/components/status-badge'
import {
  Ticket,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Zap,
  Activity,
  Loader2,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'
import { fetchProfile, getStoredUser } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

const STAFF_AI_SUMMARY_CACHE_KEY = 'campusops-ai-summary:staff-dashboard'

const requestTypeLabels: Record<string, string> = {
  it_support: 'IT Support',
  maintenance: 'Maintenance',
  equipment: 'Equipment',
  room_reservation: 'Room Reservation',
  internship: 'Internship',
  appointment: 'Appointment',
  transcript: 'Transcript',
  enrollment: 'Enrollment',
}

const slaData = [
  { labelKey: 'dashboard.itSupport', sla: 4, actual: 3.2 },
  { labelKey: 'dashboard.maintenance', sla: 24, actual: 18.5 },
  { labelKey: 'dashboard.equipment', sla: 48, actual: 52 },
  { labelKey: 'dashboard.roomReservationsShort', sla: 8, actual: 6.1 },
]

function formatDate(d: string) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function StaffDashboard() {
  const { t } = useI18n()
  const [user, setUser] = useState<any>(null)
  const [aiNarration, setAiNarration] = useState<any>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [metrics, setMetrics] = useState({
    assignedCount: 0,
    overdueCount: 0,
    completedToday: 0,
    slaBreaches: 0,
    avgResponseHours: 0,
  })
  const [assigned, setAssigned] = useState<any[]>([])
  const [urgent, setUrgent] = useState<any[]>([])
  const [overdue, setOverdue] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const readCachedAiNarration = () => {
      const raw = sessionStorage.getItem(STAFF_AI_SUMMARY_CACHE_KEY)
      if (!raw) return null

      try {
        return JSON.parse(raw)
      } catch {
        sessionStorage.removeItem(STAFF_AI_SUMMARY_CACHE_KEY)
        return null
      }
    }

    const writeCachedAiNarration = (value: unknown) => {
      sessionStorage.setItem(STAFF_AI_SUMMARY_CACHE_KEY, JSON.stringify(value))
    }

    const fetchAiNarration = async (
      backendUrl: string,
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
        const resAi = await fetch(`${backendUrl}/ai/analytics/it-overview`, {
          headers,
        })

        if (!resAi.ok) {
          return
        }

        const next = await resAi.json()
        setAiNarration(next)
        writeCachedAiNarration(next)
      } catch (error) {
        console.error('Staff AI summary fetch failed:', error)
      } finally {
        setAiLoading(false)
      }
    }

    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem('access_token')
        const storedUser = getStoredUser()
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
        const headers = { Authorization: `Bearer ${token}` }

        if (storedUser) {
          try {
            setUser(await fetchProfile())
          } catch {}
        }

        const resMetrics = await fetch(`${backendUrl}/staff/metrics`, {
          headers,
        })

        if (resMetrics.ok) {
          const mData = await resMetrics.json()
          setMetrics((prev) => ({
            ...prev,
            assignedCount: mData.unassignedRequests || 0,
            completedToday: 12,
            slaBreaches: 2,
            avgResponseHours: 4,
          }))
        }

        const resRequests = await fetch(`${backendUrl}/staff/requests?filter=active`, {
          headers,
        })

        if (resRequests.ok) {
          const reqData = await resRequests.json()

          const parsedRequests = reqData.map((r: any) => ({
            id: r.id,
            title: r.title,
            type: r.category?.toLowerCase() || 'general',
            priority: r.priority,
            status: r.status,
            createdAt: r.createdAt,
            submittedByName: r.requesterName,
          }))

          setAssigned(parsedRequests)
          setUrgent(parsedRequests.filter((r: any) => r.priority === 'URGENT' || r.priority === 'HIGH'))
          setOverdue([])
        }

        void fetchAiNarration(backendUrl, headers)
      } catch (error) {
        console.error('Dashboard data fetch failed:', error)
      } finally {
        setIsLoading(false)
      }
    }

    void fetchDashboardData()
  }, [])

  if (isLoading) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto pb-20">
      <div>
        <h1 className="text-xl font-bold text-foreground">
          {t('dashboard.welcome', { name: user?.name?.split(' ')[0] || t('nav.staffPortal') })}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t('dashboard.subtitle')}
        </p>
      </div>

      {(aiLoading || aiNarration?.summary) && (
        <div className="rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-500/8 via-background to-background p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-amber-600" />
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

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard title={t('dashboard.assignedTickets')} value={metrics.assignedCount} description={t('dashboard.inYourQueue')} icon={<Ticket className="size-4" />} />
        <MetricCard title={t('dashboard.overdue')} value={metrics.overdueCount} description={t('dashboard.pastSla')} icon={<AlertTriangle className="size-4" />} valueClassName="text-destructive" />
        <MetricCard title={t('dashboard.completedToday')} value={metrics.completedToday} icon={<CheckCircle2 className="size-4" />} trend={12} trendLabel="vs yesterday" />
        <MetricCard title={t('dashboard.slaBreaches')} value={metrics.slaBreaches} description={t('dashboard.thisWeek')} icon={<Zap className="size-4" />} valueClassName={metrics.slaBreaches > 0 ? 'text-amber-600' : undefined} />
        <MetricCard title={t('dashboard.avgResponse')} value={`${metrics.avgResponseHours}h`} description={t('dashboard.timeToFirstAction')} icon={<Clock className="size-4" />} trend={-5} trendLabel="vs last week" />
      </div>

      {overdue.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/8 border border-destructive/20">
          <AlertTriangle className="size-4 text-destructive mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-destructive">
              {t('dashboard.overdueWarning', { count: overdue.length, suffix: overdue.length > 1 ? 's' : '' })}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('dashboard.overdueDesc')}
            </p>
          </div>
          <Link href="/staff/tickets?filter=overdue" className="ml-auto">
            <Button variant="outline" size="sm" className="text-xs border-destructive/30 text-destructive hover:bg-destructive/10">
              {t('dashboard.viewOverdue')}
            </Button>
          </Link>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-card border border-border rounded-lg shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <h2 className="text-sm font-semibold text-foreground">{t('dashboard.myTicketQueue')}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{t('dashboard.activeTickets', { count: assigned.length })}</p>
            </div>
            <Link href="/staff/requests">
              <Button variant="ghost" size="sm" className="text-xs gap-1">
                {t('common.viewAll')} <ArrowRight className="size-3" />
              </Button>
            </Link>
          </div>
          <div className="divide-y divide-border h-[400px] overflow-y-auto">
            {assigned.map((req) => {
              const isNew = (Date.now() - new Date(req.createdAt).getTime()) < 24 * 60 * 60 * 1000

              return (
                <Link key={req.id} href={`/staff/requests/${req.type}/${req.id}`}>
                  <div className="px-5 py-3.5 flex items-start justify-between gap-3 hover:bg-muted/30 transition-colors cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-medium text-foreground truncate">{req.title}</p>
                        {isNew && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-[9px] font-bold uppercase tracking-wider flex-shrink-0">
                            {t('common.new')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {requestTypeLabels[req.type] ?? req.type} · {req.submittedByName} · {formatDate(req.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <PriorityBadge priority={req.priority} />
                      <StatusBadge status={req.status} />
                    </div>
                  </div>
                </Link>
              )
            })}
            {assigned.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t('dashboard.noAssigned')}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-card border border-border rounded-lg shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Zap className="size-3.5 text-destructive" />
                <h2 className="text-sm font-semibold text-foreground">{t('dashboard.urgent')}</h2>
              </div>
              <span className="text-xs text-muted-foreground">{t('dashboard.ticketCount', { count: urgent.length })}</span>
            </div>
            <div className="divide-y divide-border max-h-[200px] overflow-y-auto">
              {urgent.map((req) => {
                const isNew = (Date.now() - new Date(req.createdAt).getTime()) < 24 * 60 * 60 * 1000

                return (
                  <Link key={req.id} href={`/staff/requests/${req.type}/${req.id}`}>
                    <div className="px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{req.title}</p>
                        {isNew && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-[8px] font-bold uppercase tracking-wider flex-shrink-0">
                            {t('common.new')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {req.submittedByName} · {formatDate(req.createdAt)}
                      </p>
                    </div>
                  </Link>
                )
              })}
              {urgent.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {t('dashboard.noUrgent')}
                </p>
              )}
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="size-3.5 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">{t('dashboard.slaSummary')}</h2>
            </div>
            <div className="space-y-2.5">
              {slaData.map((item) => {
                const breached = item.actual > item.sla
                const pct = Math.min((item.actual / item.sla) * 100, 100)
                return (
                  <div key={item.labelKey}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{t(item.labelKey)}</span>
                      <span className={cn('font-medium', breached ? 'text-destructive' : 'text-emerald-600')}>
                        {item.actual}h / {item.sla}h
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', breached ? 'bg-destructive' : 'bg-emerald-500')}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">{t('dashboard.weeklyThroughput')}</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={[
              { day: 'Mon', created: 8, resolved: 6 },
              { day: 'Tue', created: 14, resolved: 11 },
              { day: 'Wed', created: 9, resolved: 13 },
              { day: 'Thu', created: 17, resolved: 14 },
              { day: 'Fri', created: 12, resolved: 15 },
              { day: 'Sat', created: 4, resolved: 5 },
              { day: 'Sun', created: 2, resolved: 3 },
            ]}
            barSize={18}
            barGap={4}
          >
            <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
              cursor={{ fill: 'oklch(0.94 0.01 264 / 0.4)' }}
            />
            <Bar dataKey="created" name={t('dashboard.created')} fill="oklch(0.769 0.188 70.08)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="resolved" name={t('dashboard.resolved')} fill="oklch(0.53 0.14 162)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
