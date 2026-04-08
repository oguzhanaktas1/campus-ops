'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { MetricCard } from '@/components/metric-card'
import {
  FileText,
  Users,
  CheckSquare,
  Activity,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Ticket,
  Calendar,
  BookMarked,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { cn } from '@/lib/utils'
import { getToken } from '@/lib/auth'

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6']

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<any>(null)
  const [reports, setReports] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const token = getToken()
      if (!token) return

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const headers = { Authorization: `Bearer ${token}` }

      try {
        const [metricsRes, reportsRes] = await Promise.all([
          fetch(`${backendUrl}/admin/dashboard/summary`, { headers }),
          fetch(`${backendUrl}/admin/reports`, { headers }),
        ])

        if (metricsRes.ok) setMetrics(await metricsRes.json())
        if (reportsRes.ok) setReports(await reportsRes.json())
      } catch (error) {
        console.error('Admin dashboard fetch error:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  const m = metrics ?? {}
  const requestsByStatus = reports?.requestsByStatus ?? []
  const ticketsByStatus = reports?.ticketsByStatus ?? []

  const pieData = requestsByStatus.map((r: any, i: number) => ({
    type: r.status,
    count: r.count,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }))

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">System Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Real-time platform health and request metrics.</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="size-3" />
          System Healthy
        </span>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Requests"
          value={m.totalRequests ?? 0}
          description="All time"
          icon={<FileText className="size-4" />}
        />
        <MetricCard
          title="Open Requests"
          value={m.openRequests ?? 0}
          description="Require attention"
          icon={<Activity className="size-4" />}
          valueClassName="text-amber-600"
        />
        <MetricCard
          title="Active Users"
          value={(m.activeUsers ?? 0).toLocaleString()}
          icon={<Users className="size-4" />}
        />
        <MetricCard
          title="Approval Rate"
          value={`${m.approvalRate ?? 0}%`}
          icon={<CheckSquare className="size-4" />}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Requests by Status chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg shadow-sm p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Requests by Status</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={requestsByStatus} barSize={22}>
              <XAxis dataKey="status" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} cursor={{ fill: 'oklch(0.94 0.01 264 / 0.4)' }} />
              <Bar dataKey="count" name="Count" fill="oklch(0.511 0.262 276.966)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Requests distribution pie */}
        <div className="bg-card border border-border rounded-lg shadow-sm p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Status Distribution</h2>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={65} innerRadius={35}>
                    {pieData.map((entry: any, i: number) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1.5">
                {pieData.slice(0, 5).map((item: any) => (
                  <div key={item.type} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="size-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
                      <span className="text-muted-foreground capitalize">{item.type.toLowerCase()}</span>
                    </div>
                    <span className="font-medium text-foreground">{item.count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No data yet.</p>
          )}
        </div>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-amber-600">{m.overdueRequests ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-1">Overdue Requests</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-destructive">{m.openTickets ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-1">Open Tickets</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-foreground">{m.todayReservations ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-1">Today's Reservations</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-primary">{m.todayAppointments ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-1">Today's Appointments</p>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Manage Users', href: '/admin/users', icon: Users },
          { label: 'All Requests', href: '/admin/requests', icon: FileText },
          { label: 'Open Tickets', href: '/admin/tickets', icon: Ticket },
          { label: 'Reservations', href: '/admin/reservations', icon: BookMarked },
        ].map(({ label, href, icon: Icon }) => (
          <Link key={href} href={href}>
            <div className="bg-card border border-border rounded-lg p-4 flex flex-col items-center gap-2 hover:shadow-md transition-shadow cursor-pointer text-center">
              <div className="size-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
                <Icon className="size-5" />
              </div>
              <span className="text-xs font-medium text-foreground">{label}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
