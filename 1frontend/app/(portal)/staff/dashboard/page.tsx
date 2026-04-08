'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { MetricCard } from '@/components/metric-card'
import { StatusBadge } from '@/components/status-badge'
import { PriorityBadge } from '@/components/status-badge'
import {
  Ticket,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Zap,
  Activity,
  Loader2
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'

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
  { label: 'IT Support', sla: 4, actual: 3.2 },
  { label: 'Maintenance', sla: 24, actual: 18.5 },
  { label: 'Equipment', sla: 48, actual: 52 },
  { label: 'Room Res.', sla: 8, actual: 6.1 },
]

function formatDate(d: string) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function StaffDashboard() {
  const [user, setUser] = useState<any>(null)
  const [metrics, setMetrics] = useState({
    assignedCount: 0,
    overdueCount: 0,
    completedToday: 0,
    slaBreaches: 0,
    avgResponseHours: 0
  })
  const [assigned, setAssigned] = useState<any[]>([])
  const [urgent, setUrgent] = useState<any[]>([])
  const [overdue, setOverdue] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem('access_token')
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
        
        // 0. PROFİL ÇEK
        const resProfile = await fetch(`${backendUrl}/auth/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (resProfile.ok) setUser(await resProfile.json())

        // 1. METRİKLERİ ÇEK
        const resMetrics = await fetch(`${backendUrl}/staff/metrics`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        
        if (resMetrics.ok) {
          const mData = await resMetrics.json()
          setMetrics(prev => ({
            ...prev,
            assignedCount: mData.unassignedRequests || 0,
            completedToday: 12, 
            slaBreaches: 2,     
            avgResponseHours: 4 
          }))
        }

        // 2. TÜM TALEPLERİ ÇEK (Aktif olanlar)
        const resRequests = await fetch(`${backendUrl}/staff/requests?filter=active`, {
          headers: { Authorization: `Bearer ${token}` }
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
      } catch (error) {
        console.error('Dashboard verileri çekilemedi:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  if (isLoading) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto pb-20">
      <div>
        <h1 className="text-xl font-bold text-foreground">
          Welcome, {user?.name?.split(' ')[0] || 'Staff'}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Here&apos;s your operations queue and SLA status.
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Assigned Tickets"
          value={metrics.assignedCount}
          description="In your queue"
          icon={<Ticket className="size-4" />}
        />
        <MetricCard
          title="Overdue"
          value={metrics.overdueCount}
          description="Past SLA"
          icon={<AlertTriangle className="size-4" />}
          valueClassName="text-destructive"
        />
        <MetricCard
          title="Completed Today"
          value={metrics.completedToday}
          icon={<CheckCircle2 className="size-4" />}
          trend={12}
          trendLabel="vs yesterday"
        />
        <MetricCard
          title="SLA Breaches"
          value={metrics.slaBreaches}
          description="This week"
          icon={<Zap className="size-4" />}
          valueClassName={metrics.slaBreaches > 0 ? 'text-amber-600' : undefined}
        />
        <MetricCard
          title="Avg Response"
          value={`${metrics.avgResponseHours}h`}
          description="Time to first action"
          icon={<Clock className="size-4" />}
          trend={-5}
          trendLabel="vs last week"
        />
      </div>

      {/* Overdue Alert */}
      {overdue.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/8 border border-destructive/20">
          <AlertTriangle className="size-4 text-destructive mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-destructive">
              {overdue.length} overdue ticket{overdue.length > 1 ? 's' : ''} requiring immediate attention
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              These tickets have exceeded their SLA deadline.
            </p>
          </div>
          <Link href="/staff/tickets?filter=overdue" className="ml-auto">
            <Button variant="outline" size="sm" className="text-xs border-destructive/30 text-destructive hover:bg-destructive/10">
              View Overdue
            </Button>
          </Link>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Ticket Queue */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <h2 className="text-sm font-semibold text-foreground">My Ticket Queue</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{assigned.length} active tickets</p>
            </div>
            <Link href="/staff/requests">
              <Button variant="ghost" size="sm" className="text-xs gap-1">
                View all <ArrowRight className="size-3" />
              </Button>
            </Link>
          </div>
          <div className="divide-y divide-border h-[400px] overflow-y-auto">
            {assigned.map((req) => {
              // 🔥 24 SAAT KONTROLÜ (NEW ROZETİ İÇİN) 🔥
              const isNew = (Date.now() - new Date(req.createdAt).getTime()) < 24 * 60 * 60 * 1000;

              return (
                <Link key={req.id} href={`/staff/requests/${req.type}/${req.id}`}>
                  <div className="px-5 py-3.5 flex items-start justify-between gap-3 hover:bg-muted/30 transition-colors cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-medium text-foreground truncate">{req.title}</p>
                        {/* 🔥 YENİ İSE ROZETİ BAS 🔥 */}
                        {isNew && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-[9px] font-bold uppercase tracking-wider flex-shrink-0">
                            New
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
                No tickets assigned to you.
              </p>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Urgent tickets */}
          <div className="bg-card border border-border rounded-lg shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Zap className="size-3.5 text-destructive" />
                <h2 className="text-sm font-semibold text-foreground">Urgent</h2>
              </div>
              <span className="text-xs text-muted-foreground">{urgent.length} tickets</span>
            </div>
            <div className="divide-y divide-border max-h-[200px] overflow-y-auto">
              {urgent.map((req) => {
                // 🔥 URGENT KISMINA DA YENİ ROZETİNİ EKLEDİK 🔥
                const isNew = (Date.now() - new Date(req.createdAt).getTime()) < 24 * 60 * 60 * 1000;

                return (
                  <Link key={req.id} href={`/staff/requests/${req.type}/${req.id}`}>
                    <div className="px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{req.title}</p>
                        {isNew && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-[8px] font-bold uppercase tracking-wider flex-shrink-0">
                            New
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
                  No urgent tickets.
                </p>
              )}
            </div>
          </div>

          {/* SLA Summary */}
          <div className="bg-card border border-border rounded-lg shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="size-3.5 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">SLA Summary</h2>
            </div>
            <div className="space-y-2.5">
              {slaData.map((item) => {
                const breached = item.actual > item.sla
                const pct = Math.min((item.actual / item.sla) * 100, 100)
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{item.label}</span>
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

      {/* Throughput Chart */}
      <div className="bg-card border border-border rounded-lg shadow-sm p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Weekly Throughput</h2>
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
            <Bar dataKey="created" name="Created" fill="oklch(0.769 0.188 70.08)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="resolved" name="Resolved" fill="oklch(0.53 0.14 162)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}