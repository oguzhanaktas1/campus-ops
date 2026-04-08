'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts'

const weeklyData = [
  { day: 'Mon', opened: 8, resolved: 6 },
  { day: 'Tue', opened: 14, resolved: 11 },
  { day: 'Wed', opened: 9, resolved: 13 },
  { day: 'Thu', opened: 17, resolved: 14 },
  { day: 'Fri', opened: 12, resolved: 15 },
  { day: 'Sat', opened: 4, resolved: 5 },
  { day: 'Sun', opened: 2, resolved: 3 },
]

const resolutionTrend = [
  { week: 'W44', avgHours: 5.2 },
  { week: 'W45', avgHours: 4.8 },
  { week: 'W46', avgHours: 6.1 },
  { week: 'W47', avgHours: 3.8 },
]

const typeBreakdown = [
  { type: 'IT Support', count: 42 },
  { type: 'Maintenance', count: 18 },
  { type: 'Equipment', count: 15 },
  { type: 'Room Res.', count: 22 },
  { type: 'Other', count: 9 },
]

export default function StaffReportsPage() {
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-foreground">Reports & Analytics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Staff operational performance overview.</p>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Tickets (Month)', value: '106', note: '+12% vs last month' },
          { label: 'Resolved', value: '89', note: '84% resolution rate' },
          { label: 'Avg Resolution', value: '3.8h', note: '-0.4h vs last month' },
          { label: 'SLA Compliance', value: '94%', note: '6 breaches total' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card border border-border rounded-lg p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{kpi.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{kpi.note}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Weekly throughput */}
        <div className="bg-card border border-border rounded-lg shadow-sm p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Weekly Ticket Throughput</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeklyData} barSize={16} barGap={4}>
              <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} cursor={{ fill: 'oklch(0.94 0.01 264 / 0.4)' }} />
              <Bar dataKey="opened" name="Opened" fill="oklch(0.769 0.188 70.08)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="resolved" name="Resolved" fill="oklch(0.53 0.14 162)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Type breakdown */}
        <div className="bg-card border border-border rounded-lg shadow-sm p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Tickets by Type</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={typeBreakdown} layout="vertical" barSize={16}>
              <XAxis type="number" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="type" type="category" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} cursor={{ fill: 'oklch(0.94 0.01 264 / 0.4)' }} />
              <Bar dataKey="count" name="Tickets" fill="oklch(0.511 0.262 276.966)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Resolution time trend */}
      <div className="bg-card border border-border rounded-lg shadow-sm p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Avg Resolution Time Trend (hours)</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={resolutionTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 264)" />
            <XAxis dataKey="week" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 8]} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Line type="monotone" dataKey="avgHours" name="Avg Hours" stroke="oklch(0.511 0.262 276.966)" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
