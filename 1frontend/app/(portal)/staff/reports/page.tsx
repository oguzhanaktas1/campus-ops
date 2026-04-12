'use client'

import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

interface StaffReportsData {
  scope: string
  totalTickets: number
  openTickets: number
  resolvedTickets: number
  avgResolutionHours: number
  overdueCount: number
  slaCompliance: number
  slaBreaches: number
  weeklyThroughput: { day: string; opened: number; resolved: number }[]
  resolutionTrend: { week: string; avgHours: number }[]
  typeBreakdown: { type: string; count: number }[]
  priorityBreakdown: { priority: string; count: number }[]
}

export default function StaffReportsPage() {
  const [data, setData] = useState<StaffReportsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadReports() {
      try {
        const res = await fetch(`${BACKEND}/staff/reports`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })

        if (!res.ok) throw new Error()
        setData(await res.json())
      } catch {
        toast.error('Failed to load report data.')
      } finally {
        setIsLoading(false)
      }
    }

    void loadReports()
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading reports...</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-foreground">Reports & Analytics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {data.scope === 'TEAM'
            ? 'Team-wide IT performance overview.'
            : 'Your assigned IT ticket performance overview.'}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Visible Tickets', value: data.totalTickets, note: `${data.openTickets} open` },
          { label: 'Resolved / Closed', value: data.resolvedTickets, note: 'Completed workload' },
          { label: 'Avg Resolution', value: `${data.avgResolutionHours}h`, note: 'Across completed tickets' },
          { label: 'SLA Compliance', value: `${data.slaCompliance}%`, note: `${data.slaBreaches} breach events` },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card border border-border rounded-lg p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{kpi.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{kpi.note}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-card border border-border rounded-lg shadow-sm p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Weekly Ticket Throughput</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.weeklyThroughput} barSize={16} barGap={4}>
              <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="opened" name="Opened" fill="oklch(0.769 0.188 70.08)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="resolved" name="Resolved" fill="oklch(0.53 0.14 162)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-lg shadow-sm p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Tickets by Category</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.typeBreakdown} layout="vertical" barSize={16}>
              <XAxis type="number" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="type" type="category" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={100} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="count" name="Tickets" fill="oklch(0.511 0.262 276.966)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-card border border-border rounded-lg shadow-sm p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Avg Resolution Time Trend (hours)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.resolutionTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 264)" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Line type="monotone" dataKey="avgHours" name="Avg Hours" stroke="oklch(0.511 0.262 276.966)" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-lg shadow-sm p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Tickets by Priority</h2>
          <div className="space-y-3">
            {data.priorityBreakdown.map((row) => {
              const maxCount = Math.max(...data.priorityBreakdown.map((item) => item.count), 1)
              return (
                <div key={row.priority} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">{row.priority}</span>
                    <span className="text-sm font-bold text-foreground">{row.count}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.round((row.count / maxCount) * 100)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs text-muted-foreground">Overdue Tickets</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{data.overdueCount}</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs text-muted-foreground">SLA Breaches</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{data.slaBreaches}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
