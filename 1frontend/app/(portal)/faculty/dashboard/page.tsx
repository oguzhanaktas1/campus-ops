'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { MetricCard } from '@/components/metric-card'
import { StatusBadge } from '@/components/status-badge'
import { CheckSquare, Clock, Calendar, ArrowRight, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

function formatDate(d: string) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTime(d: string) {
  if (!d) return ''
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export default function FacultyDashboard() {
  const [user, setUser] = useState<any>(null)
  const [pending, setPending] = useState<any[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [allRequests, setAllRequests] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      const token = localStorage.getItem('access_token')
      if (!token) return

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const headers = { Authorization: `Bearer ${token}` }

      try {
        // 🔥 TÜM VERİLERİ ASENKRON OLARAK AYNI ANDA ÇEKİYORUZ 🔥
        const [profileRes, pendingRes, allRes, eventsRes] = await Promise.all([
          fetch(`${backendUrl}/auth/profile`, { headers }),
          fetch(`${backendUrl}/faculty/requests/pending`, { headers }),
          fetch(`${backendUrl}/faculty/requests/all`, { headers }),
          fetch(`${backendUrl}/faculty/calendar/events`, { headers })
        ])

        if (profileRes.ok) setUser(await profileRes.json())
        if (pendingRes.ok) setPending(await pendingRes.json())
        if (allRes.ok) setAllRequests(await allRes.json())
        
        if (eventsRes.ok) {
          const events = await eventsRes.json()
          // Sadece bugünün randevularını filtrele
          const today = new Date()
          const todaysEvents = events.filter((e: any) => {
            const eDate = new Date(e.startDate)
            return eDate.getDate() === today.getDate() && 
                   eDate.getMonth() === today.getMonth() && 
                   eDate.getFullYear() === today.getFullYear()
          })
          setAppointments(todaysEvents)
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  if (isLoading) {
    return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>
  }

  if (!user) return null

  // 🔥 GERÇEK VERİLERDEN METRİK HESAPLAMALARI 🔥
  const todayStr = new Date().toDateString()
  
  // All Requests içinden bugünün onay/red sayılarını bul
  const approvedToday = allRequests.filter(r => r.status === 'APPROVED' && new Date(r.createdAt).toDateString() === todayStr).length
  const rejectedToday = allRequests.filter(r => r.status === 'REJECTED' && new Date(r.createdAt).toDateString() === todayStr).length
  
  const metrics = {
    pendingCount: pending.length,
    approvedToday,
    rejectedToday,
    avgReviewHours: 12 // Ortalama süre için şimdilik statik tutuyoruz
  }

  // 🔥 GERÇEK VERİLERDEN HAFTALIK GRAFİK HESAPLAMASI 🔥
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const weeklyDataMap = [
    { day: 'Mon', approved: 0, rejected: 0 },
    { day: 'Tue', approved: 0, rejected: 0 },
    { day: 'Wed', approved: 0, rejected: 0 },
    { day: 'Thu', approved: 0, rejected: 0 },
    { day: 'Fri', approved: 0, rejected: 0 },
    { day: 'Sat', approved: 0, rejected: 0 },
    { day: 'Sun', approved: 0, rejected: 0 },
  ]

  const now = new Date()
  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1))) // Pazartesi başlangıç

  allRequests.forEach(r => {
    const d = new Date(r.createdAt)
    if (d >= startOfWeek && (r.status === 'APPROVED' || r.status === 'REJECTED')) {
      const dayName = days[d.getDay()]
      const dayData = weeklyDataMap.find(w => w.day === dayName)
      if (dayData) {
        if (r.status === 'APPROVED') dayData.approved++
        if (r.status === 'REJECTED') dayData.rejected++
      }
    }
  })

  // Pazartesi'den Cuma'ya sıralama
  const weeklyData = [
    weeklyDataMap[0], weeklyDataMap[1], weeklyDataMap[2], weeklyDataMap[3], weeklyDataMap[4]
  ]

  // Kullanıcı İsimlendirmesi
  const title = user?.title || 'Prof.'
  const lastName = user?.lastName || user?.fullName?.split(' ').slice(-1)[0] || 'User'

  // AŞAĞIDAKİ JSX VE SINIFLARA HİÇBİR ŞEKİLDE DOKUNULMADI
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-foreground">Welcome, {title} {lastName}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your pending approvals and schedule for today.</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Pending Approvals"
          value={metrics.pendingCount}
          description="Require action"
          icon={<CheckSquare className="size-4" />}
          valueClassName="text-amber-600"
        />
        <MetricCard
          title="Approved Today"
          value={metrics.approvedToday}
          icon={<CheckCircle2 className="size-4" />}
          trend={metrics.approvedToday > 0 ? 15 : 0}
          trendLabel="vs yesterday"
        />
        <MetricCard
          title="Rejected Today"
          value={metrics.rejectedToday}
          icon={<XCircle className="size-4" />}
        />
        <MetricCard
          title="Avg Review Time"
          value={`${metrics.avgReviewHours}h`}
          description="Per request"
          icon={<Clock className="size-4" />}
          trend={-8}
          trendLabel="vs last week"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Pending Approvals */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Pending Approvals</h2>
            <Link href="/faculty/approvals">
              <Button variant="ghost" size="sm" className="text-xs gap-1">View all <ArrowRight className="size-3" /></Button>
            </Link>
          </div>
          <div className="divide-y divide-border">
            {pending.map((req) => (
              <Link key={req.id} href={`/faculty/approvals?id=${req.id}`}>
                <div className="px-5 py-3.5 flex items-start justify-between gap-3 hover:bg-muted/30 transition-colors cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{req.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {req.submittedByName} · {req.typeName || req.type?.replace(/_/g, ' ')} · {formatDate(req.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={req.status} />
                </div>
              </Link>
            ))}
            {pending.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No pending approvals.</p>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Today's Appointments */}
          <div className="bg-card border border-border rounded-lg shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Today's Appointments</h2>
              <Link href="/faculty/appointments">
                <Button variant="ghost" size="sm" className="text-xs h-auto py-0.5 gap-1">
                  View <ArrowRight className="size-3" />
                </Button>
              </Link>
            </div>
            <div className="divide-y divide-border">
              {appointments.slice(0, 3).map((apt) => (
                <div key={apt.id} className="px-4 py-3">
                  <p className="text-sm font-medium text-foreground">{apt.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{apt.description || 'No description'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatTime(apt.startDate)} · Office / Online</p>
                </div>
              ))}
              {appointments.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No appointments today.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Activity Chart */}
      <div className="bg-card border border-border rounded-lg shadow-sm p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Approval Activity – This Week</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={weeklyData} barSize={20} barGap={4}>
            <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
              cursor={{ fill: 'oklch(0.94 0.01 264 / 0.5)' }}
            />
            <Bar dataKey="approved" name="Approved" fill="oklch(0.53 0.14 162)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="rejected" name="Rejected" fill="oklch(0.577 0.245 27.325)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}