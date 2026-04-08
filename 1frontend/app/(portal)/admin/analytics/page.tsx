'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  AreaChart, Area, CartesianGrid,
} from 'recharts'
import { Loader2 } from 'lucide-react'
import { getToken } from '@/lib/auth'

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6']

export default function AdminAnalyticsPage() {
  const [metrics, setMetrics] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const token = getToken()
      if (!token) return

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const headers = { Authorization: `Bearer ${token}` }

      try {
        const res = await fetch(`${backendUrl}/admin/analytics/overview`, { headers })
        if (res.ok) setMetrics(await res.json())
      } catch (e) {
        console.error('Analytics fetch error:', e)
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
  const summary = m
  const requestsByStatus = m.requestsByStatus ?? []
  const ticketsByStatus = m.ticketsByStatus ?? []

  const pieData = requestsByStatus.map((r: any, i: number) => ({
    type: r.status,
    count: r.count,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }))

  const ticketPieData = ticketsByStatus.map((t: any, i: number) => ({
    type: t.status,
    count: t.count,
    color: PIE_COLORS[(i + 2) % PIE_COLORS.length],
  }))

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Platform-wide metrics and performance insights.</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Requests', value: m.totalRequests ?? 0 },
          { label: 'Total Users', value: m.totalUsers ?? 0 },
          { label: 'Open Tickets', value: m.openTickets ?? 0 },
          { label: 'Approval Rate', value: `${m.approvalRate ?? 0}%` },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card border border-border rounded-lg p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Requests by Status bar chart */}
        <div className="bg-card border border-border rounded-lg shadow-sm p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Requests by Status</h2>
          {requestsByStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={requestsByStatus} barSize={22}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 264)" />
                <XAxis dataKey="status" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="count" name="Requests" fill="oklch(0.511 0.262 276.966)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-16">No data available.</p>
          )}
        </div>

        {/* Tickets by Status bar chart */}
        <div className="bg-card border border-border rounded-lg shadow-sm p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Tickets by Status</h2>
          {ticketsByStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ticketsByStatus} barSize={22}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 264)" />
                <XAxis dataKey="status" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="count" name="Tickets" fill="oklch(0.53 0.14 162)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-16">No data available.</p>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Request status pie */}
        <div className="bg-card border border-border rounded-lg shadow-sm p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Request Status Breakdown</h2>
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
                      <div className="size-2 rounded-full" style={{ background: item.color }} />
                      <span className="text-muted-foreground capitalize">{item.type.toLowerCase()}</span>
                    </div>
                    <span className="font-medium text-foreground">{item.count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No data.</p>
          )}
        </div>

        {/* Summary stats */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg shadow-sm p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Platform Summary</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Total Reservations', value: summary.totalReservations ?? 0 },
              { label: 'Total Appointments', value: summary.totalAppointments ?? 0 },
              { label: 'Overdue Requests', value: m.overdueRequests ?? 0 },
              { label: 'Today\'s Requests', value: m.todayRequests ?? 0 },
            ].map((stat) => (
              <div key={stat.label} className="bg-muted/30 rounded-lg p-4 text-center">
                <p className="text-xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
