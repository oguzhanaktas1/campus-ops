'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { MetricCard } from '@/components/metric-card'
import { StatusBadge } from '@/components/status-badge'
import { CheckSquare, Clock, ArrowRight, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { fetchProfile, getStoredUser, getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

function formatDate(d: string) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTime(d: string) {
  if (!d) return ''
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export default function FacultyDashboard() {
  const { t } = useI18n()
  const [user, setUser] = useState<any>(null)
  const [pending, setPending] = useState<any[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [allRequests, setAllRequests] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      const storedUser = getStoredUser()
      const token = getToken()
      if (!storedUser || !token) {
        setIsLoading(false)
        return
      }

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const headers = { Authorization: `Bearer ${token}` }

      try {
        const [profile, pendingRes, allRes, eventsRes] = await Promise.all([
          fetchProfile(),
          fetch(`${backendUrl}/faculty/requests/pending`, { headers }),
          fetch(`${backendUrl}/faculty/requests/all`, { headers }),
          fetch(`${backendUrl}/faculty/calendar/events`, { headers }),
        ])

        setUser(profile)
        if (pendingRes.ok) setPending(await pendingRes.json())
        if (allRes.ok) setAllRequests(await allRes.json())

        if (eventsRes.ok) {
          const events = await eventsRes.json()
          const today = new Date()
          const todaysEvents = events.filter((e: any) => {
            const eDate = new Date(e.startDate)
            return eDate.getDate() === today.getDate()
              && eDate.getMonth() === today.getMonth()
              && eDate.getFullYear() === today.getFullYear()
          })
          setAppointments(todaysEvents)
        }
      } catch (error) {
        console.error('Dashboard fetch failed:', error)
      } finally {
        setIsLoading(false)
      }
    }

    void fetchDashboardData()
  }, [])

  if (isLoading) {
    return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>
  }

  if (!user) return null

  const todayStr = new Date().toDateString()
  const approvedToday = allRequests.filter(r => r.status === 'APPROVED' && new Date(r.createdAt).toDateString() === todayStr).length
  const rejectedToday = allRequests.filter(r => r.status === 'REJECTED' && new Date(r.createdAt).toDateString() === todayStr).length

  const metrics = {
    pendingCount: pending.length,
    approvedToday,
    rejectedToday,
    avgReviewHours: 12,
  }

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
  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)))

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

  const weeklyData = [weeklyDataMap[0], weeklyDataMap[1], weeklyDataMap[2], weeklyDataMap[3], weeklyDataMap[4]]
  const title = user?.title || 'Prof.'
  const lastName = user?.lastName || user?.fullName?.split(' ').slice(-1)[0] || 'User'

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-foreground">{t('dashboard.welcome', { title, name: lastName })}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('dashboard.subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title={t('dashboard.pendingApprovals')} value={metrics.pendingCount} description={t('common.requiredAction')} icon={<CheckSquare className="size-4" />} valueClassName="text-amber-600" />
        <MetricCard title={t('dashboard.approvedToday')} value={metrics.approvedToday} icon={<CheckCircle2 className="size-4" />} trend={metrics.approvedToday > 0 ? 15 : 0} trendLabel={t('common.vsYesterday')} />
        <MetricCard title={t('dashboard.rejectedToday')} value={metrics.rejectedToday} icon={<XCircle className="size-4" />} />
        <MetricCard title={t('dashboard.avgReviewTime')} value={`${metrics.avgReviewHours}h`} description={t('common.perRequest')} icon={<Clock className="size-4" />} trend={-8} trendLabel={t('common.vsLastWeek')} />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-card border border-border rounded-lg shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">{t('dashboard.pendingApprovals')}</h2>
            <Link href="/faculty/approvals">
              <Button variant="ghost" size="sm" className="text-xs gap-1">{t('common.viewAll')} <ArrowRight className="size-3" /></Button>
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
              <p className="text-sm text-muted-foreground text-center py-8">{t('dashboard.noPending')}</p>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-card border border-border rounded-lg shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">{t('dashboard.todayAppointments')}</h2>
              <Link href="/faculty/appointments">
                <Button variant="ghost" size="sm" className="text-xs h-auto py-0.5 gap-1">
                  {t('common.view')} <ArrowRight className="size-3" />
                </Button>
              </Link>
            </div>
            <div className="divide-y divide-border">
              {appointments.slice(0, 3).map((apt) => (
                <div key={apt.id} className="px-4 py-3">
                  <p className="text-sm font-medium text-foreground">{apt.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{apt.description || t('common.noDescription')}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatTime(apt.startDate)} · {t('dashboard.officeOnline')}</p>
                </div>
              ))}
              {appointments.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">{t('dashboard.noAppointments')}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">{t('dashboard.approvalActivity')}</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={weeklyData} barSize={20} barGap={4}>
            <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} cursor={{ fill: 'oklch(0.94 0.01 264 / 0.5)' }} />
            <Bar dataKey="approved" name={t('common.approved')} fill="oklch(0.53 0.14 162)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="rejected" name={t('common.rejected')} fill="oklch(0.577 0.245 27.325)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
